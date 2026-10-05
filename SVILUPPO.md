# Data Engineer – codice sorgente

- `app/`  interfaccia (HTML/JS/CSS). `sh app/build.sh` crea `app/pitwall.html` e `app/test.html` (concatenando i file nell'ordine scritto in build.sh).
- `bridge/` programma Windows in Go (legge LMU, serve l'app su http://localhost:8790, si collega alla squadra, si aggiorna da solo).
  Contiene l'app incorporata: `bridge/app.html` (copia di Data_Engineer.html).
- `server/` server della squadra per Cloudflare (Worker + Durable Object).
- `sh release.sh <versione> "nota" …` → `release/<versione>/` con Data_Engineer.html, DataEngineerBridge.exe e version.json (con gli SHA-256),
  e copia gli stessi 3 file nella radice del repository (il canale degli aggiornamenti letto da app e bridge).
  Serve Go 1.24+ e `llvm-windres` per icona e versione (app.rc → rsrc_windows_amd64.syso).
  Il bridge viene compilato come app Windows senza console: `-ldflags "-s -w -H=windowsgui"`.
  `app/pitwall.html`, `app/test.html`, `bridge/app.html` e `release/` sono generati e non vanno nel repository.

Prima di pubblicare una versione: stesso numero in `app/ui17.js` (APP_VERSION + CHANGELOG), `bridge/main.go` (VERSION) e `bridge/app.rc`.
I file da mettere nel canale aggiornamenti sono i 3 di `release/<versione>/`: version.json deve corrispondere esattamente (SHA-256) agli altri due.

Ogni versione pubblicata deve avere app e bridge nuovi, creati insieme da `release.sh` (che si ferma se i 3 numeri non coincidono).
Mai cambiare a mano solo `version.json` o solo `Data_Engineer.html`: un bridge che vede una versione più nuova della sua si sostituisce e si riavvia.
Dalla 2.0.2 il bridge non si sostituisce se l'exe pubblicato è identico al suo, ma i bridge 2.0.1 e precedenti si riavvierebbero all'infinito.
