// ================= PRO LAYOUT: side menu, top bar with car / track / session, session strip =================
// Only the frame changes: every view, panel and number stays where it was. The old look ("carbon") stays in Personalizza.
const PRO_ICONS={
  dash:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  tel:'<path d="M2 12h4l2-6 4 13 3-9 2 4h5"/>',
  setb:'<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-2.5-2.5"/><path d="M3 21l6-6"/><path d="M9.3 17.7l-3-3 8-8a4 4 0 0 0 0 0"/>',
  eng:'<circle cx="12" cy="10" r="6"/><path d="M6 10H4v4h2M18 10h2v4h-2"/><path d="M9 20h6M12 16v4"/><path d="M9.5 9.5h5"/>',
  coach:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  ses:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  bop:'<path d="M12 3v18M5 7h14"/><path d="M5 7l-3 7h6zM19 7l-3 7h6z"/>',
  prog:'<path d="M4 20V12M10 20V6M16 20v-9M22 20H2"/>',
  live:'<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>'};
// [id, title, subtitle, views, setup tab]
const PRO_NAV=[['dash','Dashboard','Analisi e panoramica',['stint']],
  ['tel','Telemetria','Giri e confronti',['tele','lap','cmp']],
  ['setb','Setup Builder','Setup, confronto e generatore',['setup'],'set'],
  ['eng','Race Engineer','Diagnosi e piano di lavoro',['setup'],'eng'],
  ['coach','Coach','Guida curva per curva',['coach']],
  ['ses','Sessioni','Diario delle uscite',['diary']],
  ['bop','BOP','Bilanciamento prestazioni',['bop']],
  ['prog','Progressi','Stagione e statistiche',['prog']],
  ['live','Muretto','Live con la squadra',['live']]];
const proLook=()=>LS.get('look','pro')==='pro';
function proNavOf(v){if(v==='setup')return LS.get('su:tab','eng')==='eng'?'eng':'setb';return (PRO_NAV.find(n=>n[3].includes(v))||PRO_NAV[0])[0];}
function proSync(){if(!proLook())return;const v=curView(),id=proNavOf(v);const g=PRO_NAV.find(n=>n[0]===id);
  $$('#proNav .pn').forEach(b=>b.setAttribute('aria-current',b.dataset.n===id?'page':'false'));
  const nav=$('.tabs.subtabs');if(nav){$$('.tabs .tab').forEach(t=>t.hidden=!g[3].includes(t.dataset.view));nav.hidden=g[3].length<2;}
  const su=$('#suTabs');if(su){su.hidden=id==='eng';su.querySelectorAll('button').forEach(b=>b.hidden=b.dataset.t==='eng');}
  document.documentElement.dataset.pnav=id;}
function proBuild(){if($('#proNav'))return;
  const side=document.createElement('aside');side.id='proNav';side.setAttribute('aria-label',tr('Sezioni'));
  side.innerHTML=`<nav>${PRO_NAV.map(([id,t,s])=>`<button type="button" class="pn" data-n="${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${PRO_ICONS[id]}</svg><span><b>${id==='live'?'<i class="livedot"></i>':''}${tr(t)}</b><small>${tr(s)}</small></span></button>`).join('')}</nav>
    <div class="pfoot" data-noi18n>DATA<br>DRIVES<br>PERFORMANCE</div>`;
  $('header.top').after(side);
  side.querySelectorAll('.pn').forEach(b=>b.onclick=()=>{const g=PRO_NAV.find(n=>n[0]===b.dataset.n);
    if(g[4]){const cur=LS.get('su:tab','eng');if(g[4]==='eng')LS.set('su:tab','eng');else if(cur==='eng')LS.set('su:tab','set');}
    const last=LS.get('pgrp:'+g[0],g[3][0]);showView(g[3].includes(last)?last:g[3][0]);if(g[4]&&typeof suTabsApply==='function')suTabsApply();proSync();window.scrollTo({top:0});});
  // the second row of tabs goes on top of the page
  const sub=$('.tabs.subtabs');if(sub)$('main').prepend(sub);
  // car and track filters next to the session menu
  const g=$('#gSess');if(g&&!$('#proCar')){const w=document.createElement('div');w.className='psel';
    w.innerHTML=`<label class="pf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16l2-5 4-2h6l4 3 2 1v3H3z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="17" cy="16.5" r="1.8"/></svg><select id="proCar" aria-label="${tr('Auto')}"></select></label>
      <label class="pf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18c-2-3 0-6 3-6s4-5 7-6 5 2 3 5-6 2-6 5 4 4 1 5-6 0-8-3z"/></svg><select id="proTrack" aria-label="${tr('Pista')}"></select></label>
      <label class="pf pfs"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg></label>`;
    $('.top-in .brand').after(w);w.querySelector('.pfs').append(g);
    $('#proCar').onchange=$('#proTrack').onchange=()=>{LS.set('pro:car',$('#proCar').value);LS.set('pro:track',$('#proTrack').value);proFilter(true);};}
  const st=document.createElement('div');st.id='proSync';st.className='psync';$('.hdr-tools').append(st);
  const lb=$('#btnLoad');if(lb)lb.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v5h16v-5"/></svg>${tr('Carica dati')}`;}
