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

## Ordine dei file e funzioni avvolte
I file di `app/` non sono moduli: build.sh li unisce in un solo script e molti file successivi prendono una funzione
di un file precedente e la avvolgono (`window.renderHero=renderHero=function(){rh(); …}`, `RENDER.stint=()=>{rs(); …}`).
L'ordine di caricamento fa quindi parte del funzionamento.

`tools/overrides.txt` è la mappa: per ogni funzione, quali file la avvolgono (wrap), la sostituiscono (replace) o la
definiscono, nell'ordine di caricamento; "later" vuol dire dentro `setTimeout`, cioè dopo che tutti i file sono caricati.
`python3 tools/check_overrides.py` (anche nel controllo automatico su GitHub) si ferma se:
- una funzione è dichiarata due volte;
- un file avvolge una funzione che viene dichiarata dopo di lui (senza `setTimeout`);
- una vista `RENDER.x` ha più di una definizione o viene avvolta prima di essere definita;
- la mappa è cambiata: se il cambio è voluto, `python3 tools/check_overrides.py --update` e committa `tools/overrides.txt`.

Per le funzioni nuove meglio aggiungere al file dell'area giusta che avvolgere: ogni voce in più nella mappa è un
pezzo di comportamento che dipende dall'ordine.
