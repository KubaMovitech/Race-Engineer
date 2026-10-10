// ================= VERSIONE, NOVITÀ E AGGIORNAMENTI =================
const APP_VERSION='2.0.6';
const DEFAULT_UPD='https://raw.githubusercontent.com/KubaMovitech/Race-Engineer/main/';   // update channel (folder with version.json), set when the team repository exists
const CHANGELOG=[
{v:'2.0.6',d:'10/10/2026',items:['Setup › Sospensioni e ammortizzatori: dalla telemetria MoTeC gli istogrammi delle velocità degli ammortizzatori per ogni ruota (compressione ed estensione, lente e veloci), corsa usata, altezze in velocità e rake, beccheggio in frenata e rollio per g.','Consigli su bump e rebound lenti e veloci e sulle barre, legati ai problemi che vede il Dottore setup e ai valori del tuo .svm.']},
{v:'2.0.5',d:'08/10/2026',items:['Pannello File più chiaro: telemetria, risultati e setup separati, a cosa serve ognuno e dove li salva LMU, con Apri, riferimento e rimuovi per ogni file.','Aggiorna da LMU carica le 10 telemetrie più recenti (più tutti i risultati e i setup nuovi) invece di tutto: l\'app resta veloce.','Corretto: un file .ld.gz caricato spariva alla riapertura dell\'app.']},
{v:'2.0.4',d:'07/10/2026',items:['Gomme, carburante ed energia come nel gioco (Panoramica e Auto): usura rimasta, pressione, temperature, e per benzina ed energia consumo massimo, medio e ultimo con giri e minuti che restano. Per le altre auto benzina ed energia nel dettaglio auto.','Slick o wet? Confronto dei tempi delle auto della nostra classe con gomme diverse e avviso quando conviene cambiare.','Avvisi meteo: inizia o smette di piovere, pista che si bagna o si asciuga, pioggia prevista entro 10 minuti.','Piloti e stint (Strategia): chi guida e da quanto, cambio tra quanto, prossimo pilota, tempo alla guida di ognuno, avviso 5 e 1 minuto prima del cambio.','Aggiornamento in un clic: aprendo il file Data_Engineer.html, «Aggiorna» passa all\'app Data Engineer e fa tutto da sola.']},
{v:'2.0.3',d:'07/10/2026',items:['Muretto con più piloti online: non salta più da un pilota all\'altro. Segue la sessione di «Nostra auto»: classifica, giri e meteo di un compagno su un altro server o in un\'altra sessione non si mescolano più con i nostri.','Crea squadra dall\'app del bridge: il nuovo codice vale anche per il bridge di questo PC.','Meteo più preciso: intensità della pioggia e come cambia, pista che si asciuga o si bagna con la stima di quando sarà asciutta, vento in km/h, umidità dalle previsioni.','Una sola app aperta: riaprendo Data Engineer torna in primo piano la finestra già aperta.','Classifica: le quattro gomme viste dall\'alto (anteriori sopra, posteriori sotto).','Passo gara sugli ultimi 5 giri fatti (senza giro 1, giri dei box e un giro molto lento), non sui giri più veloci.']},
{v:'2.0.2',d:'05/10/2026',items:['Le novità mostrano di nuovo tutte le versioni, dalla 1.7 in poi.','Con un bridge vecchio (1.6 o 1.7) che non sa aggiornarsi, il pulsante «Aggiorna» scarica il nuovo DataEngineerBridge.exe da sostituire.','Il bridge non si riavvia più all\'infinito se trova lo stesso programma già installato.']},
{v:'2.0.1',d:'05/10/2026',items:['La classifica si aggiorna ogni secondo anche quando nessuno della squadra è in auto.']},
{v:'2.0',d:'05/10/2026',items:['Data Engineer diventa un\'app: un solo programma per tutti, si apre in una finestra sua e si aggiorna da solo.','Muretto più affidabile: niente più dati scartati per gli orologi dei PC, riconnessione in pochi secondi.','Pronto per il nuovo server della squadra (Cloudflare).']},
{v:'1.7.2',d:'04/10/2026',items:['Corretto: due bridge aperti sullo stesso PC si scollegavano a vicenda e il Muretto online si fermava.','Grafica TV: le modifiche della Regia arrivano a OBS anche da un altro PC o dal file per PC.']},
{v:'1.7.1',d:'04/10/2026',items:['Classifica più leggibile: gomme allineate, energia e benzina ben visibili, tutta la larghezza dello schermo.','Cambiare o togliere il codice squadra direttamente dalla finestra del bridge o dall\'app.']},
{v:'1.7',d:'04/10/2026',items:['Grafica TV per OBS in stile WEC / F1 con Regia TV nel Muretto.','Classifica con velocità massima (sessione, stint, giro).','Colori gomme: soft bianche, medie gialle, dure rosse, wet azzurre.','Strategia: stint in tempo reale con tempo e giri di guida rimasti e stint previsti fino alla bandiera.']},
 {v:'1.6',d:'04/10/2026',items:['Classifica: settori S1 S2 S3 in diretta, colorati come in F1 e WEC (viola miglior della classe, verde personale, giallo più lento).','Strategia › Fino alla bandiera: quanta energia e benzina mettere a ogni sosta e il ratio, con l\'ultima sosta in evidenza.','Giri possibili con l\'energia attuale per ogni pilota, con i suoi consumi.','Mappa: P1, auto davanti e auto dietro evidenziate con il distacco.','Finestra di sosta: dove rientri fermandoti adesso o nei prossimi giri, con traffico e chi deve ancora fermarsi. Tempo perso al box correggibile a mano.','Undercut e overcut in diretta sulle auto vicine, con chi è ai box in quel momento.','Overlay per OBS configurabile: classifica, duello, settori, energia, rientro, sessione, gomme, mappa, relativo.','Setup › Confronto setup: differenze tra base e un altro set con gli effetti attesi, e confronto in pista con due telemetrie.','Muretto riordinato: barra in alto più compatta, strategia raggruppata, riquadro Settori nella Panoramica.']},
 {v:'1.5.1',d:'03/10/2026',items:['Aggiornamenti automatici attivi: canale della squadra già impostato, nessuna configurazione.']},
 {v:'1.5',d:'03/10/2026',items:['Novità e aggiornamenti dentro l\'app: il numero di versione in alto apre questa finestra.','Pulsante «Aggiorna»: il bridge scarica da solo la nuova versione (sua e dell\'app) e si riavvia; il file per PC si sovrascrive con un clic.','Il bridge controlla gli aggiornamenti a ogni avvio.']},
 {v:'1.4',d:'03/10/2026',items:['Debrief della sessione (con «Chiedi all\'AI» sulla pagina claude.ai).','Aggancio: in che giro prendi l\'auto davanti o ti prende quella dietro.','Setup in uso letto dal garage del gioco, con avviso quando il pilota lo cambia.','Classifica: colonna VE · benzina sempre visibile, anche online (dalla classifica interna del gioco).','Gomme viste dall\'alto, colorate per mescola.','Strategie degli avversari: soste, stint, tempi ai box, gomme cambiate, cambi pilota, consumi, soste mancanti.','Nomi auto leggibili (modello · numero · squadra) al posto di «Custom Team».','Stato PISTA / BOX / FERMO / GARAGE molto più visibile.','Dati di strategia del gioco in unità leggibili.']},
 {v:'1.3',d:'03/10/2026',items:['Corretti i giri inesistenti che comparivano online.','All\'avvio il Muretto non mostra più la sessione precedente.','Condizioni e consumi in tempo reale nella Panoramica, «Adesso in pista» nel Meteo.','Relativo in pista, durata delle gomme, secondi senza pedali a giro.','Icona dell\'app e del bridge, app installabile da http://localhost:8790, logo della squadra.','Bridge e app più leggeri.']},
 {v:'1.2.1',d:'03/10/2026',items:['Niente più avvisi di cambio pilota ripetuti.','Riaprendo l\'app non riappare la sessione vecchia.']},
 {v:'1.2',d:'03/10/2026',items:['Muretto a schede e menu a due livelli.','Classifica diversa per prove, qualifica e gara.','Benzina, VE, gomme ruota per ruota, soste e cambi pilota di tutte le auto.','Avvisi a comparsa, strategia Solo / Endurance, risparmio, punto di rientro dopo la sosta.']},
 {v:'1.1',d:'02/10/2026',items:['Piano squadra nel Muretto, rivali, passo di tutti.','Stima della sosta dal menu box, previsioni meteo dal gioco.','Registrazione automatica delle sessioni.']},
 {v:'1.0',d:'01/10/2026',items:['Muretto live e Data Engineer Bridge: telemetria in diretta per tutta la squadra.']},
 {v:'0.9',d:'01/10/2026',items:['Italiano / inglese, colori personalizzabili, logo, Progressi, Pioggia, Squadra endurance, Report, aggiornamento dalla cartella LMU.']}];
