package main

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLdLib(t *testing.T) {
	ud := t.TempDir()
	tel := filepath.Join(ud, "Telemetry")
	os.MkdirAll(tel, 0755)
	os.WriteFile(filepath.Join(tel, "2026-10-18 Monza P1.ld"), []byte("LDDATA"), 0644)
	os.WriteFile(filepath.Join(tel, "note.txt"), []byte("no"), 0644)
	os.WriteFile(filepath.Join(ud, "secret.ld"), []byte("no"), 0644)
	userData.Store(ud)
	defer userData.Store("")
	get := func(url, remote, host string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", url, nil)
		r.RemoteAddr, r.Host = remote, host
		w := httptest.NewRecorder()
		if strings.HasPrefix(url, "/ldlib/file") {
			handleLdFile(w, r)
		} else {
			handleLdLib(w, r)
		}
		return w
	}
	w := get("/ldlib", "127.0.0.1:5000", "localhost:8790")
	var m struct {
		Ok    bool
		Files []svmEntry
	}
	json.Unmarshal(w.Body.Bytes(), &m)
	if !m.Ok || len(m.Files) != 1 || m.Files[0].P != "2026-10-18 Monza P1.ld" {
		t.Fatalf("list: %s", w.Body.String())
	}
	// the references folder is created for the user
	if st, err := os.Stat(filepath.Join(tel, refDir)); err != nil || !st.IsDir() {
		t.Errorf("no %s folder", refDir)
	}
	if w := get("/ldlib/file?p=2026-10-18%20Monza%20P1.ld", "127.0.0.1:5000", "127.0.0.1:8790"); w.Code != 200 || w.Body.String() != "LDDATA" {
		t.Fatalf("file: %d %s", w.Code, w.Body.String())
	}
	for _, bad := range []string{"../secret.ld", "note.txt", "x/../../secret.ld"} {
		if w := get("/ldlib/file?p="+bad, "127.0.0.1:5000", "localhost:8790"); w.Code == 200 {
			t.Errorf("%s served", bad)
		}
	}
	if w := get("/ldlib", "192.168.1.20:5000", "192.168.1.5:8790"); w.Code != 403 {
		t.Errorf("LAN allowed: %d", w.Code)
	}
}
