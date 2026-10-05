package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync/atomic"
	"time"
)

// Recorder writes each session to <LMU UserData>\DataEngineer\*.de.json
// (or next to the bridge when the game path is unknown), rewriting it once a
// minute and when the session changes. Data Engineer opens these files.

type Recorder struct {
	dir     string
	ses     string
	file    string
	started time.Time
	wx      [][]float64 // [et, air, track, rain, wetness]
	lastWx  float64
	info    M
	drivers map[string]bool
	busy    atomic.Bool
	done    chan struct{}
}

const OFF_PATHS_USERDATA = 332

func recDir(shm []byte) string {
	if shm != nil {
		ud := cstr(shm, OFF_PATHS_USERDATA, 260)
		if ud != "" {
			if st, err := os.Stat(ud); err == nil && st.IsDir() {
				return filepath.Join(ud, "DataEngineer")
			}
		}
	}
	exe, err := os.Executable()
	if err != nil {
		return "sessioni"
	}
	return filepath.Join(filepath.Dir(exe), "sessioni")
}

var unsafeName = regexp.MustCompile(`[^A-Za-z0-9]+`)

func sesName(s int) string {
	switch {
	case s == 0:
		return "Test"
	case s <= 4:
		return "Prove"
	case s <= 8:
		return "Qualifica"
	case s == 9:
		return "Warmup"
	}
	return "Gara"
}

func (r *Recorder) sample(f *Frame, ses string, shm []byte) {
	if ses != r.ses {
		r.ses = ses
		r.started = time.Now()
		r.wx = nil
		r.lastWx = -999
		r.drivers = map[string]bool{}
		r.dir = recDir(shm)
		trk := cstr(f.Info, I_mTrackName, 64)
		r.file = filepath.Join(r.dir, r.started.Format("2006-01-02_15-04")+"_"+strings.Trim(unsafeName.ReplaceAllString(trk, "-"), "-")+"_"+sesName(i32(f.Info, I_mSession))+".de.json")
	}
	et := f64(f.Info, I_mCurrentET)
	if et-r.lastWx >= 30 {
		r.lastWx = et
		in := f.Info
		r.wx = append(r.wx, []float64{r1(et), r1(f64(in, I_mAmbientTemp)), r1(f64(in, I_mTrackTemp)), r2(f64(in, I_mRaining)), r2(fin(f64(in, I_mAvgPathWetness)))})
	}
}

// save writes asynchronously; skipped if the previous write is still running.
func (r *Recorder) save(tr *Tracker, fd *Field, sc M, pit, wx M) {
	if r.file == "" || r.busy.Load() || len(fd.cars) == 0 {
		return
	}
	if tr.driver != "" {
		r.drivers[tr.driver] = true
	}
	var drv []string
	for d := range r.drivers {
		drv = append(drv, d)
	}
	sort.Strings(drv)
	data := M{"de": "live", "v": 1, "saved": time.Now().Format(time.RFC3339), "started": r.started.Format(time.RFC3339),
		"ses": tr.sesKey, "car": tr.car, "cls": tr.cls, "drivers": drv, "laps": tr.laps, "events": tr.events,
		"field": fd.snapshot(0), "stream": fd.stream, "wx": r.wx, "sc": sc, "pit": pit, "forecast": wx}
	js, err := json.Marshal(data)
	if err != nil {
		return
	}
	r.busy.Store(true)
	dir, file := r.dir, r.file
	go func() {
		defer r.busy.Store(false)
		os.MkdirAll(dir, 0755)
		tmp := file + ".tmp"
		if os.WriteFile(tmp, js, 0644) == nil {
			os.Rename(tmp, file)
		}
	}()
}

// list of recorded sessions (for the local Muretto).
func listRecordings(dirs ...string) []M {
	var out []M
	seen := map[string]bool{}
	for _, d := range dirs {
		ents, _ := os.ReadDir(d)
		for _, e := range ents {
			if !strings.HasSuffix(e.Name(), ".de.json") || seen[e.Name()] {
				continue
			}
			seen[e.Name()] = true
			info, _ := e.Info()
			sz := int64(0)
			if info != nil {
				sz = info.Size()
			}
			out = append(out, M{"name": e.Name(), "dir": d, "size": sz})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i]["name"].(string) > out[j]["name"].(string) })
	return out
}
