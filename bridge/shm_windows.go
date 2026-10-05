//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

var (
	k32        = syscall.NewLazyDLL("kernel32.dll")
	pOpenMap   = k32.NewProc("OpenFileMappingW")
	pMapView   = k32.NewProc("MapViewOfFile")
	pUnmapView = k32.NewProc("UnmapViewOfFile")
	pSetPrio   = k32.NewProc("SetPriorityClass")
	pCurProc   = k32.NewProc("GetCurrentProcess")
	pSetTitle  = k32.NewProc("SetConsoleTitleW")
)

const fileMapRead = 0x0004

func openShm() ([]byte, func()) {
	name, _ := syscall.UTF16PtrFromString("LMU_Data")
	h, _, _ := pOpenMap.Call(fileMapRead, 0, uintptr(unsafe.Pointer(name)))
	if h == 0 {
		return nil, nil
	}
	addr, _, _ := pMapView.Call(h, fileMapRead, 0, 0, 0)
	if addr == 0 {
		syscall.CloseHandle(syscall.Handle(h))
		return nil, nil
	}
	ptr := *(*unsafe.Pointer)(unsafe.Pointer(&addr))
	b := unsafe.Slice((*byte)(ptr), SHM_SIZE)
	return b, func() { pUnmapView.Call(addr); syscall.CloseHandle(syscall.Handle(h)) }
}

// Below-normal priority: the game always wins the CPU.
func lowPriority() {
	h, _, _ := pCurProc.Call()
	pSetPrio.Call(h, 0x00004000)
}

func setTitle(s string) {
	p, _ := syscall.UTF16PtrFromString(s)
	pSetTitle.Call(uintptr(unsafe.Pointer(p)))
}
