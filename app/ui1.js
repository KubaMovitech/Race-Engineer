// ================= APP: base =================
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtLap=s=>Number.isFinite(s)&&s>0?`${Math.floor(s/60)}:${(s%60).toFixed(3).padStart(6,'0')}`:'—';
const fx=(v,d=1,u='')=>Number.isFinite(v)?v.toFixed(d)+(u?' '+u:''):'—';
const fsign=(v,d=3)=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(d):'—';
const WL={FL:'Ant. sx',FR:'Ant. dx',RL:'Post. sx',RR:'Post. dx'};
const COLS4=()=>[tok('lapA'),tok('lapB'),tok('good'),tok('warn')];
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3200);}
const LS={get(k,d){try{const v=localStorage.getItem('pitwall:'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem('pitwall:'+k,JSON.stringify(v));}catch(e){}}};

const store={items:[]};
const CFG_DEF={pmin:'',pmax:'',iomin:3,iomax:12,bmax:'',rh:3,tmin:75,tmax:95};
let _cfg=null;function cfg(){if(!_cfg)_cfg={...CFG_DEF,...LS.get('cfg',{})};return _cfg;}
function saveCfg(){LS.set('cfg',_cfg);}
const num=v=>v===''||v==null?NaN:+v;

// ---------- local library (IndexedDB, only in this browser)
const IDB={db:null,
  open(){return new Promise(res=>{try{const r=indexedDB.open('pitwall',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'name'});r.onsuccess=()=>{this.db=r.result;res(true);};r.onerror=()=>res(false);}catch(e){res(false);}});},
  tx(m){return this.db.transaction('files',m).objectStore('files');},
  all(){return new Promise(res=>{if(!this.db)return res([]);try{const r=this.tx('readonly').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>res([]);}catch(e){res([]);}});},
  put(o){try{this.db&&this.tx('readwrite').put(o);}catch(e){}},
  del(n){try{this.db&&this.tx('readwrite').delete(n);}catch(e){}}
};
async function gunzip(buf){const ds=new DecompressionStream('gzip');return await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();}
function extOf(n){const m=n.toLowerCase().match(/\.(ld|xml|svm)(\.gz)?$/);return m?m[1]:null;}

async function addFile(name,buf,{persist=false,sample=false}={}){
  if(/\.gz$/i.test(name))buf=await gunzip(buf);
  const ext=extOf(name);let item;
  if(ext==='ld'){item=buildSession(parseLD(buf),name);item.label=sessLabel(item);}
  else if(ext==='xml'){item=parseResultsXML(new TextDecoder().decode(buf),name);item.label=`${item.venue} · risultati ${item.time.slice(0,10)}`;}
  else if(ext==='svm'){item=parseSVM(new TextDecoder('latin1').decode(buf),name);item.label=name.replace(/\.svm$/i,'');}
  else throw new Error('Formato non supportato: usa .ld, .xml o .svm');
  item.sample=sample;item.file=name;
  const old=store.items.findIndex(x=>x.id===item.id);if(old>=0)store.items.splice(old,1,item);else store.items.push(item);
  if(persist)IDB.put({name,buf,added:Date.now()});
  return item;
}
function sessLabel(S){const m=S.meta;return `${m.venue||'Pista'}${m.car?' · '+m.car:''} · ${m.date?m.date.slice(0,5):''} ${m.time?m.time.slice(0,5):''}`.trim();}
const lds=()=>store.items.filter(x=>x.kind==='ld'),xmls=()=>store.items.filter(x=>x.kind==='xml'),svms=()=>store.items.filter(x=>x.kind==='svm');
const byId=id=>store.items.find(x=>x.id===id);
function relink(){lds().forEach(S=>{mergeResults(S,xmls());});}
const active=()=>{const v=$('#gSess').value;if(!v)return null;if(v.startsWith('xml:')){const [id,si]=v.split('|');return {xml:byId(id),si:+si};}return {S:byId(v)};};

function renderLib(){
  const el=$('#lib');el.innerHTML='';$('#nFiles').textContent=store.items.length;
  store.items.forEach(it=>{const c=document.createElement('span');c.className='chip';c.title=it.file;
    c.innerHTML=`<span class="k">${it.kind==='ld'?'motec':it.kind==='xml'?'risultati':it.kind==='live'?'live':'setup'}</span><span class="nm">${esc(it.label)}${it.sample?' <span class="muted">· esempio</span>':''}</span><button type="button" aria-label="Rimuovi ${esc(it.label)}">×</button>`;
    c.querySelector('button').onclick=()=>{store.items=store.items.filter(x=>x!==it);if(!it.sample)IDB.del(it.file);relink();refreshAll();};
    if(it.kind==='ld'){const s=document.createElement('button');s.type='button';const on=isRef(it);s.textContent=on?'★ riferimento':'☆ riferimento';s.title='Usa questo file come giro di riferimento nel Coach';s.style.cssText='font-size:.75rem;color:'+(on?'var(--accent)':'var(--faint)');s.onclick=()=>{LS.set('ref:'+it.id,!isRef(it));$('#coRef').dataset.sess='';renderLib();if(curView()==='coach')RENDER.coach();};c.insertBefore(s,c.lastChild);}
    el.appendChild(c);});
  const d=document.createElement('button');d.type='button';d.className='drop';d.textContent='+ Aggiungi o trascina qui file .ld · .xml · .svm';d.onclick=()=>$('#fileIn').click();el.appendChild(d);
  const p=document.createElement('span');p.className='muted small';p.textContent='I file che carichi restano solo in questo browser.';el.appendChild(p);
}
async function handleFiles(files){
  for(const f of files){try{const it=await addFile(f.name,await f.arrayBuffer(),{persist:true});toast('Caricato: '+it.label);if(it.kind==='ld')$('#gSess').dataset.want=it.id;if(it.kind==='xml'){relink();if(!lds().some(S=>S.merged?.R===it))$('#gSess').dataset.want=it.id+'|0';}}catch(e){console.error(e);toast(`${f.name}: ${e.message}`);}}
  relink();learnPitLoss();learnWet();lds().forEach(S=>{try{recordHistory(S);}catch(e){}});refreshAll();
}

