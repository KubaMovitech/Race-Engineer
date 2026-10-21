#!/usr/bin/env python3
"""Read the official LMU "Balance of Performance & Track Config" PDF into app/bop_data.js.

usage: python3 tools/bop_pdf.py LMU_BOP_1.4.3_Marked-up.pdf

Needs pdftotext (poppler). Every version read is kept in app/bop_data.js (newest first), so the app can show
what changed between two documents. The "(+5)" marks of a marked-up PDF are kept as the change against the
previous version.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'bop_data.js')

# (manufacturer, model, regex that finds the line with the numbers)
CARS = {
    'HY': [('Alpine', 'A424', r'\bA424\b'), ('Aston Martin', 'Valkyrie', r'\bValkyrie\b'), ('BMW', 'M Hybrid V8', r'M Hybrid V8'),
           ('Cadillac', 'V-Series.R', r'V-Series\.R'), ('Ferrari', '499P', r'\b499P\b'), ('Genesis', 'GMR-001', r'GMR-001'),
           ('Glickenhaus', 'SCG 007', r'SCG 007'), ('Isotta', 'Tipo 6', r'Tipo 6'), ('Lamborghini', 'SC63', r'\bSC63\b'),
           ('Peugeot', '9x8', r'\b9x8\s+(?!Evo)\d'), ('Peugeot', '9x8 Evo', r'\b9x8 Evo\b'), ('Porsche', '963', r'\b963\s+\d'),
           ('Toyota', 'GR010', r'\bGR010\b'), ('Vanwall', 'Vandervell 680', r'Vandervell 680')],
    'GT3': [('Aston Martin', 'Vantage AMR LMGT3', r'^\s*Aston Martin\s+\d'), ('BMW', 'M4 LMGT3', r'M4 LMGT3'),
            ('Corvette', 'Z06 LMGT3.R', r'Z06 LMGT3'), ('Ferrari', '296 LMGT3', r'296 LMGT3'), ('Ford', 'Mustang LMGT3', r'Mustang LMGT3'),
            ('Lamborghini', 'Huracan LMGT3 Evo2', r'^\s*Lamborghini\s+\d'), ('Lexus', 'RC F LMGT3', r'RC F LMGT3'),
            ('McLaren', '720S LMGT3 Evo', r'720S LMGT3'), ('Mercedes', 'AMG LMGT3', r'AMG LMGT3'), ('Porsche', '911 GT3 R', r'911 GT3 R\b')],
    'GTE': [('Aston Martin', 'Vantage AMR', r'Vantage AMR\s+\d'), ('Corvette', 'C8.R', r'\bC8\.R\b'), ('Ferrari', '488 GTE Evo', r'488 GTE Evo'),
            ('Porsche', '911 RSR-19', r'911 RSR-19')],
    'LMP2': [('Oreca', '07 ELMS', r'\b07 ELMS\b'), ('Oreca', '07 WEC', r'\b07 WEC\b')],
    'LMP3': [('ADESS', 'AD25', r'\bAD25\b'), ('Duqueine', 'D09', r'\bD09\b'), ('Ginetta', 'G61-LT-P325-Evo', r'G61-LT-P325-Evo'), ('Ligier', 'JS P325', r'JS P325')],
}
# columns after the car name, in the order of the document
COLS = {
    'HY': ['kg', 'kw', 's1', 's2', 'kw2', 'dep', 'mj', 'dock'],
    'GT3': ['kg', 'pw', 's1', 's2', 'pw2', 'mj', 'wmin', 'wmax', 'rh'],
    'GTE': ['kg', 'pw', 'tank', 'refuel', 'aero'],
    'LMP2': ['kg', 'power', 'rpm', 'tank', 'aero', 'dive', 'cover', 'gurney', 'strakes'],
    'LMP3': ['kg', 'dive', 'cover'],
}
HEAD = {'HYPERCAR': 'HY', 'LMGT3': 'GT3', 'LMGTE': 'GTE', 'LMP2': 'LMP2', 'LMP3': 'LMP3'}
VAL = re.compile(r'(-?\d+(?:\.\d+)?)[²³]?(?:\s*\(([+-]?\d+(?:\.\d+)?)\))?|(-)(?=\s|$)')


def num(s):
    f = float(s)
    return int(f) if f.is_integer() else f


def values(tail, cls):
    """The numbers (and words for LMP2/3) after the car name; returns (dict, changes)."""
    keys = COLS[cls]
    tail = re.split(r'\s{2,}[¹²³⁴⁵⁶⁷]\s', tail)[0]  # footnotes printed on the same line
    if cls in ('LMP2', 'LMP3', 'GTE'):
        toks = [t.strip() for t in re.split(r'\s{2,}', tail.strip()) if t.strip()]
        out, chg = {}, {}
        for k, t in zip(keys, toks):
            m = re.fullmatch(r'(-?\d+(?:\.\d+)?)[²³]?(?:\s*\(([+-]?\d+(?:\.\d+)?)\))?', t)
            if m:
                out[k] = num(m.group(1))
                if m.group(2): chg[k] = num(m.group(2))
            else:
                out[k] = t
        return out, chg
    out, chg, i = {}, {}, 0
    for m in VAL.finditer(tail):
        if i >= len(keys): break
        k = keys[i]; i += 1
        if m.group(3):
            out[k] = None
            continue
        out[k] = num(m.group(1))
        if m.group(2): chg[k] = num(m.group(2))
    return out, chg


def parse(txt):
    pages = txt.split('\f')
    meta, tracks = {}, {}
    for pg in pages:
        lines = pg.split('\n')
        name = None
        for i, ln in enumerate(lines):
            m = re.match(r'^\s*(\S.*?)\s{3,}.*Version\s+([\d.]+)', ln)
            if m and 'Date' not in ln.split(m.group(1))[0]:
                name = m.group(1).strip()
                if name.startswith('Dry Tyre') or name.startswith('Vehicles'): name = None; continue
                meta['ver'] = m.group(2)
                tyres = re.findall(r'\b(Soft|Medium|Hard|Wet)\b', ln.split('Compounds')[1]) if 'Compounds' in ln else None
                T = tracks.setdefault(name, {'layouts': [], 'cls': {}})
                if tyres: T['tyres'] = tyres
                prev = lines[i - 1] if i else ''
                if ',' in prev or (prev.strip() and 'Date' in prev and not prev.strip().startswith('Date')):
                    lay = prev.split('Date')[0].strip()
                    if lay and not T['layouts']: T['layouts'] = [x.strip() for x in lay.split(',') if x.strip()]
                break
            if 'Date' in ln:
                d = re.search(r'Date\s+(\d\d/\d\d/\d{4})', ln)
                if d: meta['date'] = d.group(1)
        if not name:
            continue
        T = tracks[name]
        acf = re.search(r'Ambient Correction Factor[\s\S]*?\n\s*(0\.\d+|1(?:\.\d+)?)\s*\n', pg)
        if acf: T['acf'] = float(acf.group(1))
        cls = None
        for ln in lines:
            h = re.match(r'^\s*(HYPERCAR|LMGT3|LMGTE|LMP2|LMP3)\s', ln + ' ')
            if h: cls = HEAD[h.group(1)]; continue
            if not cls: continue
            for mfr, model, rx in CARS[cls]:
                m = re.search(rx, ln)
                if not m: continue
                # the numbers start after the model name (or the manufacturer for the 3-line names)
                start = m.end() if not rx.endswith(r'\d') else m.end() - 1
                v, c = values(ln[start:], cls)
                if 'kg' not in v or not isinstance(v['kg'], (int, float)): continue
                row = {'mfr': mfr, 'model': model, **v}
                if c: row['d'] = c
                lst = T['cls'].setdefault(cls, [])
                if not any(r['model'] == model for r in lst): lst.append(row)
                break
    return meta, tracks


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    txt = subprocess.run(['pdftotext', '-layout', sys.argv[1], '-'], capture_output=True, text=True, check=True).stdout
    meta, tracks = parse(txt)
    db = []
    if os.path.exists(OUT):
        s = open(OUT, encoding='utf-8').read()
        db = json.loads(s[s.index('['):s.rindex(']') + 1])
    db = [x for x in db if x['ver'] != meta['ver']]
    db.insert(0, {'ver': meta['ver'], 'date': meta.get('date', ''), 'tracks': tracks})
    db.sort(key=lambda x: [int(p) for p in x['ver'].split('.')], reverse=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// Official LMU Balance of Performance, read from the PDF by tools/bop_pdf.py (newest version first)\n')
        f.write('const BOP_DB=' + json.dumps(db, ensure_ascii=False, separators=(',', ':')) + ';\n')
    n = {k: 0 for k in COLS}
    for T in tracks.values():
        for k, rows in T['cls'].items(): n[k] += len(rows)
    print(f"BOP {meta['ver']} del {meta.get('date')}: {len(tracks)} piste ·", ' · '.join(f'{k} {v}' for k, v in n.items()))
    for name, T in tracks.items():
        miss = [k for k in COLS if len(T['cls'].get(k, [])) != len(CARS[k])]
        if miss: print('  ', name, 'incompleta:', {k: len(T['cls'].get(k, [])) for k in miss})


if __name__ == '__main__':
    main()
