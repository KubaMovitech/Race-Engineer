# Stato dei lavori: analisi MoTeC, setup, Libreria e Muretto (solo PC)

Pubblicato nelle versioni **2.18.0** (fasi 1–5 e 7) e **2.19.0** (fasi 6 e 8), 01/11/2026.

## Dove sta il codice nuovo

| File | Cosa fa |
|---|---|
| `app/chq.js` | Canali: unità e conversioni dai metadati del file, nomi alternativi, canali piatti, frequenza reale, qualità per canale e per analisi, affidabilità |
| `app/vdyn.js` | Calcoli: velocità ammortizzatore, istogrammi, fasi del giro, eventi, assi, 3° elemento, packer, piattaforma, confronti prima/dopo |
| `app/ui51.js` | Pagina «Analisi tecnica» (menu Prepara), schede di diagnosi, setup associato alla sessione |
| `app/ui52.js` | Muretto: stato guidato, profili, prova del server |
| `bridge/libdir.go` | `GET /libstatus`, `POST /libdir` (cartella scelta a mano) |
| `tools/test_analysis.js` | 44 controlli su segnali sintetici (anche nel controllo automatico su GitHub) |

## Fase 1 — Lettura e qualità dei dati MoTeC · fatto

- `parseLD` conserva per ogni canale nome, unità e frequenza originali (`c.raw`) e le conversioni applicate (`c.conv`) con la
  loro certezza: *certa* (unità nel file), *convenzione* (LMU scrive gli angoli in radianti senza unità; −273 °C = valore assente),
  *incerta* (unità mancante, dedotta dal nome). Non si converte più guardando solo l'ampiezza dei valori
  (tolto da Telemetria, Race Engineer e analisi sospensioni).
