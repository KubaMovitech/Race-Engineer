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

## Analisi della telemetria (chq.js, vdyn.js) e test
- `app/chq.js` e `app/vdyn.js` vengono subito dopo `core.js` e contengono solo calcoli (niente pagina): unità e conversioni
  dei canali decise dai metadati del file, canali piatti trattati come mancanti, qualità e affidabilità per analisi,
  sospensioni, eventi, assi, packer, piattaforma. Le pagine sono in `ui51.js` (Analisi tecnica) e `ui52.js` (Muretto).
- `node tools/test_analysis.js` prova questi calcoli su segnali sintetici con risultato noto (anche nel controllo su GitHub).
  Non sostituisce la taratura su telemetrie reali: vedi `STATO_LAVORI.md`.
- `python3 tools/check_release.py --allow-unreleased` (controllo automatico) segnala come avviso, non come errore, i sorgenti
  cambiati dopo l'ultima versione pubblicata; senza l'opzione (prima di pubblicare) resta un errore.

### Verifica desktop e setup storico
- `node tools/smoke_desktop.js <url-bridge> <fixture.ld> [cartella-schermate]` verifica a
  1366×768 e 1920×1080: copia confermata del setup, esplorazione esplicita di un altro setup, aggiornamento
  dell'originale, schede tecniche, posizione dei grafici e invito via link (anche con appunti negati).
  Usa il Chromium installato da Playwright come gli altri smoke test. Non crea squadre reali né invia inviti.
- Il setup confermato è la base dei calcoli. «Prova il setup selezionato» permette di esplorare un altro
  `.svm` senza modificare la copia storica; «Torna al setup confermato» ripristina la base della sessione.
- Le analisi ammortizzatori richiedono una frequenza effettiva di almeno 50 Hz. La velocità misurata mantiene
  la propria frequenza; se manca una sorgente utilizzabile non si deriva la velocità e non si propongono
  modifiche fondate su quella metrica. La corsa sospensioni resta consultabile quando disponibile.

## Pagina web (Muretto per l'ingegnere)
- GitHub Pages pubblica la radice del repository: `index.html` apre `Data_Engineer.html`, cioè la versione pubblicata
  (si aggiorna da sola a ogni release). Indirizzo: https://kubamovitech.github.io/Race-Engineer/
- `#muretto&t=<codice>` (link «Per chi fa l'ingegnere» in Invita un compagno) entra nella squadra solo con la pagina,
  profilo Ingegnere, senza programma. Il codice resta dopo «#» e non arriva al server. `#join&t=` resta il link per chi
  guida (il bridge del suo PC entra nella squadra).
- Chi guida ha sempre bisogno del bridge: il browser non può leggere la memoria condivisa del gioco.

## Solo italiano (dalla 2.21)
- L'inglese è stato tolto: niente dizionario (`i18n_dict.js`) né pulsante IT/EN. `tr()` resta e restituisce il testo
  com'è, così il codice esistente non cambia; i testi nuovi si scrivono direttamente in italiano.
