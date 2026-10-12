// ================= LIBRERIA SETUP E GENERATORE =================
// The library keeps the setups you give it (setup shops, team-mates, your own) only in this browser.
// From them it learns, per car, which values each setting takes and which way the clicks go, and it
// picks the base for a track. The generator starts from that base and applies what you ask for, a click
// at a time and never outside the values seen in the library, then writes a new .svm.
const SETLIB=[];
const LIB_TRACKS=[['lemans','Le Mans',/sarthe|le ?mans|lemans|\b(lms|lem|lm)\b/i,'veloce'],['monza','Monza',/monza|\b(mon|mnz)\b/i,'veloce'],['spa','Spa',/spa|francorchamps/i,'medio'],['bahrain','Bahrain',/bahrain|sakhir|\b(bah|bhr|brn)\b/i,'medio'],
  ['qatar','Qatar',/qatar|lusail|losail|\b(qat|qtr)\b/i,'medio'],['fuji','Fuji',/fuji|\bfuj\b/i,'medio'],['cota','COTA',/americas|\bcota\b|austin/i,'medio'],['interlagos','Interlagos',/interlagos|paulo|brazil|brasil|\b(int|itl|itlg|itlgs)\b/i,'medio'],
  ['silverstone','Silverstone',/silverstone|\bsil\b/i,'medio'],['ricard','Paul Ricard',/ricard|castellet|\b(pr|prc|par|pr1av2|par1av2)\b/i,'medio'],['imola','Imola',/imola|enzo|\bimo\b/i,'lento'],['portimao','Portimão',/portim|algarve|\b(alg|por|ptm)\b/i,'lento'],['longbeach','Long Beach',/long ?beach|\blb\b/i,'lento'],['atlanta','Road Atlanta',/atlanta|petit|\b(ratl|roat)\b/i,'medio'],['barcelona','Barcellona',/barcel|catalunya|\b(bcn|bar|brc)\b/i,'medio'],['daytona','Daytona',/daytona|\b(day|dtn)\b/i,'veloce'],['laguna','Laguna Seca',/laguna|\b(lag|lags|lgs)\b/i,'lento'],['sebring','Sebring',/sebring|\b(seb|sbr|srg)\b/i,'lento']];
// the same car comes with one class name per livery and season ("... Hypercar WEC2025", "... WEC2026"): one car for the library
const libCar=c=>String(c||'').trim().replace(/\s*\b(WEC|ELMS|IMSA|LMGT3|GT3)?\s*(19|20)\d\d\s*$/i,'').trim();
const libTrack=s=>LIB_TRACKS.find(t=>t[2].test(s||''))||null;
const libType=s=>/wet|rain|pioggia|bagnato|(^|[^a-z])w(\s*[qr])?\d*([^a-z]|$)/i.test(s)?'wet':/(^|[^a-z])([ce]?q\d*|qualy?|quali|qualifying|qualifica)([^a-z]|$)/i.test(s)?'q':'race';
// the shops sell two styles: fast and edgy (GO "Esport", HYMO/TRT "E") or easy to drive (GO "Safe", HYMO/TRT "C"); GO "Endu" for long races
const libStyle=s=>/endu/i.test(s)?'endu':/esport|(^|[^a-z])e[qr]?\d*(\s|$)|(^|\s)e\s+[qr]\d*/i.test(s)?'esport':/safe|(^|[^a-z])c[qr]\d*(\s|$)|(^|\s)c\s+[qr]\d*|(^|[^a-z])s\d+([^a-z]|$)/i.test(s)?'safe':'';
const LIB_STYLE_N={'':'Automatico',esport:'Veloce (Esport / E)',safe:'Facile da guidare (Safe / C)',endu:'Endurance (Endu)'};
const LIB_TYPE_N={race:'Gara',q:'Qualifica',wet:'Pioggia'};
const libNum=d=>{const m=String(d||'').match(/-?\d+(?:[.,]\d+)?/);return m?parseFloat(m[0].replace(',','.')):NaN;};