- Nomi alternativi dei canali (es. `Damper Pos FL` → `Susp Pos FL`).
- Canali piatti (costanti con l'auto in movimento, es. `Front Downforce` = 0, `Steering Wheel Position` = 0 nei file LMU attuali)
  trattati come **mancanti**, non come zero.
- Per ogni canale: valori non numerici, fuori scala, durata e allineamento, frequenza reale di aggiornamento, valori fermi,
  interruzioni (la saturazione, es. gas al 100%, non conta come blocco).
- Velocità ammortizzatore ricavata **giro per giro** sui campioni originali, con 1 s di margine, filtro Savitzky–Golay (7 campioni
  a 100 Hz): niente picchi finti tra giri messi in fila. Con posizione aggiornata sotto 50 Hz non viene calcolata.
- Pannello **Qualità telemetria**: analisi utilizzabili / limitate / non utilizzabili, canali mancanti, cosa è misurato,
  derivato, stimato o non disponibile.
- Affidabilità **per analisi** (canali, giri confrontabili, dati utili, condizioni, ripetibilità): «alta» solo con almeno
  5 giri confrontabili **e** risultato ripetibile; 3 giri non bastano.

## Fase 2 — Sospensioni e ammortizzatori · fatto

- Posizione e velocità per ruota; velocità *misurata* se esiste il canale, altrimenti *derivata* (e lo dice).
- Segno compressione/estensione **verificato** con altezza da terra, carico gomma e forza sospensione (sui file LMU: verificato
  su tutte e 4 le ruote); se non determinabile, l'istogramma dice «verso − / verso +».
- Istogrammi con unità, soglia lento/veloce, scala e classi regolabili, campioni fuori scala contati a parte.
  **Tolta** la diagnosi automatica dalla simmetria («rebound lento duro» ecc.).
- Analisi per fase: frenata, inserimento, appoggio, uscita, rettilineo, cordolo (`Surface Type` = cordolo, misurato).
- Selezione di giro, curva o intervallo in metri, fase; confronto A/B con le condizioni visibili.
- Eventi localizzati e ripetibili (stesso punto ± 40 m nel 60% dei giri): ruota scarica e recupero del carico, oscillazioni
  ripetute, recupero lento (solo con pedali e g laterale stabili), compressione che si accumula, vicinanza alla corsa massima
  *osservata* (mai chiamata fine corsa). Ogni evento si apre su mappa + segnali sincronizzati e in Telemetria.

## Fase 3 — Molle, barre e terzo elemento · fatto

- Movimento comune, differenziale sx−dx, indice di beccheggio (dichiarati come indicatori dalle ruote), beccheggio e rollio misurati.
- Mediane per fase, andamento con la velocità e con (velocità)² sui rettilinei, frenata, rollio per g con le cautele.
- Nei file LMU il canale `3rd Pos` coincide con la media delle due ruote (r = 1,00): l'app lo dice.
- **Corretto** il packer: niente più «vicino al 99,5° percentile = sul packer». Il contatto è *misurato* (solo con canale
  dedicato), *stimato* (rigidezza forza/posizione che sale di colpo; 3° elemento che smette di comprimersi mentre il carico
  sale) o *non determinabile*. Margine solo rispetto al contatto stimato.

## Fase 4 — Piattaforma e aerodinamica · fatto

- Altezze ant./post. e rake (in mm, dichiarato «non è un angolo») contro la velocità, per fase, oscillazioni in rettilineo,
  altezze sotto soglia con indizi (cordolo, g verticale), carico aerodinamico solo se il gioco lo esporta davvero.
- Tolta la regola «più rake = più carico anteriore» e il «bilanciamento meccanico neutro» dal rapporto dei rollii; i
  consigli sull'ala da indice di sterzo sono presentati come prova, non come fatto.

## Fase 5 — Diagnosi collegata al setup · fatto (da tarare su dati reali)

- Schede in 10 punti (fenomeno → esito prima/dopo); lo stesso fenomeno in più punti è una scheda sola. Le stesse schede
  entrano in Race Engineer e nel debrief al posto dei vecchi consigli su sospensioni e piattaforma.
- «Prova questa modifica» usa la prova setup già esistente (`ptests`, ui45.js) con una metrica misurata **nel punto** della
  scheda, giro per giro; esito migliorato / peggiorato / inconcludente rispetto alla dispersione tra i giri; il tempo sul giro
  è giudicato a parte.
- Setup della sessione: *confermato*, *abbinamento suggerito* (es. aperto dalla Libreria) o *mancante*, con **copia del
  contenuto** salvata; se il file cambia resta la copia storica (apribile); avviso se l'auto non corrisponde.

## Fase 6 — Grafica PC · fatto

- Pagina tecnica a tutta larghezza, selettori in una riga, B affiancato, pannello ingrandibile (⤢), informazioni
  secondarie richiudibili, mappa + segnali + evento coordinati.
- Riepilogo in alto compatto sulla pagina tecnica (resta la riga della sessione, spariscono i numeri grandi e gli obiettivi).
- Setup Builder: valori attuali, **differenze rispetto a un setup di riferimento** scelto («Confronta con», evidenziate in
  giallo con il valore di riferimento), **problemi collegati** (numero accanto al parametro = schede di Analisi tecnica che
  propongono di cambiarlo; clic → la scheda).
- Clic su una ruota (Setup Builder) → Analisi tecnica sugli ammortizzatori di quella ruota; clic su un problema
  (Setup Builder o Race Engineer, pulsante «Analisi →») → la sua scheda in Analisi tecnica.
- Verificata a 1366×768 e 1920×1080 senza sbordi.

## Fase 7 — Libreria · fatto

- «Apri ultima sessione», raggruppamento per pista, ricerca per pista, auto, pilota, data; setup compatibili (pista e auto)
  in alto; anteprima della coppia con il controllo di compatibilità; un solo comando «Apri analisi».
- Stato della cartella del gioco (come è stata trovata, setup e telemetrie presenti, ultima lettura), errori comprensibili,
  scelta della cartella a mano (il bridge accetta solo una cartella UserData di LMU, solo da questo PC, e la ricorda).
- Lista aggiornata da sola ogni 15 s; file ancora in scrittura riconosciuti e non apribili; etichette nuovo, già importato,
  riferimento, setup associato/suggerito. Con il bridge «Aggiorna da LMU» è nascosto (la Libreria lo sostituisce).

## Fase 8 — Muretto · fatto (collegamento tra due PC non provato)

- «Stato del Muretto» con i passi programma → gioco → squadra → compagni → freschezza dei dati e l'azione da fare; si apre
  da solo solo quando qualcosa blocca.
- Spiegazione del link localhost; profili Pilota/Ingegnere (solo schermate e avvisi, non controllo accessi); server nelle
  impostazioni avanzate e provato da questo PC prima di creare la squadra.
- **Vista gara** in una riga sopra tutte le schede: auto seguita, posizione, distacchi davanti/dietro, autonomia (limite
  carburante o energia), prossima sosta (giro attuale + giri di autonomia), numero di avvisi e il più importante; avvisi
  ordinati per priorità; dati più vecchi di 8 s segnalati e attenuati.
- **Non verificato**: il collegamento tra due PC diversi non è stato provato in questo ambiente (serve una prova vera con
  due PC e una squadra).

## Cosa resta da validare con dati reali

I test sintetici verificano gli algoritmi, non la correttezza delle diagnosi su un'auto vera. Per tarare servono:
1. **Due uscite con una sola modifica nota**, stessa pista, auto, carburante e gomme, almeno 6–8 giri puliti ciascuna:
   i due `.ld` e i due `.svm` (es. estensione veloce posteriore −1 click). Serve per verificare che la metrica della scheda
   si muova come atteso e per tarare le soglie degli eventi (`VD_EV` in `app/vdyn.js`).
2. Un'uscita con **molti passaggi sui cordoli** e una pulita, per tarare scarichi e recupero.
3. Un'uscita in cui l'auto **tocca il fondo** (altezze basse), per verificare l'indizio di contatto dal g verticale.
4. Telemetrie di **altre auto** (LMP2, GT3) per controllare nomi dei canali, unità e canali piatti.
5. Valori da chiarire nei file LMU: alcune temperature gomme arrivano a ~1037 °C (segnalate come fuori scala, non corrette).

## Prossimi passi consigliati

1. Validazione con i file del punto 1 e taratura delle soglie.
2. Prova reale del Muretto tra due PC.
3. Release (versione nuova con `release.sh`) solo su richiesta.
