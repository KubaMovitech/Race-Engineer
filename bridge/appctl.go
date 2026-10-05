package main

import (
	"fmt"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"
)

// the app window and a clean exit
var quitFn = func() {}
var appWin struct {
	sync.Mutex
	cmd      *exec.Cmd
	quitting atomic.Bool
}

// open the window; when the user closes it, Data Engineer stops (cleanly).
// If the browser hands the window to an instance already open (it returns at once),
// we keep running: opening Data Engineer again shows the window again.
func startWindow(url string) {
	c := openAppWindow(url)
	if c == nil {
		return
	}
	appWin.Lock()
	appWin.cmd = c
	appWin.Unlock()
	go func() {
		t0 := time.Now()
		c.Wait()
		if appWin.quitting.Load() || time.Since(t0) < 5*time.Second {
			return
		}
		fmt.Println("Finestra chiusa: Data Engineer si ferma.")
		quitFn()
	}()
}

// close our window before a restart: the new process opens its own
func closeWindow() {
	appWin.quitting.Store(true)
	appWin.Lock()
	defer appWin.Unlock()
	if appWin.cmd != nil && appWin.cmd.Process != nil {
		appWin.cmd.Process.Kill()
	}
}

// what the console used to show, for the app (Muretto › Questo PC)
type statusBox struct{ v atomic.Value }

func (s *statusBox) set(m M) { s.v.Store(m) }
func (s *statusBox) get() M {
	if m, ok := s.v.Load().(M); ok {
		return m
	}
	return M{}
}

var appStatus statusBox
