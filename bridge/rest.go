package main

import (
	"encoding/json"
	"math"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
)

// LMU's local REST API (the game's own UI server on port 6397): pit stop
// estimate for what is selected in the pit menu, wear/damage, weather forecast.
// Polled in its own goroutine so a slow answer never touches the reader loop.

const lmuREST = "http://localhost:6397"

type RestState struct {
	mu      sync.Mutex
	pit     M
	wx      M
	std     []M
	stdAt   time.Time
	setup   M
	setupAt time.Time
	ses     int
	on      bool // poll pit data (player is driving)
	demo    bool
}

var restClient = &http.Client{Timeout: 1500 * time.Millisecond}

func getJSON(path string) (any, bool) {
	r, err := restClient.Get(lmuREST + path)
	if err != nil {
		return nil, false
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return nil, false
	}
	var v any
	if json.NewDecoder(r.Body).Decode(&v) != nil {
		return nil, false
	}
	return v, true
}

func jget(v any, keys ...any) any {
	for _, k := range keys {
		switch kk := k.(type) {
		case string:
			m, ok := v.(map[string]any)
			if !ok {
				return nil
			}
			v = m[kk]
		case int:
			a, ok := v.([]any)
			if !ok || kk >= len(a) {
				return nil
			}
			v = a[kk]
		}
	}
	return v
}
func jnum(v any) (float64, bool) {
	f, ok := v.(float64)
	if !ok || math.IsNaN(f) || math.IsInf(f, 0) {
		return 0, false
	}
	return f, true
}

func parsePit(est, rr any) M {
	out := M{}
	if m, ok := est.(map[string]any); ok {
		e := M{}
		for k, v := range m {
			if f, ok := jnum(v); ok {
				e[k] = r1(f)
			}
		}
		out["est"] = e
	}
	if rr != nil {
		w := M{}
		if f, ok := jnum(jget(rr, "wearables", "body", "aero")); ok {
			w["aero"] = r3(f)
		}
		for _, k := range []string{"brakes", "suspension", "tyres", "tires"} {
			if a, ok := jget(rr, "wearables", k).([]any); ok && len(a) >= 4 {
				var x []float64
				for i := 0; i < 4; i++ {
					f, _ := jnum(a[i])
					x = append(x, r3(f))
				}
				w[k] = x
			}
		}
		out["wear"] = w
		if f, ok := jnum(jget(rr, "fuelInfo", "maxVirtualEnergy")); ok {
			out["maxVE"] = r1(f)
		}
		var menu []M
		if items, ok := jget(rr, "pitMenu", "pitMenu").([]any); ok {
			for _, it := range items {
				name, _ := jget(it, "name").(string)
				if name == "" {
					continue
				}
				cur := jget(it, "currentSetting")
				val := ""
				if ci, ok := jnum(cur); ok {
					if t, ok := jget(it, "settings", int(ci), "text").(string); ok {
						val = t
					} else {
						val = itoa(int(ci))
					}
				} else if s, ok := cur.(string); ok {
					val = s
				}
				menu = append(menu, M{"n": name, "v": val})
			}
		}
		if len(menu) > 0 {
			out["menu"] = menu
		}
		// the game's own fuel / energy estimates and pit recommendations, as they come
		g := M{}
		flatten(jget(rr, "fuelInfo"), "fuelInfo", g, 0)
		flatten(jget(rr, "pitRecommendations"), "pitRecommendations", g, 0)
		flatten(jget(rr, "pitStopLength"), "pitStopLength", g, 0)
		if len(g) > 0 {
			out["game"] = g
		}
	}
	return out
}

func parseWx(v any, ses int) M {
	key := "RACE"
	if ses <= 4 {
		key = "PRACTICE"
	} else if ses <= 8 {
		key = "QUALIFY"
	}
	var nodes []M
	for _, n := range []string{"START", "NODE_25", "NODE_50", "NODE_75", "FINISH"} {
		node := jget(v, key, n)
		if node == nil {
			continue
		}
		g := func(k string) any {
			if f, ok := jnum(jget(node, k, "currentValue")); ok {
				return r1(f)
			}
			return nil
		}
		nodes = append(nodes, M{"sky": g("WNV_SKY"), "temp": g("WNV_TEMPERATURE"), "rain": g("WNV_RAIN_CHANCE"), "hum": g("WNV_HUMIDITY"), "wdir": g("WNV_WINDDIRECTION"), "wspd": g("WNV_WINDSPEED")})
	}
	if len(nodes) == 0 {
		return nil
	}
	return M{"ses": key, "nodes": nodes}
}

