#!/usr/bin/env python3
"""Write a small synthetic MoTeC .ld file (3 laps on an invented track) for the automatic test of the app.

usage: python3 tools/make_fixture_ld.py out.ld

No real telemetry goes in the repository: this file is made up, with the channels the app reads.
"""
import math, struct, sys

HZ = 50
LEN = 3000.0  # m


def track(d):
    """position (x, y) and curvature at distance d on a rounded rectangle with a chicane"""
    t = d / LEN * 2 * math.pi
    x = 520 * math.cos(t) + 60 * math.cos(3 * t)
    y = 260 * math.sin(t) - 40 * math.sin(2 * t)
    return x, y


def build():
    ch = {}
    names = ['Ground Speed', 'Throttle Pos', 'Brake Pos', 'Steering', 'Gear', 'Engine RPM', 'Engine Max RPM', 'Lap Number', 'Last Laptime', 'Current Sector',
             'GPS Latitude', 'GPS Longitude', 'G Force Lat', 'G Force Long', 'G Force Vert', 'Fuel Level', 'Battery Charge Level', 'Path Lateral', 'Track Edge',
             'Ambient Temperature', 'Track Temperature', 'Engine Torque', 'Motor Torque', 'Motor RPM', 'Front 3rd Pos', 'Rear 3rd Pos', 'Local Rotation Y']
    W = ['FL', 'FR', 'RL', 'RR']
    for w in W:
        names += [f'Tyre Temp {w} Inner', f'Tyre Temp {w} Centre', f'Tyre Temp {w} Outer', f'Tyre Rubber Temp {w} I', f'Tyre Rubber Temp {w} C', f'Tyre Rubber Temp {w} O',
                  f'Tyre Carcass Temp {w}', f'Tyre Pressure {w}', f'Tyre Wear {w}', f'Brake Temp {w}', f'Ride Height {w}', f'Wheel Rot Speed {w}', f'Susp Pos {w}',
                  f'Tyre Load {w}', f'Grip Fract {w}', f'Camber {w}']
    for n in names:
        ch[n] = []
    d = 0.0
    lap = 1
    lap_start = 0.0
    last = 0.0
    t = 0.0
    fuel, wear = 60.0, 0.0
    while lap <= 5:
        # curvature from three nearby points
        (x0, y0), (x1, y1), (x2, y2) = track(d - 5), track(d), track(d + 5)
        a = math.atan2(y1 - y0, x1 - x0)
        b = math.atan2(y2 - y1, x2 - x1)
        da = (b - a + math.pi) % (2 * math.pi) - math.pi
        k = da / 5.0
        v = max(70.0, min(300.0, 300.0 - abs(k) * 9000))
        # lookahead braking
        ahead = min(max(70.0, min(300.0, 300.0 - abs(((math.atan2(track(d + 125)[1] - track(d + 120)[1], track(d + 125)[0] - track(d + 120)[0]) - math.atan2(track(d + 120)[1] - track(d + 115)[1], track(d + 120)[0] - track(d + 115)[0]) + math.pi) % (2 * math.pi) - math.pi) / 5.0) * 9000)), v)
        brake = 100.0 if ahead < v - 25 else 0.0
        v = min(v, ahead + 25)
        thr = 0.0 if brake else (100.0 if abs(k) < 0.004 else 55.0)
        gear = max(1, min(7, int(v / 45) + 1))
        rpm = 4500 + (v % 45) / 45 * 3500
        glat = (v / 3.6) ** 2 * k / 9.81
        lat0, lon0 = 0.0, -135.0
        ch['Ground Speed'].append(v); ch['Throttle Pos'].append(thr); ch['Brake Pos'].append(brake); ch['Steering'].append(k * 900)
        ch['Gear'].append(gear); ch['Engine RPM'].append(rpm); ch['Engine Max RPM'].append(8200); ch['Lap Number'].append(lap); ch['Last Laptime'].append(last)
        ch['Current Sector'].append(0 if d < LEN / 3 else 1 if d < 2 * LEN / 3 else 2)
        ch['GPS Latitude'].append(lat0 + y1 / 110574.0); ch['GPS Longitude'].append(lon0 + x1 / 111320.0)
        ch['G Force Lat'].append(glat); ch['G Force Long'].append(-2.5 if brake else 0.4 if thr > 90 else 0.0); ch['G Force Vert'].append(0.05 * math.sin(d / 7))
        ch['Fuel Level'].append(fuel); ch['Battery Charge Level'].append(60 + 10 * math.sin(d / 400)); ch['Path Lateral'].append(3.5 * math.sin(d / 180)); ch['Track Edge'].append(6.5)
        ch['Ambient Temperature'].append(22); ch['Track Temperature'].append(34); ch['Engine Torque'].append(thr * 5.5); ch['Motor Torque'].append(thr * 1.2); ch['Motor RPM'].append(rpm * 2)
        ch['Front 3rd Pos'].append(6 + v / 60); ch['Rear 3rd Pos'].append(10 + v / 50); ch['Local Rotation Y'].append(k * v / 3.6)
        for i, w in enumerate(W):
            side = 1 if w.endswith('L') else -1
            base = 82 + 4 * side * math.copysign(1, glat) * min(1, abs(glat) / 2)
            ch[f'Tyre Temp {w} Inner'].append(base + 4); ch[f'Tyre Temp {w} Centre'].append(base + 2); ch[f'Tyre Temp {w} Outer'].append(base - 3)
            ch[f'Tyre Rubber Temp {w} I'].append(base + 3); ch[f'Tyre Rubber Temp {w} C'].append(base + 1); ch[f'Tyre Rubber Temp {w} O'].append(base - 2)
            ch[f'Tyre Carcass Temp {w}'].append(base); ch[f'Tyre Pressure {w}'].append(165 + (base - 82) * 0.3); ch[f'Tyre Wear {w}'].append(100 - wear)
            ch[f'Brake Temp {w}'].append(420 + (200 if brake else 0) + 30 * i); ch[f'Ride Height {w}'].append(30 - v / 40 + (4 if w[0] == 'R' else 0))
            ch[f'Wheel Rot Speed {w}'].append(v / 3.6 / 0.34); ch[f'Susp Pos {w}'].append(8 + glat * side * 2 + (3 if brake and w[0] == 'F' else 0))
            ch[f'Tyre Load {w}'].append(5000 + 1500 * side * glat / 3); ch[f'Grip Fract {w}'].append(min(100, abs(glat) * 30)); ch[f'Camber {w}'].append(-0.02)
        # advance
        ds = v / 3.6 / HZ
        d += ds
        t += 1.0 / HZ
        fuel -= 0.0009
        wear += 0.00004
        if d >= LEN:
            d -= LEN
            last = t - lap_start
            lap_start = t
            lap += 1
    return ch


def write(path, ch):
    names = list(ch)
    head = 0x800
    meta_size = 124
    meta0 = head
    data0 = meta0 + meta_size * len(names)
    out = bytearray(data0)
    struct.pack_into('<I', out, 8, meta0)
    for off, s, n in [(0x5e, '27/10/2026', 16), (0x7e, '12:00:00', 16), (0x9e, 'Test Driver', 64), (0xde, 'Test Car', 64), (0x15e, 'Fixture Raceway', 64)]:
        b = s.encode('latin1')[:n]
        out[off:off + len(b)] = b
    data = bytearray()
    for i, n in enumerate(names):
        p = meta0 + i * meta_size
        vals = ch[n]
        dp = data0 + len(data)
        nxt = p + meta_size if i < len(names) - 1 else 0
        struct.pack_into('<IIII', out, p, 0, nxt, dp, len(vals))
        struct.pack_into('<HHHhhhh', out, p + 18, 7, 4, HZ, 0, 1, 1, 0)
        nb = n.encode('latin1')[:31]
        out[p + 32:p + 32 + len(nb)] = nb
        data += struct.pack('<%df' % len(vals), *vals)
    open(path, 'wb').write(bytes(out) + bytes(data))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    write(sys.argv[1], build())
