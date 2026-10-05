package main

import (
	"bufio"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

// Minimal MQTT 3.1.1 publisher (QoS 0, retained messages, last will).
// Publishing never blocks the reader: messages go through a buffered channel
// and are dropped if the network is slow.
type MQTT struct {
	host     string
	port     int
	tls      bool
	user     string
	pass     string
	clientID string
	willT    string
	willP    []byte
	out      chan pub
	mu       sync.Mutex
	retained map[string][]byte
	Up       atomic.Bool
	Sent     atomic.Int64
	Err      atomic.Value
	stop     chan struct{}
	subs     []string                     // topics to receive (the Regia's overlay state)
	onMsg    func(topic string, p []byte) // called for every message received
}

type pub struct {
	topic   string
	payload []byte
	retain  bool
}

func newMQTT(host string, port int, useTLS bool, user, pass, id, willT string, willP []byte, subs []string, onMsg func(string, []byte)) *MQTT {
	m := &MQTT{host: host, port: port, tls: useTLS, user: user, pass: pass, clientID: id, willT: willT, willP: willP,
		out: make(chan pub, 64), retained: map[string][]byte{}, stop: make(chan struct{}), subs: subs, onMsg: onMsg}
	m.Err.Store("")
	go m.loop()
	return m
}

func (m *MQTT) Publish(topic string, p []byte, retain bool) {
	if retain {
		m.mu.Lock()
		m.retained[topic] = p
		m.mu.Unlock()
	}
	select {
	case m.out <- pub{topic, p, retain}:
	default: // network behind: drop, the next update replaces it
	}
}

func (m *MQTT) Close(lastT string, lastP []byte) {
	select {
	case m.out <- pub{lastT, lastP, true}:
	default:
	}
	time.Sleep(300 * time.Millisecond)
	close(m.stop)
}

func remLen(n int) []byte {
	var b []byte
	for {
		d := byte(n % 128)
		n /= 128
		if n > 0 {
			d |= 0x80
		}
		b = append(b, d)
		if n == 0 {
			return b
		}
	}
}
func mstr(s []byte) []byte { return append([]byte{byte(len(s) >> 8), byte(len(s))}, s...) }
func packet(h byte, body []byte) []byte {
	return append(append([]byte{h}, remLen(len(body))...), body...)
}

func (m *MQTT) connectPkt() []byte {
	flags := byte(0x02)
	body := append(mstr([]byte("MQTT")), 4)
	pl := mstr([]byte(m.clientID))
	if m.willT != "" {
		flags |= 0x04 | 0x20
		pl = append(pl, mstr([]byte(m.willT))...)
		pl = append(pl, mstr(m.willP)...)
	}
	if m.user != "" {
		flags |= 0x80
		pl = append(pl, mstr([]byte(m.user))...)
		if m.pass != "" {
			flags |= 0x40
			pl = append(pl, mstr([]byte(m.pass))...)
		}
	}
	body = append(body, flags, 0, 30)
	return packet(0x10, append(body, pl...))
}

func pubPkt(p pub) []byte {
	h := byte(0x30)
	if p.retain {
		h |= 1
	}
	return packet(h, append(mstr([]byte(p.topic)), p.payload...))
}

func (m *MQTT) dial() (net.Conn, error) {
	addr := net.JoinHostPort(m.host, fmt.Sprint(m.port))
	d := &net.Dialer{Timeout: 8 * time.Second}
	if m.tls {
		return tls.DialWithDialer(d, "tcp", addr, &tls.Config{ServerName: m.host})
	}
	return d.Dial("tcp", addr)
}

func (m *MQTT) session() error {
	c, err := m.dial()
	if err != nil {
		return err
	}
	defer c.Close()
	c.SetDeadline(time.Now().Add(10 * time.Second))
	if _, err := c.Write(m.connectPkt()); err != nil {
		return err
	}
	r := bufio.NewReader(c)
	ack := make([]byte, 4)
	if _, err := io.ReadFull(r, ack); err != nil {
		return err
	}
	if ack[0] != 0x20 || ack[3] != 0 {
		return fmt.Errorf("il server ha rifiutato la connessione (codice %d)", ack[3])
	}
	c.SetDeadline(time.Time{})
	m.Up.Store(true)
	m.Err.Store("")
	defer m.Up.Store(false)
	write := func(b []byte) error {
		c.SetWriteDeadline(time.Now().Add(6 * time.Second))
		_, err := c.Write(b)
		if err == nil {
			m.Sent.Add(int64(len(b)))
		}
		return err
	}
	for len(m.out) > 0 { // drop what queued up while offline
		<-m.out
	}
	m.mu.Lock()
	for t, p := range m.retained {
		if err := write(pubPkt(pub{t, p, true})); err != nil {
			m.mu.Unlock()
			return err
		}
	}
	m.mu.Unlock()
	if len(m.subs) > 0 && m.onMsg != nil {
		body := []byte{0, 1}
		for _, t := range m.subs {
			body = append(body, mstr([]byte(t))...)
			body = append(body, 0)
		}
		if err := write(packet(0x82, body)); err != nil {
			return err
		}
	}
	dead := make(chan error, 1)
	go func() { // read packets: PINGRESP, SUBACK, and PUBLISH for the subscriptions
		for {
			c.SetReadDeadline(time.Now().Add(70 * time.Second))
			h, err := r.ReadByte()
			if err != nil {
				dead <- err
				return
			}
			n, mul := 0, 1
			for i := 0; i < 4; i++ {
				b, err := r.ReadByte()
				if err != nil {
					dead <- err
					return
				}
				n += int(b&127) * mul
				mul *= 128
				if b&128 == 0 {
					break
				}
			}
			if n > 1<<20 {
				dead <- errors.New("pacchetto troppo grande")
				return
			}
			body := make([]byte, n)
			if _, err := io.ReadFull(r, body); err != nil {
				dead <- err
				return
			}
			if h>>4 == 3 && len(body) >= 2 && m.onMsg != nil {
				tl := int(body[0])<<8 | int(body[1])
				off := 2 + tl
				if (h>>1)&3 > 0 {
					off += 2
				}
				if off <= len(body) {
					m.onMsg(string(body[2:2+tl]), body[off:])
				}
			}
		}
	}()
	ping := time.NewTicker(20 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-m.stop:
			write([]byte{0xE0, 0})
			return nil
		case err := <-dead:
			return err
		case <-ping.C:
			if err := write([]byte{0xC0, 0}); err != nil {
				return err
			}
		case p := <-m.out:
			if err := write(pubPkt(p)); err != nil {
				return err
			}
		}
	}
}

func (m *MQTT) loop() {
	wait := time.Second
	for {
		start := time.Now()
		err := m.session()
		select {
		case <-m.stop:
			return
		default:
		}
		if err == nil {
			err = errors.New("disconnesso")
		}
		m.Err.Store(err.Error())
		if time.Since(start) > 30*time.Second {
			wait = time.Second
		}
		time.Sleep(wait)
		if wait < 8*time.Second {
			wait *= 2
		}
	}
}
