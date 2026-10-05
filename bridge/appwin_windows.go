//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

var (
	pConsoleWin = k32.NewProc("GetConsoleWindow")
	u32         = syscall.NewLazyDLL("user32.dll")
	pMsgBox     = u32.NewProc("MessageBoxW")
)

// started by double click as a windows app (no console)?
func hasConsole() bool { h, _, _ := pConsoleWin.Call(); return h != 0 }

func appDataDir() string {
	d := os.Getenv("LOCALAPPDATA")
	if d == "" {
		d = os.TempDir()
	}
	d = filepath.Join(d, "DataEngineer")
	os.MkdirAll(d, 0755)
	return d
}

// Edge (always there on Windows 10/11) or Chrome in "app" mode: a window of its own,
// no tabs or address bar, with a separate profile so it does not touch the user's browser.
func browserApp() string {
	pf, pf86, la := os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")
	for _, p := range []string{
		filepath.Join(pf86, `Microsoft\Edge\Application\msedge.exe`), filepath.Join(pf, `Microsoft\Edge\Application\msedge.exe`),
		filepath.Join(la, `Microsoft\Edge\Application\msedge.exe`),
		filepath.Join(pf, `Google\Chrome\Application\chrome.exe`), filepath.Join(pf86, `Google\Chrome\Application\chrome.exe`),
		filepath.Join(la, `Google\Chrome\Application\chrome.exe`),
	} {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	return ""
}

func openAppWindow(url string) *exec.Cmd {
	if b := browserApp(); b != "" {
		c := exec.Command(b, "--app="+url, "--user-data-dir="+filepath.Join(appDataDir(), "window"), "--no-first-run",
			"--no-default-browser-check", "--window-size=1600,950", "--disable-features=Translate")
		if c.Start() == nil {
			return c
		}
	}
	exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	return nil
}

func msgBox(title, text string) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	pMsgBox.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x40)
}
