package main

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLibDir(t *testing.T) {
	root := t.TempDir()
	game := filepath.Join(root, "Le Mans Ultimate")
	ud := filepath.Join(game, "UserData")
	os.MkdirAll(filepath.Join(ud, "player", "Settings", "Monza"), 0755)
	other := filepath.Join(root, "Documents")
	os.MkdirAll(other, 0755)
	defer userData.Store("")

	post := func(body, ctype, remote, host string) map[string]any {
		r := httptest.NewRequest("POST", "/libdir", strings.NewReader(body))
		r.RemoteAddr, r.Host = remote, host
		r.Header.Set("Content-Type", ctype)
		w := httptest.NewRecorder()
		handleLibDir(w, r)
		m := map[string]any{"code": w.Code}
		json.Unmarshal(w.Body.Bytes(), &m)
		return m
	}
	js := func(d string) string { b, _ := json.Marshal(map[string]string{"dir": d}); return string(b) }
	// the game folder is accepted and its UserData is used
	if m := post(js(game), "application/json", "127.0.0.1:5000", "localhost:8790"); m["ok"] != true || m["userData"] != ud {
		t.Fatalf("game folder: %v", m)
	}
	if udSrc() != "manuale" {
		t.Fatalf("source %q", udSrc())
	}
	// a folder that is not UserData, a relative path, nothing
	for _, d := range []string{other, "UserData", "", filepath.Join(root, "missing")} {
		if m := post(js(d), "application/json", "127.0.0.1:5000", "localhost:8790"); m["ok"] == true {
			t.Fatalf("accepted %q", d)
		}
	}
	// only JSON (a form from another web page cannot send it) and only from this PC
	if m := post("dir="+ud, "application/x-www-form-urlencoded", "127.0.0.1:5000", "localhost:8790"); m["code"] != 400 {
		t.Fatalf("form accepted: %v", m)
	}
	if m := post(js(ud), "application/json", "192.168.1.20:5000", "192.168.1.5:8790"); m["code"] != 403 {
		t.Fatalf("remote accepted: %v", m)
	}
	if m := post(js(ud), "application/json", "127.0.0.1:5000", "evil.example:8790"); m["code"] != 403 {
		t.Fatalf("rebinding accepted: %v", m)
	}
	// the status says where it reads from
	r := httptest.NewRequest("GET", "/libstatus", nil)
	r.RemoteAddr, r.Host = "127.0.0.1:5000", "localhost:8790"
	w := httptest.NewRecorder()
	handleLibStatus(w, r)
	var st struct {
		Ok       bool
		UserData string
		Source   string
		Settings struct{ Ok bool }
	}
	json.Unmarshal(w.Body.Bytes(), &st)
	if !st.Ok || st.UserData != ud || st.Source != "manuale" || !st.Settings.Ok {
		t.Fatalf("status: %s", w.Body.String())
	}
}
