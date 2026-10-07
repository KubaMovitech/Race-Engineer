package main

import (
	"math"
	"strings"
	"time"
)

// Field: what every car in the session does — laps (also the invalid ones),
// pit stops (time in the lane, time stationary, fuel/energy added, tyres
// changed), driver changes. Used for everyone's pace, the leaderboard, rivals
// and the session recording.

type pitRec struct {
	Lap    int     `json:"lap"`
	In     float64 `json:"in"`
	Out    float64 `json:"out"`
	Lane   float64 `json:"lane"`
	Stop   float64 `json:"stop"`
	Fuel   float64 `json:"fuel"` // fraction of tank added (-1 unknown)
	Ve     float64 `json:"ve"`   // fraction of energy added (-1 unknown)
	C0     string  `json:"c0"`   // compounds per wheel before (S/M/H/W)
	C1     string  `json:"c1"`   // after
	Tyres  int     `json:"tyres"`
	D0     string  `json:"d0"`
	D1     string  `json:"d1"`
	Garage bool    `json:"garage,omitempty"`
	wear0  [4]float64
}

type swapRec struct {
	Et   float64 `json:"et"`
	Lap  int     `json:"lap"`
	From string  `json:"from"`
	To   string  `json:"to"`
}

type fcar struct {
	Name    string      `json:"name"`
	Cls     string      `json:"cls"`
	Drivers []string    `json:"drivers"`
	Laps    [][]float64 `json:"laps"` // [n, t, et, pit, s1, s2, place, inv, fuel, ve, drv]
	Pits    []*pitRec   `json:"pits"`
	Swaps   []swapRec   `json:"swaps"`
	lastTL  int
	pit     bool
	lastLT  float64
	lastAt  time.Time
	lapET   float64
	inPits  bool
	cur     *pitRec
	stillET float64
	stillPS float64
	pendDrv string
	pendET  float64
	lastET  float64
	vmax    float64 // top speed in the current lap (km/h)
}

type Field struct {
	std     []M            // REST standings, fallback for fuel/energy of remote cars
	keys    map[int]string // slot ID -> car key (vehicle name, made unique if two cars share it)
	dirty   bool
	ses     string
	cars    map[string]*fcar
	changes M
	stream  []string
	seenStr map[string]int
}

func newField() *Field {
	return &Field{cars: map[string]*fcar{}, seenStr: map[string]int{}, keys: map[int]string{}}
}

// assignKeys gives each car a stable key: its vehicle name, or "name (slot)"
// when another car in the session uses the same name. The lowest slot keeps the
// plain name, so every bridge of the team gives every car the same key (with the
// player's car first, two teammates in cars with the same name both called
// theirs by the plain name and the Muretto jumped from one to the other).
func (fd *Field) assignKeys(f *Frame) {
	low := map[string]int{}
	for _, v := range f.Veh {
		veh, id := cstr(v, V_mVehicleName, 64), i32(v, V_mID)
		if l, ok := low[veh]; !ok || id < l {
			low[veh] = id
		}
	}
	for _, v := range f.Veh {
		veh, id := cstr(v, V_mVehicleName, 64), i32(v, V_mID)
		k := veh
		if low[veh] != id {
			k = veh + " (" + itoa(id) + ")"
		}
		fd.keys[id] = k
	}
}

func (fd *Field) keyOf(v []byte) string {
	if k, ok := fd.keys[i32(v, V_mID)]; ok {
		return k
	}
	return cstr(v, V_mVehicleName, 64)
}

func (fd *Field) change(kind string, v any) {
	if fd.changes == nil {
		fd.changes = M{}
	}
	fd.dirty = true
	l, _ := fd.changes[kind].([]any)
	fd.changes[kind] = append(l, v)
}

var compLetters = "SMHW"

// per-car extras from that car's telemetry row
func carTel(f *Frame, v []byte) (fuel, ve float64, comp string, wear [4]float64) {
	fuel, ve = -1, -1
	t := f.AllTel[i32(v, V_mID)]
	if t != nil {
		fl, cap := f64(t, T_mFuel), f64(t, T_mFuelCapacity)
		if fl > 0 && cap > 0 {
			fuel = fl / cap
		}
		if e := fin(f32(t, T_mVirtualEnergy)); e > 0 {
			ve = e
		}
		var b strings.Builder
		for i := 0; i < 4; i++ {
			ct := u8(t, T_mWheels+i*W_SIZE+W_mCompoundType)
			if ct < 4 {
				b.WriteByte(compLetters[ct])
			} else {
				b.WriteByte('?')
			}
			wear[i] = f64(t, T_mWheels+i*W_SIZE+W_mWear)
		}
		comp = b.String()
	}
	if fuel < 0 {
		if ff := u8(v, V_mFuelFraction); ff > 0 {
			fuel = float64(ff) / 255
		}
	}
	return
}

