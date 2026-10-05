package main

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
	"strings"
	"time"
)

// Demo: a fake LMU_Data mapping driven by a small simulation, so the whole
// pipeline (reader → tracker → MQTT/local feed → Muretto) can be tested without the game.

type demoCar struct {
	id         int
	name, veh  string
	cls        string
	k          float64 // pace factor
	dist       float64 // total distance
	lapStart   float64
	best, last float64
	pits       int
	pitT       float64
	inPit      bool
	fuel, ve   float64
	comp       string
	lastInv    bool
	wear       float64
	v          float64
	jit        float64 // pace noise in the current sector (demo sector times vary)
	sec        int     // 1, 2, 0 like rF2 mSector
	cs1, cs2   float64 // current lap sector splits (cumulative)
	ls1, ls2   float64 // last lap splits (cumulative)
	bs1, bs2   float64
}

var demoCars []*demoCar
var demoStream []string

var demoSpeed = 1.0
var demoSes = 10

func startDemo() []byte {
	m := make([]byte, SHM_SIZE)
	const N = 2000
	const L = 4563.0
	xs, zs := make([]float64, N), make([]float64, N)
	for i := 0; i < N; i++ {
		th := 2 * math.Pi * float64(i) / N
		xs[i] = 900*math.Cos(th) + 180*math.Cos(3*th) + 60*math.Sin(5*th)
		zs[i] = 520*math.Sin(th) + 140*math.Sin(2*th)
	}
	// scale to length L
	tot := 0.0
	for i := 0; i < N; i++ {
		j := (i + 1) % N
		tot += math.Hypot(xs[j]-xs[i], zs[j]-zs[i])
	}
	sc := L / tot
	for i := range xs {
		xs[i] *= sc
		zs[i] *= sc
	}
	ds := L / N
	vmax := make([]float64, N)
	for i := 0; i < N; i++ {
		a, b, c := (i+N-5)%N, i, (i+5)%N
		h1 := math.Atan2(zs[b]-zs[a], xs[b]-xs[a])
		h2 := math.Atan2(zs[c]-zs[b], xs[c]-xs[b])
		d := math.Abs(math.Remainder(h2-h1, 2*math.Pi))
		curv := d / (5 * ds)
		v := 86.0
		if curv > 1e-5 {
			v = math.Min(86, math.Sqrt(2.6*9.81/curv))
		}
		vmax[i] = v
	}
	for it := 0; it < 3; it++ { // braking / traction limits
		for i := 2*N - 1; i >= 0; i-- {
			a, b := i%N, (i+1)%N
			vmax[a] = math.Min(vmax[a], math.Sqrt(vmax[b]*vmax[b]+2*30*ds))
		}
		for i := 0; i < 2*N; i++ {
			a, b := i%N, (i+1)%N
			vmax[b] = math.Min(vmax[b], math.Sqrt(vmax[a]*vmax[a]+2*7*ds))
		}
	}
	idx := func(d float64) int { return int(math.Mod(d, L)/ds) % N }
	names := []string{"Stefano Lai", "Luca Gibertini", "Sven Geelhoed", "Carlo Meninno", "Fabio Grigoletto", "Giovanni Marasca", "Vinicius Neto", "Adam Csaplar", "Marco Carrieri", "Oscar Pink", "Erik Del Fante", "Danilo La Rosa"}
	vehs := []string{"Cadillac V-Series.R #35", "Porsche 963 #6", "Toyota GR010 #7", "Ferrari 499P #50", "BMW M Hybrid V8 #20", "Alpine A424 #36", "Peugeot 9X8 #93", "Ferrari 296 LMGT3 #54", "Porsche 911 GT3 R #92", "BMW M4 LMGT3 #31", "Aston Martin Vantage #27", "Corvette Z06 #81"}
	cars := []*demoCar{}
	for i := range names {
		cls := "Hyper"
		k := 1 + 0.012*float64(i) + rand.Float64()*0.01
		if i >= 7 {
			cls, k = "LMGT3", 1.12+0.01*float64(i-7)
		}
		cars = append(cars, &demoCar{id: i, name: names[i], veh: vehs[i], cls: cls, k: k, dist: -float64(i) * 12, fuel: 1, ve: 1, comp: "MMMM", wear: 1})
	}
	cars[5].comp = "MMHH"
	demoCars = cars
	addStream := func(l string) {
		demoStream = append(demoStream, l)
		if len(demoStream) > 400 {
			demoStream = demoStream[len(demoStream)-400:]
		}
		b := []byte(strings.Join(demoStream, "\n") + "\n")
		if len(b) > STREAM_SIZE-1 {
			b = b[len(b)-STREAM_SIZE+1:]
		}
		copy(m[OFF_STREAM:], b)
		m[OFF_STREAM+len(b)] = 0
	}
	p := cars[0]
	fuel, ve, bat := 81.0, 1.0, 0.6
	wear := [4]float64{1, 1, 1, 1}
	carc := [4]float64{340, 340, 338, 338}
	brk := [4]float64{500, 500, 450, 450}
	et := 0.0
	invLap := -1
	impET := 0.0
	lapN := 0
	var lastSpd float64
	writeInfo := func() {
		o := OFF_SCORING_INFO
		pstr(m, o+I_mTrackName, 64, "Fuji Speedway")
		pi32(m, o+I_mSession, demoSes)
		pf64(m, o+I_mCurrentET, et)
		pf64(m, o+I_mEndET, 6*3600)
		pi32(m, o+I_mMaxLaps, 999999)
		pf64(m, o+I_mLapDist, L)
		pi32(m, o+I_mNumVehicles, len(cars))
		m[o+I_mGamePhase] = 5
		m[o+I_mInRealtime] = 1
		pstr(m, o+I_mPlayerName, 32, "Stefano Lai")
		rain := math.Max(0, math.Min(1, (et-600)/900))
		pf64(m, o+I_mRaining, rain*0.4)
		pf64(m, o+I_mDarkCloud, 0.2+rain*0.6)
		pf64(m, o+I_mAmbientTemp, 19.5-rain)
		pf64(m, o+I_mTrackTemp, 24-rain*3)
		pf64(m, o+I_mWind, 2.1)
		pf64(m, o+I_mMinPathWetness, rain*0.2)
		pf64(m, o+I_mMaxPathWetness, rain*0.5)
		pf64(m, o+I_mAvgPathWetness, rain*0.35)
		m[o+I_mGameMode] = 2
		pstr(m, o+I_mServerName, 32, "Daily Race 35")
		pf32(m, o+I_mSessionTimeRemaining, 6*3600-et)
		pf32(m, o+I_mTimeOfDay, 13*3600+et)
		m[o+I_mTrackGripLevel] = 3
		m[o+I_mTrackLimitsStepsPerPenalty] = 4
		m[OFF_GAME_VERSION] = 0x80
		pi32(m, OFF_GAME_VERSION, 14000)
		srt := append([]*demoCar(nil), cars...)
		sort.Slice(srt, func(a, b int) bool { return srt[a].dist > srt[b].dist })
		lead := srt[0]
		for pl, c := range srt {
			v := OFF_VEH_SCORING + c.id*V_SIZE
			pi32(m, v+V_mID, c.id)
			pstr(m, v+V_mDriverName, 32, c.name)
			m[v+V_mFuelFraction] = byte(math.Max(0, math.Min(1, c.fuel)) * 255)
			if c != p { // other cars' telemetry rows
				t := OFF_TELEM + c.id*T_SIZE
				pi32(m, t+T_mID, c.id)
				pf64(m, t+T_mFuel, c.fuel*90)
				pf64(m, t+T_mFuelCapacity, 90)
				if c.id%3 != 0 { // some cars without VE in telemetry, like online
					pf32(m, t+T_mVirtualEnergy, c.ve)
				}
				pstr(m, t+T_mVehicleModel, 30, strings.TrimSpace(c.veh[:strings.LastIndex(c.veh, "#")]))
				pstr(m, t+T_mFrontTireCompoundName, 18, map[byte]string{'M': "Medium", 'H': "Hard", 'W': "Wet", 'S': "Soft"}[c.comp[0]])
				pstr(m, t+T_mRearTireCompoundName, 18, map[byte]string{'M': "Medium", 'H': "Hard", 'W': "Wet", 'S': "Soft"}[c.comp[2]])
				for w := 0; w < 4; w++ {
					m[t+T_mWheels+w*W_SIZE+W_mCompoundType] = byte(strings.IndexByte(compLetters, c.comp[w]))
					pf64(m, t+T_mWheels+w*W_SIZE+W_mWear, c.wear)
				}
			}
			pstr(m, v+V_mVehicleName, 64, c.veh)
			pstr(m, v+V_mVehicleClass, 32, c.cls)
			laps := int(math.Floor(c.dist / L))
			if laps < 0 {
				laps = 0
			}
			pi16(m, v+V_mTotalLaps, laps)
			pf64(m, v+V_mLapDist, math.Mod(math.Mod(c.dist, L)+L, L))
			pf64(m, v+V_mBestLapTime, c.best)
			if c.lastInv {
				pf64(m, v+V_mLastLapTime, -1)
			} else {
				pf64(m, v+V_mLastLapTime, c.last)
			}
			pf64(m, v+V_mBestSector1, c.bs1)
			pf64(m, v+V_mBestSector2, c.bs2)
			pf64(m, v+V_mLastSector1, c.ls1)
			pf64(m, v+V_mLastSector2, c.ls2)
			pf64(m, v+V_mCurSector1, c.cs1)
			pf64(m, v+V_mCurSector2, c.cs2)
			m[v+V_mSector] = byte(c.sec)
			pi16(m, v+V_mNumPitstops, c.pits)
			if c == p {
				m[v+V_mIsPlayer] = 1
				m[v+V_mControl] = 0
			} else {
				m[v+V_mControl] = 2
			}
			ip := 0
			if c.inPit {
				ip = 1
			}
			m[v+V_mInPits] = byte(ip)
			m[v+V_mPitState] = 0
			if c.inPit {
				m[v+V_mPitState] = 2
				if c.pitT > 0 {
					m[v+V_mPitState] = 3
				}
			}
			pf64(m, v+V_mLapStartET, c.lapStart)
			m[v+V_mPlace] = byte(pl + 1)
			gap := (lead.dist - c.dist) / 70
			pf64(m, v+V_mTimeBehindLeader, gap)
			if pl > 0 {
				pf64(m, v+V_mTimeBehindNext, (srt[pl-1].dist-c.dist)/70)
			} else {
				pf64(m, v+V_mTimeBehindNext, 0)
			}
			i := idx(math.Max(c.dist, 0))
			pf64(m, v+V_mPos, xs[i])
			pf64(m, v+V_mPos+16, zs[i])
			pf64(m, v+V_mLocalVel+16, c.v)
			pf64(m, v+V_mTimeIntoLap, et-c.lapStart)
			pf64(m, v+V_mEstimatedLapTime, 90*c.k)
			m[v+V_mFinishStatus] = 0
		}
	}
	go func() {
		t := time.NewTicker(10 * time.Millisecond)
		step := 0
		for range t.C {
			dt := 0.01 * demoSpeed
			et += dt
			for _, c := range cars {
				i := idx(math.Max(c.dist, 0))
				v := vmax[i] / (c.k * (1 + c.jit))
				cld := math.Mod(math.Max(c.dist, 0), L)
				// sector splits at 1/3 and 2/3 of the lap
				if c.dist > 0 && c.lapStart > 0 {
					if c.sec == 1 && cld >= L/3 && cld < L/2 {
						c.cs1, c.sec, c.jit = et-c.lapStart, 2, rand.Float64()*0.014-0.005
					} else if c.sec == 2 && cld >= 2*L/3 {
						c.cs2, c.sec, c.jit = et-c.lapStart, 0, rand.Float64()*0.014-0.005
					}
				}
				clap := int(math.Floor(math.Max(c.dist, 0) / L))
				if c != p {
					every := 7 + c.id%4
					if clap > 0 && clap%every == 0 && cld < 300 && !c.inPit && c.pitT == 0 {
						c.inPit, c.pitT = true, 18+float64(c.id%5)*3
						c.pits++
					}
					if c.inPit && c.pitT > 0 && c.pitT-dt <= 0 {
						c.fuel, c.ve, c.wear = 1, 1, 1
						if et > 900 {
							c.comp = "WWWW"
						}
						if c.id == 3 {
							if c.name == "Carlo Meninno" {
								c.name = "Paolo Rossi"
							} else {
								c.name = "Carlo Meninno"
							}
						}
					}
					if c.inPit && cld > 400 {
						c.inPit, c.pitT = false, 0
					}
					c.fuel -= v * dt / (L * 13)
					c.ve -= v * dt / (L * 34)
					c.wear -= v * dt / (L * 110)
				}
				if c.inPit {
					v = 22
					if c.pitT > 0 {
						v = 0
						c.pitT -= dt
					}
				}
				c.v = v
				prevLap := math.Floor(c.dist / L)
				c.dist += v * dt
				if math.Floor(c.dist/L) > prevLap && c.dist > L {
					lt := et - c.lapStart
					c.lastInv = c != p && rand.Float64() < 0.12
					if c.lapStart > 0 && c.cs1 > 0 && c.cs2 > c.cs1 {
						c.ls1, c.ls2 = c.cs1, c.cs2
						if !c.lastInv && (c.bs1 == 0 || c.cs1 < c.bs1) {
							c.bs1 = c.cs1
						}
						if !c.lastInv && (c.bs2 == 0 || c.cs2 < c.bs2) {
							c.bs2 = c.cs2
						}
					}
					c.cs1, c.cs2, c.sec, c.jit = 0, 0, 1, rand.Float64()*0.014-0.005
					if c.lapStart > 0 {
						c.last = lt
						if !c.lastInv && (c.best == 0 || lt < c.best) {
							c.best = lt
						}
					}
					if c.lastInv {
						addStream(fmt.Sprintf(`<TrackLimits Driver="%s" ID="%d" Lap="%d" WarningPoints="0" CurrentPoints="1" Resolution="2" et="%.1f">Invalid Lap Cut Track</TrackLimits>`, c.name, c.id, int(c.dist/L)-1, et))
					}
					if rand.Float64() < 0.05 {
						o := cars[rand.Intn(len(cars))]
						if o != c {
							addStream(fmt.Sprintf(`<Incident et="%.1f">%s(%d) reported contact (%.2f) with another vehicle %s(%d)</Incident>`, et, c.name, c.id, 200+rand.Float64()*900, o.name, o.id))
						}
					}
					c.lapStart = et
				}
			}
			// player telemetry
			ld := math.Mod(math.Max(p.dist, 0), L)
			lap := int(math.Floor(math.Max(p.dist, 0) / L))
			if lap != lapN {
				lapN = lap
				if lap%3 == 1 {
					invLap = lap
				}
			}
			// pit every 9 laps
			if lap > 0 && lap%9 == 0 && ld < 300 && !p.inPit && p.pitT == 0 {
				p.inPit, p.pitT = true, 25
				p.pits++
				fuel, ve = 81, 1
				wear = [4]float64{1, 1, 1, 1}
			}
			if p.inPit && ld > 400 {
				p.inPit = false
				p.pitT = 0
			}
			i := idx(ld)
			spd := vmax[i] / p.k
			if p.inPit {
				spd = 22
			}
			acc := (spd - lastSpd) / dt
			lastSpd = spd
			thr, br := 0.0, 0.0
			if acc > 0.5 || spd > 85 {
				thr = 1
			} else if acc < -3 {
				br = math.Min(1, -acc/30)
			} else {
				thr = 0.4
			}
			fuel -= 2.07 / L * spd * dt
			ve -= 0.026 / L * spd * dt
			bat = 0.4 + 0.2*math.Sin(et/7)
			for w := 0; w < 4; w++ {
				wear[w] -= (0.009 + 0.001*float64(w)) / L * spd * dt
				tgt := 345 + br*8 + thr*3
				carc[w] += (tgt - carc[w]) * 0.002
				brk[w] += (br*900 - (brk[w]-300)*0.4) * dt
			}
			if lap == 3 && ld > 1200 && impET == 0 {
				impET = et
			}
			if step%5 == 0 {
				o := OFF_TELEM
				m[OFF_ACTIVE_VEH] = byte(len(cars))
				m[OFF_PLAYER_IDX] = 0
				m[OFF_PLAYER_HAS] = 1
				pi32(m, o+T_mID, 0)
				pf64(m, o+T_mElapsedTime, et)
				pi32(m, o+T_mLapNumber, lap)
				pf64(m, o+T_mLapStartET, p.lapStart)
				pstr(m, o+T_mVehicleName, 64, p.veh)
				pf64(m, o+T_mPos, xs[i])
				pf64(m, o+T_mPos+16, zs[i])
				pf64(m, o+T_mLocalVel+16, -spd)
				g := int(math.Min(7, 1+spd/14))
				pi32(m, o+T_mGear, g)
				pf64(m, o+T_mEngineRPM, 4000+math.Mod(spd*120, 4500))
				pf64(m, o+T_mEngineMaxRPM, 9000)
				pf64(m, o+T_mEngineWaterTemp, 88)
				pf64(m, o+T_mEngineOilTemp, 104)
				pf64(m, o+T_mUnfilteredThrottle, thr)
				pf64(m, o+T_mUnfilteredBrake, br)
				pf64(m, o+T_mUnfilteredSteering, math.Sin(float64(i)/40)*0.3)
				pf64(m, o+T_mFuel, fuel)
				pf64(m, o+T_mFuelCapacity, 90)
				pf32(m, o+T_mVirtualEnergy, ve)
				pf64(m, o+T_mBatteryChargeFraction, bat)
				pf64(m, o+T_mRearBrakeBias, 0.455)
				pf64(m, o+T_mDeltaBest, math.Sin(et/30)*0.4)
				m[o+T_mTC], m[o+T_mTCMax], m[o+T_mTCCut], m[o+T_mTCSlip] = 4, 11, 3, 5
				m[o+T_mABS], m[o+T_mABSMax], m[o+T_mMotorMap], m[o+T_mMotorMapMax] = 0, 0, 2, 5
				m[o+T_mFrontAntiSway], m[o+T_mRearAntiSway], m[o+T_mMigration] = 5, 3, 2
				m[o+T_mElectricBoostMotorState] = 2
				if lap == invLap && ld > 2000 {
					m[o+T_mLapInvalidated] = 1
				} else {
					m[o+T_mLapInvalidated] = 0
				}
				if impET > 0 {
					pf64(m, o+T_mLastImpactET, impET)
					pf64(m, o+T_mLastImpactMagnitude, 1830)
					m[o+T_mDentSeverity+1] = 1
				}
				pstr(m, o+T_mFrontTireCompoundName, 18, "Medium")
				pstr(m, o+T_mRearTireCompoundName, 18, "Medium")
				pf32(m, o+T_mTimeGapCarAhead, 1.2)
				pf32(m, o+T_mTimeGapCarBehind, 0.8)
				m[o+T_mTrackLimitsSteps] = byte(lap % 4)
				for w := 0; w < 4; w++ {
					wo := o + T_mWheels + w*W_SIZE
					pf64(m, wo+W_mBrakeTemp, brk[w]+273.15)
					pf64(m, wo+W_mPressure, 152+carc[w]/40)
					for k := 0; k < 3; k++ {
						pf64(m, wo+W_mTemperature+8*k, carc[w]+float64(k)*2-2+br*20)
						pf64(m, wo+W_mTireInnerLayerTemperature+8*k, carc[w]+float64(k))
					}
					pf64(m, wo+W_mTireCarcassTemperature, carc[w])
					pf64(m, wo+W_mWear, wear[w])
					pf64(m, wo+W_mRideHeight, 0.045)
				}
			}
			if step%20 == 0 {
				writeInfo()
			}
			step++
		}
	}()
	time.Sleep(300 * time.Millisecond)
	return m
}

