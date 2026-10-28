// ================= TELEMETRIE AUTOMATICHE, RIFERIMENTI E «IL CAMBIO HA FUNZIONATO?» =================

// ---------- 1. the game's Telemetry folder, through the bridge ----------
// New .ld files appear by themselves: the bridge lists UserData\Telemetry, the app downloads a file once its size
// has stopped growing (LMU is done writing it). The first time only the latest session of the last 12 hours is
// loaded; the rest stays on the PC and can be opened from the files panel. Riferimenti\ holds reference laps.
const LDSYNC={files:[],dir:'',err:'',busy:false,pend:{},last:0};
const ldIsRef=p=>/^riferimenti\//i.test(p);
const ldName=p=>p.split('/').pop();
async function ldFetch(p){const r=await fetch('/ldlib/file?p='+encodeURIComponent(p),{cache:'no-store'});if(!r.ok)throw new Error(await r.text());return new File([await r.arrayBuffer()],ldName(p));}
async function ldOpen(p,{ref=false,select=true}={}){toast(tr('Carico')+' '+ldName(p)+'…');try{const f=await ldFetch(p);const id='ld:'+f.name;
  if(ref)LS.set('ref:'+id,true);
  if(!select){// a reference: load it without making it the session on screen
    await addFile(f.name,await f.arrayBuffer(),{persist:true});relink();const keep=[TW.SA,TW.a];refreshAll();if(keep[0]&&byId(keep[0].id)){TW.SA=keep[0];TW.a=keep[1];}}
  else await handleFiles([f]);const seen=LS.get('ld:seen',{});const e=LDSYNC.files.find(x=>x.p===p);if(e){seen[p]=e.t+':'+e.s;LS.set('ld:seen',seen);}
  if(select&&byId(id)){$('#gSess').value=id;LS.set('sess',id);renderHero();RENDER[curView()]?.();}return byId(id);}catch(e){toast(ldName(p)+': '+e.message);return null;}}
async function ldSync(){if(!isBridgeHost()||LDSYNC.busy)return;LDSYNC.busy=true;
  try{const j=await (await fetch('/ldlib',{cache:'no-store'})).json();if(!j.ok){LDSYNC.err=j.error||'';return;}LDSYNC.err='';LDSYNC.dir=j.dir||'';LDSYNC.files=j.files||[];LDSYNC.last=Date.now();
    const seen=LS.get('ld:seen',null);const own=LDSYNC.files.filter(f=>!ldIsRef(f.p));
    if(!seen){// first time: everything already there counts as seen, apart from the latest recent session
      const S={};LDSYNC.files.forEach(f=>S[f.p]=f.t+':'+f.s);const recent=own.filter(f=>Date.now()/1000-f.t<12*3600).sort((a,b)=>b.t-a.t)[0];
      if(recent){delete S[recent.p];LDSYNC.pend[recent.p]=recent.s;}LS.set('ld:seen',S);}
    const cur=LS.get('ld:seen',{});
    for(const f of own){if(cur[f.p]===f.t+':'+f.s||store.items.some(x=>x.id==='ld:'+ldName(f.p)&&x.size===f.s))continue;
      // still being written? wait until two lists in a row give the same size
      if(LDSYNC.pend[f.p]!==f.s){LDSYNC.pend[f.p]=f.s;continue;}delete LDSYNC.pend[f.p];
      const it=await ldOpen(f.p,{select:true});if(it)toast(tr('Nuova telemetria dal gioco')+': '+it.label);}
    if(curView()==='live')return;const lib=$('#lib');if(lib&&!lib.closest('[hidden]'))renderLib();}
  catch(e){LDSYNC.err=e.message;}finally{LDSYNC.busy=false;}}
setTimeout(()=>{ldSync();setInterval(ldSync,30000);},4000);

