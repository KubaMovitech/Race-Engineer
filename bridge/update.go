package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Updates: the bridge and the app it serves update themselves from an
// "update channel" (a folder on the web, e.g. a GitHub repository) that holds
//   version.json            {"version":"1.6","date":"…","notes":[…],
//                            "bridge":{"file":"DataEngineerBridge.exe","sha256":"…"},
//                            "app":{"file":"Data_Engineer.html","sha256":"…"}}
//   DataEngineerBridge.exe, Data_Engineer.html
// Files are checked against their SHA-256 before being used.

// DefaultUpdates is the channel used when databridge.json does not set one.
var DefaultUpdates = "https://raw.githubusercontent.com/KubaMovitech/Race-Engineer/main/"

type Remote struct {
	Version string   `json:"version"`
	Date    string   `json:"date"`
	Notes   []string `json:"notes"`
	Relay   *string  `json:"relay"` // team server; absent = keep the last one known
	Bridge  struct {
		File   string `json:"file"`
		Sha256 string `json:"sha256"`
	} `json:"bridge"`
	App struct {
		File   string `json:"file"`
		Sha256 string `json:"sha256"`
	} `json:"app"`
}

var updClient = &http.Client{Timeout: 60 * time.Second}
var updMu sync.Mutex

// newer reports whether version a is newer than b ("1.10" > "1.9").
func newer(a, b string) bool {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := 0; i < len(pa) || i < len(pb); i++ {
		x, y := 0, 0
		if i < len(pa) {
			x, _ = strconv.Atoi(pa[i])
		}
		if i < len(pb) {
			y, _ = strconv.Atoi(pb[i])
		}
		if x != y {
			return x > y
		}
	}
	return false
}

func chanURL(base, file string) string {
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	return base + file
}

func fetchRemote(base string) (*Remote, error) {
	if base == "" {
		return nil, errors.New("canale aggiornamenti non impostato")
	}
	c := &http.Client{Timeout: 8 * time.Second}
	r, err := c.Get(chanURL(base, "version.json") + "?t=" + strconv.FormatInt(time.Now().Unix(), 10))
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return nil, fmt.Errorf("canale aggiornamenti: HTTP %d", r.StatusCode)
	}
	var rm Remote
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&rm); err != nil {
		return nil, err
	}
	return &rm, nil
}

func download(url, sha string) ([]byte, error) {
	r, err := updClient.Get(url + "?t=" + strconv.FormatInt(time.Now().Unix(), 10))
	if err != nil {
		return nil, err
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return nil, fmt.Errorf("download: HTTP %d", r.StatusCode)
	}
	b, err := io.ReadAll(io.LimitReader(r.Body, 200<<20))
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(b)
	if sha == "" || !strings.EqualFold(hex.EncodeToString(sum[:]), sha) {
		return nil, errors.New("file scaricato non valido (controllo SHA-256 fallito)")
	}
	return b, nil
}

// selfSha is the SHA-256 of the running bridge ("" if it cannot be read).
func selfSha() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	b, err := os.ReadFile(exe)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

// served app: a downloaded newer Data_Engineer.html next to the bridge, else the embedded one
func servedApp() ([]byte, string) {
	dir := exeDir()
	if v, err := os.ReadFile(filepath.Join(dir, "app.version")); err == nil {
		ver := strings.TrimSpace(string(v))
		if newer(ver, VERSION) || ver == VERSION {
			if b, err := os.ReadFile(filepath.Join(dir, "app.html")); err == nil && len(b) > 1000 {
				return b, ver
			}
		}
	}
	return appHTML, VERSION
}

// applyUpdate downloads what is newer. Returns whether the bridge itself changed
// (the caller then restarts).
func applyUpdate(base string) (rm *Remote, bridgeChanged bool, err error) {
	updMu.Lock()
	defer updMu.Unlock()
	rm, err = fetchRemote(base)
	if err != nil {
		return nil, false, err
	}
	dir := exeDir()
	_, appVer := servedApp()
	if rm.App.File != "" && newer(rm.Version, appVer) {
		b, err := download(chanURL(base, rm.App.File), rm.App.Sha256)
		if err != nil {
			return rm, false, err
		}
		if err := os.WriteFile(filepath.Join(dir, "app.html"), b, 0644); err != nil {
			return rm, false, err
		}
		os.WriteFile(filepath.Join(dir, "app.version"), []byte(rm.Version), 0644)
	}
	// the same exe under a newer number (a new app with the old bridge) is not an update:
	// replacing it would restart into the same version and loop forever
	if runtime.GOOS == "windows" && rm.Bridge.File != "" && newer(rm.Version, VERSION) && !strings.EqualFold(selfSha(), rm.Bridge.Sha256) {
		b, err := download(chanURL(base, rm.Bridge.File), rm.Bridge.Sha256)
		if err != nil {
			return rm, false, err
		}
		exe, _ := os.Executable()
		old := exe + ".old"
		os.Remove(old)
		if err := os.WriteFile(exe+".new", b, 0755); err != nil {
			return rm, false, err
		}
		// Windows lets a running program be renamed (not overwritten)
		if err := os.Rename(exe, old); err != nil {
			return rm, false, err
		}
		if err := os.Rename(exe+".new", exe); err != nil {
			os.Rename(old, exe)
			return rm, false, err
		}
		return rm, true, nil
	}
	return rm, false, nil
}

// restart starts the updated bridge and quits this one (the window is reopened by the new one).
func restart() {
	exe, _ := os.Executable()
	// keep the options, but not the ones that would ask for / force the team code again
	var keep []string
	for i := 1; i < len(os.Args); i++ {
		a := os.Args[i]
		if a == "-setup" || a == "--setup" || a == "-restarted" || a == "--restarted" {
			continue
		}
		if a == "-team" || a == "--team" {
			i++
			continue
		}
		if strings.HasPrefix(a, "-team=") || strings.HasPrefix(a, "--team=") {
			continue
		}
		keep = append(keep, a)
	}
	keep = append(keep, "-restarted")
	closeWindow()
	if hasConsole() && runtime.GOOS == "windows" {
		// console version: a new console window for the new process
		exec.Command("cmd", append([]string{"/c", "start", "Data Engineer", exe}, keep...)...).Start()
	} else {
		exec.Command(exe, keep...).Start()
	}
	time.Sleep(500 * time.Millisecond)
	os.Exit(0)
}

func cleanupOld() {
	if exe, err := os.Executable(); err == nil {
		os.Remove(exe + ".old")
	}
}
