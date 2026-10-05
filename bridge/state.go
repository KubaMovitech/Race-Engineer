package main

import (
	"math"
)

type M = map[string]any

func r1(v float64) float64 { return math.Round(v*10) / 10 }
func r2(v float64) float64 { return math.Round(v*100) / 100 }
func r3(v float64) float64 { return math.Round(v*1000) / 1000 }
func fin(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return v
}
func k2c(v float64) float64 {
	if v <= 0 {
		return 0
	}
	return r1(v - 273.15)
}

func vlen(b []byte, o int) float64 {
	x, y, z := f64(b, o), f64(b, o+8), f64(b, o+16)
	return math.Sqrt(x*x + y*y + z*z)
}

func playerRow(f *Frame) []byte {
	for _, v := range f.Veh {
		if v[V_mIsPlayer] != 0 {
			return v
		}
	}
	return nil
}

type lapAcc struct {
	n                    int
	startET              float64
	fuel0, ve0, bat0     float64
	wear0                [4]float64
	carc, bmax           [4]float64
	carcN                int
	vmax, rain, trk, air float64
	cnt                  int
	pit, inv             bool
	drv                  string
	coast, full, brk     float64 // seconds: no pedals above 60 km/h, full throttle, braking
	lastT                float64
}

type Tracker struct {
	sesKey    string
	lastET    float64
	lap       *lapAcc
	laps      []M
	events    []M
	inPits    bool
	pitFuel   float64
	pitWear   [4]float64
	impET     float64
	dents     [8]int
	flat      [4]bool
	ovh       bool
	pen       int
	flag      int
	fcy       int
	driving   bool
	invSent   bool
	samples   [][]float64
	car, cls  string
	driver    string
	changed   bool // laps or events changed since last publish
	stopStart float64
	stopDur   float64
}

func (t *Tracker) ev(f *Frame, kind string, extra M) {
	e := M{"k": kind, "et": r1(f64(f.Info, I_mCurrentET))}
	if t.lap != nil {
		e["lap"] = t.lap.n + 1
	}
	if t.driver != "" {
		e["drv"] = t.driver
	}
	for k, v := range extra {
		e[k] = v
	}
	t.events = append(t.events, e)
	if len(t.events) > 60 {
		t.events = t.events[len(t.events)-60:]
	}
	t.changed = true
}

func wheelOff(i int) int { return T_mWheels + i*W_SIZE }