func demoPit() M {
	return M{"est": M{"total": 31.4, "fuel": 18.2, "tires": 12.0, "damage": 6.5, "driverSwap": 0}, "maxVE": 100,
		"wear": M{"aero": 0.06, "brakes": []float64{0.18, 0.18, 0.12, 0.12}, "suspension": []float64{0, 0.02, 0, 0}},
		"menu": []M{{"n": "VIRTUAL ENERGY:", "v": "100%"}, {"n": "FUEL RATIO:", "v": "0.81"}, {"n": "TIRES:", "v": "Medium (4)"}, {"n": "DAMAGE:", "v": "Repair All"}, {"n": "DRIVER:", "v": "Stefano Lai"}}}
}

func demoWx() M {
	return M{"ses": "RACE", "nodes": []M{{"sky": 2.0, "temp": 19.0, "rain": 0.0}, {"sky": 4.0, "temp": 18.0, "rain": 30.0}, {"sky": 7.0, "temp": 17.0, "rain": 70.0}, {"sky": 8.0, "temp": 16.0, "rain": 85.0}, {"sky": 3.0, "temp": 17.0, "rain": 20.0}}}
}

func demoStd() []M {
	var out []M
	for _, c := range demoCars {
		out = append(out, M{"driverName": c.name, "vehicleName": c.veh, "fullTeamName": "Team " + strings.Fields(c.name)[1], "carNumber": strings.TrimPrefix(c.veh[strings.LastIndex(c.veh, "#"):], "#"), "slotID": float64(c.id), "fuelFraction": r3(c.fuel), "veFraction": r3(c.ve)})
	}
	return out
}

func demoSetup() M {
	return M{"VM_FRONT_WING": "P3", "VM_REAR_WING": "P5", "VM_BRAKE_BALANCE": "54.5:45.5", "VM_BRAKE_PRESSURE": "92%", "VM_TRACTION_CONTROL": "4", "VM_FRONT_ANTISWAY": "5", "VM_REAR_ANTISWAY": "3",
		"VM_FRONT_TIRE_PRESSURE": "152 kPa", "VM_REAR_TIRE_PRESSURE": "150 kPa", "VM_STEER_LOCK": "420 deg", "VM_RADIATOR": "2", "VM_FRONT_RIDE_HEIGHT": "4.5 cm"}
}