const UPD={base:LS.get('upd:base','')||DEFAULT_UPD,remote:null,state:'',err:''};
const isBridgeHost=()=>/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&!!location.port;
const isFileHost=()=>location.protocol==='file:';
const isHosted=()=>!isBridgeHost()&&!isFileHost();
function newerV(a,b){const pa=String(a).split('.'),pb=String(b).split('.');for(let i=0;i<Math.max(pa.length,pb.length);i++){const x=+pa[i]||0,y=+pb[i]||0;if(x!==y)return x>y;}return false;}

const updChannel=()=>(UPD.base||DEFAULT_UPD).replace(/\/?$/,'/');
async function updFetchRemote(){if(!UPD.base&&!DEFAULT_UPD)throw new Error(tr('Imposta prima il canale degli aggiornamenti.'));const r=await fetch(updChannel()+'version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
async function updCheck(){UPD.err='';UPD.state='checking';updRender();
  try{if(isBridgeHost()){const q=UPD.base?'?channel='+encodeURIComponent(UPD.base):'';let r=null;try{const x=await fetch('/update'+q,{method:'POST'});if(x.ok)r=await x.json();}catch(e){}
      // bridges up to 1.7 have no updater: ask the channel directly and offer the new bridge as a download
      UPD.oldBridge=!r;if(r){if(!r.ok)throw new Error(r.error);UPD.remote=r.remote;}else UPD.remote=await updFetchRemote();}
    else UPD.remote=await updFetchRemote();
    UPD.state=UPD.remote&&newerV(UPD.remote.version,APP_VERSION)?'available':'latest';}
  catch(e){UPD.state='error';UPD.err=e.message||String(e);}
  updRender();}
async function sha256hex(buf){const h=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');}
const updIdb={get(){return new Promise(r=>{try{const t=IDB.db.transaction('files','readonly').objectStore('files').get('__app_file__');t.onsuccess=()=>r(t.result?.h||null);t.onerror=()=>r(null);}catch(e){r(null);}});},
  set(h){try{IDB.db.transaction('files','readwrite').objectStore('files').put({name:'__app_file__',h});}catch(e){}}};
async function updApply(){const R=UPD.remote;if(!R)return;UPD.state='working';updRender();
  try{
    if(isBridgeHost()&&UPD.oldBridge){const a=document.createElement('a');a.href=updChannel()+(R.bridge?.file||'DataEngineerBridge.exe');a.download='DataEngineerBridge.exe';document.body.appendChild(a);a.click();a.remove();
      UPD.state='available';updRender();toast(tr('Nuovo bridge scaricato: chiudi il bridge, sostituisci DataEngineerBridge.exe e riaprilo.'));return;}
    if(isBridgeHost()){const r=await (await fetch('/update?apply=1',{method:'POST'})).json();if(!r.ok)throw new Error(r.error);
      UPD.state='done';updRender();LS.set('updJust',R.version);
      // the bridge restarts if it updated itself: wait for it, then reload the new app
      const t0=Date.now();const wait=async()=>{try{const v=await (await fetch('/version',{cache:'no-store'})).json();if(!newerV(R.version,v.app))return location.reload();}catch(e){}if(Date.now()-t0<60000)setTimeout(wait,1500);else location.reload();};setTimeout(wait,r.restart?2500:300);return;}
    // the HTML file opened by hand: if Data Engineer (the bridge) runs on this PC it does the whole update, no file to pick
    if(isFileHost()&&await fetch('http://localhost:8790/version',{mode:'no-cors',cache:'no-store'}).then(()=>true,()=>false)){location.href='http://localhost:8790/#upd';return;}
    const url=updChannel()+(R.app?.file||'Data_Engineer.html');const buf=await (await fetch(url+'?t='+Date.now(),{cache:'no-store'})).arrayBuffer();
    if(R.app?.sha256&&(await sha256hex(buf))!==R.app.sha256.toLowerCase())throw new Error(tr('file scaricato non valido (controllo SHA-256 fallito)'));
    if(window.showSaveFilePicker){let h=await updIdb.get();
      if(h){const p=await h.requestPermission({mode:'readwrite'});if(p!=='granted')h=null;}
      if(!h){toast(tr('Scegli il file Data_Engineer.html che stai usando: verrà sostituito con la nuova versione.'));h=await window.showSaveFilePicker({suggestedName:'Data_Engineer.html',types:[{description:'Data Engineer',accept:{'text/html':['.html']}}]});updIdb.set(h);}
      const w=await h.createWritable();await w.write(buf);await w.close();LS.set('updJust',R.version);UPD.state='done';updRender();
      toast(tr('Aggiornato: riapro l\'app…'));setTimeout(()=>location.reload(),1200);}
    else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'text/html'}));a.download='Data_Engineer.html';document.body.appendChild(a);a.click();a.remove();UPD.state='done';updRender();toast(tr('Nuova versione scaricata: sostituisci il vecchio file.'));}}
  catch(e){if(e.name==='AbortError'){UPD.state='available';}else{UPD.state='error';UPD.err=e.message||String(e);}updRender();}}

