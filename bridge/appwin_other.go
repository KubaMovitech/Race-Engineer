//go:build !windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
)

func hasConsole() bool { return true }
func appDataDir() string {
	d := filepath.Join(os.TempDir(), "DataEngineer")
	os.MkdirAll(d, 0755)
	return d
}
func openAppWindow(url string) *exec.Cmd { return nil }
func msgBox(title, text string)          {}
