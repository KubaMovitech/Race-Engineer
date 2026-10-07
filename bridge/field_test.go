package main

import (
	"testing"
	"time"
)

func mkRow(id int, drv, veh string, player bool) []byte {
	v := make([]byte, V_SIZE)
	pi32(v, V_mID, id)
	pstr(v, V_mDriverName, 32, drv)
	pstr(v, V_mVehicleName, 64, veh)
	pstr(v, V_mVehicleClass, 32, "Hyper")
	if player {
		v[V_mIsPlayer] = 1
	}
	return v
}

func frameAt(et float64, rows ...[]byte) *Frame {
	in := make([]byte, I_SIZE)
	pf64(in, I_mCurrentET, et)
	return &Frame{Info: in, Veh: rows, AllTel: map[int][]byte{}}
}

func TestSameVehicleNameGetsOwnKey(t *testing.T) {
	fd := newField()
	for i := 0; i < 50; i++ {
		fd.update(frameAt(float64(i)*0.2, mkRow(3, "Me", "Team X #1", true), mkRow(7, "Other", "Team X #1", false)), "s", time.Now())
	}
	if len(fd.cars) != 2 {
		t.Fatalf("want 2 cars, got %d", len(fd.cars))
	}
	if fd.cars["Team X #1"] == nil || fd.cars["Team X #1"].Name != "Me" {
		t.Fatalf("lowest slot must keep the plain name")
	}
	for _, c := range fd.cars {
		if len(c.Swaps) != 0 {
			t.Fatalf("no driver change expected, got %v", c.Swaps)
		}
	}
}

func TestFlickeringNameIsNotASwap(t *testing.T) {
	fd := newField()
	et := 0.0
	for i := 0; i < 100; i++ {
		n := "A"
		if i%3 == 1 {
			n = "B"
		}
		fd.update(frameAt(et, mkRow(1, n, "Car #1", false)), "s", time.Now())
		et += 0.2
	}
	if s := fd.cars["Car #1"].Swaps; len(s) != 0 {
		t.Fatalf("flicker counted as swaps: %v", s)
	}
	for i := 0; i < 40; i++ { // real change: B stays
		fd.update(frameAt(et, mkRow(1, "B", "Car #1", false)), "s", time.Now())
		et += 0.2
	}
	if s := fd.cars["Car #1"].Swaps; len(s) != 1 || s[0].To != "B" {
		t.Fatalf("want one swap to B, got %v", s)
	}
}

func TestLapCounterJumpsAreIgnored(t *testing.T) {
	fd := newField()
	et := 100.0
	set := func(tl int, lt float64) {
		r := mkRow(5, "X", "Car #5", false)
		pi16(r, V_mTotalLaps, tl)
		pf64(r, V_mLastLapTime, lt)
		pf64(r, V_mLapStartET, et)
		fd.update(frameAt(et, r), "s", time.Now())
	}
	set(2, 90)
	et += 90
	set(3, 90) // real lap
	set(5000, 90)
	set(3, 90) // garbage and back
	et += 90
	set(4, 90) // real lap
	if n := len(fd.cars["Car #5"].Laps); n != 2 {
		t.Fatalf("want 2 laps, got %d: %v", n, fd.cars["Car #5"].Laps)
	}
}

// two teammates in cars with the same name: both bridges must use the same keys
func TestSameKeysOnEveryBridge(t *testing.T) {
	a, b := newField(), newField()
	a.update(frameAt(1, mkRow(7, "Anna", "Team X #1", true), mkRow(3, "Beppe", "Team X #1", false)), "s", time.Now())
	b.update(frameAt(1, mkRow(7, "Anna", "Team X #1", false), mkRow(3, "Beppe", "Team X #1", true)), "s", time.Now())
	for _, id := range []int{3, 7} {
		if a.keys[id] != b.keys[id] {
			t.Fatalf("slot %d: %q on one bridge, %q on the other", id, a.keys[id], b.keys[id])
		}
	}
	if a.keys[3] != "Team X #1" || a.keys[7] != "Team X #1 (7)" {
		t.Fatalf("lowest slot keeps the plain name, got %v", a.keys)
	}
}