function updRender(){const chip=$('#verChip');if(chip){const av=UPD.state==='available';chip.classList.toggle('upd',av);chip.textContent=av?`${tr('Aggiorna')} → v${UPD.remote.version}`:'v'+APP_VERSION;chip.title=av?tr('È disponibile una nuova versione'):tr('Novità e aggiornamenti');}
  const box=$('#updBox');if(!box)return;const R=UPD.remote;
  let h='';if(isHosted()){h=`<p class="muted small">${tr('Questa pagina su claude.ai si aggiorna da sola: è sempre l\'ultima versione.')}</p>`;box.innerHTML=h;return;}
  h+=`<div class="lvrow"><span>${tr('Versione dell\'app')}</span><b>v${APP_VERSION}</b></div>`;
  h+=`<label class="f" style="margin-top:8px">${tr('Canale degli aggiornamenti')}<input type="text" id="updBase" value="${esc(UPD.base)}" placeholder="https://raw.githubusercontent.com/…/main/"></label>`;
  h+=`<div class="row" style="margin-top:8px"><button class="btn" type="button" id="updCheck"${UPD.state==='checking'||UPD.state==='working'?' disabled':''}>${tr('Controlla aggiornamenti')}</button>`;
  if(UPD.state==='available')h+=`<button class="btn primary" type="button" id="updGo">${UPD.oldBridge?tr('Scarica il nuovo bridge'):tr('Aggiorna alla')+' v'+esc(R.version)}</button>`;h+='</div>';
  const msg={checking:tr('Controllo…'),working:tr('Aggiornamento in corso…'),latest:tr('Hai già l\'ultima versione.'),done:tr('Aggiornato.'),error:tr('Non riesco ad aggiornare')+': '+esc(UPD.err)}[UPD.state];if(msg)h+=`<p class="small ${UPD.state==='error'?'neg':'muted'}">${msg}</p>`;
  if(UPD.state==='available'&&R?.notes?.length)h+=`<div class="newsnew"><b>${tr('Novità della')} v${esc(R.version)}</b><ul>${R.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`;
  if(isBridgeHost()&&UPD.oldBridge)h+=`<p class="small neg">${tr('Questo bridge è di una versione vecchia e non sa aggiornarsi da solo: scarica il nuovo DataEngineerBridge.exe e sostituisci quello vecchio (basta una volta).')}</p>`;
  else h+=`<p class="muted small">${isBridgeHost()?tr('Il bridge scarica la nuova versione sua e dell\'app e si riavvia da solo. Controlla gli aggiornamenti anche a ogni avvio.'):tr('Il file si sostituisce con un clic (Chrome o Edge); la prima volta scegli il file Data_Engineer.html che usi.')}</p>`;
  box.innerHTML=h;$('#updCheck').onclick=()=>{const v=$('#updBase').value.trim();if(v&&!/^https?:\/\//.test(v)){toast(tr('Il canale deve essere un indirizzo web'));return;}UPD.base=v;LS.set('upd:base',v);updCheck();};const g=$('#updGo');if(g)g.onclick=updApply;}

function openNews(tab){let m=$('#mNews');if(!m){m=document.createElement('div');m.className='modal';m.id='mNews';m.hidden=true;
    m.innerHTML=`<div class="mbox wide"><div class="panel-h"><h2>${tr('Novità e aggiornamenti')}</h2><button class="btn" type="button" data-close>${tr('Chiudi')}</button></div>
      <div id="newsJust"></div><div class="grid2 newsgrid"><div><h3>${tr('Aggiornamenti')}</h3><div id="updBox"></div></div><div><h3>${tr('Cosa è cambiato')}</h3><div id="newsList" class="newslist"></div></div></div></div>`;document.body.appendChild(m);}
  const just=LS.get('updJust','');$('#newsJust').innerHTML=just===APP_VERSION?`<div class="newsok">${tr('Aggiornato alla versione')} ${APP_VERSION}</div>`:'';if(just===APP_VERSION)LS.set('updJust','');
  $('#newsList').innerHTML=CHANGELOG.map((c,i)=>`<div class="newsv${i===0?' cur':''}"><div class="nh"><b>v${c.v}</b><span>${c.d}</span>${c.v===APP_VERSION?`<i>${tr('installata')}</i>`:''}</div><ul>${c.items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
  updRender();openModal('#mNews');}

(function(){const tools=$('.hdr-tools');if(tools&&!$('#verChip')){const b=document.createElement('button');b.type='button';b.id='verChip';b.className='verchip';b.textContent='v'+APP_VERSION;b.onclick=()=>openNews();tools.insertBefore(b,$('#btnSettings'));}
  // after an update (or on first run of a new version) show what changed
  const seen=LS.get('seenVer','');if(seen!==APP_VERSION&&!document.documentElement.classList.contains('ovmode')&&!/^#(ov|tv)/.test(location.hash)){setTimeout(()=>openNews(),800);}LS.set('seenVer',APP_VERSION);
  // arrived from the HTML file to update: check and update straight away
  if(isBridgeHost()&&location.hash==='#upd'){history.replaceState(null,'',location.pathname);updCheck().then(()=>{if(UPD.state==='available')updApply();else openNews();});}
  else if(!isHosted()&&(UPD.base||isBridgeHost()))setTimeout(updCheck,3000);
  updRender();})();

// ---------- one app window at a time: a newer window replaces the older ones ----------
(function(){if(!window.BroadcastChannel||/^#(ov|tv)/.test(location.hash))return;
  const t0=Date.now()+Math.random();const ch=new BroadcastChannel('de-app');
  ch.onmessage=e=>{const m=e.data||{};if(m.t!=='open'||!(m.at>t0))return;ch.close();
    try{LIVE.conns.forEach(c=>c.close());LIVE.conns=[];}catch(x){}window.close();
    setTimeout(()=>{const d=document.createElement('div');d.className='modal';d.innerHTML=`<div class="mbox"><h2>${tr('Data Engineer è aperto in un\'altra finestra')}</h2><p class="muted">${tr('Questa finestra non si aggiorna più: chiudila e usa quella nuova.')}</p></div>`;document.body.appendChild(d);},300);};
  ch.postMessage({t:'open',at:t0});})();
