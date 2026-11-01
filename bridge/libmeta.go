package main

import (
	"bufio"
	"compress/gzip"
	"io"
	"os"
	"strings"
	"sync"
	"unicode/utf8"
)

// What the Libreria page needs to sort the files without opening them: from the first bytes of each
// MoTeC .ld (date, time, driver, car, track) and of each .svm (the car). Read once per file and kept
// in memory while the size and time stay the same.

type ldMeta struct {
	Date   string `json:"date,omitempty"`
	Time   string `json:"time,omitempty"`
	Driver string `json:"driver,omitempty"`
	Car    string `json:"car,omitempty"`
	Venue  string `json:"venue,omitempty"`
}

type metaKey struct {
	p    string
	s, t int64
}

var ldMetaCache, svmCarCache sync.Map

// hdrStr: a zero-terminated string at off in the header: UTF-8 when valid (LMU writes accented track
// names in UTF-8), else latin-1
func hdrStr(b []byte, off, n int) string {
	if off >= len(b) {
		return ""
	}
	end := off + n
	if end > len(b) {
		end = len(b)
	}
	s := b[off:end]
	if i := strings.IndexByte(string(s), 0); i >= 0 {
		s = s[:i]
	}
	if utf8.Valid(s) {
		return strings.TrimSpace(string(s))
	}
	r := make([]rune, 0, len(s))
	for _, c := range s {
		r = append(r, rune(c))
	}
	return strings.TrimSpace(string(r))
}

func readLdMeta(full string, s, t int64) ldMeta {
	k := metaKey{full, s, t}
	if v, ok := ldMetaCache.Load(k); ok {
		return v.(ldMeta)
	}
	m := ldMeta{}
	f, err := os.Open(full)
	if err == nil {
		defer f.Close()
		var r io.Reader = f
		if strings.HasSuffix(strings.ToLower(full), ".gz") {
			if g, err := gzip.NewReader(f); err == nil {
				defer g.Close()
				r = g
			}
		}
		b := make([]byte, 0x1A0)
		if n, _ := io.ReadFull(r, b); n > 0 {
			b = b[:n]
			m = ldMeta{Date: hdrStr(b, 0x5e, 16), Time: hdrStr(b, 0x7e, 16), Driver: hdrStr(b, 0x9e, 64), Car: hdrStr(b, 0xde, 64), Venue: hdrStr(b, 0x15e, 64)}
		}
	}
	ldMetaCache.Store(k, m)
	return m
}

// the car of a setup: the VehicleClassSetting line near the top of the .svm
func readSvmCar(full string, s, t int64) string {
	k := metaKey{full, s, t}
	if v, ok := svmCarCache.Load(k); ok {
		return v.(string)
	}
	car := ""
	if f, err := os.Open(full); err == nil {
		sc := bufio.NewScanner(io.LimitReader(f, 4096))
		for sc.Scan() {
			l := sc.Text()
			if strings.HasPrefix(l, "VehicleClassSetting=") {
				car = strings.Trim(strings.TrimPrefix(l, "VehicleClassSetting="), "\" \r")
				break
			}
		}
		f.Close()
	}
	svmCarCache.Store(k, car)
	return car
}
