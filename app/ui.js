// ================= APP =================
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtLap=s=>Number.isFinite(s)&&s>0?`${Math.floor(s/60)}:${(s%60).toFixed(3).padStart(6,'0')}`:'—';
const fx=(v,d=1,u='')=>Number.isFinite(v)?v.toFixed(d)+(u?' '+u:''):'—';
const fsign=(v,d=3)=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(d):'—';
const WL={FL:'Ant. sx',FR:'Ant. dx',RL:'Post. sx',RR:'Post. dx'};
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3200);}

const store={items:[]};
const CFG_DEF={pmin:'',pmax:'',iomin:3,iomax:12,bmax:'',rh:3};
let _cfg=null;function cfg(){if(_cfg)return _cfg;_cfg={...CFG_DEF};try{Object.assign(_cfg,JSON.parse(localStorage.getItem('pitwall:cfg')||'{}'));}catch(e){}return _cfg;}
function saveCfg(){try{localStorage.setItem('pitwall:cfg',JSON.stringify(_cfg));}catch(e){}}
const num=v=>v===''||v==null?NaN:+v;

// ---------- local library (IndexedDB, per browser)
const IDB={db:null,
  open(){return new Promise(res=>{try{const r=indexedDB.open('pitwall',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'name'});r.onsuccess=()=>{this.db=r.result;res(true);};r.onerror=()=>res(false);}catch(e){res(false);}});},
  tx(mode){return this.db.transaction('files',mode).objectStore('files');},
  all(){return new Promise(res=>{if(!this.db)return res([]);try{const r=this.tx('readonly').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>res([]);}catch(e){res([]);}});},
  put(o){try{this.db&&this.tx('readwrite').put(o);}catch(e){}},
  del(n){try{this.db&&this.tx('readwrite').delete(n);}catch(e){}}
};

async function gunzip(buf){const ds=new DecompressionStream('gzip');return await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();}
function extOf(n){const m=n.toLowerCase().match(/\.(ld|xml|svm)(\.gz)?$/);return m?m[1]:null;}

async function addFile(name,buf,{persist=false,sample=false}={}){
  if(/\.gz$/i.test(name))buf=await gunzip(buf);
  const ext=extOf(name);let item;
  if(ext==='ld'){const p=parseLD(buf);item=buildSession(p,name);item.label=sessLabel(item);}
  else if(ext==='xml'){item=parseResultsXML(new TextDecoder().decode(buf),name);item.label=`${item.venue} · risultati ${item.time.slice(0,10)}`;}
  else if(ext==='svm'){item=parseSVM(new TextDecoder('latin1').decode(buf),name);item.label=name.replace(/\.svm$/i,'');}
  else throw new Error('Formato non supportato: usa .ld, .xml o .svm');
  item.sample=sample;item.file=name;
  const old=store.items.findIndex(x=>x.id===item.id);if(old>=0)store.items.splice(old,1,item);else store.items.push(item);
  if(persist)IDB.put({name,buf,added:Date.now()});
  return item;
}
function sessLabel(S){const m=S.meta;const d=m.date?m.date.slice(0,5):'';return `${m.venue||'Pista'}${m.car?' · '+m.car:''} · ${d} ${m.time?m.time.slice(0,5):''}`.trim();}
const lds=()=>store.items.filter(x=>x.kind==='ld'),xmls=()=>store.items.filter(x=>x.kind==='xml'),svms=()=>store.items.filter(x=>x.kind==='svm');
const byId=id=>store.items.find(x=>x.id===id);

function renderLib(){
  const el=$('#lib');el.innerHTML='';
  store.items.forEach(it=>{const c=document.createElement('span');c.className='chip';c.title=it.file;
    c.innerHTML=`<span class="k">${it.kind==='ld'?'tele':it.kind==='xml'?'risult.':'setup'}</span><span class="nm">${esc(it.label)}${it.sample?' <span class="muted">(esempio)</span>':''}</span><button type="button" aria-label="Rimuovi ${esc(it.label)}">×</button>`;
    c.querySelector('button').onclick=()=>{store.items=store.items.filter(x=>x!==it);if(!it.sample)IDB.del(it.file);refreshAll();};el.appendChild(c);});
  const d=document.createElement('span');d.className='drop';d.textContent='Trascina qui .ld · .xml · .svm';d.onclick=()=>$('#fileIn').click();el.appendChild(d);
}
async function handleFiles(files){
  for(const f of files){try{const buf=await f.arrayBuffer();const it=await addFile(f.name,buf,{persist:true});toast('Caricato: '+it.label);}catch(e){console.error(e);toast(`${f.name}: ${e.message}`);}}
  refreshAll();
}

// ---------- tabs
function showView(v){$$('.tab').forEach(t=>t.setAttribute('aria-selected',t.dataset.view===v));$$('.view').forEach(s=>s.hidden=s.id!=='v-'+v);try{localStorage.setItem('pitwall:tab',v);}catch(e){}RENDER[v]&&RENDER[v]();}
const RENDER={};
function curView(){return $('.tab[aria-selected="true"]').dataset.view;}
function refreshAll(){renderLib();fillSelects();RENDER[curView()]();}