// files panel: what is in the game's folder, with a button to open each one
(function(){const rl=renderLib;window.renderLib=renderLib=function(){rl();const el=$('#lib');if(!el||!isBridgeHost())return;
  const fs=[...LDSYNC.files].sort((a,b)=>b.t-a.t);const loaded=p=>store.items.some(x=>x.id==='ld:'+ldName(p));const dt=t=>new Date(t*1000).toLocaleString([], {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  const row=f=>`<div class="lbrow${loaded(f.p)?' on':''}"><div class="lbn"><b title="${esc(f.p)}">${esc(ldName(f.p).replace(/\.ld(\.gz)?$/i,''))}</b><small>${dt(f.t)} · ${mb(f.s)}${loaded(f.p)?' · '+tr('aperta'):''}</small></div>${loaded(f.p)?'':`<button type="button" class="btn" data-ldp="${esc(f.p)}"${ldIsRef(f.p)?' data-ref="1"':''}>${tr('Apri')}</button>`}</div>`;
  const own=fs.filter(f=>!ldIsRef(f.p)).slice(0,30),refs=fs.filter(f=>ldIsRef(f.p));
  el.insertAdjacentHTML('beforeend',`<div class="lbcard ldpc"><div class="lbh"><b>${tr('Telemetrie nel PC')}</b><span class="mono">.ld · ${own.length}</span></div>
    <p class="muted small">${LDSYNC.err?esc(LDSYNC.err):tr('Dalla cartella Telemetry di LMU: le sessioni nuove si aprono da sole appena il gioco finisce di scriverle.')}</p><div class="lblist">${own.map(row).join('')||`<div class="muted small">${tr('Nessun file.')}</div>`}</div>
    <div class="lbh" style="margin-top:12px"><b>★ ${tr('Riferimenti')}</b><span class="mono">${refs.length}</span></div><p class="muted small">${tr('Metti nella sottocartella «Riferimenti» le telemetrie dei piloti veloci (per esempio quelle dei pacchetti setup): le trovi come giro B in Telemetria e come riferimento nel Coach.')}</p>
    <div class="lblist">${refs.map(row).join('')||`<div class="muted small">${tr('Nessun riferimento.')}</div>`}</div>${LDSYNC.dir?`<p class="small" style="color:var(--faint)"><span class="mono">${esc(LDSYNC.dir)}</span></p>`:''}</div>`);
  el.querySelectorAll('[data-ldp]').forEach(b=>b.onclick=()=>ldOpen(b.dataset.ldp,{ref:!!b.dataset.ref}).then(()=>renderLib()));};})();

// ---------- 2. Telemetria: the references on the PC are in the «Confronta con» list ----------
(function(){const rt=RENDER.tele;if(!rt)return;RENDER.tele=()=>{rt();const sel=$('#twSB');if(!sel||!isBridgeHost())return;
  const refs=LDSYNC.files.filter(f=>ldIsRef(f.p)&&!store.items.some(x=>x.id==='ld:'+ldName(f.p)));if(!refs.length)return;
  sel.insertAdjacentHTML('beforeend',`<optgroup label="★ ${esc(tr('Riferimenti nel PC'))}">${refs.map(f=>`<option value="pcref:${esc(f.p)}">${esc(ldName(f.p).replace(/\.ld(\.gz)?$/i,''))}</option>`).join('')}</optgroup>`);
  const on=sel.onchange;sel.onchange=async e=>{const v=e.target.value;if(!v.startsWith('pcref:'))return on(e);const S=await ldOpen(v.slice(6),{ref:true,select:false});
    if(!S)return;if(S.meta?.venue!==TW.SA?.meta?.venue)toast(tr('Il riferimento è di un\'altra pista')+': '+(S.meta?.venue||''));TW.SB=S;TW.b=(S.best||S.laps.find(l=>l.complete))?.i;TW.auto=false;RENDER.tele();};};})();

// ---------- 3. «Il cambio ha funzionato?»: every run is compared with the previous one on the same track and car ----------
function engMetrics(D,S,laps){const SL=D.raw?.SL||{};const T=D.raw?.T||{};const W=['FL','FR','RL','RR'];const B=D.raw?.B||{};
  return {lockF:SL.lockF,lockR:SL.lockR,spin:SL.spin,rhLow:Math.max(...W.map(w=>T[w]?.rhLow||0)),io:Object.fromEntries(W.map(w=>[w,T[w]?.I-T[w]?.O])),
    cF:(T.FL?.carc+T.FR?.carc)/2,cR:(T.RL?.carc+T.RR?.carc)/2,ph:{entrata:B.phases?.entrata?.steerIdx,centro:B.phases?.centro?.steerIdx,uscita:B.phases?.uscita?.steerIdx},
    sp:{lente:B.speedIdx?.lente?.idx,veloci:B.speedIdx?.veloci?.idx},laps:laps.length};}
// which measured number tells whether a setting change helped
const ENG_KPI=[['pace','Passo','s',3,-1],['best','Miglior giro','s',3,-1],['lockF','Bloccaggi ant.','s/giro',2,-1],['lockR','Bloccaggi post.','s/giro',2,-1],['spin','Pattinamento','s/giro',2,-1],
  ['rhLow','Fondo che tocca','%',2,-1,100],['cF','Carcassa ant.','°C',0,0],['cR','Carcassa post.','°C',0,0],['entrata','Sterzo relativo ingresso','',2,'n'],['centro','Sterzo relativo centro','',2,'n'],['uscita','Sterzo relativo uscita','',2,'n'],['lente','Sterzo rel. curve lente','',2,'n'],['veloci','Sterzo rel. curve veloci','',2,'n']];
function kpiVal(h,k){if(k==='pace'||k==='best')return h[k];const m=h.m||{};if(k in (m.ph||{}))return m.ph[k];if(k in (m.sp||{}))return m.sp[k];return m[k];}
function engCompareHTML(S){const H=LS.get('suhist',{});const cur=H[S.id];if(!cur)return '';const car=(cur.car||'').toLowerCase();
  const prev=Object.values(H).filter(h=>h.id!==S.id&&h.venue===cur.venue&&(!car||!h.car||h.car.toLowerCase()===car)&&(h.when<cur.when||(h.when===cur.when&&h.at<cur.at))).sort((a,b)=>String(b.when).localeCompare(String(a.when))||b.at-a.at)[0];
  if(!prev)return `<div class="panel ecmp"><div class="panel-h"><h3>${tr('Il cambio ha funzionato?')}</h3></div><p class="muted small">${tr('Questa è la prima prova salvata con questa auto su questa pista. Cambia il setup, fai 3–5 giri puliti e carica la nuova telemetria: qui vedrai cosa è cambiato e se è servito.')}</p></div>`;
  const diff=shDiff(prev,cur);const rows=ENG_KPI.map(([k,l,u,d,good,mul=1])=>{const a=kpiVal(prev,k),b=kpiVal(cur,k);if(!Number.isFinite(a)||!Number.isFinite(b))return '';const dx=(b-a)*mul;
    const better=good==='n'?Math.abs(b-1)<Math.abs(a-1)-0.02:good===0?null:dx*good>(d>=2?0.005:0.02);const worse=good==='n'?Math.abs(b-1)>Math.abs(a-1)+0.02:good===0?null:dx*good<-(d>=2?0.005:0.02);
    return `<tr><td class="l">${tr(l)}</td><td>${fx(a*mul,d)}</td><td>${fx(b*mul,d)}</td><td class="${better?'pos':worse?'neg':'muted'}">${dx>0?'+':''}${fx(dx,d)} ${u}</td><td class="${better?'pos':worse?'neg':'muted'}">${better?'▲ '+tr('meglio'):worse?'▼ '+tr('peggio'):'='}</td></tr>`;}).join('');
  // did the run follow the engineer's plan of the previous one, and did it fix that problem?
  const plan=(prev.plan||[]).map(p=>{const changed=Object.keys(cur.vals).some(k=>k.endsWith('|'+p.key)&&cur.vals[k]!==prev.vals[k]);const still=(cur.open||[]).includes(p.t);
    return `<li><b>${esc(p.t)}</b> → ${esc(SETUP_LABELS[p.key]||p.key)}: ${esc(p.dir)} · ${changed?(still?`<span class="neg">${tr('cambiato, ma il problema c\'è ancora')}</span>`:`<span class="pos">${tr('cambiato e il problema non c\'è più')}</span>`):`<span class="muted">${tr('non cambiato')}</span>`}</li>`;}).join('');
  const dT=Number.isFinite(cur.track)&&Number.isFinite(prev.track)?cur.track-prev.track:NaN;const dp=cur.pace-prev.pace;
  const verdict=!diff.length?tr('Il setup è lo stesso della prova precedente: le differenze vengono da pista, gomme o guida.'):Number.isFinite(dp)?(dp<-0.05?`${tr('Il passo è migliorato di')} ${fx(-dp,3)} s.`:dp>0.05?`${tr('Il passo è peggiorato di')} ${fx(dp,3)} s.`:tr('Il passo è rimasto uguale: guarda i numeri qui sotto per capire cosa è cambiato.')):'';
  // what else changed between the two runs: if any, the comparison is not only the setup
  const W=[];const fuel=x=>x.vals?.['GENERAL|FuelCapacitySetting']||x.vals?.['GENERAL|FuelSetting'],cmpd=x=>Object.entries(x.vals||{}).filter(([k])=>/\|CompoundSetting$/.test(k)).map(([,v])=>v).join('/');
  if(fuel(prev)&&fuel(cur)&&fuel(prev)!==fuel(cur))W.push(`${tr('carburante diverso')} (${esc(fuel(prev))} → ${esc(fuel(cur))}): ${tr('il peso cambia i tempi')}`);
  if(cmpd(prev)&&cmpd(cur)&&cmpd(prev)!==cmpd(cur))W.push(`${tr('mescola diversa')} (${esc(cmpd(prev))} → ${esc(cmpd(cur))})`);
  if(prev.cond&&cur.cond&&prev.cond!==cur.cond)W.push(`${tr('meteo diverso')} (${esc(tr(prev.cond))} → ${esc(tr(cur.cond))})`);
  if(Number.isFinite(dT)&&Math.abs(dT)>3)W.push(`${tr('pista')} ${dT>0?'+':''}${fx(dT,1)} °C`);
  if((prev.n||0)<3||(cur.n||0)<3)W.push(`${tr('pochi giri buoni')} (${prev.n||0} → ${cur.n||0}): ${tr('servono almeno 3 giri per prova')}`);
  if(prev.lm&&cur.lm&&prev.lm!==cur.lm)W.push(tr('le due prove sono state analizzate su giri scelti in modo diverso (più veloci / ultimi)'));
  return `<div class="panel ecmp"><div class="panel-h"><h3>${tr('Il cambio ha funzionato?')}</h3><span class="muted small">${tr('rispetto a')} ${esc(prev.when)} · ${esc(prev.su||'')}</span></div>
    <p class="ecv">${verdict}</p>${W.length?`<div class="ecw"><b>${tr('Prima di fidarti del confronto')}:</b><ul>${W.map(w=>`<li>${w}</li>`).join('')}</ul></div>`:`<p class="ecok small">✓ ${tr('Stesse condizioni: la differenza viene dal setup e dalla guida.')}</p>`}
    <div class="ecg"><div><h4>${tr('Cosa hai cambiato')}</h4>${diff.length?`<ul class="small">${diff.map(x=>`<li>${x}</li>`).join('')}</ul>`:`<p class="muted small">${tr('Niente.')}</p>`}
      ${plan?`<h4 style="margin-top:10px">${tr('Il piano della prova precedente')}</h4><ul class="small">${plan}</ul>`:''}</div>
      <div class="tw"><table class="lbt"><thead><tr><th class="l"></th><th>${tr('Prima')}</th><th>${tr('Ora')}</th><th>Δ</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;}
(function(){const re=renderEng;window.renderEng=renderEng=function(){re();const S=active()?.S;const D=typeof DIAG!=='undefined'?DIAG:null;const el=$('#suEng');if(!el||!S||!D||D.S!==S)return;
  try{let laps=engLaps(S);
    const H=LS.get('suhist',{});if(H[S.id]){const F=engFindings(D,S,D.su,laps);H[S.id].m=engMetrics(D,S,laps);H[S.id].plan=engPlan(F).map(f=>{const x=f.fx.find(x=>!x.conflict&&x.key);return x?{t:f.t,key:x.key,dir:x.dir}:null;}).filter(Boolean);
      H[S.id].open=F.filter(f=>f.s>0).map(f=>f.t);H[S.id].lm=engLapMode();LS.set('suhist',H);}
    el.querySelector('.ehead')?.insertAdjacentHTML('afterend',engCompareHTML(S));}catch(e){console.error(e);}};})();

(function(){const st=document.createElement('style');st.textContent=`
.ecmp{margin-bottom:14px}.ecv{margin:0 0 10px;font-size:.95rem}.ecg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:18px}.ecg h4{margin:0 0 6px;font:600 .74rem var(--f-display);letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}.ecg ul{margin:0;padding-left:18px}.ecg li{margin:3px 0}
.ecmp td.pos,.ecmp .pos{color:var(--good)}.ecmp td.neg,.ecmp .neg{color:var(--bad)}
.ldpc{grid-column:1/-1}
.ecw{border:1px solid rgba(255,159,67,.4);background:rgba(255,159,67,.08);border-radius:8px;padding:8px 12px;margin:0 0 10px;font-size:.88rem}.ecw ul{margin:4px 0 0;padding-left:18px}.ecok{color:#2BE38A;margin:0 0 10px}
@media (max-width:900px){.ecg{grid-template-columns:1fr}}`;document.head.appendChild(st);})();
// the setup file menu was bound to the first version of RENDER.setup, before the other panels hooked in:
// changing the .svm did not refresh the engineer, tyres, suspension and history. Always call the current one.
setTimeout(()=>{const s=$('#suFile');if(s)s.onchange=()=>RENDER.setup();},50);
