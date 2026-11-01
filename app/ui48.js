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
PRO_GROUPS[0][1].splice(1,0,'libr');
(function(){const tabs=$('.tabs');if(tabs&&!$('#t-lib')){const b=document.createElement('button');b.className='tab';b.setAttribute('role','tab');b.id='t-lib';b.dataset.view='lib';b.setAttribute('aria-selected','false');b.textContent=tr('Libreria');b.onclick=()=>showView('lib');tabs.appendChild(b);}
  const m=$('main');if(m&&!$('#v-lib')){const s=document.createElement('section');s.className='view';s.id='v-lib';s.hidden=true;s.innerHTML='<div id="libBody"></div>';m.appendChild(s);}})();

const LIBV={ld:null,svm:null,at:0,err:'',q:'',track:'',car:''};
const libNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
// a setup folder (e.g. «Monza») belongs to a track name (e.g. «Autodromo Nazionale Monza») when they share a word
function libSameTrack(folder,venue){const a=libNorm(folder),b=libNorm(venue);if(!a||!b)return false;if(a.includes(b)||b.includes(a))return true;const B=new Set(b.split(' ').filter(w=>w.length>=4));return a.split(' ').some(w=>w.length>=4&&B.has(w));}
const libCarShort=c=>String(c||'').replace(/_/g,' ').replace(/\s+(Hypercar|LMGT3|LMP2|LMP3|GTE)\b.*$/i,'').replace(/\bWEC\d{4}\b/,'').trim()||String(c||'');
const libShopOf=n=>{for(const [s,re] of (typeof SHOPS!=='undefined'?SHOPS:[]))if(re.test(n))return s;return '';};
async function libLoad(force){if(!isBridgeHost()){LIBV.err='nobridge';return;}if(!force&&LIBV.ld&&Date.now()-LIBV.at<30000)return;
  try{const [a,b]=await Promise.all([fetch('/ldlib',{cache:'no-store'}).then(r=>r.json()),fetch('/svmlib',{cache:'no-store'}).then(r=>r.json())]);
    LIBV.ld=a.ok?a.files:[];LIBV.svm=b.ok?b.files:[];LIBV.err=!a.ok&&!b.ok?(a.error||b.error||''):'';LIBV.ldErr=a.ok?'':a.error;LIBV.svmErr=b.ok?'':b.error;LIBV.at=Date.now();}
  catch(e){LIBV.err=e.message;}}
