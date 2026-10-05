#!/bin/sh
# usage: sh release.sh <version> "<note 1>" "<note 2>" ...
#   -> release/<version>/ and the same 3 files in the repository root (the update channel)
set -e
V=$1; shift
ROOT=$(cd "$(dirname "$0")" && pwd)
grep -q "const APP_VERSION='$V'" "$ROOT/app/ui17.js" || { echo "app/ui17.js: APP_VERSION non è $V"; exit 1; }
grep -q "const VERSION = \"$V\"" "$ROOT/bridge/main.go" || { echo "bridge/main.go: VERSION non è $V"; exit 1; }
grep -q "\"FileVersion\", \"$V\"" "$ROOT/bridge/app.rc" || { echo "bridge/app.rc: versione non è $V"; exit 1; }
cd "$ROOT/app" && sh build.sh
OUT=$ROOT/release/$V; rm -rf "$OUT"; mkdir -p "$OUT"
sed 's|<html>|<html lang="it">|' test.html > "$OUT/Data_Engineer.html"
cp "$OUT/Data_Engineer.html" ../bridge/app.html
WINDRES=$(command -v llvm-windres-18 || command -v llvm-windres)
cd ../bridge && $WINDRES --target=pe-x86-64 -O coff app.rc -o rsrc_windows_amd64.syso && GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H=windowsgui" -o "$OUT/DataEngineerBridge.exe" .
python3 - "$OUT" "$V" "$@" <<'P'
import sys,json,hashlib,datetime
out,v,notes=sys.argv[1],sys.argv[2],sys.argv[3:]
h=lambda f:hashlib.sha256(open(out+'/'+f,'rb').read()).hexdigest()
json.dump({"version":v,"date":datetime.date.today().isoformat(),"notes":notes,
 "bridge":{"file":"DataEngineerBridge.exe","sha256":h("DataEngineerBridge.exe")},
 "app":{"file":"Data_Engineer.html","sha256":h("Data_Engineer.html")}},open(out+'/version.json','w'),ensure_ascii=False,indent=1)
P
cp "$OUT/Data_Engineer.html" "$OUT/DataEngineerBridge.exe" "$OUT/version.json" "$ROOT/"
ls -la "$OUT"