// ---------- tabs + selects
const RENDER={};
function showView(v){$$('.tab').forEach(t=>t.setAttribute('aria-selected',t.dataset.view===v));$$('.view').forEach(s=>s.hidden=s.id!=='v-'+v);LS.set('tab',v);renderHero();RENDER[v]&&RENDER[v]();}
function curView(){return $('.tab[aria-selected="true"]').dataset.view;}
function refreshAll(){renderLib();fillSelects();renderHero();RENDER[curView()]();}
function opt(sel,items,keep=true){const prev=keep?sel.value:null;sel.innerHTML=items.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');if(prev&&items.some(i=>i[0]===prev))sel.value=prev;}
function lapOptions(S){const b=S.best;return S.laps.map(l=>[String(l.i),`Giro ${l.num} · ${l.complete||l.start?fmtLap(l.time):'parziale'}${l.invalid?' · NON VALIDO':''} · ${l.type}${b&&l===b?' ★':''}`]);}
function defaultLap(S){return S.best?S.best.i:(S.laps.find(l=>l.complete)||S.laps[0]).i;}
function fillSelects(){
  const L=lds().map(s=>[s.id,s.label]);
  const merged=new Set(lds().map(S=>S.merged?.R.id).filter(Boolean));
  const X=xmls().flatMap(x=>x.sessions.map((s,i)=>[x.id+'|'+i,`${x.venue} · ${s.name} (solo risultati${merged.has(x.id)?', già unito':''})`]));
  const g=$('#gSess');opt(g,[...L,...X]);
  if(g.dataset.want&&[...g.options].some(o=>o.value===g.dataset.want)){g.value=g.dataset.want;delete g.dataset.want;}
  for(const id of ['#cmpSessA','#cmpSessB'])opt($(id),L);
  $('#coRef').dataset.sess='';$('#coLap').dataset.sess='';
  opt($('#suFile'),[['','— nessun file setup —'],...svms().map(s=>[s.id,s.label])]);
  if(!$('#suFile').value&&svms().length)$('#suFile').value=svms()[0].id;
}

// ---------- hero with track conditions
function renderHero(){
  const h=$('#hero'),a=active();
  if(!a){h.innerHTML=`<div><div class="ey">Nessuna sessione</div><h1>Carica una telemetria MoTeC</h1><div class="meta">Trascina qui un file .ld esportato da Le Mans Ultimate, il .xml dei risultati e il .svm del setup.</div></div>`;return;}
  if(a.xml){const R=a.xml,s=R.sessions[a.si];h.innerHTML=`<div><div class="ey">Risultati ufficiali · ${esc(s.name)}</div><h1>${esc(R.venue)}</h1><div class="meta">${esc(R.event)} · ${esc(R.time)} · senza telemetria: niente condizioni pista, tracce o setup</div></div><div class="cond"><button class="btn primary" type="button" id="btnReport">Report</button></div>`;$('#btnReport').onclick=openReport;return;}
  const S=a.S,m=S.meta,c=S.cond,fl=S.laps.filter(l=>l.complete).length;
  const rng=(r,d=1,u='°C')=>!r?'—':Math.abs(r.max-r.min)<0.2?fx(r.avg,d)+u:`${fx(r.start,d)}→${fx(r.end,d)}${u}`;
  const chips=[['Aria',rng(c.air)],['Pista',rng(c.track)],['Meteo',c.label,c.state],c.wet&&c.wet.max>0?['Bagnato',fx(c.wet.max*100,0)+'%','wet']:null,c.cloud?['Nuvole',fx(c.cloud.avg*100,0)+'%']:null,c.wind?['Vento',fx(c.wind.avg,1)+' m/s']:null].filter(Boolean);
  const mg=S.merged?`<span class="badge">● Risultati ufficiali uniti · ${S.merged.hits} giri</span>`:`<span class="badge off">Senza .xml: niente giri invalidi ufficiali né energia virtuale</span>`;
  h.innerHTML=`<div><div class="ey">Telemetria MoTeC · ${esc(m.date)} ${esc(m.time.slice(0,5))}</div><h1>${esc(m.venue||'Pista')}</h1><div class="meta">${esc(m.car||S.merged?.d.car||'Auto non indicata')} · ${esc((m.driver||'').replace(/#\d+$/,''))} · ${fl} giri completi · ${fx(S.trackLen,0)} m &nbsp;${mg}</div></div>
  <div class="cond"><button class="btn primary" type="button" id="btnReport" style="align-self:center">Report</button>${chips.map(([k,v,cl])=>`<div class="cchip ${cl||''}"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  $('#btnReport').onclick=openReport;
}

// ---------- chart toolbar
function buildToolbar(el,chart,{channels,key,onChange,expandPanel}){
  const on=LS.get('ch:'+key,channels.filter(c=>c.def!==false).map(c=>c.id));
  const size=LS.get('size:'+key,1);chart.scale=size;
  el.innerHTML=`<button class="btn icon" data-a="out" title="Riduci zoom">−</button><button class="btn icon" data-a="in" title="Aumenta zoom">+</button><button class="btn icon" data-a="l" title="Scorri indietro">◀</button><button class="btn icon" data-a="r" title="Scorri avanti">▶</button><button class="btn" data-a="reset">Giro intero</button><span class="sep"></span>
    <span class="seg" role="group" aria-label="Altezza grafici">${[[0.8,'S'],[1,'M'],[1.35,'L'],[1.8,'XL']].map(([v,l])=>`<button type="button" data-s="${v}" aria-pressed="${v===size}">${l}</button>`).join('')}</span>
    <button class="btn" data-a="exp">Espandi</button><span class="sep"></span>
    ${channels.map(c=>`<button type="button" class="tog" data-c="${c.id}" aria-pressed="${on.includes(c.id)}">${c.label}</button>`).join('')}`;
  el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const a=b.dataset.a;if(a==='in')chart.zoomIn();if(a==='out')chart.zoomOut();if(a==='l')chart.pan(-0.5);if(a==='r')chart.pan(0.5);if(a==='reset')chart.reset();
    if(a==='exp'){const p=expandPanel;const ex=!p.classList.contains('expanded');p.classList.toggle('expanded',ex);document.body.classList.toggle('has-expanded',ex);b.textContent=ex?'Chiudi':'Espandi';chart.draw();}});
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{chart.scale=+b.dataset.s;LS.set('size:'+key,chart.scale);el.querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-pressed',x===b));chart.draw();});
  el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const p=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',p);LS.set('ch:'+key,[...el.querySelectorAll('[data-c][aria-pressed="true"]')].map(x=>x.dataset.c));onChange();});
  return ()=>[...el.querySelectorAll('[data-c][aria-pressed="true"]')].map(x=>x.dataset.c);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const p=$('.panel.expanded');if(p){p.classList.remove('expanded');document.body.classList.remove('has-expanded');p.querySelector('[data-a="exp"]').textContent='Espandi';}}});