// update runs at 10 Hz on the copied frame.
func (t *Tracker) update(f *Frame) {
	in := f.Info
	et := f64(in, I_mCurrentET)
	key := cstr(in, I_mTrackName, 64) + "|" + itoa(i32(in, I_mSession))
	pr := playerRow(f)
	if key != t.sesKey || et+5 < t.lastET {
		if t.sesKey != "" {
			t.ev(f, "ses", M{"trk": cstr(in, I_mTrackName, 64), "ses": i32(in, I_mSession)})
		}
		t.sesKey = key
		t.laps = nil
		t.lap = nil
		t.changed = true
	}
	t.lastET = et
	driving := f.Tel != nil && pr != nil && i8(pr, V_mControl) == 0
	if driving != t.driving {
		t.driving = driving
		if driving {
			t.driver = cstr(in, I_mPlayerName, 32)
			t.ev(f, "drv_on", nil)
		} else {
			t.ev(f, "drv_off", nil)
			t.lap = nil
		}
	}
	if pr != nil {
		t.car = cstr(pr, V_mVehicleName, 64)
		t.cls = cstr(pr, V_mVehicleClass, 32)
	}
	if !driving {
		return
	}
	tl := f.Tel
	spd := vlen(tl, T_mLocalVel) * 3.6
	t.samples = append(t.samples, []float64{r2(f64(tl, T_mElapsedTime)), r1(spd), r2(f64(tl, T_mUnfilteredThrottle)), r2(f64(tl, T_mUnfilteredBrake)), r2(f64(tl, T_mUnfilteredSteering)), float64(i32(tl, T_mGear))})
	if len(t.samples) > 40 {
		t.samples = t.samples[len(t.samples)-40:]
	}
	fuel := f64(tl, T_mFuel)
	ve := f32(tl, T_mVirtualEnergy)
	bat := f64(tl, T_mBatteryChargeFraction)
	var wear [4]float64
	for i := 0; i < 4; i++ {
		wear[i] = f64(tl, wheelOff(i)+W_mWear)
	}
	ln := i32(tl, T_mLapNumber)
	// lap change
	if t.lap == nil || ln != t.lap.n {
		if t.lap != nil && ln == t.lap.n+1 && t.lap.cnt > 20 {
			L := t.lap
			lt := f64(tl, T_mLapStartET) - L.startET
			lap := M{"n": L.n + 1, "t": r3(lt), "inv": L.inv, "pit": L.pit || t.inPits, "drv": L.drv,
				"fuel": r2(L.fuel0 - fuel), "ve": r3(L.ve0 - ve), "bat": r3(bat - L.bat0), "vmax": r1(L.vmax),
				"coast": r1(L.coast), "full": r3(L.full / math.Max(lt, 1)), "brk": r1(L.brk), "rain": r2(L.rain / float64(L.cnt)), "trk": r1(L.trk / float64(L.cnt)), "air": r1(L.air / float64(L.cnt)),
				"fuelEnd": r2(fuel), "veEnd": r3(ve), "et": r1(et)}
			if pr != nil {
				lap["s1"] = r3(f64(pr, V_mLastSector1))
				lap["s2"] = r3(f64(pr, V_mLastSector2))
				lap["pos"] = u8(pr, V_mPlace)
			}
			var ww, cc, bb []float64
			for i := 0; i < 4; i++ {
				ww = append(ww, r2((L.wear0[i]-wear[i])*100))
				c := 0.0
				if L.carcN > 0 {
					c = L.carc[i] / float64(L.carcN)
				}
				cc = append(cc, r1(c))
				bb = append(bb, r1(L.bmax[i]))
			}
			lap["wear"], lap["carc"], lap["bmax"] = ww, cc, bb
			t.laps = append(t.laps, lap)
			if len(t.laps) > 300 {
				t.laps = t.laps[len(t.laps)-300:]
			}
			t.changed = true
		}
		t.lap = &lapAcc{n: ln, startET: f64(tl, T_mLapStartET), fuel0: fuel, ve0: ve, bat0: bat, wear0: wear, drv: t.driver}
		t.invSent = false
	}
	L := t.lap
	L.cnt++
	if te := f64(tl, T_mElapsedTime); L.lastT > 0 && te > L.lastT && te-L.lastT < 1 {
		dt := te - L.lastT
		thr, brk := f64(tl, T_mUnfilteredThrottle), f64(tl, T_mUnfilteredBrake)
		if spd > 60 && thr < 0.05 && brk < 0.05 {
			L.coast += dt
		}
		if thr > 0.95 {
			L.full += dt
		}
		if brk > 0.05 {
			L.brk += dt
		}
		L.lastT = te
	} else {
		L.lastT = te
	}
	L.rain += f64(in, I_mRaining)
	L.trk += f64(in, I_mTrackTemp)
	L.air += f64(in, I_mAmbientTemp)
	if spd > L.vmax {
		L.vmax = spd
	}
	for i := 0; i < 4; i++ {
		w := wheelOff(i)
		if spd > 80 {
			L.carc[i] += k2c(f64(tl, w+W_mTireCarcassTemperature))
		}
		if b := k2c(f64(tl, w+W_mBrakeTemp)); b > L.bmax[i] {
			L.bmax[i] = b
		}
	}
	if spd > 80 {
		L.carcN++
	}
	if u8(tl, T_mLapInvalidated) != 0 {
		L.inv = true
		if !t.invSent {
			t.invSent = true
			t.ev(f, "inv", nil)
		}
	}
	// pits
	inPits := pr != nil && u8(pr, V_mInPits) != 0
	if pr != nil {
		if u8(pr, V_mPitState) == 3 {
			if t.stopStart == 0 {
				t.stopStart = et
			}
		} else if t.stopStart > 0 {
			t.stopDur += et - t.stopStart
			t.stopStart = 0
		}
	}
	if inPits {
		L.pit = true
	}
	if inPits != t.inPits {
		t.inPits = inPits
		if inPits {
			t.pitFuel = fuel
			t.pitWear = wear
			t.stopDur, t.stopStart = 0, 0
			t.ev(f, "pit_in", M{"fuel": r2(fuel), "ve": r3(ve)})
		} else {
			tyres := 0
			for i := 0; i < 4; i++ {
				if wear[i] > t.pitWear[i]+0.02 {
					tyres++
				}
			}
			t.ev(f, "pit_out", M{"add": r1(fuel - t.pitFuel), "ve": r3(ve), "tyres": tyres, "stop": r1(t.stopDur), "cf": cstr(tl, T_mFrontTireCompoundName, 18)})
		}
	}
	// damage
	if ie := f64(tl, T_mLastImpactET); ie > 0 && ie != t.impET {
		if t.impET != 0 || et-ie < 2 {
			t.ev(f, "hit", M{"mag": r1(f64(tl, T_mLastImpactMagnitude))})
		}
		t.impET = ie
	}
	for i := 0; i < 8; i++ {
		d := u8(tl, T_mDentSeverity+i)
		if d > t.dents[i] {
			t.ev(f, "dent", M{"z": i, "lvl": d})
		}
		t.dents[i] = d
	}
	for i := 0; i < 4; i++ {
		fl := u8(tl, wheelOff(i)+W_mFlat) != 0
		if fl && !t.flat[i] {
			t.ev(f, "flat", M{"w": i})
		}
		t.flat[i] = fl
	}
	ovh := u8(tl, T_mOverheating) != 0
	if ovh && !t.ovh {
		t.ev(f, "ovh", M{"water": r1(f64(tl, T_mEngineWaterTemp)), "oil": r1(f64(tl, T_mEngineOilTemp))})
	}
	t.ovh = ovh
	if pr != nil {
		if p := i16(pr, V_mNumPenalties); p > t.pen {
			t.ev(f, "pen", M{"n": p})
			t.pen = p
		} else {
			t.pen = p
		}
		if fl := u8(pr, V_mFlag); fl != t.flag {
			if fl == 6 {
				t.ev(f, "blue", nil)
			}
			t.flag = fl
		}
	}
	if y := i8(in, I_mYellowFlagState); y != t.fcy {
		if y > 0 || t.fcy > 0 {
			t.ev(f, "fcy", M{"s": y})
		}
		t.fcy = y
	}
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	neg := i < 0
	if neg {
		i = -i
	}
	var b []byte
	for i > 0 {
		b = append([]byte{byte('0' + i%10)}, b...)
		i /= 10
	}
	if neg {
		b = append([]byte{'-'}, b...)
	}
	return string(b)
}

