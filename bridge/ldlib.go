package main

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// The game's MoTeC telemetry folder (UserData\Telemetry) seen from the app, like the setup library:
// the list of .ld files (path, size, time) and each file on request, so new sessions arrive by themselves.
// The subfolder "Riferimenti" holds reference laps (e.g. the shops' telemetry) to compare with.
// Like the setups, these files answer only to this PC.

const refDir = "Riferimenti"

func telemetryDir() (string, error) {
	ud, _ := userData.Load().(string)
	if ud == "" {
		return "", errString("apri Le Mans Ultimate una volta con il bridge acceso: serve per trovare la cartella del gioco")
	}
	d := filepath.Join(ud, "Telemetry")
	if st, err := os.Stat(d); err != nil || !st.IsDir() {
		return "", errString("cartella Telemetry di LMU non trovata: attiva la telemetria MoTeC nelle opzioni del gioco")
	}
	// the place for the reference laps, ready for the user
	os.MkdirAll(filepath.Join(d, refDir), 0755)
	return d, nil
}

type errString string

func (e errString) Error() string { return string(e) }

func isLd(p string) bool {
	l := strings.ToLower(p)
	return strings.HasSuffix(l, ".ld") || strings.HasSuffix(l, ".ld.gz")
}

// GET /ldlib → {"ok":true,"dir":"…\\Telemetry","files":[{"p":"2026-10-18 - 16-10-41 - Monza - P1.ld","s":30593710,"t":1760000000}]}
func handleLdLib(w http.ResponseWriter, r *http.Request) {
	if !localOnly(w, r) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	base, err := telemetryDir()
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
			if strings.Count(rel, string(filepath.Separator)) >= 3 {
				return filepath.SkipDir
			}
			return nil
		}
		if !isLd(p) || len(files) >= 5000 {
			return nil
		}
		if fi, err := d.Info(); err == nil && fi.Size() > 0 && fi.Size() < 1<<30 {
			files = append(files, svmEntry{filepath.ToSlash(rel), fi.Size(), fi.ModTime().Unix()})
		}
		return nil
	})
	json.NewEncoder(w).Encode(M{"ok": true, "dir": base, "files": files})
}

// GET /ldlib/file?p=<path from the list> → the .ld file
func handleLdFile(w http.ResponseWriter, r *http.Request) {
	if !localOnly(w, r) {
		return
	}
	base, err := telemetryDir()
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	rel := filepath.FromSlash(r.URL.Query().Get("p"))
	full := filepath.Join(base, rel)
	if rel == "" || !isLd(full) || !strings.HasPrefix(full, base+string(filepath.Separator)) {
		http.Error(w, "file non valido", http.StatusBadRequest)
		return
	}
	st, err := os.Stat(full)
	if err != nil || st.IsDir() || st.Size() >= 1<<30 {
		http.Error(w, "file non trovato", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, full)
}