func (c *fcar) drvIdx(name string) int {
	for i, d := range c.Drivers {
		if d == name {
			return i
		}
	}
	c.Drivers = append(c.Drivers, name)
	return len(c.Drivers) - 1
}

func (fd *Field) update(f *Frame, ses string, now time.Time) {
	if ses != fd.ses {
		fd.ses = ses
		fd.cars = map[string]*fcar{}
		fd.changes = nil
		fd.stream = nil
		fd.seenStr = map[string]int{}
		fd.keys = map[int]string{}
	}
	fd.assignKeys(f)
	et := f64(f.Info, I_mCurrentET)
	for _, v := range f.Veh {
		veh := fd.keyOf(v)
		if cstr(v, V_mVehicleName, 64) == "" {
			continue
		}
		c := fd.cars[veh]
		tl := i16(v, V_mTotalLaps)
		lt := f64(v, V_mLastLapTime)
		drv := cstr(v, V_mDriverName, 32)
		if c == nil {
			c = &fcar{Name: drv, lastTL: tl, lastLT: lt, lapET: f64(v, V_mLapStartET), lastET: et}
			fd.cars[veh] = c
			c.drvIdx(drv)
		}
		c.Cls = cstr(v, V_mVehicleClass, 32)
		fuel, ve, comp, wear := carTel(f, v)
		if e := stdFor(fd.std, i32(v, V_mID), drv); e != nil {
			if fuel < 0 {
				if x := stdNum(e, "fuelFraction"); x >= 0 {
					fuel = x
				}
			}
			if ve < 0 {
				if x := stdNum(e, "veFraction", "virtualEnergyFraction", "virtualEnergy"); x >= 0 {
					if x > 1.5 {
						x /= 100
					}
					ve = x
				}
			}
		}
		inPits := u8(v, V_mInPits) != 0
		// driver change
		// (confirmed only if the new name stays for 5 s: names can flicker while
		// a driver joins, spectates or reconnects)
		if drv == "" || drv == c.Name {
			c.pendDrv = ""
		} else if drv != c.pendDrv {
			c.pendDrv, c.pendET = drv, et
		} else if et-c.pendET >= 5 {
			c.pendDrv = ""
			sw := swapRec{Et: r1(c.pendET), Lap: tl + 1, From: c.Name, To: drv}
			c.Swaps = append(c.Swaps, sw)
			fd.change("s", []any{veh, sw})
			c.Name = drv
			c.drvIdx(drv)
		}
		// top speed in this lap (sampled with the scoring, ~5 Hz)
		if spd := vlen(v, V_mLocalVel) * 3.6; !inPits && spd < 480 && spd > c.vmax {
			c.vmax = spd
		}
		// pit stops
		if inPits && !c.inPits {
			c.cur = &pitRec{Lap: tl + 1, In: r1(et), Fuel: fuel, Ve: ve, C0: comp, D0: c.Name, wear0: wear}
			c.stillET, c.stillPS = 0, 0
		}
		if inPits && c.cur != nil {
			if et > c.lastET {
				if vlen(v, V_mLocalVel) < 0.5 {
					c.stillET += et - c.lastET
				}
				if u8(v, V_mPitState) == 3 {
					c.stillPS += et - c.lastET
				}
			}
			if u8(v, V_mInGarageStall) != 0 {
				c.cur.Garage = true
			}
		}
		if !inPits && c.inPits && c.cur != nil {
			p := c.cur
			p.Out = r1(et)
			p.Lane = r1(p.Out - p.In)
			p.Stop = r1(math.Max(c.stillET, c.stillPS))
			if p.Fuel >= 0 && fuel >= 0 {
				p.Fuel = r3(fuel - p.Fuel)
			} else {
				p.Fuel = -1
			}
			if p.Ve >= 0 && ve >= 0 {
				p.Ve = r3(ve - p.Ve)
			} else {
				p.Ve = -1
			}
			p.C1, p.D1 = comp, c.Name
			for i := 0; i < 4; i++ {
				ch := i < len(comp) && i < len(p.C0) && comp[i] != p.C0[i]
				if wear[i] > 0 && p.wear0[i] > 0 && wear[i] > p.wear0[i]+0.02 {
					ch = true
				}
				if ch {
					p.Tyres++
				}
			}
			if p.Lane < 3600 {
				c.Pits = append(c.Pits, p)
				fd.change("p", []any{veh, p})
			}
			c.cur = nil
		}
		c.inPits = inPits
		c.lastET = et
		if inPits {
			c.pit = true
		}
		// laps: count only a single +1 step of the lap counter. Online, remote cars
		// can report jumps or garbage for a moment (garage, reconnect, slot reuse):
		// those just resync the counter instead of inventing laps.
		if tl > c.lastTL && (tl != c.lastTL+1 || tl > int(et/10)+3 || u8(v, V_mInGarageStall) != 0 && c.lastTL <= 0) {
			c.lastTL, c.lastLT, c.lapET = tl, lt, f64(v, V_mLapStartET)
			c.pit = inPits
			c.vmax = 0
		} else if tl > c.lastTL {
			p := 0.0
			if c.pit {
				p = 1
			}
			ls := f64(v, V_mLapStartET)
			t, inv := lt, 0.0
			if lt <= 0 { // invalid lap: the game hides the time; rebuild it from the lap start times
				inv = 1
				if ls > c.lapET && c.lapET > 0 {
					t = ls - c.lapET
				} else {
					t = 0
				}
			}
			if t < 0 || t > 3600 {
				t = 0
			}
			lap := []float64{float64(tl), r3(t), r2(ls), p, r3(f64(v, V_mLastSector1)), r3(f64(v, V_mLastSector2)), float64(u8(v, V_mPlace)), inv, r3(fuel), r3(ve), float64(c.drvIdx(c.Name)), r1(c.vmax)}
			c.vmax = 0
			c.Laps = append(c.Laps, lap)
			if len(c.Laps) > 500 {
				c.Laps = c.Laps[len(c.Laps)-500:]
			}
			c.lastTL, c.lastLT, c.lastAt, c.lapET = tl, lt, now, ls
			c.pit = inPits
			fd.change("l", []any{veh, lap})
		} else if tl < c.lastTL {
			c.lastTL = tl
		} else if lt != c.lastLT && lt > 0 && now.Sub(c.lastAt) < 4*time.Second && len(c.Laps) > 0 {
			// lap time arrived a tick after the lap count: fix the last lap
			last := c.Laps[len(c.Laps)-1]
			last[1], last[4], last[5], last[7] = r3(lt), r3(f64(v, V_mLastSector1)), r3(f64(v, V_mLastSector2)), 0
			c.lastLT = lt
			fd.change("l", []any{veh, last})
		}
	}
}