// carMsg: full live state of the player's car.
func (t *Tracker) carMsg(f *Frame) M {
	tl, in := f.Tel, f.Info
	pr := playerRow(f)
	m := M{"et": r2(f64(in, I_mCurrentET)), "drv": t.driver, "car": t.car, "cls": t.cls}
	if tl == nil {
		return m
	}
	m["lap"] = i32(tl, T_mLapNumber) + 1
	m["gear"] = i32(tl, T_mGear)
	m["rpm"] = math.Round(f64(tl, T_mEngineRPM))
	m["rpmMax"] = math.Round(f64(tl, T_mEngineMaxRPM))
	m["spd"] = r1(vlen(tl, T_mLocalVel) * 3.6)
	m["thr"] = r2(f64(tl, T_mUnfilteredThrottle))
	m["brk"] = r2(f64(tl, T_mUnfilteredBrake))
	m["str"] = r2(f64(tl, T_mUnfilteredSteering))
	m["fuel"] = r2(f64(tl, T_mFuel))
	m["fuelCap"] = r1(f64(tl, T_mFuelCapacity))
	m["ve"] = r3(fin(f32(tl, T_mVirtualEnergy)))
	m["bat"] = r3(f64(tl, T_mBatteryChargeFraction))
	m["mot"] = u8(tl, T_mElectricBoostMotorState)
	m["water"] = r1(f64(tl, T_mEngineWaterTemp))
	m["oil"] = r1(f64(tl, T_mEngineOilTemp))
	m["lim"] = u8(tl, T_mSpeedLimiterActive)
	m["ovh"] = u8(tl, T_mOverheating)
	m["detached"] = u8(tl, T_mDetached)
	m["db"] = r3(fin(f64(tl, T_mDeltaBest)))
	m["inv"] = u8(tl, T_mLapInvalidated)
	m["bb"] = r1((1 - f64(tl, T_mRearBrakeBias)) * 100)
	m["tc"] = []int{u8(tl, T_mTC), u8(tl, T_mTCMax), u8(tl, T_mTCCut), u8(tl, T_mTCSlip)}
	m["abs"] = []int{u8(tl, T_mABS), u8(tl, T_mABSMax)}
	m["map"] = []int{u8(tl, T_mMotorMap), u8(tl, T_mMotorMapMax)}
	m["mig"] = u8(tl, T_mMigration)
	m["arb"] = []int{u8(tl, T_mFrontAntiSway), u8(tl, T_mRearAntiSway)}
	m["tcOn"] = u8(tl, T_mTCActive)
	m["absOn"] = u8(tl, T_mABSActive)
	m["tl"] = u8(tl, T_mTrackLimitsSteps)
	m["tlPen"] = u8(in, I_mTrackLimitsStepsPerPenalty)
	m["gaps"] = []float64{r2(fin(f32(tl, T_mTimeGapCarAhead))), r2(fin(f32(tl, T_mTimeGapCarBehind))), r2(fin(f32(tl, T_mTimeGapPlaceAhead))), r2(fin(f32(tl, T_mTimeGapPlaceBehind)))}
	var dents []int
	for i := 0; i < 8; i++ {
		dents = append(dents, u8(tl, T_mDentSeverity+i))
	}
	m["dents"] = dents
	m["imp"] = []float64{r1(f64(tl, T_mLastImpactET)), r1(f64(tl, T_mLastImpactMagnitude))}
	m["cf"] = cstr(tl, T_mFrontTireCompoundName, 18)
	m["cr"] = cstr(tl, T_mRearTireCompoundName, 18)
	m["hl"] = u8(tl, T_mHeadlights)
	var ws []M
	for i := 0; i < 4; i++ {
		w := wheelOff(i)
		ws = append(ws, M{
			"bt":   k2c(f64(tl, w+W_mBrakeTemp)),
			"p":    r1(f64(tl, w+W_mPressure)),
			"s":    []float64{k2c(f64(tl, w+W_mTemperature)), k2c(f64(tl, w+W_mTemperature+8)), k2c(f64(tl, w+W_mTemperature+16))},
			"c":    k2c(f64(tl, w+W_mTireCarcassTemperature)),
			"i":    []float64{k2c(f64(tl, w+W_mTireInnerLayerTemperature)), k2c(f64(tl, w+W_mTireInnerLayerTemperature+8)), k2c(f64(tl, w+W_mTireInnerLayerTemperature+16))},
			"wear": r3(f64(tl, w+W_mWear)),
			"flat": u8(tl, w+W_mFlat),
			"det":  u8(tl, w+W_mDetached),
			"surf": u8(tl, w+W_mSurfaceType),
			"rh":   r1(f64(tl, w+W_mRideHeight) * 1000),
		})
	}
	m["w"] = ws
	if pr != nil {
		m["pos"] = u8(pr, V_mPlace)
		m["pit"] = u8(pr, V_mInPits)
		m["pitState"] = u8(pr, V_mPitState)
		m["pits"] = i16(pr, V_mNumPitstops)
		m["pen"] = i16(pr, V_mNumPenalties)
		m["last"] = r3(f64(pr, V_mLastLapTime))
		m["best"] = r3(f64(pr, V_mBestLapTime))
		m["til"] = r2(f64(pr, V_mTimeIntoLap))
		m["estL"] = r2(f64(pr, V_mEstimatedLapTime))
		m["ld"] = r1(f64(pr, V_mLapDist))
		m["flag"] = u8(pr, V_mFlag)
		m["id"] = i32(pr, V_mID)
	}
	m["x"] = r1(f64(tl, T_mPos))
	m["z"] = r1(f64(tl, T_mPos+16))
	m["smp"] = t.samples
	t.samples = nil
	return m
}

