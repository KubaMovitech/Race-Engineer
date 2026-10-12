package main

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync/atomic"
)

// LMU UserData folder, read from the game while it runs (the setups live in
// <UserData>\player\Settings\<track>\*.svm).
var userData atomic.Value

func setUserData(shm []byte) {
	if shm == nil {
		return
	}
	if ud := cstr(shm, OFF_PATHS_USERDATA, 260); ud != "" {
		if st, err := os.Stat(ud); err == nil && st.IsDir() {
			userData.Store(ud)
		}
	}
}

func settingsDir() (string, error) {
	ud, _ := userData.Load().(string)
	if ud == "" {
		return "", errors.New("apri Le Mans Ultimate: il bridge legge da lì la cartella dei setup")
	}
	d := filepath.Join(ud, "player", "Settings")
	if st, err := os.Stat(d); err != nil || !st.IsDir() {
		return "", errors.New("cartella dei setup di LMU non trovata")
	}
	return d, nil
}

var wordRe = regexp.MustCompile(`[a-z0-9]+`)

// trackFolder picks the Settings sub-folder of a track: the one sharing the most words with the
// name given by the app (e.g. "Fuji Speedway" → "Fuji"). The app never chooses a path itself.
func trackFolder(base, track string) (string, []string, error) {
	ents, err := os.ReadDir(base)
	if err != nil {
		return "", nil, err
	}
	want := map[string]bool{}
	for _, w := range wordRe.FindAllString(strings.ToLower(track), -1) {
		if len(w) > 2 {
			want[w] = true
		}
	}
	best, bestN := "", 0
	var all []string
	for _, e := range ents {
		if !e.IsDir() {
			continue
		}
		all = append(all, e.Name())
		n := 0
		for _, w := range wordRe.FindAllString(strings.ToLower(e.Name()), -1) {
			if want[w] {
				n++
			}
		}
		if n > bestN {
			best, bestN = e.Name(), n
		}
	}
	sort.Strings(all)
	if best == "" {
		return "", all, errors.New("nessuna cartella di setup per questa pista")
	}
	return filepath.Join(base, best), all, nil
}

var svmName = regexp.MustCompile(`^[\w .,()+-]{1,80}$`)

// POST /svm {"track","name","text"}: writes a generated setup next to the others of that track.
// JSON only (other web pages cannot post it), plain file name, .svm only, never overwrites.
func handleSvm(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fail := func(err error, extra M) {
		m := M{"ok": false, "error": err.Error()}
		for k, v := range extra {
			m[k] = v
		}
		json.NewEncoder(w).Encode(m)
	}
	if r.Method != http.MethodPost || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "POST json", http.StatusBadRequest)
		return
	}
	var q struct{ Track, Name, Text string }
	if err := json.NewDecoder(io.LimitReader(r.Body, 512<<10)).Decode(&q); err != nil {
		fail(err, nil)
		return
	}
	name := strings.TrimSuffix(strings.TrimSpace(q.Name), ".svm")
	if !svmName.MatchString(name) || strings.Contains(name, "..") {
		fail(errors.New("nome del file non valido"), nil)
		return
	}
	if !strings.Contains(q.Text, "[") || len(q.Text) < 50 {
		fail(errors.New("setup vuoto"), nil)
		return
	}
	base, err := settingsDir()
	if err != nil {
		fail(err, nil)
		return
	}
	dir, all, err := trackFolder(base, q.Track)
	if err != nil {
		fail(err, M{"folders": all})
		return
	}
	p := filepath.Join(dir, name+".svm")
	for i := 2; ; i++ {
		if _, err := os.Stat(p); os.IsNotExist(err) {
			break
		}
		p = filepath.Join(dir, name+" ("+itoa(i)+").svm")
	}
	if err := os.WriteFile(p, []byte(strings.ReplaceAll(q.Text, "\r\n", "\n")), 0644); err != nil {
		fail(err, nil)
		return
	}
	json.NewEncoder(w).Encode(M{"ok": true, "file": filepath.Base(p), "folder": filepath.Base(dir)})
}