func (rs *RestState) loop() {
	var lastWx time.Time
	for {
		rs.mu.Lock()
		on, ses, demo := rs.on, rs.ses, rs.demo
		rs.mu.Unlock()
		if demo {
			rs.mu.Lock()
			rs.pit, rs.wx = demoPit(), demoWx()
			rs.std, rs.stdAt = demoStd(), time.Now()
			rs.setup, rs.setupAt = demoSetup(), time.Now()
			rs.mu.Unlock()
			time.Sleep(2 * time.Second)
			continue
		}
		if v, ok := getJSON("/rest/watch/standings"); ok {
			l := parseStandings(v)
			rs.mu.Lock()
			rs.std, rs.stdAt = l, time.Now()
			rs.mu.Unlock()
		}
		if on && time.Since(rs.setupAt) > 20*time.Second {
			if v, ok := getJSON("/rest/garage/getPlayerGarageData"); ok {
				st := parseSetup(v)
				rs.mu.Lock()
				rs.setup, rs.setupAt = st, time.Now()
				rs.mu.Unlock()
			}
		}
		if on {
			est, ok1 := getJSON("/rest/strategy/pitstop-estimate")
			rr, ok2 := getJSON("/rest/garage/UIScreen/RepairAndRefuel")
			if ok1 || ok2 {
				p := parsePit(est, rr)
				rs.mu.Lock()
				rs.pit = p
				rs.mu.Unlock()
			}
		}
		if time.Since(lastWx) > 60*time.Second {
			if v, ok := getJSON("/rest/sessions/weather"); ok {
				lastWx = time.Now()
				w := parseWx(v, ses)
				rs.mu.Lock()
				rs.wx = w
				rs.mu.Unlock()
			} else {
				lastWx = time.Now().Add(-45 * time.Second) // retry in 15 s
			}
		}
		if on {
			time.Sleep(2 * time.Second)
		} else {
			time.Sleep(5 * time.Second)
		}
	}
}

func (rs *RestState) get() (M, M) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	return rs.pit, rs.wx
}

// /rest/watch/standings: per-car fuel and virtual energy (also for the other cars).
var stdKeep = regexp.MustCompile(`(?i)(driver|vehicle|team|carNumber|number|slot|^id$|class|fuel|energy|^ve|ve[A-Z_]|pitstops|pitState|tire|tyre|compound)`)

func parseStandings(v any) []M {
	arr, ok := v.([]any)
	if !ok {
		return nil
	}
	var out []M
	for _, e := range arr {
		m, ok := e.(map[string]any)
		if !ok {
			continue
		}
		o := M{}
		for k, x := range m {
			if !stdKeep.MatchString(k) {
				continue
			}
			switch y := x.(type) {
			case float64:
				o[k] = r3(y)
			case string:
				if len(y) < 64 {
					o[k] = y
				}
			case bool:
				o[k] = y
			case []any:
				if len(y) <= 4 {
					o[k] = y
				}
			}
		}
		if len(o) > 0 {
			out = append(out, o)
		}
	}
	return out
}

func (rs *RestState) standings() []M {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	if time.Since(rs.stdAt) > 10*time.Second {
		return nil
	}
	return rs.std
}

// flatten copies scalar values of a small JSON tree into out with dotted keys.
func flatten(v any, prefix string, out M, depth int) {
	if v == nil || depth > 3 || len(out) > 60 {
		return
	}
	switch x := v.(type) {
	case map[string]any:
		for k, y := range x {
			flatten(y, prefix+"."+k, out, depth+1)
		}
	case []any:
		if len(x) <= 8 {
			for i, y := range x {
				flatten(y, prefix+"."+itoa(i), out, depth+1)
			}
		}
	case float64:
		out[prefix] = r3(x)
	case bool:
		out[prefix] = x
	case string:
		if len(x) <= 40 {
			out[prefix] = x
		}
	}
}

// /rest/garage/getPlayerGarageData: the setup in use, as the garage shows it (VM_* entries).
func parseSetup(v any) M {
	out := M{}
	var walk func(x any, depth int)
	walk = func(x any, depth int) {
		if depth > 4 || len(out) > 250 {
			return
		}
		switch y := x.(type) {
		case map[string]any:
			for k, z := range y {
				if strings.HasPrefix(k, "VM_") {
					if m, ok := z.(map[string]any); ok {
						if sv, ok := m["stringValue"].(string); ok && sv != "" && len(sv) < 48 {
							out[k] = sv
							continue
						}
						if f, ok := jnum(m["value"]); ok {
							out[k] = r3(f)
							continue
						}
					}
				}
				walk(z, depth+1)
			}
		case []any:
			for _, z := range y {
				walk(z, depth+1)
			}
		}
	}
	walk(v, 0)
	if len(out) == 0 {
		return nil
	}
	return out
}

func (rs *RestState) getSetup() M {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	if time.Since(rs.setupAt) > 5*time.Minute {
		return nil
	}
	return rs.setup
}

// stdFor finds the REST standings entry of a car (by slot ID, then driver name).
func stdFor(std []M, id int, drv string) M {
	for _, e := range std {
		for _, k := range []string{"slotID", "slotId", "id"} {
			if f, ok := e[k].(float64); ok && int(f) == id {
				return e
			}
		}
	}
	for _, e := range std {
		if s, ok := e["driverName"].(string); ok && s == drv {
			return e
		}
	}
	return nil
}

func stdStr(e M, keys ...string) string {
	for _, k := range keys {
		if s, ok := e[k].(string); ok && strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
		if f, ok := e[k].(float64); ok {
			return itoa(int(f))
		}
	}
	return ""
}

func stdNum(e M, keys ...string) float64 {
	for _, k := range keys {
		if f, ok := e[k].(float64); ok {
			return f
		}
	}
	return -1
}