function libSel(){return LS.get('libsel',{ld:'',svm:''});}
function libSetSel(o){LS.set('libsel',{...libSel(),...o});}
function libRows(){const q=libNorm(LIBV.q);const T=LIBV.track,C=LIBV.car;
  const L=(LIBV.ld||[]).map(f=>({...f,venue:f.venue||'',ref:/^riferimenti\//i.test(f.p),name:f.p.split('/').pop()}))
    .filter(f=>(!T||libSameTrack(T,f.venue)||libNorm(f.venue)===libNorm(T))&&(!C||libNorm(f.car).includes(libNorm(C)))&&(!q||libNorm(f.name+' '+f.venue+' '+f.car+' '+f.driver).includes(q)))
    .sort((a,b)=>b.t-a.t);
  const S=(LIBV.svm||[]).map(f=>{const parts=f.p.split('/');return {...f,folder:parts.length>1?parts[0]:'',name:parts.pop().replace(/\.svm$/i,'')};})
    .filter(f=>(!T||libSameTrack(f.folder,T))&&(!C||libNorm(f.car).includes(libNorm(C)))&&(!q||libNorm(f.name+' '+f.folder+' '+f.car).includes(q)))
    .sort((a,b)=>b.t-a.t);
  return {L,S};}
const libDate=t=>{const d=new Date(t*1000);return d.toLocaleDateString(undefined,{day:'2-digit',month:'2-digit',year:'2-digit'})+' '+d.toTimeString().slice(0,5);};
function libHTML(){if(LIBV.err==='nobridge')return `<div class="panel lempty"><h2>${tr('La libreria legge le cartelle di Le Mans Ultimate')}</h2><p>${tr('Apri Data Engineer dal programma (bridge) su questo PC: qui compariranno da soli tutti i setup e tutte le telemetrie MoTeC del gioco.')}</p><button type="button" class="btn primary" id="libHand">${tr('Carica file a mano')}</button></div>`;
  if(!LIBV.ld)return `<div class="panel"><p class="muted">${tr('Leggo le cartelle del gioco…')}</p></div>`;
  const {L,S}=libRows();const sel=libSel();const selLd=(LIBV.ld||[]).find(f=>f.p===sel.ld);const venue=selLd?.venue||'';
  const tracks=[...new Set([...(LIBV.ld||[]).map(f=>f.venue).filter(Boolean),...(LIBV.svm||[]).map(f=>f.p.includes('/')?f.p.split('/')[0]:'').filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  const cars=[...new Set([...(LIBV.ld||[]).map(f=>f.car),...(LIBV.svm||[]).map(f=>libCarShort(f.car))].filter(Boolean))].sort();
  const ldRow=f=>{const on=sel.ld===f.p;const open=!!byId('ld:'+f.name);return `<label class="lrow${on?' on':''}"><input type="radio" name="libld" value="${esc(f.p)}"${on?' checked':''}>
      <span class="lmain"><b>${esc(f.venue||f.name)}</b><small>${esc([f.date&&f.time?f.date+' '+f.time.slice(0,5):libDate(f.t),f.car,f.driver].filter(Boolean).join(' · '))}</small></span>
      <span class="ltags">${f.ref?`<em class="lref">${tr('Riferimento')}</em>`:''}${open?`<em>${tr('aperta')}</em>`:''}<small>${(f.s/1048576).toFixed(0)} MB</small></span></label>`;};
  const svmRow=f=>{const on=sel.svm===f.p;const near=venue&&libSameTrack(f.folder,venue);const shop=libShopOf(f.name);return `<label class="lrow${on?' on':''}${near?' near':''}"><input type="radio" name="libsvm" value="${esc(f.p)}"${on?' checked':''}>
      <span class="lmain"><b>${esc(f.name)}</b><small>${esc([f.folder,libCarShort(f.car),libDate(f.t)].filter(Boolean).join(' · '))}</small></span>
      <span class="ltags">${shop?`<em>${esc(shop)}</em>`:''}${near?`<em class="lnear">${tr('stessa pista')}</em>`:''}</span></label>`;};
  // setups of the chosen telemetry's track first
  const S2=venue?[...S.filter(f=>libSameTrack(f.folder,venue)),...S.filter(f=>!libSameTrack(f.folder,venue))]:S;
  const N=120;
  return `<div class="panel lhead"><div class="lfil"><label class="f lq">${tr('Cerca')}<input type="search" id="libQ" value="${esc(LIBV.q)}" placeholder="${esc(tr('pista, auto, nome del setup…'))}"></label>
      <label class="f">${tr('Pista')}<select id="libT"><option value="">${tr('Tutte le piste')}</option>${tracks.map(t=>`<option${t===LIBV.track?' selected':''}>${esc(t)}</option>`).join('')}</select></label>
      <label class="f">${tr('Auto')}<select id="libC"><option value="">${tr('Tutte le auto')}</option>${cars.map(c=>`<option${c===LIBV.car?' selected':''}>${esc(c)}</option>`).join('')}</select></label>
      <button type="button" class="btn" id="libRe">${tr('Rileggi le cartelle')}</button></div>
      <p class="muted small">${(LIBV.ld||[]).length} ${tr('telemetrie')} · ${(LIBV.svm||[]).length} ${tr('setup')} ${tr('nelle cartelle del gioco')}</p></div>
    <div class="lcols"><div class="panel lcol"><div class="panel-h"><h3>${tr('1. Telemetria')}</h3><span class="muted small">${L.length} · ${tr('le più recenti in alto')}</span></div>
        ${LIBV.ldErr?`<p class="warnbar">${esc(LIBV.ldErr)}</p>`:''}<div class="llist" role="radiogroup" aria-label="${esc(tr('Telemetria'))}">${L.slice(0,N).map(ldRow).join('')||`<p class="muted">${tr('Nessuna telemetria con questi filtri.')}</p>`}</div>${L.length>N?`<p class="muted small">${tr('Mostro le prime')} ${N}: ${tr('usa la ricerca per le altre.')}</p>`:''}</div>
      <div class="panel lcol"><div class="panel-h"><h3>${tr('2. Setup')}</h3><span class="muted small">${venue?tr('prima quelli di questa pista'):S.length}</span></div>
        ${LIBV.svmErr?`<p class="warnbar">${esc(LIBV.svmErr)}</p>`:''}<div class="llist" role="radiogroup" aria-label="${esc(tr('Setup'))}">${S2.slice(0,N).map(svmRow).join('')||`<p class="muted">${tr('Nessun setup con questi filtri.')}</p>`}</div>${S2.length>N?`<p class="muted small">${tr('Mostro i primi')} ${N}: ${tr('usa la ricerca per gli altri.')}</p>`:''}</div></div>
    <div class="lbar"><div><span>${tr('Telemetria')}</span><b>${selLd?esc((selLd.venue||selLd.p)+' · '+(selLd.date||'')):'—'}</b></div><div><span>${tr('Setup')}</span><b>${sel.svm?esc(sel.svm.split('/').pop().replace(/\.svm$/i,'')):'—'}</b></div>
      <button type="button" class="btn" id="libOpenT"${sel.ld?'':' disabled'}>${tr('Apri la telemetria')}</button><button type="button" class="btn primary" id="libGo"${sel.ld&&sel.svm?'':' disabled'}>${tr('Analizza con Race Engineer')}</button></div>`;}
async function libOpenSetup(p){const r=await fetch('/svmlib/file?p='+encodeURIComponent(p),{cache:'no-store'});if(!r.ok)throw new Error(await r.text());
  const name=p.split('/').pop();const it=await addFile(name,await r.arrayBuffer(),{persist:true});relink();refreshAll();const s=$('#suFile');if(s&&it?.id){s.value=it.id;}return it;}
async function libGo(withSetup){const sel=libSel();if(!sel.ld)return;const b=$(withSetup?'#libGo':'#libOpenT');if(b){b.disabled=true;b.setAttribute('aria-busy','true');b.textContent=tr('Apro…');}
  try{const S=await ldOpen(sel.ld,{select:true});if(!S)return;
    if(withSetup&&sel.svm){await libOpenSetup(sel.svm);LS.set('su:tab','eng');$('#proNav .pn[data-n="eng"]')?.click();toast(tr('Aperti telemetria e setup'));}
    else showView('stint');}
  catch(e){toast(tr('Non riesco ad aprire il file')+': '+e.message);}finally{RENDER.lib&&curView()==='lib'&&RENDER.lib();}}
RENDER.lib=async()=>{const el=$('#libBody');if(!el)return;if(!LIBV.ld&&LIBV.err!=='nobridge'){el.innerHTML=libHTML();await libLoad();}
  el.innerHTML=libHTML();
  const q=$('#libQ');if(q){q.oninput=()=>{LIBV.q=q.value;const pos=q.selectionStart;RENDER.lib();const n=$('#libQ');n.focus();n.setSelectionRange(pos,pos);};}
  const t=$('#libT');if(t)t.onchange=()=>{LIBV.track=t.value;RENDER.lib();};const c=$('#libC');if(c)c.onchange=()=>{LIBV.car=c.value;RENDER.lib();};
  $('#libRe')?.addEventListener('click',async()=>{await libLoad(true);RENDER.lib();});
  el.querySelectorAll('input[name="libld"]').forEach(i=>i.onchange=()=>{libSetSel({ld:i.value});RENDER.lib();});
  el.querySelectorAll('input[name="libsvm"]').forEach(i=>i.onchange=()=>{libSetSel({svm:i.value});RENDER.lib();});
  $('#libOpenT')?.addEventListener('click',()=>libGo(false));$('#libGo')?.addEventListener('click',()=>libGo(true));
  $('#libHand')?.addEventListener('click',()=>$('#fileIn').click());};

// ---------- Personalizza: Muretto on/off and dashed B ----------
setTimeout(()=>{const row=$('#mSettings .lookrow');if(!row||$('#liveOn'))return;
  row.insertAdjacentHTML('beforeend',`<label class="chk"><input type="checkbox" id="liveOn"> ${tr('Usa il Muretto (live con la squadra)')}</label><label class="chk"><input type="checkbox" id="bDashOn"> ${tr('Giro B tratteggiato nei grafici (utile se distingui male i colori)')}</label>`);
  const l=$('#liveOn');l.checked=!liveOff();l.onchange=()=>{LS.set('live:off',!l.checked);liveApplyOff();if(l.checked)liveStart();if(typeof proSync==="function")proSync();};
  const d=$('#bDashOn');d.checked=bDash();d.onchange=()=>{LS.set('bdash',d.checked);RENDER[curView()]?.();};},0);

(function(){const st=document.createElement('style');st.textContent=`
/* Muretto off: no menu entry, no Gara group, no Muretto card on the welcome page */
html.no-live #proNav .pn[data-n="live"],html.no-live #proNav .pgh:nth-last-of-type(1),html.no-live .wcard.w2,html.no-live #t-live,html.no-live .mtab[data-group="live"]{display:none!important}
/* no OBS overlay and no TV direction */
#lvObs,.lvtabs [data-sub="tv"]{display:none!important}
html[data-look="pro"][data-pnav="libr"] .hero{display:none}
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
