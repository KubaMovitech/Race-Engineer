# Server della squadra (Cloudflare, gratuito)

È il "ripetitore" di Data Engineer: passa i dati tra i PC della squadra.
I dati sono cifrati con la chiave del codice squadra, quindi il server non li può leggere.

## Pubblicarlo (una volta sola, circa 10 minuti)

1. Metti questa cartella `server` nel repository GitHub (Race-Engineer).
2. Crea un account gratuito su https://dash.cloudflare.com/sign-up
3. Nel pannello di Cloudflare apri **Compute (Workers) › Workers & Pages › Create**,
   poi **Import a repository**.
4. Collega GitHub, scegli **Race-Engineer**.
5. In **Root directory** scrivi `server`. Lascia il resto com'è e premi **Deploy**.
6. Alla fine Cloudflare mostra l'indirizzo, tipo
   `https://data-engineer-relay.TUONOME.workers.dev`.
   Aprilo nel browser: deve comparire `Data Engineer relay: ok`.
7. Mandami l'indirizzo: lo aggiungo a `version.json` e da quel momento tutte le app
   della squadra usano questo server (dopo un riavvio dell'app).

Piano gratuito: 100.000 richieste al giorno. I messaggi dei piloti contano 1 ogni 20,
quelli verso chi guarda sono gratis: una squadra ci sta comoda anche in una 24 ore.
