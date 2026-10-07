#!/usr/bin/env python3
"""Checks that the update channel (the 3 files in the repository root) is consistent:
the same version everywhere, SHA-256 in version.json matching the two files, and the
published app equal to the one built from app/. A bridge that sees a newer version
than its own replaces itself and restarts: a mismatch here can make it loop."""
import hashlib, json, os, re, subprocess, sys, tempfile

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = lambda *a: os.path.join(root, *a)
err = []
sha = lambda f: hashlib.sha256(open(p(f), "rb").read()).hexdigest()

vj = json.load(open(p("version.json"), encoding="utf-8"))
v = vj["version"]
if vj["app"]["sha256"].lower() != sha(vj["app"]["file"]):
    err.append("version.json: SHA-256 dell'app diverso da Data_Engineer.html")
if vj["bridge"]["sha256"].lower() != sha(vj["bridge"]["file"]):
    err.append("version.json: SHA-256 del bridge diverso da DataEngineerBridge.exe")

src = {
    "app/ui17.js": re.search(r"const APP_VERSION='([^']+)'", open(p("app/ui17.js"), encoding="utf-8").read()),
    "bridge/main.go": re.search(r'const VERSION = "([^"]+)"', open(p("bridge/main.go"), encoding="utf-8").read()),
    "bridge/app.rc": re.search(r'"FileVersion", "([^"]+)"', open(p("bridge/app.rc"), encoding="utf-8").read()),
}
for f, m in src.items():
    if not m or m.group(1) != v:
        err.append(f"{f}: versione {m.group(1) if m else '?'} invece di {v}")
if f"const APP_VERSION='{v}'" not in open(p("Data_Engineer.html"), encoding="utf-8").read():
    err.append(f"Data_Engineer.html non è la versione {v}")
if f"Data Engineer {v}".encode() not in open(p("DataEngineerBridge.exe"), "rb").read():
    err.append(f"DataEngineerBridge.exe non è la versione {v}")
if f"const APP_VERSION='{v}'".encode() not in open(p("DataEngineerBridge.exe"), "rb").read():
    err.append(f"DataEngineerBridge.exe non contiene l'app {v}")

# the published app must be exactly the one built from the sources
subprocess.run(["sh", p("app/build.sh")], check=True)
built = open(p("app/test.html"), encoding="utf-8").read().replace("<html>", '<html lang="it">', 1)
if built != open(p("Data_Engineer.html"), encoding="utf-8").read():
    err.append("Data_Engineer.html è diverso dall'app costruita da app/: rifai la versione con release.sh")

for e in err:
    print("ERRORE:", e)
print(("OK: versione " + v + " coerente") if not err else ("Versione " + v + " NON coerente"))
sys.exit(1 if err else 0)
