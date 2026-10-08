// ================= TRACK LIMITS MAP (telemetry + official events) =================
function limitEvents(S){
  if(S.cache.has('lim'))return S.cache.get('lim');
  const pl=S.ch['Path Lateral'],te=S.ch['Track Edge'],sp=S.ch['Ground Speed'],pit=S.ch['In Pits'];if(!pl||!te){S.cache.set('lim',null);return null;}
  const f=pl.f,n=pl.v.length,PL=pl.v,TE=te.v;const ev=[];let s=-1,mx=0,im=0;
  for(let i=0;i<n;i++){const t=i/f;const o=Math.abs(PL[i])-Math.abs(sampleAt(te,t));const on=o>0.3&&sampleAt(sp,t)>40&&!(pit&&sampleStep(pit,t)>0.5);
    if(on){if(s<0){s=i;mx=o;im=i;}else if(o>mx){mx=o;im=i;}}else if(s>=0){ev.push({t:im/f,ov:mx,dur:(i-s)/f});s=-1;}}
  const laps=S.laps;const ref=S.best||laps.find(l=>l.complete);if(!ref){S.cache.set('lim',null);return null;}
  const g0=lapGrid(S,ref,2),cr=detectCorners(g0);
  const la=S.ch['GPS Latitude'],lo=S.ch['GPS Longitude'];
  const place=e=>{const lap=laps.find(l=>e.t>=l.t0&&e.t<l.t1);e.lap=lap;if(lap){const tr=lapTrace(S,lap);const k=Math.min(tr.t.length-1,Math.max(0,Math.round((e.t-lap.t0)/0.02)));e.frac=tr.d[k]/(lap.complete?tr.len:(S.trackLen||tr.len));const x=e.frac*g0.len;const c=cr.find(c=>x>=c.dS&&x<=c.dE);e.corner=c?'T'+c.k:(x<(cr[0]?.dS??0)?'partenza':'arrivo');}
    if(la&&lo){e.lat=sampleAt(la,e.t);e.lon=sampleAt(lo,e.t);}};
  ev.forEach(place);
  // official events from merged results
  const off=[];
  if(S.merged)S.laps.forEach(l=>(l.x?.ev||[]).forEach(x=>{if(!['inv','warn','pen','nfa'].includes(x.k)||!Number.isFinite(x.et))return;const t=x.et-S.et0;
    const cand=ev.filter(e=>e.t<=t+1&&e.t>=t-10).sort((a,b)=>b.ov-a.ov)[0];
    if(cand){cand.off=x.k;off.push(cand);}else{const e={t:t-3,ov:NaN,off:x.k,orphan:true};place(e);ev.push(e);off.push(e);}}));
  const out={ev,cr,g0,ref};S.cache.set('lim',out);return out;
}
function drawLimits(S){
  const P=$('#limP');const R=limitEvents(S);
  if(!R){P.hidden=true;return;}P.hidden=false;
  const ev=R.ev.filter(e=>e.off||e.ov>0.3);const big=ev.filter(e=>e.ov>1),edge=ev.filter(e=>e.ov>0.3&&e.ov<=1),off=ev.filter(e=>e.off);
  const nL=S.laps.filter(l=>l.complete||l.start).length;
  $('#limNote').textContent=`${nL} giri · bordo pista calcolato dalla telemetria${S.merged?' · segnalazioni dal file risultati':''}`;
  // map
  const cv=$('#limMap');const {c,w,h}=fitCanvas(cv);c.clearRect(0,0,w,h);const g0=R.g0;const LA=g0.get('GPS Latitude'),LO=g0.get('GPS Longitude');
  if(LA&&LO){const view=getMapView(S.meta.venue),ang=view.rot*Math.PI/2,ca=Math.cos(ang),sa=Math.sin(ang);
    const pr=(la,lo)=>{let x=lo,y=-la;if(view.flip)x=-x;return [x*ca-y*sa,x*sa+y*ca];};
    const pts=Array.from(LA,(v,i)=>pr(v,LO[i]));let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;pts.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);});
    const pad=18,s=Math.min((w-2*pad)/(x1-x0||1),(h-2*pad)/(y1-y0||1)),ox=(w-(x1-x0)*s)/2,oy=(h-(y1-y0)*s)/2,T=([x,y])=>[ox+(x-x0)*s,oy+(y-y0)*s];
    c.lineCap='round';c.lineJoin='round';c.strokeStyle=tok('trackbed');c.lineWidth=14;c.beginPath();pts.forEach((p,i)=>{const q=T(p);i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]);});c.stroke();
    c.strokeStyle=tok('line');c.lineWidth=2;c.stroke();
    c.font='700 11px "Titillium Web",sans-serif';c.textAlign='center';c.textBaseline='middle';
    R.cr.forEach(k=>{const q=T(pts[k.apex]);c.fillStyle=tok('panel');c.beginPath();c.arc(q[0],q[1],9,0,7);c.fill();c.fillStyle=tok('muted');c.fillText(k.k,q[0],q[1]+.5);});
    const dot=(e)=>{if(!Number.isFinite(e.lat))return;const q=T(pr(e.lat,e.lon));const col=e.ov>1?tok('lapB'):Number.isFinite(e.ov)?tok('warn'):tok('faint');c.globalAlpha=.85;c.fillStyle=col;c.beginPath();c.arc(q[0],q[1],e.ov>1?4.5:3,0,7);c.fill();c.globalAlpha=1;
      if(e.off){c.strokeStyle=e.off==='nfa'?tok('muted'):tok('bad');c.lineWidth=2;c.beginPath();c.arc(q[0],q[1],8,0,7);c.stroke();}};
    ev.filter(e=>!(e.ov>1)).forEach(dot);ev.filter(e=>e.ov>1).forEach(dot);}
  // table per corner
  const by={};ev.forEach(e=>{const k=e.corner||'?';(by[k]??={edge:0,big:0,off:0,inv:0,laps:new Set()});if(e.ov>1)by[k].big++;else if(e.ov>0.3)by[k].edge++;if(e.off){by[k].off++;if(e.off!=='nfa')by[k].inv++;}if(e.lap)by[k].laps.add(e.lap.num);});
  const rows=Object.entries(by).sort((a,b)=>(b[1].inv*10+b[1].off*4+b[1].big*3+b[1].edge*0.3)-(a[1].inv*10+a[1].off*4+a[1].big*3+a[1].edge*0.3));
  const top=rows.filter(([,v])=>v.big||v.off).slice(0,3);
  $('#limSum').innerHTML=`<div class="kpis"><div class="kpi" style="--kc:${tok('warn')}"><div class="l">Al limite</div><div class="v">${edge.length}</div><div class="s">0,3–1 m oltre il bordo</div></div><div class="kpi" style="--kc:${tok('lapB')}"><div class="l">Fuori con 4 ruote</div><div class="v">${big.length}</div><div class="s">oltre 1 m</div></div>${S.merged?`<div class="kpi" style="--kc:${tok('bad')}"><div class="l">Segnalati dal gioco</div><div class="v">${off.length}</div><div class="s">${off.filter(e=>e.off!=='nfa').length} con conseguenze</div></div>`:''}</div>
    ${top.length?`<p style="margin:10px 0 0">Curve a rischio: ${top.map(([k,v])=>`<b>${esc(k)}</b> (${v.big} fuori${v.off?`, ${v.off} segnalate`:''})`).join(' · ')}.</p>`:'<p class="muted" style="margin:10px 0 0">Nessuna uscita importante.</p>'}`;
  $('#limTable').innerHTML=rows.length?`<table><thead><tr><th>Curva</th><th>Al limite</th><th>Fuori (&gt;1 m)</th>${S.merged?'<th>Segnalati</th><th>Con conseguenze</th>':''}<th class="l">Giri</th></tr></thead><tbody>${rows.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v.edge||'—'}</td><td class="${v.big?'t-slow':''}">${v.big||'—'}</td>${S.merged?`<td>${v.off||'—'}</td><td class="${v.inv?'t-bad':''}">${v.inv||'—'}</td>`:''}<td class="l">${[...v.laps].sort((a,b)=>a-b).join(', ')}</td></tr>`).join('')}</tbody></table>`:'';
}

// ================= PIT LOSS PER TRACK =================
function pitLossLD(S){const L=S.laps;const med=median(L.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid).map(l=>l.time));const out=[];
  L.forEach((l,i)=>{if(l.type==='rientro box'&&L[i+1]&&L[i+1].type==='uscita box'){const o=L[i+1];const fa=S.ch['Fuel Level']?sampleAt(S.ch['Fuel Level'],o.t1-0.5)-sampleAt(S.ch['Fuel Level'],l.t1-0.5)+0:NaN;out.push({loss:l.time+o.time-2*med,fuel:fa,lap:l.num});}});return out;}
function savePitLoss(venue,list,src){if(!venue||!list.length)return;const v=list.map(x=>x.loss).filter(x=>Number.isFinite(x)&&x>10&&x<200);if(!v.length)return;LS.set('pitloss:'+venue,{loss:median(v),n:v.length,fuel:median(list.map(x=>x.fuel).filter(Number.isFinite)),src,date:Date.now()});}
function learnPitLoss(){lds().forEach(S=>{if(S.meta.venue)savePitLoss(S.meta.venue,pitLossLD(S),'telemetria');});
  xmls().forEach(R=>R.sessions.forEach(sess=>{if(!/race/i.test(sess.name))return;const v=[];sess.drivers.forEach(d=>{const L=d.laps,med=median(L.filter(l=>l.kind==='lanciato'&&!l.invalid&&Number.isFinite(l.time)).map(l=>l.time));L.forEach((l,i)=>{if(l.pit&&L[i+1]&&Number.isFinite(l.time)&&Number.isFinite(L[i+1].time))v.push({loss:l.time+L[i+1].time-2*med});});});
    const prev=LS.get('pitloss:'+R.venue,null);if(!prev||prev.src!=='telemetria')savePitLoss(R.venue,v,'risultati (mediana di tutti i piloti)');}));}

// ================= SYNC FROM LMU FOLDER (File System Access, Chrome/Edge desktop) =================
const FSH={async get(){if(!IDB.db)return null;return new Promise(r=>{try{const t=IDB.db.transaction('files','readonly').objectStore('files').get('__lmu_dir__');t.onsuccess=()=>r(t.result?.h||null);t.onerror=()=>r(null);}catch(e){r(null);}});},
  set(h){try{IDB.db.transaction('files','readwrite').objectStore('files').put({name:'__lmu_dir__',h});}catch(e){}}};
async function* walk(dir,depth=0,path=''){for await(const [name,h] of dir.entries()){if(h.kind==='file'){if(/\.(ld|xml|svm)$|\.de\.json$/i.test(name))yield {h,path:path+name};}else if(depth<4&&!/^(Replays|Screenshots|Shaders|Cache|log_old)$/i.test(name))yield* walk(h,depth+1,path+name+'/');}}
async function syncLMU(){
  if(!window.showDirectoryPicker){toast('Disponibile nel file per il PC aperto con Chrome o Edge');return;}
  let dir=await FSH.get();
  try{if(dir){let p=await dir.queryPermission({mode:'read'});if(p!=='granted')p=await dir.requestPermission({mode:'read'});if(p!=='granted')dir=null;}
    if(!dir){toast('Scegli la cartella UserData di Le Mans Ultimate');dir=await window.showDirectoryPicker({id:'lmu',mode:'read'});FSH.set(dir);}}
  catch(e){toast(e.name==='SecurityError'?'Il browser non permette di leggere cartelle da qui: usa il file per il PC in Chrome o Edge':'Cartella non selezionata');return;}
  const seen=LS.get('synced',{});const since=LS.get('syncSince',Date.now()-7*864e5);let n=0,skipped=0;
  $('#btnSync').disabled=true;$('#btnSync').textContent='Cerco file…';
  // results and setups are small: all the new ones. Telemetry is heavy: only the 10 most recent
  // (many of them slow the app down and Progressi keeps its history anyway)
  let older=0;
  try{const todo=[];for await(const {h,path} of walk(dir)){const f=await h.getFile();const key=path+'|'+f.lastModified;if(seen[key])continue;if(f.lastModified<since){skipped++;continue;}todo.push({f,key,path});}
    const isLd=x=>/\.ld$/i.test(x.f.name);const lds_=todo.filter(isLd).sort((a,b)=>b.f.lastModified-a.f.lastModified);const keep=new Set(lds_.slice(0,10));older=lds_.length-keep.size;
    for(const x of todo.filter(x=>!isLd(x)||keep.has(x)).sort((a,b)=>a.f.lastModified-b.f.lastModified)){
      try{$('#btnSync').textContent='Carico '+x.f.name.slice(0,24)+'…';await addFile(x.f.name,await x.f.arrayBuffer(),{persist:x.f.size<60e6});seen[x.key]=1;n++;}catch(e){console.warn(x.path,e);}}}
  finally{$('#btnSync').disabled=false;$('#btnSync').textContent='Aggiorna da LMU';}
  LS.set('synced',seen);LS.set('syncSince',Date.now()-864e5);relink();learnPitLoss();refreshAll();
  toast((n?`Caricati ${n} file nuovi dalla cartella LMU`:'Nessun file nuovo')+(older?` · ${older} telemetrie meno recenti non caricate (puoi aggiungerle a mano)`:'')+(!n&&skipped?` (ignorati ${skipped} più vecchi di una settimana)`:''));
}