function opt(sel,items,keep){const prev=keep?sel.value:null;sel.innerHTML=items.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');if(prev&&items.some(i=>i[0]===prev))sel.value=prev;}
function lapOptions(S){const b=S.best;return S.laps.map(l=>[String(l.i),`Giro ${l.num} · ${l.complete?fmtLap(l.time):'parziale'} · ${l.type}${b&&l===b?' ★':''}`]);}
function defaultLap(S){return S.best?S.best.i:(S.laps.find(l=>l.complete)||S.laps[0]).i;}
function fillSelects(){
  const L=lds().map(s=>[s.id,s.label]);
  const src=[...xmls().flatMap(x=>x.sessions.map((s,i)=>[x.id+'|'+i,`${x.venue} · ${s.name} (risultati)`])),...L.map(([v,l])=>[v,l+' (telemetria)'])];
  opt($('#stSrc'),src,true);
  for(const id of ['#lapSess','#cmpSessA','#cmpSessB','#suSess'])opt($(id),L,true);
  opt($('#suFile'),[['','— nessun file setup —'],...svms().map(s=>[s.id,s.label])],true);
  if(!$('#suFile').value&&svms().length)$('#suFile').value=svms()[0].id;
}

// ================= STINT =================
RENDER.stint=()=>{
  const v=$('#stSrc').value,body=$('#stBody');
  if(!v){body.innerHTML='<div class="empty">Carica un file risultati (.xml) o una telemetria (.ld) per vedere lo stint.</div>';$('#stDrvWrap').hidden=true;return;}
  if(v.startsWith('xml:'))stintXML(v,body);else{$('#stDrvWrap').hidden=true;stintLD(byId(v),body);}
};
function stintXML(v,body){
  const [id,si]=v.split('|');const R=byId(id),sess=R.sessions[+si];
  const dsel=$('#stDrv');$('#stDrvWrap').hidden=sess.drivers.length<2;
  const cur=dsel.value;opt(dsel,sess.drivers.map((d,i)=>[String(i),d.name.replace(/#\d+$/,'')+(d.isPlayer?' (tu)':'')]));
  if(cur&&+cur<sess.drivers.length)dsel.value=cur;else dsel.value=String(Math.max(0,sess.drivers.findIndex(d=>d.isPlayer)));
  const D=sess.drivers[+dsel.value];const laps=D.laps;
  if(!laps.length){body.innerHTML='<div class="empty">Nessun giro per questo pilota.</div>';return;}
  const A=stintAnalysis(laps);
  const wearAvg=mean(W.map(w=>A.wear[w])),wearMax=Math.max(...W.map(w=>A.wear[w]).filter(Number.isFinite));
  const lapsFuel=1/A.fuelPerLap,lapsVE=1/A.vePerLap;
  const lim=[['carburante',lapsFuel],['energia virtuale',lapsVE]].filter(x=>Number.isFinite(x[1])&&x[1]>0).sort((a,b)=>a[1]-b[1])[0];
  body.innerHTML=`
  <p class="muted small" style="margin:0 0 10px">${esc(R.event||R.venue)} · ${esc(D.car)} (${esc(D.cls)}) · ${esc(sess.name)} · ${laps.length} giri${D.aids?' · aiuti: '+esc(D.aids.replace('PlayerControl,','')):''}</p>
  <div class="kpis">
    <div class="kpi hl"><div class="s">Miglior giro</div><div class="v">${fmtLap(A.best)}</div></div>
    <div class="kpi"><div class="s">Passo medio · ${A.paceLaps.length} giri</div><div class="v">${fmtLap(A.avg)}</div><div class="s">+${fx(A.avg-A.best,3)} s dal best</div></div>
    <div class="kpi"><div class="s">Costanza (σ)</div><div class="v">${fx(A.sd,3)} s</div><div class="s">${A.sd<0.3?'ottima':A.sd<0.6?'buona':'da migliorare'}</div></div>
    <div class="kpi"><div class="s">Carburante / giro</div><div class="v">${fx(A.fuelPerLap*100,2)} %</div><div class="s">≈ ${fx(lapsFuel,1)} giri col pieno</div></div>
    <div class="kpi"><div class="s">Energia virtuale / giro</div><div class="v">${fx(A.vePerLap*100,2)} %</div><div class="s">≈ ${fx(lapsVE,1)} giri al 100%</div></div>
    <div class="kpi"><div class="s">Usura gomme / giro</div><div class="v">${fx(wearAvg*100,2)} %</div><div class="s">peggiore ${fx(wearMax*100,2)} % · ≈ ${fx(0.1/wearMax,0)} giri ogni 10%</div></div>
    <div class="kpi"><div class="s">Degrado passo</div><div class="v">${fsign(A.deg,3)} s/giro</div><div class="s">${A.stints.length} stint rilevati</div></div>
    <div class="kpi"><div class="s">Stint limitato da</div><div class="v txt">${lim?esc(lim[0]):'—'}</div><div class="s">${lim?'≈ '+fx(lim[1],1)+' giri':''}</div></div>
  </div>
  <div class="grid2" style="margin-top:14px">
    <div><h3>Tempi sul giro</h3><canvas class="mini" id="stC1"></canvas><div class="legend"><span><i style="background:var(--lapA)"></i>giri validi</span><span><i style="background:var(--best)"></i>miglior giro</span></div></div>
    <div><h3>Gomme rimaste</h3><canvas class="mini" id="stC2"></canvas><div class="legend">${W.map((w,i)=>`<span><i style="background:${['var(--lapA)','var(--lapB)','var(--good)','var(--warn)'][i]}"></i>${WL[w]}</span>`).join('')}</div></div>
    <div><h3>Carburante ed energia rimasti</h3><canvas class="mini" id="stC3"></canvas><div class="legend"><span><i style="background:var(--accent)"></i>carburante</span><span><i style="background:var(--lapA)"></i>energia virtuale</span></div></div>
    <div><h3>Settori</h3><canvas class="mini" id="stC4"></canvas><div class="legend"><span><i style="background:var(--lapA)"></i>S1</span><span><i style="background:var(--lapB)"></i>S2</span><span><i style="background:var(--good)"></i>S3</span> <span>(scarto dal miglior settore)</span></div></div>
  </div>
  <h3 style="margin:16px 0 6px">Giro per giro</h3>
  <div class="tw"><table><thead><tr><th>Giro</th><th>Tempo</th><th>S1</th><th>S2</th><th>S3</th><th>Vel. max</th><th>Carb. usato</th><th>Carb.</th><th>VE usata</th><th>VE</th>${W.map(w=>`<th>${w}</th>`).join('')}<th class="l">Note</th></tr></thead><tbody>
  ${A.stints.map((s,si)=>`${si?`<tr><td class="l" colspan="${14+W.length}" style="color:var(--accent);font-family:var(--f-display);font-weight:600;letter-spacing:.05em">STINT ${si+1} · dopo rifornimento / reset / cambio gomme</td></tr>`:''}${s.laps.map(l=>{
    const bs=k=>{const b=Math.min(...laps.filter(x=>!x.invalid&&Number.isFinite(x[k])).map(x=>x[k]));return Number.isFinite(l[k])?`<span${l[k]===b?' style="color:var(--best);font-weight:700"':''}>${l[k].toFixed(3)}</span>`:'—';};
    const tags=[l.out?'<span class="tag info">out-lap</span>':'',l.invalid?'<span class="tag bad">non valido</span>':'',l.incident?'<span class="tag warn">contatto</span>':'',l.best?'<span class="tag best">best</span>':'',!l.pace&&Number.isFinite(l.time)&&!l.invalid&&!l.out&&!l.incident?'<span class="tag info">fuori passo</span>':''].join('');
    return `<tr class="${l.best?'best':''} ${l.invalid?'inv':''} ${l.out?'out':''}"><td>${l.num}</td><td class="lt">${fmtLap(l.time)}</td><td>${bs('s1')}</td><td>${bs('s2')}</td><td>${bs('s3')}</td><td>${fx(l.top,1)}</td><td>${l.fuelUsed>0?fx(l.fuelUsed*100,1)+'%':'—'}</td><td>${fx(l.fuel*100,1)}%</td><td>${l.veUsed>0?fx(l.veUsed*100,1)+'%':'—'}</td><td>${fx(l.ve*100,1)}%</td>${W.map(w=>`<td>${fx(l.tw[w]*100,1)}</td>`).join('')}<td class="l">${tags}${l.flags.length?` <span class="muted small" title="${esc(l.flags.join(' · '))}">${esc(l.flags.filter(f=>!/No Further/.test(f)).slice(0,2).join(' · '))}</span>`:''}</td></tr>`;}).join('')}`).join('')}
  </tbody></table></div>
  <p class="muted small">Il passo medio usa solo giri validi, non di uscita box, senza contatti ed entro il 107% del best. Consumi e usura escludono gli out-lap; l'usura per giro è la pendenza calcolata dentro ogni stint.</p>`;
  const x=laps.map(l=>l.num);
  lineChart($('#stC1'),{x,series:[{data:laps.map(l=>l.pace||l.best?l.time:NaN),color:tok('lapA'),dot:i=>laps[i].best}],yfmt:v=>fmtLap(v).replace(/\.\d+$/,m=>m.slice(0,2))});
  const cols=[tok('lapA'),tok('lapB'),tok('good'),tok('warn')];
  lineChart($('#stC2'),{x,series:W.map((w,i)=>({data:laps.map(l=>l.tw[w]*100),color:cols[i]})),yfmt:v=>v.toFixed(0)+'%'});
  lineChart($('#stC3'),{x,series:[{data:laps.map(l=>l.fuel*100),color:tok('accent')},{data:laps.map(l=>l.ve*100),color:tok('lapA')}],yfmt:v=>v.toFixed(0)+'%',min:0});
  const bS=k=>Math.min(...laps.filter(x=>!x.invalid&&Number.isFinite(x[k])).map(x=>x[k]));
  lineChart($('#stC4'),{x,series:['s1','s2','s3'].map((k,i)=>({data:laps.map(l=>!l.invalid&&l[k]<bS(k)*1.1?l[k]-bS(k):NaN),color:cols[i]})),yfmt:v=>'+'+v.toFixed(1)});
}
function stintLD(S,body){
  const laps=S.laps.filter(l=>l.complete);
  if(!laps.length){body.innerHTML='<div class="empty">Nessun giro completo in questa telemetria.</div>';return;}
  const st=laps.map(l=>lapStats(S,l));
  const fl=st.filter(s=>s.lap.type==='lanciato');
  const fuelL=mean(fl.map(s=>s.fuel).filter(v=>v>0)),wearL=W.map(w=>mean(fl.map(s=>s.w[w].wear)));
  const last=st[st.length-1];
  const hasBat=st.some(s=>Number.isFinite(s.batMax));
  const best=S.best;
  body.innerHTML=`
  <p class="muted small" style="margin:0 0 10px">${esc(S.label)} · pilota ${esc(S.meta.driver)} · ${laps.length} giri completi · lunghezza ≈ ${fx(S.trackLen,0)} m</p>
  <div class="kpis">
    <div class="kpi hl"><div class="s">Miglior giro</div><div class="v">${best?fmtLap(best.time):'—'}</div></div>
    <div class="kpi"><div class="s">Passo medio lanciati</div><div class="v">${fmtLap(mean(fl.map(s=>s.time)))}</div><div class="s">σ ${fx(std(fl.map(s=>s.time)),3)} s</div></div>
    <div class="kpi"><div class="s">Carburante / giro</div><div class="v">${fx(fuelL,2)} L</div><div class="s">rimasti ${fx(last.fuelEnd,1)} L ≈ ${fx(last.fuelEnd/fuelL,1)} giri</div></div>
    <div class="kpi"><div class="s">Usura / giro (media)</div><div class="v">${fx(mean(wearL),2)} %</div><div class="s">${W.map((w,i)=>w+' '+fx(wearL[i],2)).join(' · ')}</div></div>
    ${hasBat?`<div class="kpi"><div class="s">Batteria ibrido</div><div class="v">${fx(mean(fl.map(s=>s.batMin)),0)}–${fx(mean(fl.map(s=>s.batMax)),0)} %</div><div class="s">bilancio/giro ${fsign(mean(fl.map(s=>s.batEnd-s.batStart)),1)} %</div></div>`:''}
  </div>
  <div class="grid2" style="margin-top:14px">
    <div><h3>Temperatura media gomme (°C)</h3><canvas class="mini" id="stL1"></canvas><div class="legend">${W.map((w,i)=>`<span><i style="background:${['var(--lapA)','var(--lapB)','var(--good)','var(--warn)'][i]}"></i>${WL[w]}</span>`).join('')}</div></div>
    <div><h3>Pressione media a caldo (kPa)</h3><canvas class="mini" id="stL2"></canvas></div>
  </div>
  <h3 style="margin:16px 0 6px">Giro per giro</h3>
  <div class="tw"><table><thead><tr><th>Giro</th><th class="l">Tipo</th><th>Tempo</th><th>Vel. max</th><th>Carb. usato</th><th>Carb. fine</th>${hasBat?'<th>Batt. min–max</th>':''}${W.map(w=>`<th>Usura ${w}</th>`).join('')}${W.map(w=>`<th>T ${w} I/C/E</th>`).join('')}${W.map(w=>`<th>P ${w}</th>`).join('')}${W.map(w=>`<th>Freno ${w} max</th>`).join('')}</tr></thead><tbody>
  ${st.map(s=>`<tr class="${best&&s.lap===best?'best':''} ${s.lap.type!=='lanciato'?'out':''}"><td>${s.lap.num}</td><td class="l">${s.lap.type}</td><td class="lt">${fmtLap(s.time)}</td><td>${fx(s.vmax,1)}</td><td>${fx(s.fuel,2)} L</td><td>${fx(s.fuelEnd,1)} L</td>${hasBat?`<td>${fx(s.batMin,0)}–${fx(s.batMax,0)}%</td>`:''}${W.map(w=>`<td>${fx(s.w[w].wear,2)}%</td>`).join('')}${W.map(w=>`<td>${fx(s.w[w].I,0)}/${fx(s.w[w].C,0)}/${fx(s.w[w].O,0)}</td>`).join('')}${W.map(w=>`<td>${fx(s.w[w].p,1)}</td>`).join('')}${W.map(w=>`<td>${fx(s.w[w].bMax,0)}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>
  <p class="muted small">Le temperature sono medie sopra i 50 km/h (I = interno, C = centro, E = esterno). Per un'analisi dello stint completo carica anche il file risultati .xml della sessione: contiene carburante, energia virtuale e usura di ogni giro.</p>`;
  const x=st.map(s=>s.lap.num),cols=[tok('lapA'),tok('lapB'),tok('good'),tok('warn')];
  lineChart($('#stL1'),{x,series:W.map((w,i)=>({data:st.map(s=>mean([s.w[w].I,s.w[w].C,s.w[w].O])),color:cols[i]})),yfmt:v=>v.toFixed(0)});
  lineChart($('#stL2'),{x,series:W.map((w,i)=>({data:st.map(s=>s.w[w].p),color:cols[i]})),yfmt:v=>v.toFixed(0)});
}

// ================= LAP =================
let lapChart,lapMap,lapCur={};
RENDER.lap=()=>{
  const sid=$('#lapSess').value,S=byId(sid);
  if(!S){$('#lapHead').innerHTML='<div class="kpi"><div class="empty">Carica una telemetria .ld</div></div>';return;}
  const sel=$('#lapSel');
  if(sel.dataset.sess!==sid){opt(sel,lapOptions(S));sel.value=String(defaultLap(S));sel.dataset.sess=sid;}
  const lap=S.laps[+sel.value];drawLap(S,lap);
};
function sectorTimes(S,lap,g){const cs=g.get('Current Sector');if(!cs)return [];const out=[];let st=0,prev=cs[0];for(let i=1;i<g.n;i++){if(cs[i]!==prev){out.push(g.t[i]-st);st=g.t[i];prev=cs[i];}}out.push(g.t[g.n-1]-st);return out.length>=2&&out.length<=4?out:[];}
function sectorMarks(g){const cs=g.get('Current Sector');const m=[];if(!cs)return m;let prev=cs[0],k=1;for(let i=1;i<g.n;i++){if(cs[i]!==prev){k++;m.push({x:g.d[i],label:'S'+k});prev=cs[i];}}return m;}
function drawLap(S,lap){
  const g=lapGrid(S,lap,2),v=g.get('Ground Speed'),th=g.get('Throttle Pos'),br=g.get('Brake Pos');
  const corners=detectCorners(g);lapCur={S,lap,g,corners};
  const secs=sectorTimes(S,lap,g),stt=lapStats(S,lap);
  const full=th?[...th].filter(x=>x>=98).length/g.n:NaN,brk=br?[...br].filter(x=>x>5).length/g.n:NaN;
  let gch=0;const ge=g.get('Gear');if(ge)for(let i=1;i<g.n;i++)if(ge[i]!==ge[i-1])gch++;
  $('#lapHead').innerHTML=`
    <div class="kpi hl"><div class="s">Giro ${lap.num} · ${lap.type}</div><div class="v">${lap.complete?fmtLap(lap.time):'parziale'}</div><div class="s">${S.best&&lap!==S.best&&lap.complete?'+'+fx(lap.time-S.best.time,3)+' s dal best':S.best===lap?'miglior giro della sessione':''}</div></div>
    ${secs.map((s,i)=>`<div class="kpi"><div class="s">Settore ${i+1}</div><div class="v">${fx(s,3)}</div></div>`).join('')}
    <div class="kpi"><div class="s">Velocità max / min</div><div class="v">${fx(pct(v,1),0)} / ${fx(pct(v,0),0)}</div><div class="s">km/h</div></div>
    <div class="kpi"><div class="s">Gas pieno · in frenata</div><div class="v">${fx(full*100,0)}% · ${fx(brk*100,0)}%</div><div class="s">del giro · ${gch} cambi marcia</div></div>
    <div class="kpi"><div class="s">Carburante nel giro</div><div class="v">${fx(stt.fuel,2)} L</div><div class="s">${Number.isFinite(stt.batMax)?'batteria '+fx(stt.batMin,0)+'–'+fx(stt.batMax,0)+'%':''}</div></div>`;
  // map
  const lat=g.get('GPS Latitude'),lon=g.get('GPS Longitude');
  const mode=$('#lapMapCh').value;const vmin=pct(v,0),vmax=pct(v,1),gear=g.get('Gear'),gl=g.get('G Force Lat');const gmax=Math.max(...(gear||[1]));
  const colors=Array.from({length:g.n},(_,i)=>mode==='speed'?ramp((v[i]-vmin)/(vmax-vmin)):mode==='pedals'?(br&&br[i]>5?tok('bad'):th&&th[i]>=95?tok('good'):th&&th[i]>5?tok('warn'):tok('faint')):mode==='gear'?ramp((gear?gear[i]:0)/gmax):ramp(Math.abs(gl?gl[i]:0)/2.5));
  lapMap.set(lat,lon,colors,S.meta.venue,corners.map(c=>({i:c.apex,label:c.k})));
  // chart
  const best=S.best&&S.best!==lap&&lap.complete?lapGrid(S,S.best,2,g.len):null;
  const panels=[{label:'Velocità km/h',h:150,series:[{data:v,color:tok('lapA'),w:1.8}],dp:0}];
  if(best)panels.push({label:'Delta vs best s',h:80,zero:true,series:[{data:g.t.map((t,i)=>t-best.t[i]),color:tok('accent')}],dp:3});
  panels.push({label:'Gas / freno %',h:95,min:-3,max:103,series:[{data:th,color:tok('good')},{data:br,color:tok('bad')}],dp:0});
  if(ge)panels.push({label:'Marcia',h:70,series:[{data:ge,color:tok('ink'),step:true}],dp:0});
  if(g.get('Steering'))panels.push({label:'Sterzo %',h:80,zero:true,series:[{data:g.get('Steering'),color:tok('lapB')}],dp:0});
  if(g.get('Engine RPM'))panels.push({label:'Giri motore',h:80,series:[{data:g.get('Engine RPM'),color:tok('muted')}],dp:0});
  if(gl)panels.push({label:'G lat / long',h:85,zero:true,series:[{data:gl,color:tok('lapA'),name:'lat'},{data:g.get('G Force Long'),color:tok('warn'),name:'lon'}],dp:2});
  lapChart.set(g.d,panels,[...sectorMarks(g),...corners.map(c=>({x:c.dApex,label:'T'+c.k}))].filter(m=>!/^T/.test(m.label)||true));
  lapReadout(null);
  // corners table
  $('#lapCorners').innerHTML=corners.length?`<table><thead><tr><th>Curva</th><th>Apice m</th><th>Frenata m</th><th>Vel. frenata</th><th>Freno max</th><th>Vel. min</th><th>Marcia</th><th>Gas pieno m</th><th>Uscita</th><th>Tratto s</th></tr></thead><tbody>
    ${corners.map(c=>`<tr class="clickable" data-d="${c.dApex}"><td>T${c.k}</td><td>${fx(c.dApex,0)}</td><td>${c.brake!=null?fx(c.brake,0):'<span class="muted">lift</span>'}</td><td>${fx(c.brakeV,0)}</td><td>${c.brakePeak?fx(c.brakePeak,0)+'%':'—'}</td><td><b>${fx(c.vMin,0)}</b></td><td>${fx(c.gear,0)}</td><td>${fx(c.fullThr,0)}</td><td>${fx(c.vExit,0)}</td><td>${fx(c.time,2)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Nessuna curva rilevata.</div>';
  $$('#lapCorners tr.clickable').forEach(tr=>tr.onclick=()=>{const d=+tr.dataset.d;lapChart.range=[Math.max(0,d-250),Math.min(g.len,d+250)];lapChart.draw();});
  // tyres
  $('#lapTyres').innerHTML=tyreBlock(stt);
}
function lapReadout(i){
  const {g}=lapCur;if(!g)return;const el=$('#lapReadout');if(i==null){el.innerHTML='<span>passa sopra per i valori</span>';return;}
  const r=(n,d=0,u='')=>{const a=g.get(n);return a?fx(a[i],d,u):'—';};
  el.innerHTML=`<span>Dist <b>${fx(g.d[i],0)} m</b></span><span>Tempo <b>${fx(g.t[i],2)} s</b></span><span>Vel <b>${r('Ground Speed',0,'km/h')}</b></span><span>Marcia <b>${r('Gear')}</b></span><span>Gas <b>${r('Throttle Pos',0,'%')}</b></span><span>Freno <b>${r('Brake Pos',0,'%')}</b></span><span>RPM <b>${r('Engine RPM')}</b></span><span>G lat <b>${r('G Force Lat',2)}</b></span>`;
}
function tcol(t,lo=60,hi=110){return ramp((t-lo)/(hi-lo));}
function tyreBlock(s){
  const all=W.flatMap(w=>[s.w[w].I,s.w[w].C,s.w[w].O]).filter(Number.isFinite);const lo=Math.min(...all)-5,hi=Math.max(...all)+5;
  const box=w=>{const x=s.w[w];const left=w.endsWith('L');const cells=left?[['E',x.O],['C',x.C],['I',x.I]]:[['I',x.I],['C',x.C],['E',x.O]];
    return `<div class="tyre"><div class="hd"><span>${w}</span><span class="muted small">${WL[w]}</span></div>
    <div class="ico">${cells.map(([k,t])=>`<span style="background:${tcol(t,lo,hi)}" title="${k}">${fx(t,0)}</span>`).join('')}</div>
    <dl><dt>Pressione</dt><dd>${fx(x.p,1)} kPa</dd><dt>Carcassa</dt><dd>${fx(x.carc,0)} °C</dd><dt>Usura giro</dt><dd>${fx(x.wear,2)} %</dd><dt>Freno max</dt><dd>${fx(x.bMax,0)} °C</dd><dt>Altezza min</dt><dd>${fx(x.rhMin,1)} mm</dd></dl></div>`;};
  return `<div class="car">${W.map(box).join('')}</div><p class="muted small" style="text-align:center">Temperature medie sopra i 50 km/h; colori relativi a questo giro (blu freddo → rosso caldo). E/C/I = esterno, centro, interno.</p>`;
}

// ================= COMPARE =================
let cmpChart,cmpMap,cmpCur={};
RENDER.cmp=()=>{
  const A=byId($('#cmpSessA').value),B=byId($('#cmpSessB').value);
  if(!A||!B){$('#cmpHead').innerHTML='<div class="kpi"><div class="empty">Carica almeno una telemetria .ld</div></div>';return;}
  for(const [ss,ls,S,which] of [['#cmpSessA','#cmpLapA',A,'A'],['#cmpSessB','#cmpLapB',B,'B']]){const sel=$(ls);if(sel.dataset.sess!==S.id){opt(sel,lapOptions(S));let d=defaultLap(S);if(which==='B'&&A===B){const alt=S.laps.filter(l=>l.complete&&l.i!==d).sort((a,b)=>a.time-b.time)[0];if(alt)d=alt.i;}sel.value=String(d);sel.dataset.sess=S.id;}}
  drawCmp(A,A.laps[+$('#cmpLapA').value],B,B.laps[+$('#cmpLapB').value]);
};
function drawCmp(SA,la,SB,lb){
  const ga=lapGrid(SA,la,2),gb=lapGrid(SB,lb,2,ga.len);
  const warn=[];if(SA.meta.venue!==SB.meta.venue)warn.push(`Piste diverse (${SA.meta.venue} / ${SB.meta.venue}): il confronto non ha senso.`);
  else if(Math.abs(lapTrace(SB,lb).len-ga.len)/ga.len>0.03)warn.push('Le lunghezze dei due giri differiscono più del 3%: uno dei due potrebbe essere incompleto o con un taglio.');
  if(!la.complete||!lb.complete)warn.push('Uno dei due giri è parziale.');
  $('#cmpWarn').innerHTML=warn.map(w=>`<div class="warnbar" style="margin-top:10px">${esc(w)}</div>`).join('');
  const delta=ga.t.map((t,i)=>gb.t[i]-t);
  const ca=detectCorners(ga);
  const rows=ca.map(c=>{const tA=ga.t[c.e]-ga.t[c.s],tB=gb.t[c.e]-gb.t[c.s];
    const vb=gb.get('Ground Speed'),bb=gb.get('Brake Pos'),tb=gb.get('Throttle Pos');
    let minB=Infinity,iMin=c.apex;for(let i=c.s;i<=c.e;i++)if(vb[i]<minB){minB=vb[i];iMin=i;}
    let bsB=null;if(bb){for(let j=iMin;j>=Math.max(c.s-150,iMin-250);j--){if(bb[j]>8)bsB=gb.d[j];else if(bsB!=null&&bb[j]<=2)break;}}
    let ftB=null;if(tb){for(let j=iMin;j<=c.e;j++)if(tb[j]>=95){ftB=gb.d[j];break;}}
    return {...c,tA,tB,dt:tB-tA,vMinB:minB,brakeB:bsB,fullB:ftB};});
  cmpCur={SA,SB,la,lb,ga,gb,rows,delta};
  const tot=gb.t[gb.n-1]-ga.t[ga.n-1];
  const worst=[...rows].sort((a,b)=>Math.abs(b.dt)-Math.abs(a.dt)).slice(0,3);
  $('#cmpHead').innerHTML=`
    <div class="kpi"><div class="s" style="color:var(--lapA)">Giro A · ${esc(SA.meta.driver||'')}</div><div class="v">${fmtLap(la.time)}</div><div class="s">giro ${la.num} · ${esc(SA.label)}</div></div>
    <div class="kpi"><div class="s" style="color:var(--lapB)">Giro B · ${esc(SB.meta.driver||'')}</div><div class="v">${fmtLap(lb.time)}</div><div class="s">giro ${lb.num} · ${esc(SB.label)}</div></div>
    <div class="kpi hl"><div class="s">Distacco B − A</div><div class="v">${fsign(tot,3)} s</div><div class="s">${tot>0?'A più veloce':'B più veloce'}</div></div>
    <div class="kpi"><div class="s">Tratti con più differenza</div><div class="v small" style="font-size:1rem">${worst.map(r=>`T${r.k} <span class="${r.dt>0?'neg':'pos'}">${fsign(r.dt,2)}</span>`).join(' · ')}</div></div>`;
  // map: minisectors 50 m colored by who gains
  const step=25,colors=new Array(ga.n);for(let i=0;i<ga.n;i+=step){const j=Math.min(ga.n-1,i+step);const d=delta[j]-delta[i];const col=Math.abs(d)<0.005?tok('faint'):d>0?tok('lapA'):tok('lapB');for(let k=i;k<=j;k++)colors[k]=col;}
  cmpMap.set(ga.get('GPS Latitude'),ga.get('GPS Longitude'),colors,SA.meta.venue,ca.map(c=>({i:c.apex,label:c.k})));
  const A=tok('lapA'),B=tok('lapB');
  const pair=(n,label,h,extra={})=>{const a=ga.get(n),b=gb.get(n);return a||b?{label,h,series:[{data:a,color:A,name:'A',...(extra.s||{})},{data:b,color:B,name:'B',...(extra.s||{})}],...extra.p}:null;};
  const panels=[{label:'Delta B−A s',h:95,zero:true,series:[{data:delta,color:tok('accent'),w:2,fill:true}],dp:3},pair('Ground Speed','Velocità km/h',160),pair('Throttle Pos','Gas %',80,{p:{min:-3,max:103}}),pair('Brake Pos','Freno %',80,{p:{min:-3,max:103}}),pair('Gear','Marcia',70,{s:{step:true}}),pair('Steering','Sterzo %',80,{p:{zero:true}})].filter(Boolean);
  panels.forEach(p=>{if(p.dp==null)p.dp=0;});
  cmpChart.set(ga.d,panels,ca.map(c=>({x:c.dApex,label:'T'+c.k})));
  cmpReadout(null);
  $('#cmpCorners').innerHTML=rows.length?`<table><thead><tr><th>Curva</th><th>Tratto m</th><th>Frenata A</th><th>Frenata B</th><th>Vel. min A</th><th>Vel. min B</th><th>Gas pieno A</th><th>Gas pieno B</th><th>Tempo A</th><th>Tempo B</th><th>Δ</th></tr></thead><tbody>
  ${rows.map(r=>`<tr class="clickable" data-d="${r.dApex}"><td>T${r.k}</td><td>${fx(r.dS,0)}–${fx(r.dE,0)}</td><td>${r.brake!=null?fx(r.brake,0):'lift'}</td><td>${r.brakeB!=null?fx(r.brakeB,0):'lift'}${r.brake!=null&&r.brakeB!=null?` <span class="muted small">(${fsign(r.brakeB-r.brake,0)})</span>`:''}</td><td>${fx(r.vMin,0)}</td><td>${fx(r.vMinB,0)} <span class="muted small">(${fsign(r.vMinB-r.vMin,0)})</span></td><td>${fx(r.fullThr,0)}</td><td>${fx(r.fullB,0)}</td><td>${fx(r.tA,2)}</td><td>${fx(r.tB,2)}</td><td class="${r.dt>0.02?'neg':r.dt<-0.02?'pos':''}"><b>${fsign(r.dt,3)}</b></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Nessuna curva rilevata.</div>';
  $$('#cmpCorners tr.clickable').forEach(tr=>tr.onclick=()=>{const d=+tr.dataset.d;cmpChart.range=[Math.max(0,d-250),Math.min(ga.len,d+250)];cmpChart.draw();});
}
function cmpReadout(i){const {ga,gb,delta}=cmpCur;const el=$('#cmpReadout');if(!ga)return;if(i==null){el.innerHTML='<span>passa sopra per i valori</span>';return;}
  const r=(g,n,d=0)=>{const a=g.get(n);return a?fx(a[i],d):'—';};
  el.innerHTML=`<span>Dist <b>${fx(ga.d[i],0)} m</b></span><span>Δ <b>${fsign(delta[i],3)} s</b></span><span>Vel A/B <b>${r(ga,'Ground Speed')}/${r(gb,'Ground Speed')}</b></span><span>Marcia <b>${r(ga,'Gear')}/${r(gb,'Gear')}</b></span><span>Gas <b>${r(ga,'Throttle Pos')}/${r(gb,'Throttle Pos')}</b></span><span>Freno <b>${r(ga,'Brake Pos')}/${r(gb,'Brake Pos')}</b></span>`;}

// ================= SETUP =================
RENDER.setup=()=>{
  const su=byId($('#suFile').value),S=byId($('#suSess').value);
  // config inputs
  const c=cfg();[['#cfgPmin','pmin'],['#cfgPmax','pmax'],['#cfgIOmin','iomin'],['#cfgIOmax','iomax'],['#cfgBmax','bmax'],['#cfgRH','rh']].forEach(([id,k])=>{const el=$(id);if(document.activeElement!==el)el.value=c[k];});
  // sheet
  if(su){
    $('#suMeta').textContent=`${su.car}${su.head.Notes?' · '+su.head.Notes:''}`;
    const groups={};const corner={};
    for(const [sec,items] of Object.entries(su.sec)){
      if(/^(FRONT|REAR)(LEFT|RIGHT)$/.test(sec)){items.forEach(x=>{if(/N\/A|Detached/.test(x.disp)||!x.disp)return;(corner[x.label]??={})[sec]=x.disp;});continue;}
      const gname=SETUP_GROUPS[sec]||sec;items.forEach(x=>{if(!x.disp||/N\/A|Non-adjustable|Detached/.test(x.disp))return;(groups[gname]??=[]).push([x.label,x.disp]);});
    }
    const cornerRows=Object.entries(corner);
    $('#suSheet').innerHTML=Object.entries(groups).map(([g,rows])=>`<div class="grp"><h3>${esc(g)}</h3><div class="kv">${rows.map(([l,v])=>`<span>${esc(l)}</span><span>${esc(v)}</span>`).join('')}</div></div>`).join('')+
      (cornerRows.length?`<div class="grp" style="grid-column:1/-1"><h3>Ruote e sospensioni</h3><div class="tw"><table><thead><tr><th>Parametro</th><th>Ant. sx</th><th>Ant. dx</th><th>Post. sx</th><th>Post. dx</th></tr></thead><tbody>${cornerRows.map(([l,o])=>`<tr><td class="l" style="font-family:var(--f-body)">${esc(l)}</td>${['FRONTLEFT','FRONTRIGHT','REARLEFT','REARRIGHT'].map(k=>`<td>${esc(o[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`:'');
  }else{$('#suMeta').textContent='';$('#suSheet').innerHTML='<div class="empty">Carica un file setup .svm (lo trovi in Documenti o nella cartella Settings di Le Mans Ultimate).</div>';}
  // warnings
  const w=[];if(su&&S){const car=(S.meta.car||'').toLowerCase(),sc=su.car.toLowerCase();if(car&&!sc.includes(car)&&!(car.startsWith('hyper')&&/hypercar/.test(sc)))w.push(`Il setup è per «${su.car}», la telemetria è dell'auto «${S.meta.car}». Per consigli utili usa telemetria e setup della stessa auto.`);
    else if(!car)w.push(`Controlla che la telemetria sia della stessa auto del setup (${su.car}): il file .ld non indica l'auto.`);}
  $('#suWarn').innerHTML=w.map(x=>`<div class="warnbar" style="margin-bottom:10px">${esc(x)}</div>`).join('');
  // diagnostics
  if(!S){$('#suDiag').innerHTML='<div class="empty">Scegli una telemetria per la diagnosi.</div>';return;}
  const laps=S.laps.filter(l=>l.complete&&l.type==='lanciato');const use=laps.length?laps:S.laps.filter(l=>l.complete);
  if(!use.length){$('#suDiag').innerHTML='<div class="empty">Servono giri completi.</div>';return;}
  $('#suDiagNote').textContent=`media di ${use.length} ${use.length===1?'giro':'giri'} · ${S.label}`;
  const D=diagnose(S,use);DIAG=D;
  $('#suDiag').innerHTML=D.cards.map(c=>`<div class="card"><span class="st"><span class="dot ${c.st}"></span>${esc(c.title)}</span>${c.html}</div>`).join('');
};
let DIAG=null;
function agg(stats,f){return mean(stats.map(f));}
function diagnose(S,laps){
  const st=laps.map(l=>lapStats(S,l)),c=cfg(),cards=[],summary=[];
  const T={};for(const w of W)T[w]={I:agg(st,s=>s.w[w].I),C:agg(st,s=>s.w[w].C),O:agg(st,s=>s.w[w].O),p:agg(st,s=>s.w[w].p),pMax:agg(st,s=>s.w[w].pMax),bMax:Math.max(...st.map(s=>s.w[w].bMax)),rhMin:Math.min(...st.map(s=>s.w[w].rhMin)),rhLow:agg(st,s=>s.w[w].rhLow),wear:agg(st,s=>s.w[w].wear),carc:agg(st,s=>s.w[w].carc)};
  // camber
  {const io=+c.iomin,iomax=+c.iomax;let worst='good';const li=W.map(w=>{const d=T[w].I-T[w].O;let s='good',txt='ok';if(!Number.isFinite(d)){s='';txt='n.d.';}else if(d>iomax){s='warn';txt='troppa campanatura negativa';}else if(d<io){s=d<0?'bad':'warn';txt=d<0?'esterno più caldo: serve più negativa':'poca campanatura negativa';}
      if(s==='bad'||(s==='warn'&&worst==='good'))worst=s;return `<li><b>${w}</b> int−est ${fsign(d,1)} °C · ${txt}</li>`;});
    cards.push({title:'Campanatura',st:worst,html:`<ul>${li.join('')}</ul><p class="muted small">Obiettivo: interno più caldo di ${io}–${iomax} °C.</p>`});
    summary.push('Differenza temperatura interno−esterno (°C): '+W.map(w=>`${w} ${fx(T[w].I-T[w].O,1)}`).join(', '));}
  // pressure profile
  {let worst='good';const pmin=num(c.pmin),pmax=num(c.pmax);const li=W.map(w=>{const x=T[w],edge=(x.I+x.O)/2,d=x.C-edge;let s='good',txt='profilo uniforme';if(d>6){s='warn';txt='centro caldo: pressione alta';}else if(d<-2){s='warn';txt='centro freddo: pressione bassa';}
      let pt='';if(Number.isFinite(pmin)&&Number.isFinite(pmax)){if(x.p<pmin){s='warn';pt=' · sotto obiettivo';}else if(x.p>pmax){s='warn';pt=' · sopra obiettivo';}}
      if(s!=='good')worst='warn';return `<li><b>${w}</b> ${fx(x.p,1)} kPa (max ${fx(x.pMax,1)}) · centro ${fsign(d,1)} °C · ${txt}${pt}</li>`;});
    cards.push({title:'Pressioni a caldo',st:worst,html:`<ul>${li.join('')}</ul><p class="muted small">${Number.isFinite(pmin)?`Obiettivo ${pmin}–${pmax} kPa.`:'Nessun obiettivo impostato: giudico solo dal profilo centro/bordi.'}</p>`});
    summary.push('Pressione media a caldo (kPa): '+W.map(w=>`${w} ${fx(T[w].p,1)} (max ${fx(T[w].pMax,1)})`).join(', '));
    summary.push('Temperature I/C/E medie (°C): '+W.map(w=>`${w} ${fx(T[w].I,0)}/${fx(T[w].C,0)}/${fx(T[w].O,0)}`).join(', '));}
  // temp balance
  {const f=mean(['FL','FR'].map(w=>(T[w].I+T[w].C+T[w].O)/3)),r=mean(['RL','RR'].map(w=>(T[w].I+T[w].C+T[w].O)/3)),l=mean(['FL','RL'].map(w=>(T[w].I+T[w].C+T[w].O)/3)),rr=mean(['FR','RR'].map(w=>(T[w].I+T[w].C+T[w].O)/3));
    const s=Math.abs(f-r)>10?'warn':'good';
    cards.push({title:'Equilibrio temperature',st:s,html:`<p>Anteriori ${fx(f,0)} °C · posteriori ${fx(r,0)} °C (${fsign(f-r,0)})</p><p>Sinistra ${fx(l,0)} °C · destra ${fx(rr,0)} °C (${fsign(l-rr,0)})</p><p class="muted small">${f-r>10?'Anteriori molto più caldi: tipico di sottosterzo o frenate aggressive.':r-f>10?'Posteriori molto più caldi: tipico di sovrasterzo in trazione o slittamento in uscita.':'Assi in equilibrio.'}</p>`});
    summary.push(`Temperatura media asse: anteriore ${fx(f,0)}, posteriore ${fx(r,0)}, lato sx ${fx(l,0)}, lato dx ${fx(rr,0)}`);}
  // ride height
  {const lowF=Math.max(T.FL.rhLow,T.FR.rhLow),lowR=Math.max(T.RL.rhLow,T.RR.rhLow);const s=(lowF>0.01||lowR>0.01)?'bad':(lowF>0||lowR>0)?'warn':'good';
    cards.push({title:'Altezze e fondo',st:s,html:`<ul>${W.map(w=>`<li><b>${w}</b> minima ${fx(T[w].rhMin,1)} mm · sotto ${c.rh} mm per il ${fx(T[w].rhLow*100,1)}% del giro</li>`).join('')}</ul><p class="muted small">${s==='bad'?'La vettura tocca il fondo spesso: alza l’altezza, irrigidisci molle o 3° elemento, o aumenta i packer.':s==='warn'?'Qualche contatto col fondo isolato (cordoli, compressioni).':'Nessun contatto col fondo rilevato.'}</p>`});
    summary.push('Altezza minima da terra (mm): '+W.map(w=>`${w} ${fx(T[w].rhMin,1)} (sotto ${c.rh}mm ${fx(T[w].rhLow*100,1)}% del giro)`).join(', '));}
  // brakes
  {const bmax=num(c.bmax),mx=Math.max(...W.map(w=>T[w].bMax));const s=Number.isFinite(bmax)&&mx>bmax?'warn':'good';const bf=mean([T.FL.bMax,T.FR.bMax]),brr=mean([T.RL.bMax,T.RR.bMax]);
    cards.push({title:'Freni',st:s,html:`<ul>${W.map(w=>`<li><b>${w}</b> picco ${fx(T[w].bMax,0)} °C</li>`).join('')}</ul><p class="muted small">Anteriori ${fsign(bf-brr,0)} °C rispetto ai posteriori.${Number.isFinite(bmax)?` Limite impostato ${bmax} °C.`:' Imposta un limite per ricevere avvisi.'}</p>`});
    summary.push('Picco temperatura freni (°C): '+W.map(w=>`${w} ${fx(T[w].bMax,0)}`).join(', '));}
  // balance
  {const B=balance(S,laps.slice(0,6));const P=B.phases;let s='good';const lines=[];
    for(const [k,x] of Object.entries(P)){let t='';if(B.hasGrip&&Number.isFinite(x.front)){const d=x.front-x.rear;t=` · scivolamento ant. ${fx(x.front,0)}% vs post. ${fx(x.rear,0)}% → ${d>8?'<b>tende al sottosterzo</b>':d<-8?'<b>tende al sovrasterzo</b>':'neutro'}`;if(Math.abs(d)>8)s='warn';}
      lines.push(`<li><b>${k}</b>: sterzo relativo ${fx(x.steerIdx,2)}${t}</li>`);}
    const cs=B.counter;if(cs.length>laps.slice(0,6).length*2)s='warn';
    const byC={};cs.forEach(e=>{const k=e.corner?('T'+e.corner):('~'+Math.round(e.d/100)*100+' m');(byC[k]??={n:0,ph:{}}).n++;byC[k].ph[e.phase]=(byC[k].ph[e.phase]||0)+1;});
    const top=Object.entries(byC).sort((a,b)=>b[1].n-a[1].n).slice(0,5);
    cards.push({title:'Bilanciamento',st:s,html:`<ul>${lines.join('')}</ul><p>Controsterzi rilevati: <b>${cs.length}</b>${top.length?' · '+top.map(([k,v])=>`${k} ×${v.n} (${Object.keys(v.ph).join('/')})`).join(', '):''}</p><p class="muted small">Sterzo relativo &gt; 1 = serve più volante del solito per la stessa accelerazione laterale (tendenza al sottosterzo in quella fase); &lt; 1 = ne serve meno (tendenza al sovrasterzo). ${B.hasGrip?'Lo scivolamento viene dal canale grip dei pneumatici.':'Questa telemetria non ha il canale di grip dei pneumatici, quindi uso solo sterzo e controsterzi.'}</p>`});
    summary.push('Bilanciamento per fase (sterzo relativo; >1 sottosterzo, <1 sovrasterzo): '+Object.entries(P).map(([k,x])=>`${k} ${fx(x.steerIdx,2)}${B.hasGrip?` [slittamento ant ${fx(x.front,0)}% / post ${fx(x.rear,0)}%]`:''}`).join(', '));
    summary.push(`Controsterzi rilevati: ${cs.length}. Per curva: `+top.map(([k,v])=>`${k} x${v.n} fase ${Object.keys(v.ph).join('/')}`).join('; '));}
  // wear
  {const wm=W.map(w=>T[w].wear);cards.push({title:'Usura per giro',st:'good',html:`<ul>${W.map((w,i)=>`<li><b>${w}</b> ${fx(wm[i],2)} %</li>`).join('')}</ul><p class="muted small">${Math.max(...wm)>1.5*Math.min(...wm)?'Usura sbilanciata: la gomma più consumata è la '+WL[W[wm.indexOf(Math.max(...wm))]]+'.':'Usura distribuita in modo uniforme.'}</p>`});
    summary.push('Usura per giro (%): '+W.map((w,i)=>`${w} ${fx(wm[i],2)}`).join(', '));}
  // corners of best lap
  const bl=S.best||laps[0];const g=lapGrid(S,bl,2);const cr=detectCorners(g);
  summary.push(`Miglior giro ${fmtLap(bl.time)}. Curve (distanza apice, vel. min km/h, marcia): `+cr.map(k=>`T${k.k} ${fx(k.dApex,0)}m ${fx(k.vMin,0)}km/h m${fx(k.gear,0)}`).join('; '));
  return {cards,summary,T};
}

// ================= AI =================
let SAMPLE=null,AI_READY=false;
async function initAI(){
  try{if(window.claude?.use){SAMPLE=await window.claude.use('sample');}}catch(e){SAMPLE=null;}
  AI_READY=true;
  if(!SAMPLE){['#suAnswer','#cmpAnswer'].forEach(id=>$(id).innerHTML='<div class="note">L’assistente AI è disponibile quando apri questa pagina su claude.ai o nell’app Claude.</div>');$('#suAsk').disabled=true;$('#cmpAsk').disabled=true;}
}
function md(s){
  const lines=esc(s).split('\n');let html='',inList=null,inTable=false;
  const inline=t=>t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<i>$2</i>');
  const close=()=>{if(inList){html+=`</${inList}>`;inList=null;}if(inTable){html+='</tbody></table></div>';inTable=false;}};
  for(const raw of lines){const l=raw.trimEnd();
    if(/^\|/.test(l)){const cells=l.replace(/^\||\|$/g,'').split('|').map(c=>c.trim());if(cells.every(c=>/^:?-+:?$/.test(c)))continue;if(!inTable){close();html+='<div class="tw"><table><thead><tr>'+cells.map(c=>`<th>${inline(c)}</th>`).join('')+'</tr></thead><tbody>';inTable=true;continue;}html+='<tr>'+cells.map(c=>`<td>${inline(c)}</td>`).join('')+'</tr>';continue;}
    let m;
    if((m=l.match(/^(#{1,4})\s+(.*)/))){close();html+=`<h${Math.min(4,m[1].length+1)}>${inline(m[2])}</h${Math.min(4,m[1].length+1)}>`;continue;}
    if((m=l.match(/^\s*[-*]\s+(.*)/))){if(inList!=='ul'){close();html+='<ul>';inList='ul';}html+=`<li>${inline(m[1])}</li>`;continue;}
    if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){if(inList!=='ol'){close();html+='<ol>';inList='ol';}html+=`<li>${inline(m[1])}</li>`;continue;}
    if(!l.trim()){close();continue;}
    close();html+=`<p>${inline(l)}</p>`;}
  close();return html;
}
async function runAI(turns,outEl,stateEl,tier='complex'){
  if(!SAMPLE)return null;
  const box=document.createElement('div');box.className='answer';box.innerHTML='<span class="spin"></span> <span class="muted small">L’ingegnere sta analizzando i dati…</span>';outEl.appendChild(box);
  try{const r=await SAMPLE(turns,{modelTier:tier,cache:false,onText:({text})=>{box.innerHTML=md(text);}});box.innerHTML=md(r.text);return r.text;}
  catch(e){if(e&&e.code==='not_granted'){box.innerHTML='<div class="note">Per usare l’assistente serve il tuo consenso: riprova e accetta la richiesta.</div>';}else if(e&&e.code==='rate_limited'){box.innerHTML='<div class="note">Troppe richieste ravvicinate: aspetta un minuto e riprova.</div>';}else{box.innerHTML=`<div class="note">Non sono riuscito a ottenere una risposta (${esc(e?.message||e?.code||'errore')}). Riprova tra poco.</div>`;if(e?.text)box.innerHTML+=md(e.text);}return null;}
}
const PROBLEMS=['Sottosterzo in ingresso','Sottosterzo a centro curva','Sottosterzo in uscita','Sovrasterzo in ingresso','Sovrasterzo in uscita','Instabile in frenata','Bloccaggio ruote','Poca velocità di punta','Tocca il fondo / saltella','Gomme posteriori si surriscaldano','Gomme anteriori si surriscaldano','Gomme fredde / non vanno in temperatura','Consumo eccessivo gomme','Troppo nervosa sui cordoli'];
let suTurns=[];
function setupPrompt(){
  const su=byId($('#suFile').value),S=byId($('#suSess').value);
  const probs=$$('#suChips .pchip[aria-pressed="true"]').map(b=>b.textContent);
  const txt=$('#suText').value.trim();
  const tele=DIAG&&S?`TELEMETRIA (${S.label}, pilota ${S.meta.driver}):\n- `+DIAG.summary.join('\n- '):'Nessuna telemetria selezionata.';
  return `Sei un ingegnere di pista esperto di Le Mans Ultimate (simulatore, motore fisico rFactor 2). Aiuti un pilota sim racing a risolvere problemi di guida modificando il setup. Rispondi in italiano, in modo concreto.

PROBLEMI RIFERITI DAL PILOTA: ${probs.length?probs.join(', '):'nessuno selezionato'}
DESCRIZIONE: ${txt||'(nessuna)'}

SETUP ATTUALE (${su?su.name:'non caricato'}; il valore dopo = è quello mostrato nel gioco, l'indice è la posizione del click):
${su?setupText(su):'Setup non disponibile: ragiona in termini generici.'}

${tele}

ISTRUZIONI:
1. Una breve diagnosi (3-5 righe): collega i problemi riferiti ai dati di telemetria, dicendo chiaramente se i dati confermano o no il problema.
2. Una tabella Markdown con le modifiche consigliate, in ordine di priorità, colonne: Priorità | Parametro (nome come nel menu setup del gioco) | Da | A | Perché. Usa passi piccoli (1-2 click) e al massimo 5 modifiche. Se una modifica dipende dal valore attuale, parti dal valore del setup.
3. Cosa verificare nel prossimo run (quali curve, quali numeri guardare).
4. Se qualche dato manca o è ambiguo dillo in una riga. Non inventare parametri che non esistono per questa auto: usa solo quelli presenti nel setup.`;
}
function cmpPrompt(){
  const {SA,SB,la,lb,rows,ga,gb}=cmpCur;
  const tot=gb.t[gb.n-1]-ga.t[ga.n-1];
  return `Sei un coach di guida per Le Mans Ultimate. Confronta due giri sulla stessa pista e spiega al pilota dove e come guadagnare tempo. Rispondi in italiano, con consigli pratici di guida (punti di frenata, velocità di percorrenza, uso del gas, marce). Niente premesse.

Pista: ${SA.meta.venue}. Giro A: ${fmtLap(la.time)} (${SA.meta.driver||'pilota A'}, ${SA.label}). Giro B: ${fmtLap(lb.time)} (${SB.meta.driver||'pilota B'}, ${SB.label}). Distacco B−A: ${tot.toFixed(3)} s.
Il pilota che chiede aiuto è quello del giro più lento${tot>0?' (B)':' (A)'}.

Curva per curva (distanze in metri dal traguardo; "lift" = nessuna frenata; Δ = tempo B − tempo A nel tratto):
${rows.map(r=>`T${r.k} [${r.dS.toFixed(0)}-${r.dE.toFixed(0)}m]: frenata A ${r.brake!=null?r.brake.toFixed(0):'lift'} / B ${r.brakeB!=null?r.brakeB.toFixed(0):'lift'}; vel.min A ${r.vMin.toFixed(0)} / B ${r.vMinB.toFixed(0)} km/h; marcia A ${r.gear}; gas pieno A ${r.fullThr!=null?r.fullThr.toFixed(0):'-'} / B ${r.fullB!=null?r.fullB.toFixed(0):'-'}; tempo A ${r.tA.toFixed(2)} / B ${r.tB.toFixed(2)}; Δ ${r.dt>0?'+':''}${r.dt.toFixed(3)}s`).join('\n')}

Formato:
- una riga di sintesi con il guadagno potenziale totale;
- le 3-4 curve più importanti, ognuna con: cosa fa diversamente il giro più veloce (con i numeri) e cosa provare al prossimo giro;
- un'abitudine generale da correggere se emerge un pattern (es. frena sempre troppo presto, apre il gas tardi).`;
}

// ================= BOOT =================
async function boot(){
  lapChart=new Stack($('#lapChart'),{onCursor:i=>{lapMap.setCursorIdx(i);lapReadout(i);}});
  lapMap=new TrackMap($('#lapMap'),{onCursor:i=>{lapChart.setCursorIdx(i);lapReadout(i);}});
  cmpChart=new Stack($('#cmpChart'),{onCursor:i=>{cmpMap.setCursorIdx(i);cmpReadout(i);}});
  cmpMap=new TrackMap($('#cmpMap'),{onCursor:i=>{cmpChart.setCursorIdx(i);cmpReadout(i);}});
  $$('.tab').forEach(t=>t.onclick=()=>showView(t.dataset.view));
  $('#btnLoad').onclick=()=>$('#fileIn').click();
  $('#fileIn').onchange=e=>{handleFiles([...e.target.files]);e.target.value='';};
  document.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('dragging');});
  document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('dragging');});
  document.addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('dragging');handleFiles([...e.dataTransfer.files]);});
  $('#stSrc').onchange=RENDER.stint;$('#stDrv').onchange=RENDER.stint;
  $('#lapSess').onchange=RENDER.lap;$('#lapSel').onchange=RENDER.lap;$('#lapMapCh').onchange=RENDER.lap;
  ['#cmpSessA','#cmpLapA','#cmpSessB','#cmpLapB'].forEach(id=>$(id).onchange=RENDER.cmp);
  ['#suFile','#suSess'].forEach(id=>$(id).onchange=RENDER.setup);
  [['#cfgPmin','pmin'],['#cfgPmax','pmax'],['#cfgIOmin','iomin'],['#cfgIOmax','iomax'],['#cfgBmax','bmax'],['#cfgRH','rh']].forEach(([id,k])=>$(id).onchange=e=>{cfg()[k]=e.target.value;saveCfg();lds().forEach(S=>{for(const key of [...S.cache.keys()])if(key.startsWith('st'))S.cache.delete(key);});RENDER.setup();});
  $$('[data-rot],[data-flip]').forEach(b=>b.onclick=()=>{const m=b.dataset.rot||b.dataset.flip,map=m==='lapMap'?lapMap:cmpMap;if(!map.venue)return;const v=getMapView(map.venue);if(b.dataset.rot)v.rot=(v.rot+1)%4;else v.flip=!v.flip;saveMapView(map.venue);lapMap.draw();cmpMap.draw();});
  $('#suChips').innerHTML=PROBLEMS.map(p=>`<button type="button" class="pchip" aria-pressed="false">${esc(p)}</button>`).join('');
  $$('#suChips .pchip').forEach(b=>b.onclick=()=>b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')!=='true'));
  $('#suAsk').onclick=async()=>{if(!DIAG&&byId($('#suSess').value))RENDER.setup();suTurns=[{role:'user',content:setupPrompt()}];$('#suAnswer').innerHTML='';$('#suAsk').disabled=true;const t=await runAI(suTurns,$('#suAnswer'));$('#suAsk').disabled=false;if(t){suTurns.push({role:'assistant',content:t});$('#suFollowWrap').hidden=false;}};
  const follow=async()=>{const q=$('#suFollow').value.trim();if(!q||!suTurns.length)return;$('#suFollow').value='';const p=document.createElement('p');p.className='q';p.textContent=q;$('#suAnswer').appendChild(p);suTurns.push({role:'user',content:q});const t=await runAI(suTurns,$('#suAnswer'),null,'default');if(t)suTurns.push({role:'assistant',content:t});else suTurns.pop();};
  $('#suFollowBtn').onclick=follow;$('#suFollow').onkeydown=e=>{if(e.key==='Enter')follow();};
  $('#cmpAsk').onclick=async()=>{if(!cmpCur.ga)return;$('#cmpAnswer').innerHTML='';$('#cmpAsk').disabled=true;await runAI([{role:'user',content:cmpPrompt()}],$('#cmpAnswer'),null,'default');$('#cmpAsk').disabled=false;};
  // theme change → redraw canvases
  const redraw=()=>{lapChart.draw();lapMap.draw();cmpChart.draw();cmpMap.draw();if(curView()==='stint')RENDER.stint();};
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{fillCache();redraw();});
  new MutationObserver(redraw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  function fillCache(){}
  initAI();
  // data: samples + local library
  await IDB.open();
  const SAMPLES=[['samples/imola_p1.ld.gz.b64.txt','Imola P1 (telemetria).ld.gz'],['samples/imola_p1.xml.txt','Imola P1 (risultati).xml'],['samples/fuji_q.ld.gz.b64.txt','GO V1.4.2 Cadillac Fuji Q.ld.gz'],['samples/fuji_r.svm','GO V1.4.2 Cadillac Fuji R.svm']];
  const saved=await IDB.all();
  await Promise.all(SAMPLES.map(async([u,n])=>{try{const r=await fetch(u);if(!r.ok)throw 0;let buf;if(u.endsWith('.b64.txt')){const s=atob((await r.text()).trim());const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);buf=a.buffer;}else buf=await r.arrayBuffer();await addFile(n,buf,{sample:true});}catch(e){console.warn('sample',u,e);}}));
  for(const s of saved){try{await addFile(s.name,s.buf);}catch(e){console.warn(e);}}
  // order: ld sessions of user first
  let tab='stint';try{tab=localStorage.getItem('pitwall:tab')||'stint';}catch(e){}
  if(location.hash&&RENDER[location.hash.slice(1)])tab=location.hash.slice(1);
  renderLib();fillSelects();showView(tab);
}
boot();
