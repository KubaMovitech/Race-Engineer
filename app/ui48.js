// ================= 2.15: LIBRERIA, Muretto on/off, no OBS, A/B colours =================
// Libreria: every MoTeC telemetry and every setup the game keeps on this PC, read by the bridge, sorted by track
// and car. Pick a telemetry and a setup and open them together: nothing to look for in the folders by hand.

// ---------- A and B: two clearly different colours; dashes only if asked for in Personalizza ----------
function bDash(){return LS.get('bdash',false)===true;}

// ---------- the Muretto can be switched off (Personalizza): no menu entry and no live connections ----------
const liveOff=()=>LS.get('live:off',false)===true;
(function(){const ls=window.liveStart;if(typeof ls!=='function')return;window.liveStart=liveStart=function(...a){if(liveOff()){try{LIVE.conns.forEach(c=>c.close());LIVE.conns=[];}catch(e){}return;}return ls.apply(this,a);};})();
function liveApplyOff(){const off=liveOff();document.documentElement.classList.toggle('no-live',off);
  if(off){try{LIVE.conns.forEach(c=>c.close());LIVE.conns=[];}catch(e){}if(curView()==='live')showView('stint');}}
setTimeout(liveApplyOff,0);

// ---------- no OBS overlay and no TV direction in the Muretto ----------
if(LS.get('live:sub','ov')==='tv')LS.set('live:sub','ov');

// ---------- the Libreria page ----------
PRO_ICONS.libr='<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="M16.5 4.5l3.8 1 -3.9 15 -3.8-1z"/>';
PRO_NAV.splice(1,0,['libr','Libreria','Setup e telemetrie del PC',['lib']]);
(function(){const tabs=$('.tabs');if(tabs&&!$('#t-lib')){const b=document.createElement('button');b.className='tab';b.setAttribute('role','tab');b.id='t-lib';b.dataset.view='lib';b.setAttribute('aria-selected','false');b.textContent=tr('Libreria');b.onclick=()=>showView('lib');tabs.appendChild(b);}
  const m=$('main');if(m&&!$('#v-lib')){const s=document.createElement('section');s.className='view';s.id='v-lib';s.hidden=true;s.innerHTML='<div id="libBody"></div>';m.appendChild(s);}})();

const LIBV={ld:null,svm:null,st:null,at:0,err:'',q:'',track:'',car:'',grp:LS.get('lib:grp',true)!==false,sig:''};
const libNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
// a setup folder (e.g. «Monza») belongs to a track name (e.g. «Autodromo Nazionale Monza») when they share a word
function libSameTrack(folder,venue){const a=libNorm(folder),b=libNorm(venue);if(!a||!b)return false;if(a.includes(b)||b.includes(a))return true;const B=new Set(b.split(' ').filter(w=>w.length>=4));return a.split(' ').some(w=>w.length>=4&&B.has(w));}
const libCarShort=c=>String(c||'').replace(/_/g,' ').replace(/\s+(Hypercar|LMGT3|LMP2|LMP3|GTE)\b.*$/i,'').replace(/\bWEC\d{4}\b/,'').trim()||String(c||'');
// same car: the names written by the telemetry and by the setup differ («BMW M Hybrid V8» / «BMW_M_Hybrid Hypercar WEC2026»)
const LIB_GENERIC=new Set(['hybrid','hypercar','racing','team','lmgt3','lmp2','lmp3','wec2024','wec2025','wec2026','gt3','evo']);
function libCarMatch(a,b){const x=libNorm(libCarShort(a)),y=libNorm(libCarShort(b));if(!x||!y)return null;if(x.includes(y)||y.includes(x))return true;const Y=new Set(y.split(' ').filter(w=>w.length>=3&&!LIB_GENERIC.has(w)));return x.split(' ').some(w=>w.length>=3&&!LIB_GENERIC.has(w)&&Y.has(w));}
const libShopOf=n=>{for(const [s,re] of (typeof SHOPS!=='undefined'?SHOPS:[]))if(re.test(n))return s;return '';};
async function libLoad(force){if(!isBridgeHost()){LIBV.err='nobridge';return;}if(!force&&LIBV.ld&&Date.now()-LIBV.at<30000)return;
  try{const [a,b,c]=await Promise.all([fetch('/ldlib',{cache:'no-store'}).then(r=>r.json()),fetch('/svmlib',{cache:'no-store'}).then(r=>r.json()),fetch('/libstatus',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)]);
    LIBV.ld=a.ok?a.files:[];LIBV.svm=b.ok?b.files:[];LIBV.st=c;LIBV.err=!a.ok&&!b.ok?(a.error||b.error||''):'';LIBV.ldErr=a.ok?'':a.error;LIBV.svmErr=b.ok?'':b.error;LIBV.at=Date.now();}
  catch(e){LIBV.err=e.message;}}
