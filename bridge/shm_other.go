//go:build !windows

package main

func openShm() ([]byte, func()) { return nil, nil }
func lowPriority()              {}
func setTitle(string)           {}