// scMsg: session, weather and the whole field (compact rows).
func scMsg(f *Frame, fd *Field, std []M) M {
	in := f.Info
	info := M{
		"trk": cstr(in, I_mTrackName, 64), "ses": i32(in, I_mSession), "et": r1(f64(in, I_mCurrentET)), "end": r1(f64(in, I_mEndET)),
		"maxLaps": i32(in, I_mMaxLaps), "lapDist": r1(f64(in, I_mLapDist)), "phase": u8(in, I_mGamePhase), "yel": i8(in, I_mYellowFlagState),
		"sf": []int{i8(in, I_mSectorFlag), i8(in, I_mSectorFlag+1), i8(in, I_mSectorFlag+2)}, "plr": cstr(in, I_mPlayerName, 32),
		"cloud": r2(f64(in, I_mDarkCloud)), "rain": r2(f64(in, I_mRaining)), "air": r1(f64(in, I_mAmbientTemp)), "tt": r1(f64(in, I_mTrackTemp)),
		"wind": r1(vlen(in, I_mWind)), "wmin": r2(f64(in, I_mMinPathWetness)), "wmax": r2(f64(in, I_mMaxPathWetness)), "wavg": r2(fin(f64(in, I_mAvgPathWetness))),
		"mode": u8(in, I_mGameMode), "srv": cstr(in, I_mServerName, 32), "rem": r1(fin(f32(in, I_mSessionTimeRemaining))), "tod": r1(fin(f32(in, I_mTimeOfDay))),
		"grip": u8(in, I_mTrackGripLevel), "tlPt": u8(in, I_mTrackLimitsStepsPerPoint), "tlPen": u8(in, I_mTrackLimitsStepsPerPenalty), "cov": u8(in, I_mCloudCoverage), "nv": i32(in, I_mNumVehicles), "ver": f.Version,
	}
	var rows [][]any
	for _, v := range f.Veh {
		rows = append(rows, []any{
			i32(v, V_mID), cstr(v, V_mDriverName, 32), fd.keyOf(v), cstr(v, V_mVehicleClass, 32),
			u8(v, V_mPlace), i16(v, V_mTotalLaps), r1(f64(v, V_mLapDist)), r3(f64(v, V_mBestLapTime)), r3(f64(v, V_mLastLapTime)),
			r3(f64(v, V_mBestSector1)), r3(f64(v, V_mBestSector2)), r3(f64(v, V_mLastSector1)), r3(f64(v, V_mLastSector2)),
			i16(v, V_mNumPitstops), i16(v, V_mNumPenalties), u8(v, V_mInPits), u8(v, V_mPitState),
			r2(f64(v, V_mTimeBehindLeader)), i32(v, V_mLapsBehindLeader), r2(f64(v, V_mTimeBehindNext)), i32(v, V_mLapsBehindNext),
			r1(f64(v, V_mPos)), r1(f64(v, V_mPos+16)), r1(vlen(v, V_mLocalVel) * 3.6), i8(v, V_mControl), u8(v, V_mIsPlayer),
			u8(v, V_mFlag), i8(v, V_mFinishStatus), r2(f64(v, V_mTimeIntoLap)), r2(f64(v, V_mEstimatedLapTime)), u8(v, V_mInGarageStall), i8(v, V_mSector),
		})
		fuel, ve, comp, _ := carTel(f, v)
		cf, cr, dents, det, tls := "", "", 0, 0, 0
		if t := f.AllTel[i32(v, V_mID)]; t != nil {
			cf, cr = cstr(t, T_mFrontTireCompoundName, 18), cstr(t, T_mRearTireCompoundName, 18)
			for i := 0; i < 8; i++ {
				dents += u8(t, T_mDentSeverity+i)
			}
			det = u8(t, T_mDetached)
			for i := 0; i < 4; i++ {
				if u8(t, T_mWheels+i*W_SIZE+W_mDetached) != 0 || u8(t, T_mWheels+i*W_SIZE+W_mFlat) != 0 {
					det = 2
				}
			}
			tls = u8(t, T_mTrackLimitsSteps)
		}
		model, team, num := "", "", ""
		if t := f.AllTel[i32(v, V_mID)]; t != nil {
			model = cstr(t, T_mVehicleModel, 30)
		}
		if e := stdFor(std, i32(v, V_mID), cstr(v, V_mDriverName, 32)); e != nil {
			team = stdStr(e, "fullTeamName", "teamName", "team")
			num = stdStr(e, "carNumber", "number", "vehicleNumber")
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
		row := rows[len(rows)-1]
		row = append(row, r3(fuel), r3(ve), comp, cf, cr, dents, det, tls, i32(v, V_mQualification),
			r3(fin(f32(v, V_mBestLapSector1))), r3(fin(f32(v, V_mBestLapSector2))), r3(f64(v, V_mCurSector1)), r3(f64(v, V_mCurSector2)), r2(f64(v, V_mLapStartET)), model, team, num, fd.curVmax(fd.keyOf(v)))
		rows[len(rows)-1] = row
	}
	return M{"i": info, "v": rows}
}
