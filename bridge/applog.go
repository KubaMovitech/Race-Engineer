package main

import (
	"bufio"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Without a console (windows app) everything printed goes to a log file and to the
// last lines shown in the app (Muretto › Questo PC).
var logMu sync.Mutex
var logLines []string

func logTail(n int) []string {
	logMu.Lock()
	defer logMu.Unlock()
	if len(logLines) > n {
		return append([]string(nil), logLines[len(logLines)-n:]...)
	}
	return append([]string(nil), logLines...)
}

func startLog() string {
	path := filepath.Join(appDataDir(), "bridge.log")
	if st, err := os.Stat(path); err == nil && st.Size() > 2<<20 {
		os.Rename(path, path+".old")
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return ""
	}
	r, w, err := os.Pipe()
	if err != nil {
		return ""
	}
	os.Stdout, os.Stderr = w, w
	go func() {
		br := bufio.NewReader(r)
		var cur strings.Builder
		flush := func(keep bool) {
			s := strings.TrimSpace(cur.String())
			cur.Reset()
			if s == "" || !keep {
				return
			}
			io.WriteString(f, s+"\n")
			logMu.Lock()
			logLines = append(logLines, s)
			if len(logLines) > 200 {
				logLines = logLines[len(logLines)-200:]
			}
			logMu.Unlock()
		}
		for {
			c, err := br.ReadByte()
			if err != nil {
				return
			}
			switch c {
			case '\n':
				flush(true)
			case '\r': // the status line rewrites itself: not a log line
				flush(!strings.HasPrefix(strings.TrimSpace(cur.String()), "LMU:"))
			default:
				cur.WriteByte(c)
			}
		}
	}()
	return path
}
