package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
)

// Where the Libreria reads from, and the folder chosen by hand when the automatic search fails.
// The folder must be a Le Mans Ultimate UserData folder (it contains player\Settings or Telemetry):
// the bridge never lists or serves anything else, and only to this PC (see localOnly).

// how the UserData folder was found: "gioco" (the running game says it), "salvata" (remembered from
// last time), "ricerca" (the usual Steam folders), "manuale" (chosen in the app)
var udSource atomic.Value

func udSrc() string { s, _ := udSource.Load().(string); return s }

// a folder is usable when it has the game's setup or telemetry folder inside
func isUserData(dir string) bool {
	for _, sub := range []string{filepath.Join("player", "Settings"), "Telemetry"} {
		if st, err := os.Stat(filepath.Join(dir, sub)); err == nil && st.IsDir() {
			return true
		}
	}
	return false
}

func dirState(p string) M {
	st, err := os.Stat(p)
	return M{"dir": p, "ok": err == nil && st.IsDir()}
}

// GET /libstatus → {"ok":true,"userData":"…","source":"gioco","settings":{"dir","ok"},"telemetry":{"dir","ok"},"now":…}
func handleLibStatus(w http.ResponseWriter, r *http.Request) {
	if !localOnly(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	ud, _ := userData.Load().(string)
	m := M{"ok": true, "userData": ud, "source": udSrc(), "now": time.Now().Unix()}
	if ud != "" {
		m["settings"] = dirState(filepath.Join(ud, "player", "Settings"))
		m["telemetry"] = dirState(filepath.Join(ud, "Telemetry"))
	}
	json.NewEncoder(w).Encode(m)
}

// POST /libdir {"dir":"D:\\…\\Le Mans Ultimate\\UserData"} (JSON only: other web pages cannot send it).
// The game folder itself is accepted too and its UserData subfolder is used.
func handleLibDir(w http.ResponseWriter, r *http.Request) {
	if !localOnly(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "POST json", http.StatusBadRequest)
		return
	}
	var q struct{ Dir string }
	if err := json.NewDecoder(io.LimitReader(r.Body, 8<<10)).Decode(&q); err != nil {
		json.NewEncoder(w).Encode(M{"ok": false, "error": err.Error()})
		return
	}
	dir, err := pickUserData(q.Dir)
	if err != nil {
		json.NewEncoder(w).Encode(M{"ok": false, "error": err.Error()})
		return
	}
	userData.Store(dir)
	udSource.Store("manuale")
	rememberUserData(dir)
	json.NewEncoder(w).Encode(M{"ok": true, "userData": dir})
}

func pickUserData(in string) (string, error) {
	d := strings.Trim(strings.TrimSpace(in), `"`)
	if d == "" || len(d) > 400 {
		return "", errors.New("scrivi il percorso della cartella UserData di Le Mans Ultimate")
	}
	d = filepath.Clean(d)
	if !filepath.IsAbs(d) {
		return "", errors.New("serve il percorso completo, per esempio D:\\SteamLibrary\\steamapps\\common\\Le Mans Ultimate\\UserData")
	}
	for _, c := range []string{d, filepath.Join(d, "UserData")} {
		if isUserData(c) {
			return c, nil
		}
	}
	if st, err := os.Stat(d); err != nil || !st.IsDir() {
		return "", errors.New("cartella non trovata")
	}
	return "", errors.New("in questa cartella non ci sono player\\Settings né Telemetry: non sembra la cartella UserData di Le Mans Ultimate")
}
