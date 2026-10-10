package main

import (
	"bufio"
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const VERSION = "2.0.6"

//go:embed app.html
var appHTML []byte

//go:embed icon192.png
var icon192 []byte

//go:embed icon512.png
var icon512 []byte

//go:embed app.ico
var appICO []byte

// installable app (Chrome / Edge: "Install Data Engineer") when opened from http://localhost
const manifestJSON = `{"name":"Data Engineer","short_name":"Data Engineer","start_url":"/","display":"standalone","background_color":"#08090B","theme_color":"#E10600","icons":[{"src":"/icon-192.png","sizes":"192x192","type":"image/png"},{"src":"/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}]}`
const swJS = `self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>self.clients.claim());self.addEventListener('fetch',()=>{});`

type Config struct {
	Team    string  `json:"team"`
	ID      string  `json:"id"`
	Port    int     `json:"port"`
	Hz      float64 `json:"hz"`
	Local   bool    `json:"local"`
	Updates string  `json:"updates,omitempty"` // update channel (folder URL with version.json)
	Relay   string  `json:"relay,omitempty"`   // our team server (from version.json); empty = MQTT
}

func (c *Config) updBase() string {
	if c.Updates != "" {
		return c.Updates
	}
	return DefaultUpdates
}

func cfgPath() string {
	exe, err := os.Executable()
	if err != nil {
		return "databridge.json"
	}
	return filepath.Join(filepath.Dir(exe), "databridge.json")
}

func loadCfg() *Config {
	c := &Config{Port: 8790, Hz: 4, Local: true}
	if b, err := os.ReadFile(cfgPath()); err == nil {
		json.Unmarshal(b, c)
	}
	if c.ID == "" {
		b := make([]byte, 6)
		rand.Read(b)
		c.ID = hex.EncodeToString(b)
	}
	if c.Hz <= 0 || c.Hz > 10 {
		c.Hz = 4
	}
	if c.Port == 0 {
		c.Port = 8790
	}
	return c
}
func (c *Config) save() {
	b, _ := json.MarshalIndent(c, "", "  ")
	os.WriteFile(cfgPath(), b, 0644)
}

// ---------- local live feed (Server-Sent Events) ----------
type Hub struct {
	mu      sync.Mutex
	subs    map[chan []byte]bool
	last    map[string][]byte // retained state for new viewers
	recDirs func() []string
	cfg     *Config
	relay   string // team server in use ("" = MQTT)
}

func (h *Hub) send(kind string, js []byte, retain bool) {
	msg := []byte(`{"k":"` + kind + `","d":` + string(js) + `}`)
	h.mu.Lock()
	if retain {
		h.last[kind] = msg
	}
	for c := range h.subs {
		select {
		case c <- msg:
		default:
		}
	}
	h.mu.Unlock()
}

func (h *Hub) serve(port int, id string) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		b, _ := servedApp()
		w.Write(b)
	})
	mux.HandleFunc("/version", func(w http.ResponseWriter, r *http.Request) {
		_, av := servedApp()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(M{"bridge": VERSION, "app": av, "updates": h.cfg.updBase(), "relay": h.relay})
	})
	mux.HandleFunc("/update", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			http.Error(w, "POST", http.StatusMethodNotAllowed)
			return
		}
		if u := r.URL.Query().Get("channel"); u != "" {
			if !strings.HasPrefix(u, "https://") {
				json.NewEncoder(w).Encode(M{"ok": false, "error": "il canale deve iniziare con https://"})
				return
			}
			h.cfg.Updates = u
			h.cfg.save()
		}
		if r.URL.Query().Get("apply") != "1" {
			rm, err := fetchRemote(h.cfg.updBase())
			if err != nil {
				json.NewEncoder(w).Encode(M{"ok": false, "error": err.Error()})
				return
			}
			_, av := servedApp()
			json.NewEncoder(w).Encode(M{"ok": true, "remote": rm, "bridge": VERSION, "app": av})
			return
		}
		rm, changed, err := applyUpdate(h.cfg.updBase())
		if err != nil {
			json.NewEncoder(w).Encode(M{"ok": false, "error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(M{"ok": true, "version": rm.Version, "restart": changed})
		if changed {
			go func() { time.Sleep(time.Second); restart() }()
		}
	})
	static := func(path, ctype string, b []byte) {
		mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", ctype)
			w.Write(b)
		})
	}
	static("/manifest.json", "application/manifest+json", []byte(manifestJSON))
	static("/sw.js", "text/javascript", []byte(swJS))
	static("/icon-192.png", "image/png", icon192)
	static("/icon-512.png", "image/png", icon512)
	static("/favicon.ico", "image/x-icon", appICO)
	mux.HandleFunc("/sessions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		var dirs []string
		if h.recDirs != nil {
			dirs = h.recDirs()
		}
		name := r.URL.Query().Get("name")
		if name == "" {
			list := listRecordings(dirs...)
			for _, x := range list {
				delete(x, "dir")
			}
			json.NewEncoder(w).Encode(list)
			return
		}
		if strings.ContainsAny(name, `/\:`) || !strings.HasSuffix(name, ".de.json") {
			http.NotFound(w, r)
			return
		}
		for _, d := range dirs {
			if b, err := os.ReadFile(filepath.Join(d, name)); err == nil {
				w.Write(b)
				return
			}
		}
		http.NotFound(w, r)
	})
	// status for the app (what the console window used to show) and a clean exit
	mux.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		st := appStatus.get()
		out := M{}
		for k, v := range st {
			out[k] = v
		}
		out["version"] = VERSION
		out["log"] = logTail(40)
		out["gui"] = !hasConsole()
		json.NewEncoder(w).Encode(out)
	})
	mux.HandleFunc("/quit", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			http.Error(w, "POST json", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true}`))
		go func() { time.Sleep(300 * time.Millisecond); closeWindow(); quitFn() }()
	})
	// team code of this bridge: the app (http://localhost:8790) can change or remove it
	mux.HandleFunc("/team", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		if r.Method == http.MethodGet {
			name := ""
			if t, err := parseTeam(h.cfg.Team); err == nil && t != nil {
				name = t.Name
			}
			json.NewEncoder(w).Encode(M{"team": h.cfg.Team != "", "name": name})
			return
		}
		if r.Method != http.MethodPost || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			http.Error(w, "POST json", http.StatusBadRequest)
			return
		}
		var q struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 8<<10)).Decode(&q); err != nil {
			http.Error(w, "json", http.StatusBadRequest)
			return
		}
		q.Code = strings.TrimSpace(q.Code)
		if q.Code != "" {
			if _, err := parseTeam(q.Code); err != nil {
				json.NewEncoder(w).Encode(M{"ok": false, "error": err.Error()})
				return
			}
		}
		h.cfg.Team = q.Code
		h.cfg.save()
		json.NewEncoder(w).Encode(M{"ok": true})
		go func() { time.Sleep(600 * time.Millisecond); setTeamRestart(q.Code) }()
	})
	// overlay control ("regia"): the app posts the state of the broadcast graphics,
	// every overlay page (OBS) gets it on /live. JSON only, so other web pages cannot post here.
	mux.HandleFunc("/ovc", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			http.Error(w, "POST json", http.StatusBadRequest)
			return
		}
		b, err := io.ReadAll(io.LimitReader(r.Body, 64<<10))
		if err != nil || !json.Valid(b) {
			http.Error(w, "json", http.StatusBadRequest)
			return
		}
		h.send("ovc", b, true)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true}`))
	})
	mux.HandleFunc("/live", func(w http.ResponseWriter, r *http.Request) {
		fl, ok := w.(http.Flusher)
		if !ok {
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		c := make(chan []byte, 32)
		fmt.Fprintf(w, "data: {\"k\":\"id\",\"d\":%q}\n\n", id)
		h.mu.Lock()
		h.subs[c] = true
		for _, m := range h.last {
			fmt.Fprintf(w, "data: %s\n\n", m)
		}
		h.mu.Unlock()
		fl.Flush()
		defer func() { h.mu.Lock(); delete(h.subs, c); h.mu.Unlock() }()
		tick := time.NewTicker(15 * time.Second)
		defer tick.Stop()
		for {
			select {
			case <-r.Context().Done():
				return
			case m := <-c:
				fmt.Fprintf(w, "data: %s\n\n", m)
				fl.Flush()
			case <-tick.C:
				fmt.Fprint(w, ": ping\n\n")
				fl.Flush()
			}
		}
	})
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return err
	}
	go http.Serve(ln, mux)
	return nil
}