// top speed of the lap in progress
func (fd *Field) curVmax(key string) float64 {
	if c := fd.cars[key]; c != nil {
		return r1(c.vmax)
	}
	return 0
}

// stream lines worth keeping (not the per-sector <Score> lines)
func (fd *Field) addStream(s string) []string {
	if s == "" {
		return nil
	}
	var out []string
	cnt := map[string]int{}
	for _, ln := range strings.Split(s, "\n") {
		ln = strings.TrimSpace(ln)
		if !(strings.HasPrefix(ln, "<Incident") || strings.HasPrefix(ln, "<TrackLimits") || strings.HasPrefix(ln, "<Penalty") ||
			strings.HasPrefix(ln, "<Sector") || strings.HasPrefix(ln, "<ChatMessage")) {
			continue
		}
		cnt[ln]++
		if cnt[ln] > fd.seenStr[ln] {
			fd.seenStr[ln] = cnt[ln]
			out = append(out, ln)
		}
	}
	fd.stream = append(fd.stream, out...)
	if len(fd.stream) > 4000 {
		fd.stream = fd.stream[len(fd.stream)-4000:]
	}
	return out
}

// snapshot: last n laps per car (n<=0: all).
func (fd *Field) snapshot(n int) M {
	cars := M{}
	for k, c := range fd.cars {
		l := c.Laps
		if n > 0 && len(l) > n {
			l = l[len(l)-n:]
		}
		cars[k] = M{"name": c.Name, "cls": c.Cls, "drivers": c.Drivers, "laps": l, "pits": c.Pits, "swaps": c.Swaps}
	}
	return M{"ses": fd.ses, "cars": cars}
}

func (fd *Field) takeChanges() M {
	c := fd.changes
	fd.changes = nil
	return c
}
