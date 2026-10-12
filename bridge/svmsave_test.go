package main

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSvmSave(t *testing.T) {
	ud := t.TempDir()
	for _, d := range []string{"Fuji", "Sebring", "Lemans", "Longbeach", "Road Atlanta"} {
		os.MkdirAll(filepath.Join(ud, "player", "Settings", d), 0755)
	}
	userData.Store(ud)
	post := func(body string) M {
		r := httptest.NewRequest("POST", "/svm", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handleSvm(w, r)
		var m M
		json.Unmarshal(w.Body.Bytes(), &m)
		return m
	}
	text := `VehicleClassSetting=\"Test\"\n[GENERAL]\nFuelSetting=10//50L\n[FRONTLEFT]\nPressureSetting=5//150 kPa\n`
	m := post(`{"track":"Fuji Speedway","name":"Base DE2","text":"` + text + `"}`)
	if m["ok"] != true || m["folder"] != "Fuji" {
		t.Fatalf("want saved in Fuji, got %v", m)
	}
	if m2 := post(`{"track":"Fuji Speedway","name":"Base DE2","text":"` + text + `"}`); m2["file"] != "Base DE2 (2).svm" {
		t.Fatalf("must not overwrite, got %v", m2)
	}
	if m3 := post(`{"track":"Fuji","name":"..\\..\\x","text":"` + text + `"}`); m3["ok"] == true {
		t.Fatalf("path in the name must be refused")
	}
	if m4 := post(`{"track":"Monza","name":"a","text":"` + text + `"}`); m4["ok"] == true {
		t.Fatalf("no Monza folder: must fail")
	}
}

func TestTrackFolderCompact(t *testing.T) {
	base := t.TempDir()
	for _, d := range []string{"Lemans", "Longbeach", "Road Atlanta", "Sebring", "Monza"} {
		os.MkdirAll(filepath.Join(base, d), 0755)
	}
	for track, want := range map[string]string{"Le Mans": "Lemans", "Long Beach": "Longbeach", "Road Atlanta": "Road Atlanta", "Sebring": "Sebring", "Monza": "Monza"} {
		got, _, err := trackFolder(base, track)
		if err != nil || filepath.Base(got) != want {
			t.Errorf("%s -> %q %v, want %s", track, got, err, want)
		}
	}
}

func TestSvmLib(t *testing.T) {
	ud := t.TempDir()
	os.MkdirAll(filepath.Join(ud, "player", "Settings", "Monza"), 0755)
	os.WriteFile(filepath.Join(ud, "player", "Settings", "Monza", "GO R.svm"), []byte("[GENERAL]\nNotes=\"x\"\n"), 0644)
	os.WriteFile(filepath.Join(ud, "player", "Settings", "Monza", "note.txt"), []byte("no"), 0644)
	os.WriteFile(filepath.Join(ud, "player", "secret.svm"), []byte("no"), 0644)
	userData.Store(ud)
	get := func(url, remote, host string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", url, nil)
		r.RemoteAddr, r.Host = remote, host
		w := httptest.NewRecorder()
		if strings.HasPrefix(url, "/svmlib/file") {
			handleSvmFile(w, r)
		} else {
			handleSvmLib(w, r)
		}
		return w
	}
	w := get("/svmlib", "127.0.0.1:5000", "localhost:8790")
	var m struct {
		Ok    bool
		Files []svmEntry
	}
	json.Unmarshal(w.Body.Bytes(), &m)
	if !m.Ok || len(m.Files) != 1 || m.Files[0].P != "Monza/GO R.svm" {
		t.Fatalf("list: %s", w.Body.String())
	}
	if w := get("/svmlib/file?p=Monza/GO%20R.svm", "127.0.0.1:5000", "127.0.0.1:8790"); w.Code != 200 || !strings.Contains(w.Body.String(), "GENERAL") {
		t.Fatalf("file: %d %s", w.Code, w.Body.String())
	}
	for _, bad := range []string{"../secret.svm", "Monza/note.txt", "Monza/../../secret.svm"} {
		if w := get("/svmlib/file?p="+bad, "127.0.0.1:5000", "localhost:8790"); w.Code == 200 {
			t.Errorf("%s served", bad)
		}
	}
	if w := get("/svmlib", "192.168.1.20:5000", "192.168.1.5:8790"); w.Code != 403 {
		t.Errorf("LAN allowed: %d", w.Code)
	}
	if w := get("/svmlib", "127.0.0.1:5000", "evil.example:8790"); w.Code != 403 {
		t.Errorf("rebinding allowed: %d", w.Code)
	}
}