// version of a bridge already answering on the port ("" if none)
func otherBridge(port int) string {
	c := &http.Client{Timeout: 800 * time.Millisecond}
	r, err := c.Get(fmt.Sprintf("http://127.0.0.1:%d/version", port))
	if err != nil {
		return ""
	}
	defer r.Body.Close()
	var v struct {
		Bridge string `json:"bridge"`
	}
	if json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&v) != nil || v.Bridge == "" {
		return "" // something else on the port: not a bridge
	}
	return v.Bridge
}

// a new team code: the bridge restarts so every connection uses it
func setTeamRestart(code string) {
	if code == "" {
		fmt.Println("\n  Codice squadra tolto: il Muretto funziona solo su questo PC. Riavvio…")
	} else {
		fmt.Println("\n  Nuovo codice squadra salvato. Riavvio…")
	}
	if runtime.GOOS == "windows" {
		restart()
	}
	fmt.Println("  Chiudi e riapri il bridge.")
}

func ask(prompt string) string {
	fmt.Print(prompt)
	s, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	return strings.TrimSpace(s)
}

func main() {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("\nErrore:", r)
			if !hasConsole() {
				msgBox("Data Engineer", fmt.Sprint("Errore: ", r, "\n\nDettagli in ", appDataDir(), "\\bridge.log"))
				return
			}
			ask("Premi Invio per chiudere.")
		}
	}()
	runtime.GOMAXPROCS(2)
	lowPriority()
	demo := flag.Bool("demo", false, "simula una gara (per prove senza LMU)")
	teamF := flag.String("team", "", "codice squadra")
	setup := flag.Bool("setup", false, "reinserisci il codice squadra")
	brokerOverride := flag.String("broker", "", "solo per prove: host:porta senza TLS")
	speed := flag.Float64("speed", 1, "")
	demoSesF := flag.Int("session", 10, "")
	updF := flag.String("updates", "", "canale aggiornamenti (URL)")
	restarted := flag.Bool("restarted", false, "")
	relayF := flag.String("relay", "", "solo per prove: indirizzo del server della squadra")
	winF := flag.Bool("window", false, "apri la finestra dell'app anche con la console")
	noWinF := flag.Bool("nowindow", false, "non aprire la finestra dell'app")
	flag.Parse()
	demoSpeed = *speed
	demoSes = *demoSesF
	cfg := loadCfg()
	if *teamF != "" {
		cfg.Team = *teamF
	}
	gui := !hasConsole() // started as a windows app: no console, the app window shows everything
	if gui {
		startLog()
	}
	fmt.Println("==============================================")
	fmt.Println("  Data Engineer " + VERSION)
	fmt.Println("==============================================")
	url := fmt.Sprintf("http://localhost:%d/", cfg.Port)
	// only one per PC: a second one would fight the first for the server and the port.
	// Opening the app again just shows the window of the one already running.
	if !*demo {
		other := otherBridge(cfg.Port)
		for i := 0; other != "" && *restarted && i < 40; i++ { // after an update the old one is closing
			time.Sleep(250 * time.Millisecond)
			other = otherBridge(cfg.Port)
		}
		if other != "" {
			if gui || *winF {
				// one app at a time: show the window already open (a new one only if it was closed)
				if !focusAppWindow() {
					openAppWindow(url)
				}
				return
			}
			fmt.Printf("\nC'è già un Data Engineer aperto su questo PC (versione %s).\n", other)
			fmt.Println("Usa quello, oppure chiudi la sua finestra e riapri questo.")
			ask("Premi Invio per chiudere.")
			return
		}
	}
	if ((cfg.Team == "" && !*demo) || *setup) && !gui {
		fmt.Println("Incolla il codice squadra (lo crea l'ingegnere nella scheda Muretto di Data Engineer).")
		fmt.Println("Premi solo Invio per usare il Muretto solo su questo PC.")
		for {
			code := ask("> ")
			if code == "" {
				cfg.Team = ""
				break
			}
			if _, err := parseTeam(code); err != nil {
				fmt.Println("  " + err.Error() + ": riprova.")
				continue
			}
			cfg.Team = code
			break
		}
	}
	if *updF != "" {
		cfg.Updates = *updF
	}
	cfg.save()
	cleanupOld()
	// the local page first (so a second launch finds us), then the window, then updates
	hub := &Hub{subs: map[chan []byte]bool{}, last: map[string][]byte{}, cfg: cfg}
	if err := hub.serve(cfg.Port, cfg.ID); err != nil {
		fmt.Printf("ATTENZIONE: la porta %d è già usata, di solito da un altro bridge ancora aperto (magari una versione vecchia).\n", cfg.Port)
		fmt.Println("Chiudi tutte le finestre del bridge e riapri solo questa: altrimenti " + url + " mostra la pagina del bridge vecchio.")
		if gui {
			msgBox("Data Engineer", "La porta "+fmt.Sprint(cfg.Port)+" è già usata da un altro programma (forse un bridge vecchio ancora aperto).\nChiudilo e riapri Data Engineer.")
		}
	} else {
		fmt.Printf("Muretto su questo PC:  %s\n", url)
	}
	if (gui || *winF) && !*noWinF {
		startWindow(url)
	}
	if !*demo && cfg.updBase() != "" {
		fmt.Println("Controllo aggiornamenti…")
		rm, changed, err := applyUpdate(cfg.updBase())
		if rm != nil && rm.Relay != nil && *rm.Relay != cfg.Relay {
			cfg.Relay = *rm.Relay
			cfg.save()
		}
		if err != nil {
			fmt.Println("  aggiornamenti non disponibili ora:", err)
		} else if changed {
			fmt.Printf("  Aggiornato alla versione %s: riavvio…\n", rm.Version)
			restart()
		} else if newer(rm.Version, VERSION) {
			fmt.Printf("  App aggiornata alla versione %s.\n", rm.Version)
		} else {
			fmt.Println("  Già all'ultima versione.")
		}
	}

	var team *Team
	var mq Link
	if cfg.Team != "" {
		t, err := parseTeam(cfg.Team)
		if err != nil {
			fmt.Println("Codice squadra non valido: cambialo da Muretto › Squadra.")
		} else {
			team = t
		}
	}
	if !*demo && !gui {
		fmt.Println("Per cambiare squadra: incolla qui il nuovo codice e premi Invio (scrivi 0 e Invio per toglierlo).")
		go func() {
			rd := bufio.NewReader(os.Stdin)
			for {
				line, err := rd.ReadString('\n')
				if err != nil {
					return
				}
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}
				if line == "0" {
					cfg.Team = ""
					cfg.save()
					setTeamRestart("")
					continue
				}
				if _, err := parseTeam(line); err != nil {
					fmt.Println("\n  Codice non valido: " + err.Error())
					continue
				}
				cfg.Team = line
				cfg.save()
				setTeamRestart(line)
			}
		}()
	}
	base := ""
	pubKind := func(kind string, v any, retain bool) {
		if m, ok := v.(M); ok {
			m["t"] = time.Now().UnixMilli() // lets viewers recognise old retained data
		}
		js, _ := json.Marshal(v)
		hub.send(kind, js, retain)
		if mq != nil {
			mq.Publish(base+kind, team.seal(js), retain)
		}
	}
	if team != nil {
		base = "de/" + team.Topic + "/" + cfg.ID + "/"
		host, port, tlsOn := team.Host, team.TPort, team.useTLS()
		if *brokerOverride != "" {
			h, p, _ := net.SplitHostPort(*brokerOverride)
			host, tlsOn = h, false
			fmt.Sscan(p, &port)
		}
		off, _ := json.Marshal(M{"id": cfg.ID, "on": false})
		// the Regia's overlay state (from any PC of the team) goes to the OBS pages on this PC
		regia := "de/" + team.Topic + "/regia/ovc"
		onMsg := func(topic string, p []byte) {
			if topic != regia {
				return
			}
			if js, err := team.open(p); err == nil && json.Valid(js) {
				hub.send("ovc", js, true)
			}
		}
		// a client id of its own for every run: two bridges open with the same settings
		// must not keep kicking each other off the server
		rid := make([]byte, 3)
		rand.Read(rid)
		relay := cfg.Relay
		if team.R != "" {
			relay = team.R
		}
		if *relayF != "" {
			relay = *relayF
		}
		if relay != "" && *brokerOverride == "" {
			if rl, err := newRelay(relay, team.Topic, base+"hi", team.seal(off), "regia", onMsg); err == nil {
				mq, hub.relay = rl, relay
				fmt.Printf("Squadra: %s (server Data Engineer)\n", nz(team.Name, team.Topic[:6]))
			} else {
				fmt.Println("Server della squadra non valido:", err)
			}
		}
		if mq == nil {
			mq = newMQTT(host, port, tlsOn, team.User, team.Pass, "de-"+cfg.ID+"-"+hex.EncodeToString(rid), base+"hi", team.seal(off), []string{regia}, onMsg)
			fmt.Printf("Squadra: %s (server %s)\n", nz(team.Name, team.Topic[:6]), host)
		}
	}
	// clean exit (app window closed, "Esci" in the app): tell the team we are offline
	quitFn = func() {
		if mq != nil && team != nil {
			off, _ := json.Marshal(M{"id": cfg.ID, "on": false, "t": time.Now().UnixMilli()})
			mq.Close(base+"hi", team.seal(off))
		}
		os.Exit(0)
	}
	if gui {
		fmt.Println("Non rallenta il gioco: legge pochi KB e gira a priorità bassa. Chiudendo la finestra di Data Engineer si ferma.")
	} else {
		fmt.Println("Chiudi questa finestra per fermare il bridge. Non rallenta il gioco: legge pochi KB e gira a priorità bassa.")
	}
	fmt.Println()

	var shm []byte
	var closeShm func()
	if *demo {
		shm = startDemo()
		fmt.Println("MODALITÀ DEMO: dati simulati.")
	}
	tr := &Tracker{}
	fd := newField()
	rec := &Recorder{}
	rs := &RestState{demo: *demo}
	go rs.loop()
	hub.recDirs = func() []string {
		var d []string
		if rec.dir != "" {
			d = append(d, rec.dir)
		}
		return append(d, recDir(shm), recDir(nil))
	}
	var lastFl, lastField, lastRec, lastPit time.Time
	lastPitJS, lastWxJS, lastStream, lastStdJS, lastSetupJS := "", "", "", "", ""
	var lastScMsg M
	tick := time.NewTicker(100 * time.Millisecond)
	carEvery := time.Duration(float64(time.Second) / cfg.Hz)
	var lastCar, lastSc, lastHi, lastOpen, lastStatus, lastMove time.Time
	lastET := -1.0
	hiState := ""
	connected := false
	tickN := 0
	var prevFull *Frame
	lastScET := -1.0
	for now := range tick.C {
		if shm == nil {
			if now.Sub(lastOpen) > 2*time.Second {
				lastOpen = now
				shm, closeShm = openShm()
				lastMove = now
			}
		}
		var f *Frame
		// the whole field is copied at 5 Hz (the game's scoring rate); our own car at 10 Hz
		full := tickN%2 == 0 || prevFull == nil
		tickN++
		if shm != nil {
			f, _ = readFrame(shm, full)
			if f != nil {
				if full {
					prevFull = f
				} else {
					f.Veh, f.AllTel = prevFull.Veh, prevFull.AllTel
				}
			}
		}
		if f != nil {
			et := f64(f.Info, I_mCurrentET)
			if et != lastET {
				lastET = et
				lastMove = now
			}
			if !*demo && now.Sub(lastMove) > 6*time.Second && closeShm != nil {
				// game closed or paused: reopen to find out
				closeShm()
				shm, closeShm, f = nil, nil, nil
			}
		}
		connected = f != nil && now.Sub(lastMove) < 3*time.Second
		if connected {
			key := cstr(f.Info, I_mTrackName, 64) + "|" + itoa(i32(f.Info, I_mSession))
			if tr.sesKey != "" && key != tr.sesKey {
				rec.save(tr, fd, lastScMsg, nil, nil) // close the previous session file
			}
			tr.update(f)
			if full {
				fd.std = rs.standings()
				fd.update(f, tr.sesKey, now)
			}
			// our car under the same key the standings use (unique when two cars share a name)
			if pr := playerRow(f); pr != nil && len(fd.keys) > 0 {
				tr.car = fd.keyOf(pr)
			}
			rec.sample(f, tr.sesKey, shm)
			rs.mu.Lock()
			rs.on, rs.ses = tr.driving, i32(f.Info, I_mSession)
			rs.mu.Unlock()
			if now.Sub(lastFl) >= 2*time.Second {
				lastFl = now
				if st := readStream(shm); st != lastStream {
					lastStream = st
					if lines := fd.addStream(st); len(lines) > 0 {
						pubKind("stl", M{"ses": fd.ses, "l": lines}, false)
					}
				}
				if ch := fd.takeChanges(); len(ch) > 0 {
					ch["ses"] = fd.ses
					pubKind("fl", ch, false)
				}
				if std := rs.standings(); std != nil {
					js, _ := json.Marshal(std)
					if string(js) != lastStdJS {
						lastStdJS = string(js)
						pubKind("rst", M{"l": std}, false)
					}
				}
			}
			if now.Sub(lastField) >= 60*time.Second || (fd.dirty && now.Sub(lastField) >= 20*time.Second) {
				fd.dirty = false
				lastField = now
				// refresh the retained car data too, so viewers can tell live data from old
				lastPitJS, lastWxJS, lastSetupJS = "", "", ""
				pubKind("laps", M{"car": tr.car, "cls": tr.cls, "ses": tr.sesKey, "laps": tr.laps}, true)
				pubKind("ev", M{"car": tr.car, "list": tr.events}, true)
				snap := fd.snapshot(60)
				snap["stream"] = lastN(fd.stream, 300)
				pubKind("field", snap, true)
			}
			if now.Sub(lastPit) >= 2*time.Second {
				lastPit = now
				if st := rs.getSetup(); st != nil && tr.car != "" {
					js, _ := json.Marshal(st)
					if string(js) != lastSetupJS {
						lastSetupJS = string(js)
						pubKind("setup", M{"car": tr.car, "drv": tr.driver, "v": st}, true)
					}
				}
				p, w := rs.get()
				if p != nil && tr.driving {
					p["car"] = tr.car
					js, _ := json.Marshal(p)
					if string(js) != lastPitJS {
						lastPitJS = string(js)
						pubKind("pit", p, true)
					}
				}
				if w != nil {
					js, _ := json.Marshal(w)
					if string(js) != lastWxJS {
						lastWxJS = string(js)
						pubKind("wx", w, true)
					}
				}
			}
			if now.Sub(lastRec) >= 60*time.Second {
				lastRec = now
				p, w := rs.get()
				rec.save(tr, fd, lastScMsg, p, w)
			}
			if tr.driving && now.Sub(lastCar) >= carEvery {
				lastCar = now
				pubKind("car", tr.carMsg(f), false)
			}
			// the standings once a second, also when nobody of ours is driving (engineers watch them)
			scEvery := time.Second
			if scET := f64(f.Info, I_mCurrentET); now.Sub(lastSc) >= scEvery && (scET != lastScET || now.Sub(lastSc) >= 10*time.Second) {
				lastSc, lastScET = now, scET
				lastScMsg = scMsg(f, fd, rs.standings())
				pubKind("sc", lastScMsg, true)
			}
			if tr.changed {
				tr.changed = false
				pubKind("laps", M{"car": tr.car, "cls": tr.cls, "ses": tr.sesKey, "laps": tr.laps}, true)
				pubKind("ev", M{"car": tr.car, "list": tr.events}, true)
			}
		}
		st := fmt.Sprint(connected, tr.driving, tr.car, tr.driver)
		if st != hiState || now.Sub(lastHi) > 20*time.Second {
			hiState = st
			lastHi = now
			name := tr.driver
			if name == "" && f != nil {
				name = cstr(f.Info, I_mPlayerName, 32)
			}
			pubKind("hi", M{"id": cfg.ID, "on": true, "lmu": connected, "drv": tr.driving, "name": name, "car": tr.car, "cls": tr.cls, "ses": tr.sesKey, "ver": VERSION, "t": now.Unix()}, true)
		}
		if now.Sub(lastStatus) >= time.Second {
			lastStatus = now
			s := "LMU: non trovato (avvia il gioco · in LMU attiva Impostazioni > Gameplay > Enable Plugins)"
			if connected {
				s = "LMU: collegato"
				if tr.driving && tr.lap != nil {
					s += fmt.Sprintf(" · in auto (%s) giro %d", tr.driver, tr.lap.n+1)
				} else {
					s += " · non in auto"
				}
			} else if shm != nil {
				s = "LMU: in pausa / menu"
			}
			if mq != nil {
				if up, sent, e := mq.Status(); up {
					s += fmt.Sprintf(" | squadra: online · %d KB inviati", sent/1024)
				} else if e != "" {
					s += " | squadra: riconnessione…"
				} else {
					s += " | squadra: connessione…"
				}
			}
			{
				st := M{"lmu": connected, "driving": tr.driving, "driver": tr.driver, "line": s, "team": team != nil, "relay": hub.relay != ""}
				if tr.driving && tr.lap != nil {
					st["lap"] = tr.lap.n + 1
				}
				if team != nil {
					st["teamName"] = team.Name
				}
				if mq != nil {
					up, sent, e := mq.Status()
					st["up"], st["sent"], st["err"] = up, sent, e
				}
				appStatus.set(st)
			}
			setTitle("Data Engineer Bridge · " + s)
			fmt.Printf("\r%-118s", s)
		}
	}
}

func lastN(a []string, n int) []string {
	if len(a) > n {
		return a[len(a)-n:]
	}
	return a
}

func nz(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