const proCarOf=S=>(S.merged?.d?.car||S.meta?.car||'').trim()||tr('Auto non indicata');
const proTrackOf=S=>(S.meta?.venue||'').trim()||tr('Pista');
// the two filters only narrow the session menu; the session you pick is the same as before
function proFilter(pick){const g=$('#gSess'),c=$('#proCar'),t=$('#proTrack');if(!g||!c||!t)return;const L=lds();
  const cars=[...new Set(L.map(proCarOf))].sort(),tracks=[...new Set(L.filter(S=>!c.value||proCarOf(S)===c.value).map(proTrackOf))].sort();
  const keep=(sel,list,want)=>{sel.innerHTML=`<option value="">${tr(sel===c?'Tutte le auto':'Tutte le piste')}</option>`+list.map(x=>`<option>${esc(x)}</option>`).join('');sel.value=list.includes(want)?want:'';};
  keep(c,cars,LS.get('pro:car',''));keep(t,tracks,LS.get('pro:track',''));
  const ok=o=>{if(o.value.startsWith('xml:')||!o.value)return !c.value&&!t.value;const S=byId(o.value);return !S||(!c.value||proCarOf(S)===c.value)&&(!t.value||proTrackOf(S)===t.value);};
  [...g.options].forEach(o=>o.hidden=!ok(o));
  if(pick&&g.selectedOptions[0]?.hidden){const f=[...g.options].find(o=>!o.hidden);if(f){g.value=f.value;g.onchange&&g.onchange();}}}
function proSyncChip(){const el=$('#proSync');if(!el)return;const br=isBridgeHost();const on=br&&typeof LIVE!=='undefined'&&LIVE.status?.local==='on';
  const last=typeof LDSYNC!=='undefined'&&LDSYNC.last?new Date(LDSYNC.last):null;
  el.className='psync '+(on?'on':br?'off':'file');
  el.innerHTML=`<b><i></i>${tr(on?'Bridge collegato':br?'Bridge in attesa del gioco':'Solo file')}</b><small>${last?tr('Ultimo controllo')+' '+last.toTimeString().slice(0,5):tr(br?'Telemetria dalla cartella di LMU':'Carica i file a mano')}</small>`;}