// ================= SESSION / STINT =================
RENDER.stint=()=>{
  const a=active(),body=$('#stBody');
  if(!a){body.innerHTML='<div class="panel empty">Carica una telemetria .ld (e se vuoi il .xml dei risultati della stessa sessione).</div>';return;}
  if(a.xml)stintXML(a.xml,a.xml.sessions[a.si],body);else stintLD(a.S,body);
};
function lapTimeCell(l,t){return `<td class="lt">${fmtLap(t)}</td>`;}
function stintXML(R,sess,body){
  const di=myDriverIdx(R,sess);const D=sess.drivers[di],laps=D.laps;
  if(!laps.length){body.innerHTML=(sess.drivers.length>1?driverPicker(R,sess,di):'')+'<div class="panel empty">Questo pilota non ha giri registrati in questa sessione.</div>';if(sess.drivers.length>1){body.insertAdjacentHTML('beforeend',paceHTML(sess,D));wirePace(sess,D);$('#xDrv').onchange=e=>{LS.set('xmldrv:'+R.id+'|'+sess.name,e.target.value);RENDER.stint();};}return;}
  const A=stintAnalysis(laps);
  const wearAvg=mean(W.map(w=>A.wear[w])),wearMax=Math.max(...W.map(w=>A.wear[w]).filter(Number.isFinite));
  const lapsFuel=1/A.fuelPerLap,lapsVE=1/A.vePerLap;
  const lim=[['carburante',lapsFuel],['energia virtuale',lapsVE]].filter(x=>Number.isFinite(x[1])&&x[1]>0).sort((a,b)=>a[1]-b[1])[0];
  const bS=k=>Math.min(...laps.filter(x=>!x.invalid&&Number.isFinite(x[k])).map(x=>x[k]));
  const hasF=laps.some(l=>Number.isFinite(l.fuel)),hasT=laps.some(l=>Number.isFinite(l.tw.FL));
  body.innerHTML=`
  <div class="warnbar">Stai vedendo solo il file risultati: carica il .ld della stessa sessione per litri, temperature, pressioni e condizioni pista. I valori di carburante ed energia nel .xml sono frazioni arrotondate al millesimo (±0,1%).</div>
  <div class="panel"><p class="muted small" style="margin:0 0 10px">${esc(D.car)} (${esc(D.cls)}) · ${esc(D.name.replace(/#\d+$/,''))} · ${laps.length} giri${D.aids?' · aiuti: '+esc(D.aids.replace('PlayerControl,','')):''}</p>
  <div class="kpis">
    <div class="kpi hl"><div class="l">Miglior giro</div><div class="v">${fmtLap(A.best)}</div></div>
    <div class="kpi"><div class="l">Passo medio · ${A.paceLaps.length} giri</div><div class="v">${fmtLap(A.avg)}</div><div class="s">σ ${fx(A.sd,3)} s</div></div>
    <div class="kpi"><div class="l">Carburante / giro</div><div class="v">${fx(A.fuelPerLap*100,1)} %</div><div class="s">≈ ${fx(lapsFuel,1)} giri col pieno</div></div>
    <div class="kpi"><div class="l">Energia virtuale / giro</div><div class="v">${fx(A.vePerLap*100,1)} %</div><div class="s">≈ ${fx(lapsVE,1)} giri al 100%</div></div>
    <div class="kpi"><div class="l">Usura / giro</div><div class="v">${fx(wearAvg*100,2)} %</div><div class="s">peggiore ${fx(wearMax*100,2)} %</div></div>
    <div class="kpi"><div class="l">Autonomia</div><div class="v txt">${lim?'≈ '+fx(lim[1],1)+' giri':'—'}</div><div class="s">${lim?'limitata da '+lim[0]:''}</div></div>
  </div></div>
  ${xmlStripHTML(D)}${eventsSummaryHTML(D,sess)}
  <div class="panel"><div class="tw"><table><thead><tr><th>Giro</th><th class="l">Tipo</th><th>Tempo</th><th>S1</th><th>S2</th><th>S3</th><th>Vel. max</th><th>Pos</th>${hasF?'<th>Carb. usato</th><th>Carb.</th><th>VE usata</th><th>VE</th>':''}${hasT?W.map(w=>`<th>${w}</th>`).join(''):''}<th class="l">Note</th></tr></thead><tbody>
  ${A.stints.map((s,si)=>`${si?`<tr class="sep"><td colspan="20">Stint ${si+1} · ${s.laps[0].kind==='uscita garage'||(A.stints[si-1]?.laps.slice(-1)[0]?.kind==='rientro garage')?'dopo rientro in garage':A.stints[si-1]?.laps.slice(-1)[0]?.pit?'dopo la sosta ai box':'dopo rifornimento / reset / cambio gomme'}</td></tr>`:''}${s.laps.map(l=>{
    const t=Number.isFinite(l.time)?l.time:l.estTime;const sv=k=>Number.isFinite(l[k])?`<span${l[k]===bS(k)?' style="color:var(--best)"':''}>${l[k].toFixed(3)}</span>`:'—';
    return `<tr class="${l.best?'best':''} ${l.invalid?'inv':''} ${l.kind!=='lanciato'&&l.kind!=='partenza'?'out':''}"><td>${l.num}</td><td class="l">${kindBadge(l.kind)}</td><td class="lt"${l.noTime?` title="${esc(l.noTime)}"`:''}>${Number.isFinite(l.time)?fmtLap(t):Number.isFinite(t)?(l.invalid?fmtLap(t):`<span class="muted" style="font-style:italic">≈${fmtLap(t)}</span>`):'—'}</td><td>${sv('s1')}</td><td>${sv('s2')}</td><td>${sv('s3')}</td><td>${l.top>0?fx(l.top,1):'—'}</td><td>${Number.isFinite(l.pos)?l.pos:'—'}</td>${hasF?`<td>${l.fuelUsed>0?fx(l.fuelUsed*100,1)+'%':'—'}</td><td>${fx(l.fuel*100,1)}%</td><td>${l.veUsed>0?fx(l.veUsed*100,1)+'%':'—'}</td><td>${fx(l.ve*100,1)}%</td>`:''}${hasT?W.map(w=>`<td>${fx(l.tw[w]*100,1)}</td>`).join(''):''}<td class="l">${l.best?'<span class="tag best">best</span>':''}${evTags(l)}${l.noTime&&!l.invalid&&l.kind==='lanciato'?` <span class="muted small">${esc(l.noTime)}</span>`:''}</td></tr>`;}).join('')}`).join('')}
  </tbody></table></div><p class="muted small">Quando un giro viene invalidato, Le Mans Ultimate nel file risultati scrive «--.----» al posto del tempo. Lo ricostruisco dall'ora di inizio del giro successivo: in rosso i giri invalidati, in corsivo «≈» quelli senza tempo per altri motivi (passa sopra il tempo per il motivo). Restano «—» i giri di uscita, di box, interrotti o finiti con la sessione. I tempi ricostruiti non entrano nelle medie.</p></div>`;
  if(sess.drivers.length>1){body.insertAdjacentHTML('afterbegin',driverPicker(R,sess,di));body.insertAdjacentHTML('beforeend',rivalsHTML(sess,D));drawRivals(sess,D);body.insertAdjacentHTML('beforeend',paceHTML(sess,D));wirePace(sess,D);$('#xDrv').onchange=e=>{LS.set('xmldrv:'+R.id+'|'+sess.name,e.target.value);RENDER.stint();};}
}

