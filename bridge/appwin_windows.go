//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"unsafe"
)

var (
	pConsoleWin = k32.NewProc("GetConsoleWindow")
	u32         = syscall.NewLazyDLL("user32.dll")
	pMsgBox     = u32.NewProc("MessageBoxW")
	pEnumWin    = u32.NewProc("EnumWindows")
	pWinText    = u32.NewProc("GetWindowTextW")
	pWinClass   = u32.NewProc("GetClassNameW")
	pWinVisible = u32.NewProc("IsWindowVisible")
	pIsIconic   = u32.NewProc("IsIconic")
	pShowWin    = u32.NewProc("ShowWindow")
	pSetFg      = u32.NewProc("SetForegroundWindow")
	pPostMsg    = u32.NewProc("PostMessageW")
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

// appWindows lists the open app windows: Edge/Chrome in "app" mode take the page
// title as is ("Data Engineer"), browser tabs add the browser name to it.
var enumCb = syscall.NewCallback(func(h, lp uintptr) uintptr {
	if v, _, _ := pWinVisible.Call(h); v == 0 {
		return 1
	}
	buf := make([]uint16, 128)
	n, _, _ := pWinClass.Call(h, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	if syscall.UTF16ToString(buf[:n]) != "Chrome_WidgetWin_1" {
		return 1
	}
	n, _, _ = pWinText.Call(h, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	if syscall.UTF16ToString(buf[:n]) == "Data Engineer" {
		enumFound = append(enumFound, h)
	}
	return 1
})

var (
	enumMu    sync.Mutex
	enumFound []uintptr
)

func appWindows() []uintptr {
	enumMu.Lock()
	defer enumMu.Unlock()
	enumFound = nil
	pEnumWin.Call(enumCb, 0)
	return enumFound
}

// focusAppWindow brings the open app window to the front; false if there is none.
func focusAppWindow() bool {
	l := appWindows()
	if len(l) == 0 {
		return false
	}
	if ic, _, _ := pIsIconic.Call(l[0]); ic != 0 {
		pShowWin.Call(l[0], 9) // SW_RESTORE
	}
	pSetFg.Call(l[0])
	return true
}

// closeAppWindows closes every app window (Edge may run the window in another process than the one we started).
func closeAppWindows() {
	for _, h := range appWindows() {
		pPostMsg.Call(h, 0x0010, 0, 0) // WM_CLOSE
	}
}