// ---------- session strip: the same facts as before, in one row like a timing screen ----------
function proCarSvg(){return `<svg viewBox="0 0 120 40" class="pcar" aria-hidden="true"><path d="M4 30c2-6 8-8 16-9l18-7c8-3 20-4 30-3l14 4c8 1 16 3 24 6 6 2 9 5 10 9z" fill="url(#pcg)" stroke="rgba(255,255,255,.35)" stroke-width=".8"/><path d="M44 15l10-4h12l6 5z" fill="#0B1320" stroke="rgba(255,255,255,.4)" stroke-width=".6"/><path d="M98 19l14-6v9" fill="none" stroke="#E5354B" stroke-width="2"/><circle cx="26" cy="31" r="6" fill="#0B0F16" stroke="#3A4558"/><circle cx="92" cy="31" r="6" fill="#0B0F16" stroke="#3A4558"/><defs><linearGradient id="pcg" x1="0" x2="1"><stop offset="0" stop-color="#2A3446"/><stop offset=".6" stop-color="#5B6578"/><stop offset="1" stop-color="#C8102E"/></linearGradient></defs></svg>`;}
function proTrackSvg(S){try{const d=typeof dashData==='function'?dashData(S):null;if(!d?.xy)return '';const P=dashFit(d.xy,52,34,3);return `<svg viewBox="0 0 52 34" class="ptrk" aria-hidden="true"><path d="${dPath(P)}Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;}catch(e){return '';}}
function proStrip(){const h=$('#hero'),a=active();if(!proLook()||!h||!a?.S)return;const S=a.S,m=S.meta||{},c=S.cond||{};
  const B=S.best,L=S.laps.filter(l=>l.complete);let ideal=null;
  try{const sec=L.map(l=>twLapSectors(S,l)).filter(Boolean);if(sec.length)ideal=[0,1,2].map(k=>Math.min(...sec.map(s=>s[k]))).reduce((x,y)=>x+y,0);}catch(e){}
  const ses=S.merged?.sess?.name||tr('Telemetria MoTeC');const live=Date.now()-(S.addedAt||0)<15*60e3;
  const valid=L.filter(l=>!l.invalid).length;const q=Math.round(Math.min(1,valid/5)*70+(S.merged?20:0)+(m.venue?10:0));
  const tk=c.track?fx(c.track.avg,0):'—';const wx=c.label||'';
  const keep=[...h.querySelectorAll('#btnReport,#btnDebrief')];
  h.classList.add('pstrip');
  h.innerHTML=`<div class="ps ps1"><div class="pl">${tr('Sessione attuale')}</div><div class="pn1">${esc(ses)}${live?`<span class="plive"><i></i>${tr('Appena arrivata')}</span>`:''}</div><div class="pm">${esc(m.date||'')} ${esc((m.time||'').slice(0,5))} · ${esc((m.driver||'').replace(/#\d+$/,''))}</div></div>
   <div class="ps ps2">${proCarSvg()}<div><b>${esc(proCarOf(S))}</b><small>${esc(m.car&&m.car!==proCarOf(S)?m.car:'')}</small></div></div>
   <div class="ps ps2">${proTrackSvg(S)}<div><b>${esc(proTrackOf(S))}</b><small>${fx((S.trackLen||0)/1000,3)} km</small></div></div>
   <div class="ps"><div class="pl">${tr('Miglior giro')}</div><div class="pv best">${B?fmtLap(B.time):'—'}</div><small>${B?tr('Giro')+' '+B.num:''}</small></div>
   <div class="ps"><div class="pl">${tr('Delta ideale')}</div><div class="pv good">${B&&ideal?'−'+(B.time-ideal).toFixed(3):'—'}</div><small>${ideal?tr('Ideale')+' '+fmtLap(ideal):''}</small></div>
   <div class="ps"><div class="pl">${tr('Affidabilità dati')}</div><div class="pv">${q}%</div><div class="pbar"><i style="width:${q}%"></i></div><small>${valid} ${tr('giri validi')}${S.merged?' · .xml':''}</small></div>
   <div class="ps pwx"><svg viewBox="0 0 24 24" aria-hidden="true">${c.wet&&c.wet.max>0?'<path d="M7 15a4 4 0 0 1 .5-8A6 6 0 0 1 19 9a3 3 0 0 1-1 6z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>':'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'}</svg><div><div class="pl">${tr('Pista')}</div><div class="pv">${tk}<small>°C</small></div><small>${esc(tr(wx))}${c.air?' · '+tr('aria')+' '+fx(c.air.avg,0)+'°':''}</small></div></div>
   <div class="ps pbtn"></div>`;
  const pb=h.querySelector('.pbtn');keep.forEach(b=>pb.append(b));}
(function(){const rh=renderHero;window.renderHero=renderHero=function(){const h=$('#hero');h&&h.classList.remove('pstrip');rh();try{proStrip();}catch(e){console.error(e);}};})();
(function(){const sv=showView;window.showView=showView=function(v){sv(v);const id=proNavOf(v);LS.set('pgrp:'+id,v);proSync();};})();
(function(){const fs=fillSelects;window.fillSelects=fillSelects=function(){fs();try{proFilter(false);}catch(e){}};})();
(function(){const sa=window.suTabsApply;if(typeof sa==='function')window.suTabsApply=suTabsApply=function(){sa();proSync();};})();
// the store sets addedAt only on new files: mark the session that arrives while the app is open
(function(){const af=window.addFile;if(typeof af==='function')window.addFile=addFile=async function(...a){const it=await af(...a);try{if(it&&it.kind==='ld'&&!it.addedAt)it.addedAt=Date.now();}catch(e){}return it;};})();

function proApply(){const on=proLook();document.documentElement.dataset.look=on?'pro':'carbon';if(on){proBuild();proSync();proSyncChip();proFilter(false);}
  const n=$('#proNav');if(n)n.hidden=!on;const sub=$('.tabs.subtabs');if(sub&&!on&&!$('.top').contains(sub))$('.top').append(sub);if(sub&&on&&!$('main').contains(sub))$('main').prepend(sub);}
setTimeout(()=>{proApply();renderHero();setInterval(proSyncChip,5000);},0);

// ---------- Personalizza: choose the look ----------
setTimeout(()=>{const h=$('#mSettings .mbox>.panel-h');if(!h||$('#lookSel'))return;
  h.insertAdjacentHTML('afterend',`<div class="lookrow"><label class="f">${tr('Stile dell\'app')}<select id="lookSel"><option value="pro">${tr('Pro · blu notte con menu laterale')}</option><option value="carbon">${tr('Carbon · rosso e nero')}</option></select></label></div>`);
  const s=$('#lookSel');s.value=LS.get('look','pro');s.onchange=()=>{LS.set('look',s.value);proApply();showView(curView());};},0);