function libAdd(name,buf){const text=new TextDecoder('latin1').decode(buf);const su=parseSVM(text,name.replace(/^lib\//,''));
  const path=name.replace(/^lib\//,'');const tk=libTrack(path);const e={id:name,name:path.split('/').pop().replace(/\.svm$/i,''),path,text,su,car:libCar(su.car),carFull:(su.car||'').trim(),track:tk?tk[0]:'',type:libType(path.split('/').pop()),style:libStyle(path.split('/').pop().replace(/\.svm$/i,'')),wq:/(^|[^a-z])([ce]?q\d*|w\s*q\d*|qualy?|quali|qualifying|qualifica)([^a-z]|$)/i.test(path.split('/').pop())};
  const i=SETLIB.findIndex(x=>x.id===name);if(i>=0)SETLIB[i]=e;else SETLIB.push(e);LIBLEARN=null;return e;}
// library files are stored with a "lib/" prefix: they go to the library, not to the File panel
(function(){const af=addFile;window.addFile=addFile=async function(name,buf,o={}){if(/^lib\//.test(name)){const e=libAdd(name,/\.gz$/i.test(name)?await gunzip(buf):buf);if(o.persist)IDB.put({name,buf,added:Date.now()});return e;}return af(name,buf,o);};})();
async function libImportFiles(files){let n=0;for(const f of files){if(!/\.svm$/i.test(f.name))continue;try{await addFile('lib/'+(f.webkitRelativePath||f.name),await f.arrayBuffer(),{persist:true});n++;}catch(e){console.warn(f.name,e);}}
  toast(`${n} ${tr('setup aggiunti alla libreria')}`);renderGen();}
async function libImportDir(){if(!window.showDirectoryPicker){$('#genFiles').click();return;}let dir;try{dir=await window.showDirectoryPicker({id:'setups',mode:'read'});}catch(e){return;}
  let n=0;const walk=async(d,p,depth)=>{for await(const [nm,h] of d.entries()){if(h.kind==='file'&&/\.svm$/i.test(nm)){try{const f=await h.getFile();await addFile('lib/'+p+nm,await f.arrayBuffer(),{persist:true});n++;}catch(e){console.warn(nm,e);}}else if(h.kind==='directory'&&depth<4)await walk(h,p+nm+'/',depth+1);}};
  toast(tr('Leggo i setup…'));await walk(dir,dir.name+'/',0);toast(`${n} ${tr('setup aggiunti alla libreria')}`);renderGen();}

// what the library teaches for each car: values seen per setting, their labels, which way the clicks go
let LIBLEARN=null;
function libLearn(){if(LIBLEARN)return LIBLEARN;const L={};
  SETLIB.forEach(e=>{const C=L[e.car]||(L[e.car]={n:0,keys:{}});C.n++;Object.entries(e.su.sec).forEach(([sec,items])=>items.forEach(x=>{const ix=parseInt(x.raw,10);if(!Number.isFinite(ix)||/N\/A|Non-adjustable/i.test(x.disp))return;
    const k=sec+'|'+x.key;const K=C.keys[k]||(C.keys[k]={vals:new Set(),disp:new Map()});K.vals.add(ix);if(x.disp)K.disp.set(ix,x.disp);}));});
  Object.values(L).forEach(C=>Object.values(C.keys).forEach(K=>{const v=[...K.vals].sort((a,b)=>a-b);K.min=v[0];K.max=v[v.length-1];
    const pts=[...K.disp].map(([i,d])=>[i,libNum(d)]).filter(p=>Number.isFinite(p[1]));let s=0;for(let a=0;a<pts.length;a++)for(let b=a+1;b<pts.length;b++)s+=Math.sign((pts[b][0]-pts[a][0])*(pts[b][1]-pts[a][1]));K.sign=s<0?-1:1;}));
  return LIBLEARN=L;}

// the base: same car and track and type, else same track, else a track of the same kind
function libBase(car,track,type,style){if(!SETLIB.some(e=>e.car===car))return null;
  return libRank(car,track,type,style)[0];}
const libVer=n=>{const m=String(n).match(/\bv?(\d+)\.(\d+)(?:\.(\d+))?/i);return m?(+m[1])*1e4+(+m[2])*100+(+m[3]||0):0;};
function libRank(car,track,type,style=''){const C=SETLIB.filter(e=>e.car===car);const g=(LIB_TRACKS.find(t=>t[0]===track)||[])[3];
  const score=e=>(e.track===track?100:g&&(LIB_TRACKS.find(t=>t[0]===e.track)||[])[3]===g?40:0)+(e.type===type?20:type==='q'&&e.type==='race'?8:0)+(/(^|\s)(go|pro|base)/i.test(e.name)?1:0)+(type==='race'&&/(^|\s)(r|race|gara)(\s|$)/i.test(e.name)?0.5:0)
    +(type==='wet'&&e.type==='wet'&&!e.wq?0.5:0)
    +(style?(e.style===style?10:0):(e.style==='esport'?0.3:e.style==='endu'?-0.5:0));
  return [...C].sort((a,b)=>score(b)-score(a)||libVer(b.name)-libVer(a.name)||a.name.localeCompare(b.name));}

// what changes between a race setup and a rain (or qualifying) one, learned from the pairs in the library:
// each rain setup is paired with the closest race setup of the same car and track, the clicks in between are kept
function libDelta(car,from,to){const C=SETLIB.filter(e=>e.car===car);const idx=e=>{const m=new Map();Object.entries(e.su.sec).forEach(([sec,it])=>it.forEach(x=>{const i=parseInt(x.raw,10);if(Number.isFinite(i)&&!/N\/A|Non-adjustable/i.test(x.disp))m.set(sec+'|'+x.key,i);}));return m;};
  const per=new Map();let pairs=0;
  C.filter(e=>e.type===to&&e.track&&!(to==='wet'&&e.wq)).forEach(w=>{const W=idx(w);let best=null,bd=1e9;const cand=C.filter(e=>e.type===from&&e.track===w.track),sameV=cand.filter(e=>libVer(e.name)===libVer(w.name));(sameV.length?sameV:cand).forEach(d=>{const D=idx(d);let s=0;W.forEach((v,k)=>{if(D.has(k))s+=Math.abs(v-D.get(k));});if(s<bd){bd=s;best=D;}});
    if(!best)return;pairs++;W.forEach((v,k)=>{if(!best.has(k))return;(per.get(k)||per.set(k,[]).get(k)).push(v-best.get(k));});});
  const out=new Map();per.forEach((a,k)=>{const s=[...a].sort((x,y)=>x-y);const med=s[Math.floor(s.length/2)];if(med&&a.length>=Math.ceil(pairs/2))out.set(k,med);});return {pairs,d:out};}

// requests: each slider click goes, in turn, to the settings of its list (display direction: +1 = the number shown goes up)
const GEN_PREF=[
  {id:'brk',l:'Frenata e ingresso',lo:'più rotazione in ingresso',hi:'più stabile in frenata',r:[['RearBrakeSetting',null,1,'ripartizione più all\'anteriore','ripartizione più al posteriore'],['DiffCoastSetting',null,1,'differenziale in rilascio più chiuso','differenziale in rilascio più aperto'],['RearToeInSetting',null,1,'più convergenza posteriore','meno convergenza posteriore']]},
  {id:'mid',l:'Centro curva',lo:'più stabile',hi:'più rotazione (meno sottosterzo)',r:[['FrontAntiSwaySetting',null,-1,'barra anteriore più morbida','barra anteriore più rigida'],['RearAntiSwaySetting',null,1,'barra posteriore più rigida','barra posteriore più morbida']]},
  {id:'exit',l:'Uscita di curva',lo:'più rotazione con il gas',hi:'più trazione',r:[['RearAntiSwaySetting',null,-1,'barra posteriore più morbida','barra posteriore più rigida'],['DiffPowerSetting',null,-1,'differenziale in trazione più aperto','differenziale in trazione più chiuso'],['TractionControlMapSetting',null,1,'TC più alto','TC più basso']]},
  {id:'aero',l:'Carico o velocità',lo:'più carico (curve veloci)',hi:'più velocità di punta',r:[['RWSetting',null,-1,'meno ala posteriore','più ala posteriore']]},
  {id:'kerb',l:'Cordoli e sconnessioni',lo:'più rigida',hi:'più morbida sui cordoli',r:[['FastBumpSetting','*',-1,'bump veloce più morbido','bump veloce più rigido'],['FastReboundSetting','*',-1,'rebound veloce più morbido','rebound veloce più rigido']]},
  {id:'tyre',l:'Gomme',lo:'più prestazione',hi:'consuma meno le gomme',r:[['TractionControlMapSetting',null,1,'TC più alto','TC più basso'],['DiffPowerSetting',null,-1,'differenziale in trazione più aperto','differenziale in trazione più chiuso'],['CamberSetting','*',1,'campanatura un po\' meno negativa','campanatura un po\' più negativa']]}];
// rain without a wet base: higher, softer, more wing and TC
const GEN_WET=[['RWSetting',null,1,'più ala'],['RWSetting',null,1,'più ala'],['RWSetting',null,1,'più ala'],['RideHeightSetting','FRONTLEFT',1,'anteriore più alta per l\'acqua'],['RideHeightSetting','FRONTRIGHT',1,'anteriore più alta per l\'acqua'],
  ['TractionControlMapSetting',null,1,'TC più alto'],['DiffCoastSetting',null,1,'differenziale in rilascio più chiuso'],['DiffPowerSetting',null,1,'differenziale in trazione più chiuso'],['BrakePressureSetting',null,-1,'pressione freni più bassa'],['RearBrakeSetting',null,-1,'ripartizione un po\' più al posteriore']];
const GEN_SECS=['FRONTLEFT','FRONTRIGHT','REARLEFT','REARRIGHT'];

function genBuild(car,track,type,prefs,baseId,style){const B=(baseId&&SETLIB.find(e=>e.id===baseId&&e.car===car))||libBase(car,track,type,style);if(!B)return null;const K=(libLearn()[car]||{}).keys||{};const ch=new Map();const notes=[];
  const cur=(sec,key)=>{const k=sec+'|'+key;if(ch.has(k))return ch.get(k).ix;const it=(B.su.sec[sec]||[]).find(x=>x.key===key);const ix=it?parseInt(it.raw,10):NaN;return Number.isFinite(ix)&&!/N\/A|Non-adjustable/i.test(it.disp)?ix:NaN;};
  const secsOf=(key,s)=>Object.keys(B.su.sec).filter(sec=>(B.su.sec[sec]||[]).some(x=>x.key===key)&&(s==='*'?GEN_SECS.includes(sec):s?sec===s:true));
  const click=([key,s,dir,why],n)=>{let any=false;secsOf(key,s).forEach(sec=>{const k=sec+'|'+key;const ix=cur(sec,key);if(!Number.isFinite(ix))return;const L=K[k];const step=dir*(L?.sign||1)*n;let to=ix+step;
      if(L&&L.vals.size>=2)to=Math.max(L.min,Math.min(L.max,to));if(to===ix)return;const base=ch.get(k)?.from??ix;ch.set(k,{sec,key,from:base,ix:to,why,seen:!!L?.disp.has(to)});any=true;});return any;};
  const D=type!==B.type&&B.type==='race'?libDelta(car,'race',type):{pairs:0,d:new Map()};
  const fuelK=/^(Fuel|FuelCapacity|VirtualEnergy|NumPitstops|Pitstop\d)Setting$/;const other=B.track!==track;
  if(D.d.size){D.d.forEach((n,k)=>{const [sec,key]=k.split('|');if(other&&fuelK.test(key))return;const ix=cur(sec,key);if(!Number.isFinite(ix))return;const L=K[k];let to=ix+n;if(L&&L.vals.size>=2)to=Math.max(L.min,Math.min(L.max,to));if(to===ix)return;
      ch.set(k,{sec,key,from:ix,ix:to,why:type==='wet'?'come nei setup da pioggia della libreria':'come nei setup da qualifica della libreria',seen:!!L?.disp.has(to)});});
    notes.push(type==='wet'?tr('Parto dal setup da gara e applico le differenze gara → pioggia imparate dai setup della libreria')+` (${D.pairs}).`:tr('Parto dal setup da gara e applico le differenze gara → qualifica imparate dai setup della libreria')+` (${D.pairs}).`);if(other&&type==='q')notes.push(tr('Benzina ed energia per la qualifica dipendono dalla pista: regolale in garage.'));}
  else if(type==='wet'&&B.type!=='wet'){GEN_WET.forEach(r=>click(r,1));notes.push(tr('Nessun setup da pioggia per questa auto: parto da quello asciutto e lo adatto.'));}
  else if(type==='q'&&B.type!=='q')notes.push(tr('Nessun setup da qualifica: parto da quello da gara (carica meno benzina in garage).'));
  // a click that this car cannot take (setting missing or at its limit) moves on to the next setting of the list
  GEN_PREF.forEach(P=>{const k=+prefs[P.id]||0;for(let i=0;i<Math.abs(k);i++){for(let j=0;j<P.r.length;j++){const r=P.r[(i+j)%P.r.length];if(click([r[0],r[1],Math.sign(k)*r[2],k>0?r[3]:(r[4]||r[3])],1))break;}}});
  return {B,changes:[...ch.values()],notes,K};}
// the new .svm: the base file with the changed lines only
function genDisp(L,ix){if(!L)return null;if(L.disp.has(ix))return L.disp.get(ix);const pts=[...L.disp].map(([i,d])=>[i,libNum(d),d]).filter(p=>Number.isFinite(p[1])).sort((a,b)=>Math.abs(a[0]-ix)-Math.abs(b[0]-ix));
  if(pts.length<2)return null;const [a,b]=pts;if(a[0]===b[0])return null;const v=a[1]+(ix-a[0])*(b[1]-a[1])/(b[0]-a[0]);const m=String(a[2]).match(/-?\d+(?:[.,](\d+))?/);const dec=m&&m[1]?m[1].length:0;
  return String(a[2]).replace(/-?\d+(?:[.,]\d+)?/,v.toFixed(dec));}
function genText(G,title){let sec='';const by=new Map(G.changes.map(c=>[c.sec+'|'+c.key,c]));
  return G.B.text.split(/\r?\n/).map(line=>{const m=line.trim().match(/^\[(.+)\]$/);if(m){sec=m[1];return line;}
    const kv=line.match(/^(\s*)([^=\/]+)=([^/]*)(\/\/.*)?$/);if(!kv)return line;const key=kv[2].trim();
    if(key==='Notes'&&sec==='GENERAL')return `${kv[1]}Notes="${title.replace(/"/g,'')}"`;
    const c=by.get(sec+'|'+key);if(!c)return line;const d=genDisp(G.K[sec+'|'+key],c.ix);return `${kv[1]}${key}=${c.ix}//${d||'Data Engineer'}`;}).join('\r\n');}

function renderGen(){const el=$('#genBody');if(!el)return;const L=libLearn();const cars=Object.keys(L).filter(Boolean).sort();
  const S=active()?.S;const curCar=S&&cars.find(c=>{const a=(S.meta.car||'').toLowerCase();return a&&(c.toLowerCase().includes(a)||a.split(/\s+/).some(t=>t.length>3&&c.toLowerCase().includes(t)));});
  const st=LS.get('gen:ui',{});const car=cars.includes(st.car)?st.car:curCar||[...cars].sort((a,b)=>L[b].n-L[a].n)[0]||'';const track=st.track||(S?libTrack(S.meta.venue)?.[0]:'')||'fuji';const type=st.type||'race';const style=st.style||'';const prefs=st.prefs||{};
  const counts=cars.map(c=>`${esc(c)} (${L[c].n})`).join(' · ');
  let h=`<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><button class="btn" type="button" id="genDir">${tr('Importa una cartella di setup')}</button><button class="btn" type="button" id="genAdd">${tr('Aggiungi file .svm')}</button>
    <input type="file" id="genFiles" multiple accept=".svm" hidden><span class="muted small">${SETLIB.length} ${tr('setup in libreria')}${counts?': '+counts:''}</span>${SETLIB.length?`<button class="btn" type="button" id="genClear" style="margin-left:auto">${tr('Svuota libreria')}</button>`:''}</div>`;
  const rank=libRank(car,track,type,style);const baseId=rank.some(e=>e.id===st.base)?st.base:'';
  if(!cars.length){el.innerHTML=h+`<p class="muted small">${tr('Importa la cartella con i setup che hai (setup shop, compagni, i tuoi): la libreria impara i valori di ogni auto e da quale setup partire su ogni pista. Restano solo in questo browser: non finiscono su GitHub né altrove.')}</p>`;genWire();return;}
  h+=`<div class="setgrid"><label class="f">${tr('Auto')}<select id="genCar">${cars.map(c=>`<option${c===car?' selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="f">${tr('Pista')}<select id="genTrack">${LIB_TRACKS.map(t=>`<option value="${t[0]}"${t[0]===track?' selected':''}>${t[1]}</option>`).join('')}</select></label>
    <label class="f">${tr('Per')}<select id="genType">${Object.entries(LIB_TYPE_N).map(([k,v])=>`<option value="${k}"${k===type?' selected':''}>${tr(v)}</option>`).join('')}</select></label><label class="f">${tr('Stile')}<select id="genStyle">${Object.entries(LIB_STYLE_N).map(([k,v])=>`<option value="${k}"${k===style?' selected':''}>${tr(v)}</option>`).join('')}</select></label><label class="f">${tr('Setup di partenza')}<select id="genBase"><option value="">${tr('Automatico')}: ${esc(rank[0]?.name||'')}</option>${rank.slice(0,30).concat(rank.slice(30).filter(e=>e.id===baseId)).map(e=>`<option value="${esc(e.id)}"${e.id===baseId?' selected':''}>${esc(e.name)}</option>`).join('')}</select></label></div>
    <div class="genprefs">${GEN_PREF.map(P=>`<div class="genp"><b>${tr(P.l)}</b><div class="genr"><span>${tr(P.lo)}</span><input type="range" min="-2" max="2" step="1" data-p="${P.id}" value="${+prefs[P.id]||0}"><span>${tr(P.hi)}</span></div></div>`).join('')}</div>`;
  const G=genBuild(car,track,type,prefs,baseId,style);
  if(G){const B=G.B;const tk=LIB_TRACKS.find(t=>t[0]===B.track);
    h+=`<p class="small" style="margin:10px 0 6px"><b>${tr('Base')}</b>: ${esc(B.name)} <span class="muted">(${tk?tk[1]:tr('pista sconosciuta')} · ${tr(LIB_TYPE_N[B.type])}${B.track!==track?' · '+tr('pista diversa: la più simile in libreria'):''})</span></p>${G.notes.map(n=>`<p class="small warn" style="margin:0 0 6px">${esc(n)}</p>`).join('')}`;
    h+=G.changes.length?`<div class="tw"><table class="lbt"><thead><tr><th class="l">${tr('Regolazione')}</th><th class="l">${tr('Base')}</th><th class="l">${tr('Nuovo')}</th><th class="l">${tr('Perché')}</th></tr></thead><tbody>${G.changes.map(c=>{const L=G.K[c.sec+'|'+c.key];const d=i=>genDisp(L,i)||('#'+i);
      return `<tr><td class="l"><b>${esc(SETUP_LABELS[c.key]||c.key)}</b>${SH_SEC[c.sec]?` <span class="muted small">${SH_SEC[c.sec]}</span>`:''}</td><td class="l mono">${esc(d(c.from))}</td><td class="l mono"><b>${esc(d(c.ix))}</b>${c.seen?'':` <span class="muted small">(${tr('valore mai visto in libreria')})</span>`}</td><td class="l small">${esc(tr(c.why))}</td></tr>`;}).join('')}</tbody></table></div>`
      :`<p class="muted small">${tr('Nessuna modifica: sposta i cursori per dire cosa vuoi, oppure usa la base così com\'è.')}</p>`;
    h+=`<div class="row" style="gap:10px;margin-top:10px;align-items:center"><input type="text" id="genName" value="${esc(st.name||('DE '+(tk?tk[1]:'')+' '+LIB_TYPE_N[type]).trim())}" style="max-width:260px"><button class="btn primary" type="button" id="genSave">${isBridgeHost()?tr('Salva nel gioco'):tr('Scarica il .svm')}</button>${isBridgeHost()?`<button class="btn" type="button" id="genDl">${tr('Scarica il .svm')}</button>`:''}<span class="muted small" id="genMsg"></span></div>
      <p class="muted small" style="margin:8px 0 0">${tr('Ogni click va al prossimo parametro della lista, mai oltre i valori visti nei setup della libreria per questa auto. Dopo qualche giro con il nuovo setup, Storico setup e Debrief dicono se è andata nella direzione giusta.')}</p>`;}
  el.innerHTML=h;genWire(G,{car,track,type,prefs});}
function genWire(G,ui){const save=o=>{LS.set('gen:ui',{...LS.get('gen:ui',{}),...o});renderGen();};
  const d=$('#genDir');if(d)d.onclick=libImportDir;const a=$('#genAdd');if(a)a.onclick=()=>$('#genFiles').click();const f=$('#genFiles');if(f)f.onchange=e=>{libImportFiles([...e.target.files]);e.target.value='';};
  const cl=$('#genClear');if(cl)cl.onclick=()=>{if(!confirm(tr('Togliere tutti i setup dalla libreria?')))return;SETLIB.splice(0).forEach(e=>IDB.del(e.id));LIBLEARN=null;renderGen();};
  if(!G&&!ui)return;[['#genCar','car'],['#genTrack','track'],['#genType','type'],['#genBase','base'],['#genStyle','style']].forEach(([id,k])=>{const s=$(id);if(s)s.onchange=()=>save(k==='base'?{base:s.value}:{[k]:s.value,base:''});});
  $$('#genBody input[type=range]').forEach(r=>r.onchange=()=>save({prefs:{...ui.prefs,[r.dataset.p]:+r.value}}));
  const nm=$('#genName');if(nm)nm.onchange=()=>LS.set('gen:ui',{...LS.get('gen:ui',{}),name:nm.value});if(!G)return;
  const name=()=>(nm?.value||'Data Engineer').trim();const title=()=>`${name()} - Data Engineer da ${G.B.name}`;
  const dl=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([genText(G,title())],{type:'text/plain'}));a.download=name()+'.svm';document.body.appendChild(a);a.click();a.remove();};
  const sv=$('#genSave'),db=$('#genDl');if(db)db.onclick=dl;
  if(sv)sv.onclick=async()=>{if(!isBridgeHost()){dl();return;}const msg=$('#genMsg');msg.textContent=tr('Salvo…');
    try{const tk=LIB_TRACKS.find(t=>t[0]===ui.track);const r=await (await fetch('/svm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({track:tk?tk[1]:ui.track,name:name(),text:genText(G,title())})})).json();
      if(!r.ok)throw new Error(r.error+(r.folders?.length?` (${tr('cartelle')}: ${r.folders.slice(0,8).join(', ')})`:''));msg.innerHTML=`<span class="pos">${tr('Salvato in')} ${esc(r.folder)} › ${esc(r.file)}: ${tr('lo trovi nel garage di LMU')}</span>`;}
    catch(e){msg.innerHTML=`<span class="neg">${esc(e.message)}</span> · ${tr('lo scarico: mettilo a mano nella cartella dei setup della pista')}`;dl();}};}

setTimeout(()=>{const first=$('#suSheet')?.closest('.panel');if(first&&!$('#genP'))first.insertAdjacentHTML('afterend',`<div class="panel" id="genP"><div class="panel-h"><h3>${tr('Generatore di setup')}</h3><span class="badge off">${tr('dalla tua libreria di setup · niente AI')}</span></div><div id="genBody"></div></div>`);
  const base=RENDER.setup;RENDER.setup=()=>{base();try{renderGen();}catch(e){console.error(e);}};if(curView()==='setup')RENDER.setup();},0);
