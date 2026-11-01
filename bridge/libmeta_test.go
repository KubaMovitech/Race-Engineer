package main

import (
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"
)

// the Libreria page sorts files by what is written in them: track, car, driver and date of a .ld (also .ld.gz), car of a .svm
func TestLibMeta(t *testing.T) {
	dir := t.TempDir()
	h := make([]byte, 0x200)
	put := func(off int, s string) { copy(h[off:], s) }
	put(0x5e, "18/10/2026")
	put(0x7e, "16:10:41")
	put(0x9e, "Test Driver")
	put(0xde, "Hypercar")
	put(0x15e, "Autodromo Nazionale Monza")
	ld := filepath.Join(dir, "a.ld")
	os.WriteFile(ld, h, 0644)
	m := readLdMeta(ld, 512, 1)
	if m.Venue != "Autodromo Nazionale Monza" || m.Car != "Hypercar" || m.Driver != "Test Driver" || m.Date != "18/10/2026" || m.Time != "16:10:41" {
		t.Fatalf("ld meta: %+v", m)
	}
	var gz bytes.Buffer
	zw := gzip.NewWriter(&gz)
	zw.Write(h)
	zw.Close()
	ldz := filepath.Join(dir, "b.ld.gz")
	os.WriteFile(ldz, gz.Bytes(), 0644)
	if m := readLdMeta(ldz, int64(gz.Len()), 1); m.Venue != "Autodromo Nazionale Monza" {
		t.Fatalf("ld.gz meta: %+v", m)
	}
	// a file too short is not an error: the fields stay empty
	short := filepath.Join(dir, "c.ld")
	os.WriteFile(short, []byte("LD"), 0644)
	if m := readLdMeta(short, 2, 1); m.Venue != "" {
		t.Fatalf("short: %+v", m)
	}
	svm := filepath.Join(dir, "x.svm")
	os.WriteFile(svm, []byte("VehicleClassSetting=\"BMW_M_Hybrid Hypercar WEC2026\"\n[GENERAL]\n"), 0644)
	if c := readSvmCar(svm, 50, 1); c != "BMW_M_Hybrid Hypercar WEC2026" {
		t.Fatalf("svm car %q", c)
	}
}
