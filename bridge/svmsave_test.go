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
	for _, d := range []string{"Fuji", "Sebring", "Le Mans"} {
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
