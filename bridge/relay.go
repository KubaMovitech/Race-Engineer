package main

import (
	"bufio"
	"crypto/rand"
	"crypto/sha1"
	"crypto/tls"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Link is the team connection: our relay (WebSocket) or an MQTT server.
type Link interface {
	Publish(topic string, p []byte, retain bool)
	Close(lastT string, lastP []byte)
	Status() (up bool, sent int64, err string)
}

func (m *MQTT) Status() (bool, int64, string) {
	e, _ := m.Err.Load().(string)
	return m.Up.Load(), m.Sent.Load(), e
}

// Relay: client of the Data Engineer relay (server/src/index.js). Same topics and
// encrypted payloads as MQTT; several messages travel in one WebSocket frame.
type Relay struct {
	u        *url.URL
	room     string
	willT    string
	willP    []byte
	out      chan pub
	mu       sync.Mutex
	retained map[string][]byte
	up       atomic.Bool
	sent     atomic.Int64
	err      atomic.Value
	stop     chan struct{}
	onMsg    func(topic string, p []byte)
	sub      string
}

func newRelay(base, room, willT string, willP []byte, sub string, onMsg func(string, []byte)) (*Relay, error) {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	base = strings.Replace(strings.Replace(base, "https://", "wss://", 1), "http://", "ws://", 1)
	u, err := url.Parse(base + "/ws")
	if err != nil || (u.Scheme != "wss" && u.Scheme != "ws") || u.Host == "" {
		return nil, errors.New("indirizzo del server non valido")
	}
	q := u.Query()
	q.Set("room", room)
	q.Set("sub", sub)
	q.Set("v", "1")
	u.RawQuery = q.Encode()
	r := &Relay{u: u, room: room, willT: willT, willP: willP, out: make(chan pub, 128), retained: map[string][]byte{}, stop: make(chan struct{}), onMsg: onMsg, sub: sub}
	r.err.Store("")
	go r.loop()
	return r, nil
}

func (r *Relay) Status() (bool, int64, string) {
	e, _ := r.err.Load().(string)
	return r.up.Load(), r.sent.Load(), e
}

func (r *Relay) Publish(topic string, p []byte, retain bool) {
	if retain {
		r.mu.Lock()
		r.retained[topic] = p
		r.mu.Unlock()
	}
	select {
	case r.out <- pub{topic, p, retain}:
	default:
	}
}

func (r *Relay) Close(lastT string, lastP []byte) {
	select {
	case r.out <- pub{lastT, lastP, true}:
	default:
	}
	time.Sleep(300 * time.Millisecond)
	close(r.stop)
}

func relayRec(typ, flags byte, topic string, p []byte) []byte {
	b := make([]byte, 8, 8+len(topic)+len(p))
	b[0], b[1] = typ, flags
	binary.BigEndian.PutUint16(b[2:], uint16(len(topic)))
	binary.BigEndian.PutUint32(b[4:], uint32(len(p)))
	b = append(b, topic...)
	return append(b, p...)
}

// ---- minimal WebSocket (RFC 6455) client ----
type wsConn struct {
	c  net.Conn
	r  *bufio.Reader
	wm sync.Mutex
}

func wsDial(u *url.URL) (*wsConn, error) {
	host := u.Host
	if u.Port() == "" {
		if u.Scheme == "wss" {
			host += ":443"
		} else {
			host += ":80"
		}
	}
	d := &net.Dialer{Timeout: 8 * time.Second}
	var c net.Conn
	var err error
	if u.Scheme == "wss" {
		c, err = tls.DialWithDialer(d, "tcp", host, &tls.Config{ServerName: u.Hostname()})
	} else {
		c, err = d.Dial("tcp", host)
	}
	if err != nil {
		return nil, err
	}
	kb := make([]byte, 16)
	rand.Read(kb)
	key := base64.StdEncoding.EncodeToString(kb)
	c.SetDeadline(time.Now().Add(10 * time.Second))
	req := "GET " + u.RequestURI() + " HTTP/1.1\r\nHost: " + u.Host + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: " + key +
		"\r\nSec-WebSocket-Version: 13\r\nUser-Agent: DataEngineerBridge/" + VERSION + "\r\n\r\n"
	if _, err := c.Write([]byte(req)); err != nil {
		c.Close()
		return nil, err
	}
	br := bufio.NewReader(c)
	status, err := br.ReadString('\n')
	if err != nil {
		c.Close()
		return nil, err
	}
	if !strings.Contains(status, " 101") {
		c.Close()
		return nil, fmt.Errorf("il server ha risposto: %s", strings.TrimSpace(status))
	}
	h := sha1.Sum([]byte(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	want := base64.StdEncoding.EncodeToString(h[:])
	ok := false
	for {
		ln, err := br.ReadString('\n')
		if err != nil {
			c.Close()
			return nil, err
		}
		ln = strings.TrimSpace(ln)
		if ln == "" {
			break
		}
		if i := strings.IndexByte(ln, ':'); i > 0 && strings.EqualFold(ln[:i], "Sec-WebSocket-Accept") && strings.TrimSpace(ln[i+1:]) == want {
			ok = true
		}
	}
	if !ok {
		c.Close()
		return nil, errors.New("risposta del server non valida")
	}
	c.SetDeadline(time.Time{})
	return &wsConn{c: c, r: br}, nil
}

func (w *wsConn) write(op byte, p []byte) error {
	w.wm.Lock()
	defer w.wm.Unlock()
	h := []byte{0x80 | op}
	n := len(p)
	switch {
	case n < 126:
		h = append(h, 0x80|byte(n))
	case n < 65536:
		h = append(h, 0x80|126, byte(n>>8), byte(n))
	default:
		h = append(h, 0x80|127)
		var l [8]byte
		binary.BigEndian.PutUint64(l[:], uint64(n))
		h = append(h, l[:]...)
	}
	var mk [4]byte
	rand.Read(mk[:])
	h = append(h, mk[:]...)
	m := make([]byte, n)
	for i := range p {
		m[i] = p[i] ^ mk[i&3]
	}
	w.c.SetWriteDeadline(time.Now().Add(8 * time.Second))
	_, err := w.c.Write(append(h, m...))
	return err
}

// read one complete message (control frames handled here)
func (w *wsConn) read() (op byte, data []byte, err error) {
	var msg []byte
	var mop byte
	for {
		b0, err := w.r.ReadByte()
		if err != nil {
			return 0, nil, err
		}
		b1, err := w.r.ReadByte()
		if err != nil {
			return 0, nil, err
		}
		fin, fop := b0&0x80 != 0, b0&0x0f
		n := uint64(b1 & 0x7f)
		if n == 126 {
			var l [2]byte
			if _, err := io.ReadFull(w.r, l[:]); err != nil {
				return 0, nil, err
			}
			n = uint64(binary.BigEndian.Uint16(l[:]))
		} else if n == 127 {
			var l [8]byte
			if _, err := io.ReadFull(w.r, l[:]); err != nil {
				return 0, nil, err
			}
			n = binary.BigEndian.Uint64(l[:])
		}
		if n > 8<<20 {
			return 0, nil, errors.New("messaggio troppo grande")
		}
		var mk [4]byte
		masked := b1&0x80 != 0
		if masked {
			if _, err := io.ReadFull(w.r, mk[:]); err != nil {
				return 0, nil, err
			}
		}
		p := make([]byte, n)
		if _, err := io.ReadFull(w.r, p); err != nil {
			return 0, nil, err
		}
		if masked {
			for i := range p {
				p[i] ^= mk[i&3]
			}
		}
		switch fop {
		case 8:
			return 8, p, errors.New("chiuso dal server")
		case 9:
			w.write(10, p)
			continue
		case 10:
			continue
		case 0:
			msg = append(msg, p...)
		default:
			mop, msg = fop, p
		}
		if fin {
			return mop, msg, nil
		}
	}
}

func (r *Relay) session() error {
	ws, err := wsDial(r.u)
	if err != nil {
		return err
	}
	defer ws.c.Close()
	r.up.Store(true)
	r.err.Store("")
	defer r.up.Store(false)
	send := func(b []byte) error {
		if err := ws.write(2, b); err != nil {
			return err
		}
		r.sent.Add(int64(len(b)))
		return nil
	}
	for len(r.out) > 0 {
		<-r.out
	}
	first := relayRec(3, 1, r.willT, r.willP)
	r.mu.Lock()
	for t, p := range r.retained {
		first = append(first, relayRec(1, 1, t, p)...)
	}
	r.mu.Unlock()
	if err := send(first); err != nil {
		return err
	}
	var lastRead atomic.Int64
	lastRead.Store(time.Now().Unix())
	dead := make(chan error, 1)
	go func() {
		for {
			ws.c.SetReadDeadline(time.Now().Add(70 * time.Second))
			op, data, err := ws.read()
			if err != nil {
				dead <- err
				return
			}
			lastRead.Store(time.Now().Unix())
			if op != 2 || r.onMsg == nil {
				continue
			}
			for o := 0; o+8 <= len(data); {
				typ := data[o]
				tl := int(binary.BigEndian.Uint16(data[o+2:]))
				pl := int(binary.BigEndian.Uint32(data[o+4:]))
				o += 8
				if o+tl+pl > len(data) {
					break
				}
				if typ == 2 {
					r.onMsg(string(data[o:o+tl]), data[o+tl:o+tl+pl])
				}
				o += tl + pl
			}
		}
	}()
	ping := time.NewTicker(20 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-r.stop:
			// last messages (the "offline" hello) then a clean close
			var b []byte
			for len(r.out) > 0 {
				p := <-r.out
				b = append(b, relayRec(1, boolByte(p.retain), p.topic, p.payload)...)
			}
			if len(b) > 0 {
				send(b)
			}
			ws.write(8, []byte{3, 232})
			return nil
		case err := <-dead:
			return err
		case <-ping.C:
			if time.Now().Unix()-lastRead.Load() > 55 {
				return errors.New("nessuna risposta dal server")
			}
			if err := ws.write(1, []byte("ping")); err != nil {
				return err
			}
		case p := <-r.out:
			// batch what is waiting: fewer frames, lower cost on the server
			b := relayRec(1, boolByte(p.retain), p.topic, p.payload)
			for len(r.out) > 0 && len(b) < 700<<10 {
				q := <-r.out
				b = append(b, relayRec(1, boolByte(q.retain), q.topic, q.payload)...)
			}
			if err := send(b); err != nil {
				return err
			}
		}
	}
}

func boolByte(b bool) byte {
	if b {
		return 1
	}
	return 0
}

func (r *Relay) loop() {
	wait := time.Second
	for {
		start := time.Now()
		err := r.session()
		select {
		case <-r.stop:
			return
		default:
		}
		if err == nil {
			err = errors.New("disconnesso")
		}
		r.err.Store(err.Error())
		if time.Since(start) > 30*time.Second {
			wait = time.Second
		}
		time.Sleep(wait)
		if wait < 8*time.Second {
			wait *= 2
		}
	}
}
