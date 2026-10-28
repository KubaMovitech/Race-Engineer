#!/usr/bin/env python3
"""Map of the functions that later files wrap or replace, and a check that it has not changed by accident.

The app is one page built from many .js files in the order of app/build.sh. A later file often takes a
function of an earlier one and wraps it:
    (function(){const rh=renderHero;window.renderHero=renderHero=function(){rh(); ...};})();
    const rs=RENDER.stint;RENDER.stint=()=>{rs(); ...};
so the load order is part of how the app works. This script finds every such place and checks:
  1. no top-level function is declared twice (the second would silently replace the first);
  2. a wrapper never runs before the function it wraps exists (a file earlier in the order than the
     definition, unless the wrapper is put off with setTimeout);
  3. every RENDER.<view> has exactly one plain definition; the others call the previous one;
  4. the list matches tools/overrides.txt, the map kept in the repository: a new wrapper, one that
     goes away or one that moves is reported, so it is a decision and not an accident.

usage: python3 tools/check_overrides.py            check (exit 1 if something is wrong)
       python3 tools/check_overrides.py --update   write tools/overrides.txt from the current code
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, 'app')
MAP = os.path.join(ROOT, 'tools', 'overrides.txt')
NAME = r'[A-Za-z_$][\w$]*'


def load_order():
    b = open(os.path.join(APP, 'build.sh'), encoding='utf-8').read()
    m = re.search(r'cat (core\.js[^;]*);', b)
    return m.group(1).split()


def deferred(src, pos):
    """True if the statement at pos sits inside a setTimeout(...) callback: walk back to each bracket
    that is still open at pos and look at what opens it"""
    depth = 0
    for j in range(pos - 1, max(-1, pos - 6000), -1):
        c = src[j]
        if c == ')':
            depth += 1
        elif c == '(':
            if depth == 0:
                if src[max(0, j - 10):j] == 'setTimeout':
                    return True
            else:
                depth -= 1
    return False


def scan():
    order = load_order()
    decl, errors, entries = {}, [], []
    srcs = [open(os.path.join(APP, f), encoding='utf-8').read() for f in order]
    for i, f in enumerate(order):
        for m in re.finditer(r'^(?:async\s+)?function\s+(' + NAME + r')\s*\(', srcs[i], re.M):
            n = m.group(1)
            if n in decl:
                errors.append(f'{f}: la funzione {n} è già dichiarata in {order[decl[n]]}: la seconda sostituisce la prima senza dirlo')
            else:
                decl[n] = i
    for i, f in enumerate(order):
        src = srcs[i]
        # window.X=X=... : a wrapper (it keeps the old one) or a replacement
        for m in re.finditer(r'window\.(' + NAME + r')\s*=\s*\1\s*=', src):
            n = m.group(1)
            before = src[max(0, m.start() - 160):m.start()]
            kind = 'wrap' if re.search(r'=\s*(?:window\.)?' + re.escape(n) + r'\s*;', before) else 'replace'
            late = deferred(src, m.start())
            entries.append((n, f, kind + (' later' if late else '')))
            if n in decl and decl[n] > i and not late:
                errors.append(f'{f}: avvolge {n} prima che esista (è dichiarata dopo, in {order[decl[n]]})')
            if n not in decl and not late:
                errors.append(f'{f}: avvolge {n}, che non è dichiarata in nessun file prima')
        # RENDER.view = ... : one definition, the rest wrap it
        for m in re.finditer(r'\bRENDER\.(\w+)\s*=(?!=)', src):
            n = 'RENDER.' + m.group(1)
            before = src[max(0, m.start() - 160):m.start()]
            kind = 'wrap' if re.search(r'=\s*' + re.escape(n) + r'\s*;', before) else 'define'
            entries.append((n, f, kind + (' later' if deferred(src, m.start()) else '')))
    by = {}
    for n, f, k in entries:
        by.setdefault(n, []).append((f, k))
    for n, L in by.items():
        if n.startswith('RENDER.'):
            d = [f for f, k in L if k.startswith('define')]
            if len(d) != 1:
                errors.append(f'{n}: {len(d)} definizioni senza richiamare la precedente ({", ".join(d) or "nessuna"}): deve essercene una sola')
            else:
                early = [f for f, k in L if k == 'wrap' and order.index(f) < order.index(d[0])]
                if early:
                    errors.append(f'{n}: {early[0]} la avvolge prima della definizione in {d[0]} (serve setTimeout)')
    return order, by, errors


def render_map(order, by):
    out = ['# Funzioni avvolte o sostituite dai file successivi (generato da tools/check_overrides.py --update).',
           '# Ordine = ordine di caricamento in app/build.sh. wrap = chiama la versione precedente;',
           '# replace = la sostituisce; define = definizione; "later" = dentro setTimeout, gira dopo il caricamento.', '']
    for n in sorted(by, key=lambda x: (x.startswith('RENDER.'), x.lower())):
        out.append(n)
        for f, k in by[n]:
            out.append(f'    {f:<10} {k}')
    return '\n'.join(out) + '\n'


def main():
    order, by, errors = scan()
    cur = render_map(order, by)
    if '--update' in sys.argv:
        open(MAP, 'w', encoding='utf-8').write(cur)
        print(f'scritto {os.path.relpath(MAP, ROOT)}: {len(by)} funzioni avvolte')
    else:
        old = open(MAP, encoding='utf-8').read() if os.path.exists(MAP) else ''
        if old != cur:
            import difflib
            d = ''.join(difflib.unified_diff(old.splitlines(True), cur.splitlines(True), 'tools/overrides.txt', 'codice attuale', n=1))
            errors.append('la mappa delle funzioni avvolte è cambiata. Se è voluto: python3 tools/check_overrides.py --update e committa tools/overrides.txt\n' + d)
    for e in errors:
        print('ERRORE:', e)
    if errors:
        sys.exit(1)
    if '--update' not in sys.argv:
        print(f'OK: {len(order)} file, {len(by)} funzioni avvolte, mappa invariata')


if __name__ == '__main__':
    main()
