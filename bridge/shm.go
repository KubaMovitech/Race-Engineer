package main

import (
	"encoding/binary"
	"math"
	"strings"
)

// LMU_Data container layout (SharedMemoryInterface.hpp: SharedMemoryObjectOut)
const (
	SHM_SIZE         = 324820
	OFF_GAME_VERSION = 64
	OFF_SCORING_INFO = 1632
	OFF_VEH_SCORING  = OFF_SCORING_INFO + I_SIZE + 12
	OFF_ACTIVE_VEH   = 128464
	OFF_PLAYER_IDX   = OFF_ACTIVE_VEH + 1
	OFF_PLAYER_HAS   = OFF_ACTIVE_VEH + 2
	OFF_TELEM        = OFF_ACTIVE_VEH + 4
	MAX_VEH          = 104
)

func f64(b []byte, o int) float64 { return math.Float64frombits(binary.LittleEndian.Uint64(b[o:])) }
func f32(b []byte, o int) float64 {
	return float64(math.Float32frombits(binary.LittleEndian.Uint32(b[o:])))
}
func i32(b []byte, o int) int { return int(int32(binary.LittleEndian.Uint32(b[o:]))) }
func i16(b []byte, o int) int { return int(int16(binary.LittleEndian.Uint16(b[o:]))) }
func u8(b []byte, o int) int  { return int(b[o]) }
func i8(b []byte, o int) int  { return int(int8(b[o])) }
func cstr(b []byte, o, n int) string {
	s := b[o : o+n]
	for i, c := range s {
		if c == 0 {
			s = s[:i]
			break
		}
	}
	return strings.ToValidUTF8(strings.TrimSpace(string(s)), "")
}

func pf64(b []byte, o int, v float64) { binary.LittleEndian.PutUint64(b[o:], math.Float64bits(v)) }
func pf32(b []byte, o int, v float64) {
	binary.LittleEndian.PutUint32(b[o:], math.Float32bits(float32(v)))
}
func pi32(b []byte, o int, v int) { binary.LittleEndian.PutUint32(b[o:], uint32(int32(v))) }
func pi16(b []byte, o int, v int) { binary.LittleEndian.PutUint16(b[o:], uint16(int16(v))) }
func pstr(b []byte, o, n int, s string) {
	for i := 0; i < n; i++ {
		b[o+i] = 0
	}
	copy(b[o:o+n-1], s)
}

// Frame is one coherent copy of the parts we use.
type Frame struct {
	Info      []byte         // scoring info
	Veh       [][]byte       // vehicle scoring rows
	Tel       []byte         // player telemetry row (nil when not driving)
	AllTel    map[int][]byte // telemetry of every car, by slot ID (fuel, energy, tyres, damage)
	HasPlayer bool
	Version   int
}

// readFrame copies only what is needed (a few KB) and checks two clocks the game
// touches to make sure no write landed in the middle of the copy.
func readFrame(m []byte, withVeh bool) (*Frame, bool) {
	for try := 0; try < 5; try++ {
		et0 := f64(m, OFF_SCORING_INFO+I_mCurrentET)
		has := m[OFF_PLAYER_HAS] != 0
		idx := int(m[OFF_PLAYER_IDX])
		nact := int(m[OFF_ACTIVE_VEH])
		if idx >= MAX_VEH || idx >= nact {
			has = false
		}
		toff := OFF_TELEM + idx*T_SIZE
		pe0 := f64(m, toff+T_mElapsedTime)
		n := i32(m, OFF_SCORING_INFO+I_mNumVehicles)
		if n < 0 {
			n = 0
		}
		if n > MAX_VEH {
			n = MAX_VEH
		}
		f := &Frame{HasPlayer: has, Version: i32(m, OFF_GAME_VERSION)}
		f.Info = append([]byte(nil), m[OFF_SCORING_INFO:OFF_SCORING_INFO+I_SIZE]...)
		if has {
			f.Tel = append([]byte(nil), m[toff:toff+T_SIZE]...)
		}
		if nact > MAX_VEH {
			nact = MAX_VEH
		}
		if withVeh {
			tblk := append([]byte(nil), m[OFF_TELEM:OFF_TELEM+nact*T_SIZE]...)
			f.AllTel = make(map[int][]byte, nact)
			for i := 0; i < nact; i++ {
				row := tblk[i*T_SIZE : (i+1)*T_SIZE]
				f.AllTel[i32(row, T_mID)] = row
			}
			blk := append([]byte(nil), m[OFF_VEH_SCORING:OFF_VEH_SCORING+n*V_SIZE]...)
			for i := 0; i < n; i++ {
				f.Veh = append(f.Veh, blk[i*V_SIZE:(i+1)*V_SIZE])
			}
		}
		if f64(m, OFF_SCORING_INFO+I_mCurrentET) == et0 && f64(m, toff+T_mElapsedTime) == pe0 &&
			i32(m, OFF_SCORING_INFO+I_mNumVehicles) == i32(f.Info, I_mNumVehicles) {
			return f, true
		}
	}
	return nil, false
}

// Results stream (same lines as the <Stream> of the results .xml: incidents,
// track limits, penalties, chat...).
const OFF_STREAM = OFF_VEH_SCORING + MAX_VEH*V_SIZE
const STREAM_SIZE = 65536

func readStream(m []byte) string {
	b := m[OFF_STREAM : OFF_STREAM+STREAM_SIZE]
	n := 0
	for n < len(b) && b[n] != 0 {
		n++
	}
	return strings.ToValidUTF8(string(b[:n]), "")
}

// vehicle scoring fields inside the old expansion block (LMU 1.x)
const (
	V_mSteamID      = V_mExpansion
	V_mVehFilename  = V_mExpansion + 8
	V_mFuelFraction = V_mExpansion + 42
)