function libSel(){return LS.get('libsel',{ld:'',svm:''});}
function libSetSel(o){LS.set('libsel',{...libSel(),...o});}
// the session key of a telemetry in the list (same as sesKey of an opened session: track, date, time, driver, car)
const libSesKey=f=>sesKey({meta:{venue:f.venue,date:f.date,time:f.time,driver:f.driver,car:f.car}});
function libRows(){const q=libNorm(LIBV.q);const T=LIBV.track,C=LIBV.car;
  const L=(LIBV.ld||[]).map(f=>({...f,venue:f.venue||'',ref:/^riferimenti\//i.test(f.p),name:f.p.split('/').pop()}))
    .filter(f=>(!T||libSameTrack(T,f.venue)||libNorm(f.venue)===libNorm(T))&&(!C||libCarMatch(f.car,C))&&(!q||libNorm(f.name+' '+f.venue+' '+f.car+' '+f.driver+' '+f.date).includes(q)))
    .sort((a,b)=>b.t-a.t);
  const S=(LIBV.svm||[]).map(f=>{const parts=f.p.split('/');return {...f,folder:parts.length>1?parts[0]:'',name:parts.pop().replace(/\.svm$/i,'')};})
    .filter(f=>(!T||libSameTrack(f.folder,T))&&(!C||libCarMatch(f.car,C))&&(!q||libNorm(f.name+' '+f.folder+' '+f.car).includes(q)))
    .sort((a,b)=>b.t-a.t);
  return {L,S};}
const libDate=t=>{const d=new Date(t*1000);return d.toLocaleDateString(undefined,{day:'2-digit',month:'2-digit',year:'2-digit'})+' '+d.toTimeString().slice(0,5);};
const LIB_SRC={gioco:'trovata dal gioco',salvata:'ricordata dall\'ultima volta',ricerca:'trovata tra le cartelle di Steam',manuale:'scelta a mano'};
function libStatusHTML(){const st=LIBV.st;const t=LIBV.at?new Date(LIBV.at).toTimeString().slice(0,8):'—';
  const ok=st?.userData;const sub=(o,l)=>o?`<span class="${o.ok?'pos':'w'}">${o.ok?'✓':'✗'} ${tr(l)}</span>`:'';
  const err=LIBV.ldErr||LIBV.svmErr;
  return `<div class="lstat${ok?'':' lbad'}"><span>${tr('Cartella del gioco')}</span>${ok?`<b class="mono" title="${esc(st.userData)}">${esc(st.userData)}</b><small class="muted">${tr(LIB_SRC[st.source]||'')}</small>${sub(st.settings,'setup')}${sub(st.telemetry,'telemetrie')}`:`<b class="w">${tr('non trovata')}</b>`}
    <small class="muted">${tr('ultima lettura')} ${t}</small>
    <details class="ldir"${ok&&!err?'':' open'}><summary>${tr('Scegli la cartella a mano')}</summary>
      <p class="small">${err?esc(err)+'. ':''}${tr('Incolla il percorso della cartella UserData di Le Mans Ultimate (o della cartella del gioco). Il programma legge solo telemetrie e setup lì dentro, solo da questo PC.')}</p>
      <div class="row"><input type="text" id="libDir" placeholder="D:\\SteamLibrary\\steamapps\\common\\Le Mans Ultimate\\UserData" value="${esc(ok?st.userData:'')}"><button type="button" class="btn" id="libDirGo">${tr('Usa questa cartella')}</button></div></details></div>`;}
function libHTML(){if(LIBV.err==='nobridge')return `<div class="panel lempty"><h2>${tr('La libreria legge le cartelle di Le Mans Ultimate')}</h2><p>${tr('Apri Data Engineer dal programma (bridge) su questo PC: qui compariranno da soli tutti i setup e tutte le telemetrie MoTeC del gioco.')}</p><button type="button" class="btn primary" id="libHand">${tr('Carica file a mano')}</button></div>`;
  if(!LIBV.ld)return `<div class="panel"><p class="muted">${tr('Leggo le cartelle del gioco…')}</p></div>`;
  const {L,S}=libRows();const sel=libSel();const selLd=(LIBV.ld||[]).find(f=>f.p===sel.ld);const venue=selLd?.venue||'';const selSv=(LIBV.svm||[]).find(f=>f.p===sel.svm);
  const tracks=[...new Set([...(LIBV.ld||[]).map(f=>f.venue).filter(Boolean),...(LIBV.svm||[]).map(f=>f.p.includes('/')?f.p.split('/')[0]:'').filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  const cars=[...new Set([...(LIBV.ld||[]).map(f=>f.car),...(LIBV.svm||[]).map(f=>libCarShort(f.car))].filter(Boolean))].sort();
  const seen=LS.get('lib:seen',0),imp=new Set(LS.get('lib:imp',[]));const assoc=sesSetupAll();
  const ldRow=f=>{const on=sel.ld===f.p;const open=!!byId('ld:'+f.name)||imp.has(f.p);const a=assoc[libSesKey(f)];const isNew=seen&&f.t*1000>seen&&!open;
    return `<label class="lrow${on?' on':''}${f.w?' lwr':''}"><input type="radio" name="libld" value="${esc(f.p)}"${on?' checked':''}${f.w?' disabled':''}>
      <span class="lmain"><b>${esc(f.venue||f.name)}</b><small>${esc([f.date&&f.time?f.date+' '+f.time.slice(0,5):libDate(f.t),f.car,(f.driver||'').replace(/#\d+$/,'')].filter(Boolean).join(' · '))}</small></span>
      <span class="ltags">${f.w?`<em class="lwrt">${tr('in scrittura')}</em>`:''}${isNew?`<em class="lnew">${tr('nuovo')}</em>`:''}${f.ref?`<em class="lref">${tr('Riferimento')}</em>`:''}${open?`<em>${tr('già importato')}</em>`:''}${a?`<em class="${a.st==='confermato'?'lnear':''}">${tr(a.st==='confermato'?'setup associato':'setup suggerito')}</em>`:''}<small>${(f.s/1048576).toFixed(0)} MB</small></span></label>`;};
  const fit=f=>!selLd?null:{track:libSameTrack(f.folder,venue),car:libCarMatch(f.car,selLd.car)};
  const svmRow=f=>{const on=sel.svm===f.p;const F=fit(f);const shop=libShopOf(f.name);const good=F&&F.track&&F.car!==false;
    return `<label class="lrow${on?' on':''}${good?' near':''}"><input type="radio" name="libsvm" value="${esc(f.p)}"${on?' checked':''}>
      <span class="lmain"><b>${esc(f.name)}</b><small>${esc([f.folder,libCarShort(f.car),libDate(f.t)].filter(Boolean).join(' · '))}</small></span>
      <span class="ltags">${shop?`<em>${esc(shop)}</em>`:''}${F?F.track&&F.car?`<em class="lnear">${tr('compatibile')}</em>`:F.track&&F.car===false?`<em class="lwrt">${tr('altra auto')}</em>`:F.track?`<em>${tr('stessa pista')}</em>`:'':''}</span></label>`;};
  // setups compatible with the chosen telemetry first: same track and same car, then same track, then the rest
  const rank=f=>{const F=fit(f);if(!F)return 0;return F.track&&F.car?0:F.track&&F.car!==false?1:F.track?2:3;};const S2=[...S].sort((a,b)=>rank(a)-rank(b)||b.t-a.t);
  const N=150;
  // telemetry grouped by track (most recent track first) or one list by date
  let ldList='';if(LIBV.grp&&!LIBV.track){const G={};L.slice(0,N).forEach(f=>(G[f.venue||tr('Pista sconosciuta')]??=[]).push(f));ldList=Object.entries(G).map(([v,a])=>`<div class="lgrp"><div class="lgh">${esc(v)} <small class="muted">${a.length}</small></div>${a.map(ldRow).join('')}</div>`).join('');}
  else ldList=L.slice(0,N).map(ldRow).join('');
  const last=(LIBV.ld||[]).filter(f=>!/^riferimenti\//i.test(f.p)&&!f.w).sort((a,b)=>b.t-a.t)[0];
  const pair=selLd&&selSv?(()=>{const F=fit({...selSv,folder:selSv.p.includes('/')?selSv.p.split('/')[0]:''});return F.track&&F.car?`<span class="pos">✓ ${tr('stessa pista e stessa auto')}</span>`:F.car===false?`<span class="w">⚠ ${tr('il setup è di un\'altra auto')}</span>`:!F.track?`<span class="w">⚠ ${tr('il setup è di un\'altra pista')}</span>`:`<span class="muted">${tr('auto non verificabile dal nome')}</span>`;})():'';
  const as=selLd?assoc[libSesKey(selLd)]:null;
  return `<div class="panel lhead"><div class="lfil"><label class="f lq">${tr('Cerca')}<input type="search" id="libQ" value="${esc(LIBV.q)}" placeholder="${esc(tr('pista, auto, pilota, data, nome del setup…'))}"></label>
      <label class="f">${tr('Pista')}<select id="libT"><option value="">${tr('Tutte le piste')}</option>${tracks.map(t=>`<option${t===LIBV.track?' selected':''}>${esc(t)}</option>`).join('')}</select></label>
      <label class="f">${tr('Auto')}<select id="libC"><option value="">${tr('Tutte le auto')}</option>${cars.map(c=>`<option${c===LIBV.car?' selected':''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" id="libGrp"${LIBV.grp?' checked':''}> ${tr('per pista')}</label>
      <button type="button" class="btn" id="libRe">${tr('Rileggi le cartelle')}</button>${last?`<button type="button" class="btn" id="libLast" title="${esc((last.venue||'')+' · '+(last.date||'')+' '+(last.time||'').slice(0,5))}">${tr('Apri ultima sessione')}</button>`:''}</div>
      ${libStatusHTML()}
      <p class="muted small">${(LIBV.ld||[]).length} ${tr('telemetrie')} · ${(LIBV.svm||[]).length} ${tr('setup')} ${tr('nelle cartelle del gioco')} · ${tr('la lista si aggiorna da sola quando arrivano file nuovi')}</p></div>
    <div class="lcols"><div class="panel lcol"><div class="panel-h"><h3>${tr('1. Telemetria')}</h3><span class="muted small">${L.length} · ${tr('le più recenti in alto')}</span></div>
        ${LIBV.ldErr?`<p class="warnbar">${esc(LIBV.ldErr)}</p>`:''}<div class="llist" role="radiogroup" aria-label="${esc(tr('Telemetria'))}">${ldList||`<p class="muted">${tr('Nessuna telemetria con questi filtri.')}</p>`}</div>${L.length>N?`<p class="muted small">${tr('Mostro le prime')} ${N}: ${tr('usa la ricerca per le altre.')}</p>`:''}</div>
      <div class="panel lcol"><div class="panel-h"><h3>${tr('2. Setup')}</h3><span class="muted small">${venue?tr('prima quelli compatibili con la telemetria scelta'):S.length}</span></div>
        ${LIBV.svmErr?`<p class="warnbar">${esc(LIBV.svmErr)}</p>`:''}<div class="llist" role="radiogroup" aria-label="${esc(tr('Setup'))}">${S2.slice(0,N).map(svmRow).join('')||`<p class="muted">${tr('Nessun setup con questi filtri.')}</p>`}</div>${S2.length>N?`<p class="muted small">${tr('Mostro i primi')} ${N}: ${tr('usa la ricerca per gli altri.')}</p>`:''}</div></div>
    <div class="lbar"><div><span>${tr('Telemetria')}</span><b>${selLd?esc([selLd.venue||selLd.p,selLd.date,(selLd.time||'').slice(0,5),selLd.car].filter(Boolean).join(' · ')):'—'}</b></div>
      <div><span>${tr('Setup')}</span><b>${selSv?esc(selSv.p.split('/').pop().replace(/\.svm$/i,'')+' · '+libCarShort(selSv.car)):tr('nessuno (facoltativo)')}</b>${pair?`<small>${pair}</small>`:''}${as?`<small class="muted">${tr('già associato a questa sessione')}: ${esc(as.name)} (${tr(as.st)})</small>`:''}</div>
      <button type="button" class="btn primary" id="libGo"${sel.ld?'':' disabled'}>${tr('Apri analisi')}</button></div>`;}
async function libOpenSetup(p){const r=await fetch('/svmlib/file?p='+encodeURIComponent(p),{cache:'no-store'});if(!r.ok)throw new Error(await r.text());
  const name=p.split('/').pop();const it=await addFile(name,await r.arrayBuffer(),{persist:true});relink();refreshAll();const s=$('#suFile');if(s&&it?.id){s.value=it.id;}return it;}
// one command: the telemetry, and the setup when one is chosen (kept as «abbinamento suggerito» until confirmed)
async function libGo(p){const sel=p?{ld:p,svm:''}:libSel();if(!sel.ld)return;const f=(LIBV.ld||[]).find(x=>x.p===sel.ld);if(f?.w){toast(tr('Il gioco sta ancora scrivendo questo file: riprova tra qualche secondo'));return;}
  const b=$('#libGo');if(b){b.disabled=true;b.setAttribute('aria-busy','true');b.textContent=tr('Apro…');}
  try{const S=await ldOpen(sel.ld,{select:true});if(!S)return;const imp=new Set(LS.get('lib:imp',[]));imp.add(sel.ld);LS.set('lib:imp',[...imp].slice(-300));
    if(sel.svm){const su=await libOpenSetup(sel.svm);try{sesSetupSuggest(S,su);}catch(e){}LS.set('su:tab','eng');$('#proNav .pn[data-n="eng"]')?.click();toast(tr('Aperti telemetria e setup'));}
    else showView('stint');}
  catch(e){toast(tr('Non riesco ad aprire il file')+': '+e.message);}finally{RENDER.lib&&curView()==='lib'&&RENDER.lib();}}
async function libSetDir(){const v=$('#libDir')?.value||'';try{const r=await fetch('/libdir',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dir:v})});const j=await r.json();
  if(!j.ok){toast(tr('Cartella non valida')+': '+(j.error||''));return;}toast(tr('Cartella salvata: la uso anche alle prossime aperture'));await libLoad(true);RENDER.lib();}catch(e){toast(tr('Non riesco a impostare la cartella')+': '+e.message);}}
// new or changed files show up by themselves while the Libreria is open
setInterval(async()=>{if(curView()!=='lib'||document.hidden||LIBV.err==='nobridge'||!LIBV.ld)return;const before=JSON.stringify((LIBV.ld||[]).map(f=>[f.p,f.s,f.t,f.w]));
  await libLoad(true);if(JSON.stringify((LIBV.ld||[]).map(f=>[f.p,f.s,f.t,f.w]))!==before&&!document.activeElement?.closest?.('#libBody input[type=search],#libDir'))RENDER.lib();},15000);
RENDER.lib=async()=>{const el=$('#libBody');if(!el)return;if(!LIBV.ld&&LIBV.err!=='nobridge'){el.innerHTML=libHTML();await libLoad();}
  el.innerHTML=libHTML();
  const q=$('#libQ');if(q){q.oninput=()=>{LIBV.q=q.value;const pos=q.selectionStart;RENDER.lib();const n=$('#libQ');n.focus();n.setSelectionRange(pos,pos);};}
  const t=$('#libT');if(t)t.onchange=()=>{LIBV.track=t.value;RENDER.lib();};const c=$('#libC');if(c)c.onchange=()=>{LIBV.car=c.value;RENDER.lib();};
  const g=$('#libGrp');if(g)g.onchange=()=>{LIBV.grp=g.checked;LS.set('lib:grp',g.checked);RENDER.lib();};
  $('#libRe')?.addEventListener('click',async()=>{await libLoad(true);RENDER.lib();});
  el.querySelectorAll('input[name="libld"]').forEach(i=>i.onchange=()=>{libSetSel({ld:i.value});RENDER.lib();});
  el.querySelectorAll('input[name="libsvm"]').forEach(i=>i.onchange=()=>{libSetSel({svm:i.value});RENDER.lib();});
  $('#libGo')?.addEventListener('click',()=>libGo());$('#libLast')?.addEventListener('click',()=>{const last=(LIBV.ld||[]).filter(f=>!/^riferimenti\//i.test(f.p)&&!f.w).sort((a,b)=>b.t-a.t)[0];if(last)libGo(last.p);});
  $('#libDirGo')?.addEventListener('click',libSetDir);
  $('#libHand')?.addEventListener('click',()=>$('#fileIn').click());
  // what was new is not new any more once seen
  if(LIBV.ld)setTimeout(()=>LS.set('lib:seen',Date.now()),4000);};
// with the bridge, the Libreria replaces «Aggiorna da LMU» (the browser folder picker): one way to get the game's files
setTimeout(()=>{try{if(isBridgeHost())document.documentElement.classList.add('brhost');}catch(e){}},0);

// ---------- Personalizza: Muretto on/off and dashed B ----------
setTimeout(()=>{const row=$('#mSettings .lookrow');if(!row||$('#liveOn'))return;
  row.insertAdjacentHTML('beforeend',`<label class="chk"><input type="checkbox" id="liveOn"> ${tr('Usa il Muretto (live con la squadra)')}</label><label class="chk"><input type="checkbox" id="bDashOn"> ${tr('Giro B tratteggiato nei grafici (utile se distingui male i colori)')}</label>`);
  const l=$('#liveOn');l.checked=!liveOff();l.onchange=()=>{LS.set('live:off',!l.checked);liveApplyOff();if(l.checked)liveStart();if(typeof proSync==="function")proSync();};
  const d=$('#bDashOn');d.checked=bDash();d.onchange=()=>{LS.set('bdash',d.checked);RENDER[curView()]?.();};},0);

(function(){const st=document.createElement('style');st.textContent=`
/* Muretto off: no menu entry, no Gara group, no Muretto card on the welcome page */
html.no-live #proNav .psec[data-s="live"],html.no-live #proNav .pn[data-n="live"],html.no-live .wcard.w2,html.no-live #t-live,html.no-live .mtab[data-group="live"]{display:none!important}
/* no OBS overlay and no TV direction */
#lvObs,.lvtabs [data-sub="tv"]{display:none!important}
html[data-look="pro"][data-pnav="libr"] .hero{display:none}
html.brhost #btnSync{display:none!important}
.lstat{display:flex;gap:6px 12px;align-items:center;flex-wrap:wrap;margin:12px 0 4px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:.88rem}.lstat>span:first-child{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.lstat>b{max-width:52ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lstat.lbad{border-color:var(--warn)}
.ldir{flex-basis:100%}.ldir summary{cursor:pointer;color:var(--muted)}.ldir .row{display:flex;gap:8px}.ldir input{flex:1;min-width:0;height:34px}
.lgrp{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}.lgh{font:600 .8rem var(--f-body);letter-spacing:.06em;text-transform:uppercase;color:var(--psil,#C9CDD3);padding:6px 2px 2px}
.ltags .lnew{color:var(--lapA);border-color:var(--lapA)}.ltags .lwrt{color:var(--warn);border-color:var(--warn)}.lrow.lwr{opacity:.7;cursor:progress}
.lbar small{display:block;font-size:.8rem}
html[data-look="pro"] input[type=search]{background:#09090A!important;border:1px solid var(--line)!important;border-radius:8px!important;color:var(--ink);height:38px;padding:0 12px;font:inherit}
/* Libreria */
.lhead .lfil{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}.lhead .lq{flex:1 1 260px}.lhead .lq input{width:100%}
.lcols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin:16px 0 90px}
.llist{display:flex;flex-direction:column;gap:4px;max-height:58vh;overflow:auto;padding-right:4px}
.lrow{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid var(--line);border-radius:8px;cursor:pointer;background:transparent}
.lrow:hover{border-color:var(--edge2);background:rgba(255,255,255,.03)}.lrow.on{border-color:var(--pacc,#C9A54C);background:var(--psel,#2A2416)}
.lrow input{accent-color:var(--pacc,#C9A54C);width:16px;height:16px;margin:0}
.lmain{min-width:0}.lmain b{display:block;color:var(--ink);font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lmain small{display:block;color:var(--muted);font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ltags{display:flex;gap:6px;align-items:center;white-space:nowrap}.ltags em{font-style:normal;font-size:.74rem;color:var(--psil,#C9CDD3);border:1px solid var(--line);border-radius:6px;padding:1px 6px}.ltags small{color:var(--faint);font-size:.74rem}
.ltags .lnear{color:#2BE38A;border-color:rgba(43,227,138,.4)}.ltags .lref{color:var(--pacc,#C9A54C);border-color:var(--pacc,#C9A54C)}
.lrow.near:not(.on){border-left:3px solid rgba(43,227,138,.6)}
.lbar{position:sticky;bottom:12px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:12px 16px;border:1px solid var(--pacc,#C9A54C);border-radius:12px;background:var(--panel);box-shadow:0 12px 40px rgba(0,0,0,.6);z-index:5}
.lbar>div{display:flex;flex-direction:column;min-width:0;flex:1 1 200px}.lbar span{font-size:.74rem;color:var(--muted)}.lbar b{font-size:.92rem;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lempty{text-align:left}.lempty h2{margin:0 0 6px}.lempty p{max-width:62ch}
@media (max-width:900px){.lcols{grid-template-columns:1fr}.llist{max-height:none}}
#mSettings .lookrow .chk{display:flex;gap:8px;align-items:center;margin-top:6px;flex-basis:100%}
`;document.head.appendChild(st);})();
