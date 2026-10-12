package main

import (
	"encoding/json"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// The setup library follows the game's Settings folder by itself: the app asks for the list of
// .svm files (path, size, time) and downloads only the new or changed ones. The setups never leave
// this PC: these two endpoints answer only to this computer, never to the phone or the team.

// the UserData folder is remembered, so the library works with the game closed too
func udPath() string { return filepath.Join(filepath.Dir(cfgPath()), "lmu_userdata.txt") }

func rememberUserData(ud string) {
	if old, _ := os.ReadFile(udPath()); strings.TrimSpace(string(old)) != ud {
		os.WriteFile(udPath(), []byte(ud), 0644)
	}
}

// at start: the folder seen last time, else the usual Steam places
func loadUserData() {
	if ud, _ := userData.Load().(string); ud != "" {
		return
	}
	cand := []string{}
	if b, err := os.ReadFile(udPath()); err == nil {
		cand = append(cand, strings.TrimSpace(string(b)))
	}
	for _, d := range "CDEFGH" {
		for _, p := range []string{`SteamLibrary\steamapps\common`, `Program Files (x86)\Steam\steamapps\common`, `Program Files\Steam\steamapps\common`, `Steam\steamapps\common`, `Games\SteamLibrary\steamapps\common`} {
			cand = append(cand, string(d)+`:\`+p+`\Le Mans Ultimate\UserData`)
		}
	}
	for _, ud := range cand {
		if ud == "" {
			continue
		}
		if st, err := os.Stat(filepath.Join(ud, "player", "Settings")); err == nil && st.IsDir() {
			userData.Store(ud)
			return
		}
	}
}

func localOnly(w http.ResponseWriter, r *http.Request) bool {
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	ip := net.ParseIP(host)
	h := strings.ToLower(r.Host)
	if i := strings.LastIndex(h, ":"); i > 0 {
		h = h[:i]
	}
	if ip == nil || !ip.IsLoopback() || (h != "localhost" && h != "127.0.0.1" && h != "[::1]") {
		http.Error(w, "solo da questo PC", http.StatusForbidden)
		return false
	}
	return true
}

type svmEntry struct {
	P string `json:"p"`
	S int64  `json:"s"`
	T int64  `json:"t"`
}

// GET /svmlib → {"ok":true,"files":[{"p":"Monza/GO ... R Esport.svm","s":5354,"t":1760000000}]}
func handleSvmLib(w http.ResponseWriter, r *http.Request) {
	if !localOnly(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	base, err := settingsDir()
	if err != nil {
		json.NewEncoder(w).Encode(M{"ok": false, "error": err.Error()})
		return
	}
	files := []svmEntry{}
	filepath.WalkDir(base, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(base, p)
		if d.IsDir() {
			if strings.Count(rel, string(filepath.Separator)) >= 4 {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.EqualFold(filepath.Ext(p), ".svm") || len(files) >= 20000 {
			return nil
		}
		if fi, err := d.Info(); err == nil && fi.Size() < 256<<10 {
			files = append(files, svmEntry{filepath.ToSlash(rel), fi.Size(), fi.ModTime().Unix()})
		}
		return nil
	})
	json.NewEncoder(w).Encode(M{"ok": true, "files": files})
}

// GET /svmlib/file?p=<path from the list> → the .svm text
func handleSvmFile(w http.ResponseWriter, r *http.Request) {
	if !localOnly(w, r) {
		return
	}
	base, err := settingsDir()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	rel := filepath.FromSlash(r.URL.Query().Get("p"))
	full := filepath.Join(base, rel)
	if rel == "" || !strings.EqualFold(filepath.Ext(full), ".svm") || !strings.HasPrefix(full, base+string(filepath.Separator)) {
		http.Error(w, "file non valido", http.StatusBadRequest)
		return
	}
	st, err := os.Stat(full)
	if err != nil || st.IsDir() || st.Size() >= 256<<10 {
		http.Error(w, "file non trovato", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, full)
}