// ================= LAP =================
let lapChart,lapMap,lapCur={},lapChannels;
const LAP_CH=[{id:'speed',label:'Velocità'},{id:'delta',label:'Delta vs best'},{id:'ped',label:'Gas/freno'},{id:'gear',label:'Marcia'},{id:'steer',label:'Sterzo'},{id:'rpm',label:'Giri motore'},{id:'g',label:'Forze G'},{id:'slip',label:'Slittamento ruote',def:false},{id:'rh',label:'Altezze',def:false},{id:'bt',label:'Temp. freni',def:false}];
RENDER.lap=()=>{
  const a=active(),S=a?.S;
  if(!S){$('#lapHead').innerHTML='<div class="kpi"><div class="empty">Scegli una telemetria .ld in alto</div></div>';return;}
  const sel=$('#lapSel');if(sel.dataset.sess!==S.id){opt(sel,lapOptions(S),false);sel.value=String(defaultLap(S));sel.dataset.sess=S.id;}
  drawLap(S,S.laps[+sel.value]);
};
function sectorTimes(g){const cs=g.get('Current Sector');if(!cs)return [];const out=[];let st=0,prev=cs[0];for(let i=1;i<g.n;i++){if(cs[i]!==prev){out.push(g.t[i]-st);st=g.t[i];prev=cs[i];}}out.push(g.t[g.n-1]-st);return out.length>=2&&out.length<=4?out:[];}
function sectorMarks(g){const cs=g.get('Current Sector');const m=[];if(!cs)return m;let prev=cs[0],k=1;for(let i=1;i<g.n;i++){if(cs[i]!==prev){k++;m.push({x:g.d[i],label:'S'+k});prev=cs[i];}}return m;}
function slipSeries(g,wheels){const sp=g.get('Ground Speed');const R={};wheels.forEach(w=>R[w]=wheelRadius(g,w));return wheels.map(w=>{const ws=g.get('Wheel Rot Speed '+w);if(!ws)return null;const o=new Float32Array(g.n);for(let i=0;i<g.n;i++){const v=sp[i]/3.6;o[i]=v>8?Math.max(-60,Math.min(60,(Math.abs(ws[i])*R[w]-v)/v*100)):NaN;}return o;});}
function drawLap(S,lap){
  const g=lapGrid(S,lap,2),v=g.get('Ground Speed'),th=g.get('Throttle Pos'),br=g.get('Brake Pos');
  const corners=detectCorners(g);lapCur={S,lap,g,corners};
  const secs=lap.s&&lap.s.every(Number.isFinite)?lap.s:sectorTimes(g),stt=lapStats(S,lap);
  const full=th?[...th].filter(x=>x>=98).length/g.n:NaN,brk=br?[...br].filter(x=>x>5).length/g.n:NaN;
  let gch=0;const ge=g.get('Gear');if(ge)for(let i=1;i<g.n;i++)if(ge[i]!==ge[i-1])gch++;
  const lc=lapConditions(S,lap);
  $('#lapHead').innerHTML=`
    <div class="kpi ${lap.invalid?'inv':'hl'}"><div class="l">Giro ${lap.num} · ${lap.type}${lap.invalid?' · non valido':''}</div><div class="v">${lap.complete?fmtLap(lap.time):'parziale'}</div><div class="s">${S.best&&lap!==S.best&&lap.complete?fsign(lap.time-S.best.time,3)+' s dal best':S.best===lap?'miglior giro della sessione':''}</div></div>
    ${secs.map((s,i)=>`<div class="kpi"><div class="l">Settore ${i+1}</div><div class="v">${fx(s,3)}</div></div>`).join('')}
    <div class="kpi"><div class="l">Velocità max / min</div><div class="v">${fx(pct(v,1),0)} / ${fx(pct(v,0),0)}</div><div class="s">km/h</div></div>
    <div class="kpi"><div class="l">Gas pieno · frenata</div><div class="v">${fx(full*100,0)}% · ${fx(brk*100,0)}%</div><div class="s">${gch} cambi marcia</div></div>
    <div class="kpi"><div class="l">Carburante</div><div class="v">${fx(stt.fuel,2)} L</div><div class="s">${Number.isFinite(stt.batMax)?'batteria '+fx(stt.batMin,0)+'–'+fx(stt.batMax,0)+'%':''}</div></div>
    <div class="kpi"><div class="l">Pista / aria</div><div class="v">${fx(lc.track,1)}° / ${fx(lc.air,0)}°</div><div class="s">${lc.rain>0.05?'pioggia':lc.wet>0.05?'umida':'asciutta'}</div></div>`;
  const lat=g.get('GPS Latitude'),lon=g.get('GPS Longitude');
  const mode=$('#lapMapCh').value;const vmin=pct(v,0),vmax=pct(v,1),gl=g.get('G Force Lat');const gmax=Math.max(...(ge||[1]));
  const colors=Array.from({length:g.n},(_,i)=>mode==='speed'?ramp((v[i]-vmin)/(vmax-vmin)):mode==='pedals'?(br&&br[i]>5?tok('bad'):th&&th[i]>=95?tok('good'):th&&th[i]>5?tok('warn'):tok('faint')):mode==='gear'?ramp((ge?ge[i]:0)/gmax):ramp(Math.abs(gl?gl[i]:0)/2.5));
  lapMap.set(lat,lon,colors,S.meta.venue,corners.map(c=>({i:c.apex,label:c.k})));
  drawLapChart(true);
  lapReadout(null);
  $('#lapCorners').innerHTML=corners.length?`<table><thead><tr><th>Curva</th><th>Apice m</th><th>Frenata m</th><th>Vel. frenata</th><th>Freno max</th><th>Vel. min</th><th>Marcia</th><th>Gas pieno m</th><th>Uscita</th><th>Tratto s</th></tr></thead><tbody>
    ${corners.map(c=>`<tr class="clickable" data-d="${c.dApex}"><td>T${c.k}</td><td>${fx(c.dApex,0)}</td><td>${c.brake!=null?fx(c.brake,0):'<span class="muted">lift</span>'}</td><td>${fx(c.brakeV,0)}</td><td>${c.brakePeak?fx(c.brakePeak,0)+'%':'—'}</td><td><b>${fx(c.vMin,0)}</b></td><td>${fx(c.gear,0)}</td><td>${fx(c.fullThr,0)}</td><td>${fx(c.vExit,0)}</td><td>${fx(c.time,2)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Nessuna curva rilevata.</div>';
  $$('#lapCorners tr.clickable').forEach(tr=>tr.onclick=()=>{const d=+tr.dataset.d;lapChart.setRange(d-300,d+250);$('#lapChartPanel').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#lapTyres').innerHTML=tyreBlock(stt);
  drawLimits(S);
}
function drawLapChart(reset){
  const {S,lap,g,corners}=lapCur;if(!g)return;const on=lapChannels();const v=g.get('Ground Speed');
  const best=S.best&&S.best!==lap&&lap.complete?lapGrid(S,S.best,2,g.len):null;
  const P=[];
  if(on.includes('speed'))P.push({label:'Velocità km/h',h:170,series:[{data:v,color:tok('lapA'),w:1.9}],dp:0,overview:true});
  if(on.includes('delta')&&best)P.push({label:'Delta vs best (giro '+S.best.num+') s',h:90,zero:true,series:[{data:g.t.map((t,i)=>t-best.t[i]),color:tok('accent'),fill:true}],dp:3});
  if(on.includes('ped'))P.push({label:'Gas / freno %',h:100,min:-3,max:103,series:[{data:g.get('Throttle Pos'),color:tok('good'),name:'gas'},{data:g.get('Brake Pos'),color:tok('bad'),name:'freno'}],dp:0});
  if(on.includes('gear')&&g.get('Gear'))P.push({label:'Marcia',h:75,series:[{data:g.get('Gear'),color:tok('ink'),step:true}],dp:0});
  if(on.includes('steer')&&g.get('Steering'))P.push({label:'Sterzo %',h:90,zero:true,series:[{data:g.get('Steering'),color:tok('lapB')}],dp:0});
  if(on.includes('rpm')&&g.get('Engine RPM'))P.push({label:'Giri motore',h:85,series:[{data:g.get('Engine RPM'),color:tok('muted')}],dp:0});
  if(on.includes('g')&&g.get('G Force Lat'))P.push({label:'G lat / long',h:95,zero:true,series:[{data:g.get('G Force Lat'),color:tok('lapA'),name:'lat'},{data:g.get('G Force Long'),color:tok('warn'),name:'long'}],dp:2});
  if(on.includes('slip')&&g.get('Wheel Rot Speed FL')){const s=slipSeries(g,W);P.push({label:'Slittamento ruote % (− bloccaggio, + pattinamento)',h:110,zero:true,series:W.map((w,i)=>({data:s[i],color:COLS4()[i],name:w,w:1.2})),dp:0});}
  if(on.includes('rh')&&g.get('Ride Height FL'))P.push({label:'Altezza da terra mm',h:100,series:W.map((w,i)=>({data:g.get('Ride Height '+w),color:COLS4()[i],name:w,w:1.2})),dp:0});
  if(on.includes('bt')&&g.get('Brake Temp FL'))P.push({label:'Temperatura freni °C',h:100,series:W.map((w,i)=>({data:g.get('Brake Temp '+w),color:COLS4()[i],name:w,w:1.2})),dp:0});
  if(!P.length)P.push({label:'Velocità km/h',h:170,series:[{data:v,color:tok('lapA')}],dp:0});
  lapChart.set(g.d,P,[...sectorMarks(g),...corners.map(c=>({x:c.dApex,label:'T'+c.k}))],!reset);
}
function lapReadout(i){
  const {g}=lapCur;if(!g)return;const el=$('#lapReadout');if(i==null){el.innerHTML='<span class="hint" style="grid-column:1/-1">Passa sopra mappa o grafici per leggere i valori</span>';return;}
  const r=(n,d=0,u='')=>{const a=g.get(n);return a?fx(a[i],d,u):'—';};
  el.innerHTML=`<span>Dist <b>${fx(g.d[i],0)} m</b></span><span>Tempo <b>${fx(g.t[i],2)} s</b></span><span>Vel <b>${r('Ground Speed',0,'km/h')}</b></span><span>Marcia <b>${r('Gear')}</b></span><span>Gas <b>${r('Throttle Pos',0,'%')}</b></span><span>Freno <b>${r('Brake Pos',0,'%')}</b></span><span>RPM <b>${r('Engine RPM')}</b></span><span>G lat <b>${r('G Force Lat',2)}</b></span>`;
}
function tcol(t,lo=60,hi=110){return ramp((t-lo)/(hi-lo));}
function tyreBlock(s){
  const all=W.flatMap(w=>[s.w[w].I,s.w[w].C,s.w[w].O]).filter(Number.isFinite);const lo=Math.min(...all)-5,hi=Math.max(...all)+5;
  const box=w=>{const x=s.w[w];const left=w.endsWith('L');const cells=left?[['E',x.O],['C',x.C],['I',x.I]]:[['I',x.I],['C',x.C],['E',x.O]];
    return `<div class="tyre"><div class="hd"><span>${w}</span><span class="muted small">${WL[w]}</span></div>
    <div class="ico">${cells.map(([k,t])=>`<span style="background:${tHeat(t)}" title="${k}">${k} ${fx(t,0)}</span>`).join('')}</div>
    <dl><dt>Pressione</dt><dd>${fx(x.p,1)} kPa</dd><dt>Carcassa</dt><dd style="color:${tHeat(x.carc)}">${fx(x.carc,0)} °C</dd><dt>Superficie</dt><dd>${fx(mean([x.sI,x.sC,x.sO]),0)} °C</dd><dt>Usura giro</dt><dd>${fx(x.wear,2)} %</dd><dt>Freno max</dt><dd>${fx(x.bMax,0)} °C</dd><dt>Altezza min</dt><dd>${fx(x.rhMin,1)} mm</dd></dl></div>`;};
  return `<div class="car">${W.map(box).join('')}</div><p class="muted small" style="text-align:center">Strato interno della gomma (E/C/I) e carcassa, medie sopra i 50 km/h. Colori rispetto alla finestra impostata: blu sotto, verde dentro, rosso sopra.</p>`;
}

// ================= COMPARE =================
let cmpChart,cmpMap,cmpCur={},cmpChannels;
const CMP_CH=[{id:'delta',label:'Delta'},{id:'speed',label:'Velocità'},{id:'thr',label:'Gas'},{id:'brk',label:'Freno'},{id:'gear',label:'Marcia'},{id:'steer',label:'Sterzo'},{id:'line',label:'Traiettoria'},{id:'rpm',label:'Giri motore',def:false},{id:'glat',label:'G laterale',def:false},{id:'glon',label:'G long.',def:false}];
RENDER.cmp=()=>{
  const g=active();const def=g?.S?.id;
  for(const id of ['#cmpSessA','#cmpSessB'])if(!$(id).value&&def)$(id).value=def;
  const A=byId($('#cmpSessA').value),B=byId($('#cmpSessB').value);
  if(!A||!B){$('#cmpHead').innerHTML='<div class="kpi"><div class="empty">Carica almeno una telemetria .ld</div></div>';return;}
  for(const [ls,S,which] of [['#cmpLapA',A,'A'],['#cmpLapB',B,'B']]){const sel=$(ls);if(sel.dataset.sess!==S.id){opt(sel,lapOptions(S),false);let d=defaultLap(S);if(which==='B'&&A===B){const alt=S.laps.filter(l=>l.complete&&l.i!==d&&l.type==='lanciato').sort((a,b)=>a.time-b.time)[0];if(alt)d=alt.i;}sel.value=String(d);sel.dataset.sess=S.id;}}
  drawCmp(A,A.laps[+$('#cmpLapA').value],B,B.laps[+$('#cmpLapB').value]);
};
function drawCmp(SA,la,SB,lb){
  const ga=lapGrid(SA,la,2),gb=lapGrid(SB,lb,2,ga.len);
  const warn=[];if(SA.meta.venue!==SB.meta.venue)warn.push(`Piste diverse (${SA.meta.venue} / ${SB.meta.venue}): il confronto non ha senso.`);
  else if(Math.abs(lapTrace(SB,lb).len-ga.len)/ga.len>0.03)warn.push('Le lunghezze dei due giri differiscono più del 3%: uno dei due potrebbe essere incompleto o avere un taglio.');
  if(!la.complete||!lb.complete)warn.push('Uno dei due giri è parziale.');
  const ca=SA.cond,cb=SB.cond;if(ca.track&&cb.track&&Math.abs(ca.track.avg-cb.track.avg)>3)warn.push(`Temperatura pista diversa: ${fx(ca.track.avg,1)} °C (A) contro ${fx(cb.track.avg,1)} °C (B). Parte della differenza può venire dalle condizioni.`);
  if(ca.state!==cb.state)warn.push(`Condizioni diverse: ${ca.label} (A) contro ${cb.label} (B).`);
  $('#cmpWarn').innerHTML=warn.map(w=>`<div class="warnbar" style="margin-top:10px">${esc(w)}</div>`).join('');
  const delta=ga.t.map((t,i)=>gb.t[i]-t);
  const cr=detectCorners(ga);
  const rows=cr.map(c=>{const tA=ga.t[c.e]-ga.t[c.s],tB=gb.t[c.e]-gb.t[c.s];
    const vb=gb.get('Ground Speed'),bb=gb.get('Brake Pos'),tb=gb.get('Throttle Pos');
    let minB=Infinity,iMin=c.apex;for(let i=c.s;i<=c.e;i++)if(vb[i]<minB){minB=vb[i];iMin=i;}
    let bsB=null;if(bb){let gap=0;for(let j=iMin;j>=Math.max(0,iMin-300);j--){if(bb[j]>8){bsB=gb.d[j];gap=0;}else if(bsB!=null&&bb[j]<=2){if(++gap>15)break;}}}
    let ftB=null;if(tb){for(let j=iMin;j<=c.e;j++)if(tb[j]>=95){ftB=gb.d[j];break;}}
    return {...c,tA,tB,dt:tB-tA,vMinB:minB,brakeB:bsB,fullB:ftB};});
  cmpCur={SA,SB,la,lb,ga,gb,rows,delta,cr};
  const tot=gb.t[gb.n-1]-ga.t[ga.n-1];
  const worst=[...rows].sort((a,b)=>Math.abs(b.dt)-Math.abs(a.dt)).slice(0,3);
  $('#cmpHead').innerHTML=`
    <div class="kpi ${la.invalid?'inv':''}"><div class="l" style="color:var(--lapA)">Giro A · ${esc((SA.meta.driver||'').replace(/#\d+$/,''))}</div><div class="v">${fmtLap(la.time)}</div><div class="s">giro ${la.num}${la.invalid?' · non valido':''} · ${esc(SA.label)}</div></div>
    <div class="kpi ${lb.invalid?'inv':''}"><div class="l" style="color:var(--lapB)">Giro B · ${esc((SB.meta.driver||'').replace(/#\d+$/,''))}</div><div class="v">${fmtLap(lb.time)}</div><div class="s">giro ${lb.num}${lb.invalid?' · non valido':''} · ${esc(SB.label)}</div></div>
    <div class="kpi"><div class="l">Distacco B − A</div><div class="v" style="color:${tot>0?'var(--lapA)':'var(--lapB)'}">${fsign(tot,3)} s</div><div class="s">${tot>0?'A più veloce':'B più veloce'}</div></div>
    <div class="kpi"><div class="l">Tratti decisivi</div><div class="v txt" style="font-size:1.05rem">${worst.map(r=>`T${r.k} <span class="mono" style="color:${r.dt>0?'var(--lapA)':'var(--lapB)'}">${fsign(r.dt,2)}</span>`).join(' · ')}</div></div>`;
  $('#cmpLegend').innerHTML=`<span><i style="background:var(--lapA)"></i>A più veloce</span><span><i style="background:var(--lapB)"></i>B più veloce</span>`;
  const step=25,colors=new Array(ga.n);for(let i=0;i<ga.n;i+=step){const j=Math.min(ga.n-1,i+step);const d=delta[j]-delta[i];const col=Math.abs(d)<0.005?tok('faint'):d>0?tok('lapA'):tok('lapB');for(let k=i;k<=j;k++)colors[k]=col;}
  cmpMap.zoomFit=true;cmpMap.set(ga.get('GPS Latitude'),ga.get('GPS Longitude'),colors,SA.meta.venue,cr.map(c=>({i:c.apex,label:c.k})),{lat:gb.get('GPS Latitude'),lon:gb.get('GPS Longitude')});
  drawCmpChart(true);
  cmpReadout(null);
  $('#cmpCorners').innerHTML=rows.length?`<table><thead><tr><th>Curva</th><th>Tratto m</th><th>Frenata A</th><th>Frenata B</th><th>Vel. min A</th><th>Vel. min B</th><th>Gas pieno A</th><th>Gas pieno B</th><th>Tempo A</th><th>Tempo B</th><th>Δ</th></tr></thead><tbody>
  ${rows.map(r=>`<tr class="clickable" data-d="${r.dApex}"><td>T${r.k}</td><td>${fx(r.dS,0)}–${fx(r.dE,0)}</td><td>${r.brake!=null?fx(r.brake,0):'lift'}</td><td>${r.brakeB!=null?fx(r.brakeB,0):'lift'}${r.brake!=null&&r.brakeB!=null?` <span class="muted small">(${fsign(r.brakeB-r.brake,0)})</span>`:''}</td><td>${fx(r.vMin,0)}</td><td>${fx(r.vMinB,0)} <span class="muted small">(${fsign(r.vMinB-r.vMin,0)})</span></td><td>${fx(r.fullThr,0)}</td><td>${fx(r.fullB,0)}</td><td>${fx(r.tA,2)}</td><td>${fx(r.tB,2)}</td><td><b style="color:${r.dt>0.02?'var(--lapA)':r.dt<-0.02?'var(--lapB)':'inherit'}">${fsign(r.dt,3)}</b></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Nessuna curva rilevata.</div>';
  $$('#cmpCorners tr.clickable').forEach(tr=>tr.onclick=()=>{const d=+tr.dataset.d;cmpChart.setRange(d-300,d+250);$('#cmpChartPanel').scrollIntoView({behavior:'smooth',block:'start'});});
}
function drawCmpChart(reset){
  const {ga,gb,delta,cr}=cmpCur;if(!ga)return;const on=cmpChannels();const A=tok('lapA'),B=tok('lapB');
  const pair=(n,label,h,extra={})=>{const a=ga.get(n),b=gb.get(n);return a||b?{label,h,series:[{data:a,color:A,name:'A',...(extra.s||{})},{data:b,color:B,name:'B',...(extra.s||{})}],dp:extra.dp??0,...extra.p}:null;};
  const P=[];
  if(on.includes('delta'))P.push({label:'Delta B−A s (sopra zero = A più veloce)',h:110,zero:true,series:[{data:delta,color:tok('accent'),w:2,fill:true}],dp:3});
  if(on.includes('speed'))P.push({...pair('Ground Speed','Velocità km/h',190),overview:true});
  if(on.includes('thr'))P.push(pair('Throttle Pos','Gas %',95,{p:{min:-3,max:103}}));
  if(on.includes('brk'))P.push(pair('Brake Pos','Freno %',95,{p:{min:-3,max:103}}));
  if(on.includes('gear'))P.push(pair('Gear','Marcia',80,{s:{step:true}}));
  if(on.includes('steer'))P.push(pair('Steering','Sterzo %',95,{p:{zero:true}}));
  if(on.includes('line'))P.push(pair('Path Lateral','Traiettoria · distanza dal centro pista m',110,{p:{zero:true},dp:1}));
  if(on.includes('rpm'))P.push(pair('Engine RPM','Giri motore',90));
  if(on.includes('glat'))P.push(pair('G Force Lat','G laterale',90,{p:{zero:true},dp:2}));
  if(on.includes('glon'))P.push(pair('G Force Long','G longitudinale',90,{p:{zero:true},dp:2}));
  const ps=P.filter(Boolean);if(!ps.length)ps.push(pair('Ground Speed','Velocità km/h',190));
  cmpChart.set(ga.d,ps,cr.map(c=>({x:c.dApex,label:'T'+c.k})),!reset);
}
function cmpReadout(i){const {ga,gb,delta}=cmpCur;const el=$('#cmpReadout');if(!ga)return;if(i==null){el.innerHTML='<span class="hint" style="grid-column:1/-1">Passa sopra mappa o grafici per leggere i valori</span>';return;}
  const r=(g,n,d=0)=>{const a=g.get(n);return a?fx(a[i],d):'—';};
  el.innerHTML=`<span>Dist <b>${fx(ga.d[i],0)} m</b></span><span>Δ <b>${fsign(delta[i],3)} s</b></span><span>Vel <b>${r(ga,'Ground Speed')}/${r(gb,'Ground Speed')}</b></span><span>Marcia <b>${r(ga,'Gear')}/${r(gb,'Gear')}</b></span><span>Gas <b>${r(ga,'Throttle Pos')}/${r(gb,'Throttle Pos')}</b></span><span>Freno <b>${r(ga,'Brake Pos')}/${r(gb,'Brake Pos')}</b></span>`;}
function applyColors(){const c=LS.get('colors',{});const r=document.documentElement.style;if(c.A)r.setProperty('--lapA',c.A);else r.removeProperty('--lapA');if(c.B)r.setProperty('--lapB',c.B);else r.removeProperty('--lapB');}
function toHex(c){if(c.startsWith('#'))return c.length===4?'#'+[...c.slice(1)].map(x=>x+x).join(''):c.slice(0,7);const m=c.match(/\d+/g);return m?'#'+m.slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join(''):'#888888';}
