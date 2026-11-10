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
  tech:'<path d="M3 18h18"/><path d="M6 18V9l3-3 3 3v9"/><path d="M14 18v-6l3-3 3 3v6"/><path d="M9 6V3M17 9V5"/>',
  live:'<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>'};
// [id, title, subtitle, views, setup tab]
const PRO_NAV=[['dash','Dashboard','Analisi e panoramica',['stint']],
  ['tel','Telemetria','Giri e confronti',['tele','lap','cmp']],
  ['coach','Coach','Guida curva per curva',['coach']],
  ['ses','Sessioni','Diario delle uscite',['diary']],
  ['prog','Progressi','Stagione e statistiche',['prog']],
  ['eng','Race Engineer','Diagnosi e piano di lavoro',['setup'],'eng'],
  ['tech','Analisi tecnica','Sospensioni, piattaforma, qualità dati',['setup'],'dyn'],
  ['setb','Setup Builder','Setup, confronto e generatore',['setup'],'set'],
  ['bop','BOP','Bilanciamento prestazioni',['bop']],
  ['live','Muretto','Live con la squadra',['live']]];
// four sections in the side menu (2.22); the pages of the open section are listed under it, and on narrow screens
// in a row of tabs at the top of the page. Every page keeps its own button (data-n), so code that opens a page by
// clicking it keeps working.
const PRO_SEC=[['sess','Sessione','Dati, telemetria e coach',['dash','tel','coach','ses','prog']],
  ['setup','Setup','Ingegnere, analisi e builder',['eng','tech','setb','bop']],
  ['live','Muretto','Live con la squadra',['live']],
  ['libr','Libreria','Setup e telemetrie del PC',['libr']]];
const proSecOf=id=>PRO_SEC.find(s=>s[3].includes(id))||PRO_SEC[0];
// open a page by its id (dash, tel, eng, tech, setb, live, libr …)
function proGo(id){const b=$(`#proNav .pn[data-n="${id}"]`);if(b)b.click();}
// one look since 2.23 (Grafite): kept as a function because older code asks it
const proLook=()=>true;
function proNavOf(v){if(v==='setup'){const t=LS.get('su:tab','eng');return t==='eng'?'eng':t==='dyn'?'tech':'setb';}return (PRO_NAV.find(n=>n[3].includes(v))||PRO_NAV[0])[0];}
function proSync(){if(!proLook())return;const v=curView(),id=proNavOf(v);const g=PRO_NAV.find(n=>n[0]===id);
  $$('#proNav .pn[data-n]').forEach(b=>b.setAttribute('aria-current',b.dataset.n===id?'page':'false'));
  const sec=proSecOf(id);$$('#proNav .psec').forEach(e=>{const on=e.dataset.s===sec[0];e.classList.toggle('on',on);e.querySelector('.pmain')?.setAttribute('aria-current',on?'true':'false');});
  // the pages of this section as tabs at the top of the page (shown when the side menu is narrow)
  const st=$('#proSecTabs');if(st){const h=sec[3].length>1?sec[3].map(n=>{const g=PRO_NAV.find(x=>x[0]===n);return g?`<button type="button" class="pst" data-go="${n}" aria-current="${n===id?'page':'false'}">${tr(g[1])}</button>`:'';}).join(''):'';if(st._h!==h){st.innerHTML=h;st._h=h;st.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>proGo(b.dataset.go));}st.hidden=!h;}
  const nav=$('.tabs.subtabs');if(nav){$$('.tabs .tab').forEach(t=>t.hidden=!g[3].includes(t.dataset.view));nav.hidden=g[3].length<2;}
  const su=$('#suTabs');if(su){su.hidden=id==='eng'||id==='tech';su.querySelectorAll('button').forEach(b=>b.hidden=b.dataset.t==='eng'||b.dataset.t==='dyn');}
  document.documentElement.dataset.pnav=id;}
function proBuild(){if($('#proNav'))return;
  const side=document.createElement('aside');side.id='proNav';side.setAttribute('aria-label',tr('Sezioni'));
  const page=id=>{const n=PRO_NAV.find(x=>x[0]===id);return n?`<button type="button" class="pn psb" data-n="${id}"><span><b>${tr(n[1])}</b></span></button>`:'';};
  const icon={sess:PRO_ICONS.dash,setup:PRO_ICONS.setb,live:PRO_ICONS.live,libr:PRO_ICONS.libr};
  side.innerHTML=`<nav>${PRO_SEC.map(([s,t,d,ids])=>`<div class="psec" data-s="${s}"><button type="button" class="pn pmain" data-s="${s}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon[s]||''}</svg><span><b>${s==='live'?'<i class="livedot"></i>':''}${tr(t)}</b><small>${tr(d)}</small></span></button>
      <div class="psub"${ids.length>1?'':' hidden'}>${ids.map(page).join('')}</div></div>`).join('')}</nav>
    <div class="pfoot" data-noi18n>DATA<br>DRIVES<br>PERFORMANCE</div>`;
  $('header.top').after(side);
  // a section opens on the page used last in it
  side.querySelectorAll('.pmain').forEach(b=>b.onclick=()=>{const S=PRO_SEC.find(x=>x[0]===b.dataset.s);const last=LS.get('psec:'+S[0],S[3][0]);proGo(S[3].includes(last)?last:S[3][0]);});
  side.querySelectorAll('.pn[data-n]').forEach(b=>b.onclick=()=>{const g=PRO_NAV.find(n=>n[0]===b.dataset.n);LS.set('psec:'+proSecOf(g[0])[0],g[0]);
    if(g[4]){const cur=LS.get('su:tab','eng');if(g[4]==='eng'||g[4]==='dyn')LS.set('su:tab',g[4]);else if(cur==='eng'||cur==='dyn')LS.set('su:tab','set');}
    const last=LS.get('pgrp:'+g[0],g[3][0]);showView(g[3].includes(last)?last:g[3][0]);if(g[4]&&typeof suTabsApply==='function')suTabsApply();proSync();window.scrollTo({top:0});});
  // the second row of tabs goes on top of the page
  const sub=$('.tabs.subtabs');if(sub)$('main').prepend(sub);
  if(!$('#proSecTabs')){const t=document.createElement('nav');t.id='proSecTabs';t.className='psectabs';t.setAttribute('aria-label',tr('Pagine della sezione'));t.hidden=true;$('main').prepend(t);}
  // car and track filters next to the session menu
  const g=$('#gSess');if(g&&!$('#proCar')){const w=document.createElement('div');w.className='psel';
    w.innerHTML=`<label class="pf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16l2-5 4-2h6l4 3 2 1v3H3z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="17" cy="16.5" r="1.8"/></svg><select id="proCar" aria-label="${tr('Auto')}"></select></label>
      <label class="pf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18c-2-3 0-6 3-6s4-5 7-6 5 2 3 5-6 2-6 5 4 4 1 5-6 0-8-3z"/></svg><select id="proTrack" aria-label="${tr('Pista')}"></select></label>
      <label class="pf pfs"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg></label>`;
    $('.top-in .brand').after(w);w.querySelector('.pfs').append(g);
    w.insertAdjacentHTML('beforeend',`<button type="button" class="btn icon pfbtn" aria-expanded="false" title="${esc(tr('Filtri auto e pista'))}" aria-label="${esc(tr('Filtri auto e pista'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg></button>`);
    w.querySelector('.pfbtn').onclick=e=>{const o=!w.classList.contains('pfopen');w.classList.toggle('pfopen',o);e.currentTarget.setAttribute('aria-expanded',o);};
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
  el.className='psync '+(on?'on':br?'off':'file');const old=last&&Date.now()-last>120e3;
  el.innerHTML=`<b><i></i>${tr(on?'Bridge collegato':br?'Bridge in attesa del gioco':'Solo file')}</b><small${old?' class="dold"':''}>${last?tr('Ultimo controllo')+' '+last.toTimeString().slice(0,5):tr(br?'Telemetria dalla cartella di LMU':'Carica i file a mano')}</small>`;}

// ---------- session strip: pace, distance from the reference, main problem; the rest in one compact line ----------
// how much the numbers can be trusted, said in words with the reasons (no made-up percentage)
function dataQuality(S){const L=S.laps.filter(l=>l.complete&&l.type==='lanciato');const valid=L.filter(l=>!l.invalid).length;const c=S.cond||{};
  let lv=valid>=5?2:valid>=2?1:0;const why=[`${valid} ${valid===1?tr('giro lanciato valido'):tr('giri lanciati validi')}`];
  const tr_=c.track&&Number.isFinite(c.track.max-c.track.min)?c.track.max-c.track.min:0;
  if(tr_>4){lv=Math.max(0,lv-1);why.push(`${tr('pista cambiata di')} ${fx(tr_,0)} °C`);}else if(c.track)why.push(tr('pista stabile'));
  if(c.wet&&c.wet.max>0&&c.wet.min!=null&&c.wet.max-c.wet.min>0.1){lv=Math.max(0,lv-1);why.push(tr('asciutto e bagnato mischiati'));}
  why.push(S.merged?tr('giri non validi ufficiali dal .xml'):tr('senza .xml: giri non validi stimati'));
  return {lv,label:tr(['Bassa','Media','Alta'][lv]),why};}
// pace: median of the good flying laps (valid, within 107% of the best); one lap = that lap
function proPace(S){const b=S.best;if(!b)return null;let L=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid&&l.time<=b.time*1.07);if(!L.length)L=[b];return {t:median(L.map(l=>l.time)),n:L.length};}
// the lap to measure against: a reference from «Riferimenti», else your fastest other session here with this car, else your best lap
function proRef(S){const v=S.meta?.venue,car=proCarOf(S);const O=lds().filter(x=>x!==S&&!x.sample&&x.best&&x.meta?.venue===v);
  const R=O.filter(x=>LS.get('ref:'+x.id,false)).sort((a,b)=>a.best.time-b.best.time)[0];if(R)return {t:R.best.time,k:'ref',name:R.label||R.id};
  const M=O.filter(x=>proCarOf(x)===car).sort((a,b)=>a.best.time-b.best.time)[0];if(M&&M.best.time<(S.best?.time??Infinity))return {t:M.best.time,k:'pb',name:M.label||M.id};
  return S.best?{t:S.best.time,k:'best'}:null;}
function proStrip(){const h=$('#hero'),a=active();if(!proLook()||!h||!a?.S)return;const S=a.S,m=S.meta||{},c=S.cond||{};
  const B=S.best;const ses=S.merged?.sess?.name||tr('Telemetria MoTeC');const live=Date.now()-(S.addedAt||0)<15*60e3;
  const Q=dataQuality(S);const P=proPace(S),R=proRef(S);const d=P&&R?P.t-R.t:null;
  const refTxt=!R?'':R.k==='ref'?`${tr('dal riferimento')} ${fmtLap(R.t)}`:R.k==='pb'?`${tr('dal tuo record qui')} ${fmtLap(R.t)}`:`${tr('dal tuo miglior giro')} ${fmtLap(R.t)}`;
  let F=null;try{const X=proFindings(S);F=X?[...X.F].filter(f=>f.s>0).sort((a,b)=>b.s-a.s||ENG_ORDER.indexOf(a.a)-ENG_ORDER.indexOf(b.a))[0]||'ok':null;}catch(e){}
  const wx=[c.label?tr(c.label):'',c.track?`${tr('pista')} ${fx(c.track.avg,0)}°C`:'',c.air?`${tr('aria')} ${fx(c.air.avg,0)}°C`:''].filter(Boolean).join(' · ');
  const keep=[...h.querySelectorAll('#btnReport,#btnDebrief')];
  h.classList.add('pstrip');
  h.innerHTML=`<div class="pmain">
   <div class="ps pk"><div class="pl">${tr('Passo')}</div><div class="pv">${P?fmtLap(P.t):'<span class="dmiss">'+tr('manca')+'</span>'}</div><small>${P?(P.n===1?tr('1 giro buono'):P.n+' '+tr('giri buoni')+' · '+tr('mediana')):tr('servono giri completi')}</small></div>
   <div class="ps pk"><div class="pl">${tr('Distanza dal riferimento')}</div><div class="pv ${d==null?'':d<=0.05?'good':d<=0.5?'warn':'bad'}">${d==null?'<span class="dmiss">'+tr('manca')+'</span>':(d>0?'+':d<0?'−':'')+Math.abs(d).toFixed(3)}</div><small>${esc(refTxt)}</small></div>
   <div class="ps pk pprob" role="button" tabindex="0" title="${esc(tr('Apri Race Engineer'))}"><div class="pl">${tr('Problema principale')}</div>${F==='ok'?`<div class="pt ok">✓ ${tr('Niente di urgente')}</div>`:F?`<div class="pt s${F.s}">${esc(F.t)}</div><small>${esc((F.ev[0]||'').slice(0,90))}</small>`:`<div class="pt"><span class="dmiss">${tr('manca')}</span></div><small>${tr('servono giri completi')}</small>`}</div></div>
   <div class="pline"><b>${esc(ses)}</b>${live?`<span class="plive"><i></i>${tr('Appena arrivata')}</span>`:''}<span>${esc(m.date||'')} ${esc((m.time||'').slice(0,5))}</span><span>${esc((m.driver||'').replace(/#\d+$/,''))}</span>
     <span>${esc(proCarOf(S))}</span><span>${esc(proTrackOf(S))} · ${fx((S.trackLen||0)/1000,3)} km</span><span>${esc(wx)}</span><span>${tr('Miglior giro')} <b class="mono">${B?fmtLap(B.time):'—'}</b></span>
     <span title="${esc(Q.why.join(' · '))}">${tr('Dati')} <b class="pq q${Q.lv}">${Q.label}</b></span><span class="pbtn"></span></div>`;
  const pb=h.querySelector('.pbtn');keep.forEach(b=>pb.append(b));
  const pp=h.querySelector('.pprob');if(pp)pp.onclick=pp.onkeydown=e=>{if(e.type==='keydown'&&e.key!=='Enter')return;$('#proNav .pn[data-n="eng"]')?.click();};}
(function(){const rh=renderHero;window.renderHero=renderHero=function(){const h=$('#hero');h&&h.classList.remove('pstrip');rh();try{proStrip();}catch(e){console.error(e);}};})();
(function(){const sv=showView;window.showView=showView=function(v){sv(v);const id=proNavOf(v);LS.set('pgrp:'+id,v);proSync();};})();
(function(){const fs=fillSelects;window.fillSelects=fillSelects=function(){fs();try{proFilter(false);}catch(e){}};})();
(function(){const sa=window.suTabsApply;if(typeof sa==='function')window.suTabsApply=suTabsApply=function(){sa();proSync();};})();
// the store sets addedAt only on new files: mark the session that arrives while the app is open
(function(){const af=window.addFile;if(typeof af==='function')window.addFile=addFile=async function(...a){const it=await af(...a);try{if(it&&it.kind==='ld'&&!it.addedAt)it.addedAt=Date.now();}catch(e){}return it;};})();

// text size: the «Densità» of Personalizza (compact / normal / large) also scales the Pro layout; 2.10 kept it apart in «dens»
function proDens(){const u=LS.get('ui',{});const old=LS.get('dens',null);if(old&&!u.density){u.density=old==='compatta'?'compact':old==='comoda'?'large':'normal';LS.set('ui',u);}if(old)LS.set('dens',null);
  const d={compact:'compatta',large:'comoda'}[LS.get('ui',{}).density];if(d)document.documentElement.dataset.dens=d;else delete document.documentElement.dataset.dens;
}
(function(){const au=window.applyUI;if(typeof au==='function')window.applyUI=applyUI=function(){au();proDens();};})();
function proApply(){document.documentElement.dataset.look='pro';document.documentElement.dataset.pal='grafite';proBuild();proSync();proSyncChip();proFilter(false);proDens();
  const n=$('#proNav');if(n)n.hidden=false;
  // Grafite: the pages of the section sit in the same row as the four sections (one row of menu, more room for the page)
  const st=$('#proSecTabs');if(st&&n){if(st.parentNode!==n)n.querySelector('nav').after(st);}const sub=$('.tabs.subtabs');if(sub&&!$('main').contains(sub))$('main').prepend(sub);}
setTimeout(()=>{proApply();renderHero();setInterval(proSyncChip,5000);},0);

// ---------- Personalizza: the row where later files add their switches (live on/off, invite) ----------
setTimeout(()=>{const h=$('#mSettings .mbox>.panel-h');if(h&&!$('#mSettings .lookrow'))h.insertAdjacentHTML('afterend','<div class="lookrow"></div>');},0);

// ---------- team logo (Personalizza): in Pro it sits at the bottom of the side menu, where there is room for it ----------
(function(){const al=window.applyTeamLogo;if(typeof al!=='function')return;window.applyTeamLogo=applyTeamLogo=function(){al();const nav=$('#proNav');if(!nav)return;const u=LS.get('teamLogo','');let w=$('#proLogo');
  if(!u){w&&w.remove();return;}if(!w){w=document.createElement('div');w.id='proLogo';w.innerHTML='<img alt="">';nav.querySelector('.pfoot')?.before(w);}w.querySelector('img').src=u;};
  setTimeout(()=>applyTeamLogo(),0);})();

// ---------- data states: an empty value says «manca» in its own style, not a grey dash that looks like a number ----------
function proMissing(root){if(!proLook())return;(root||document).querySelectorAll('.kpi .v,.pinfo b,.pcw b,.pcb b').forEach(e=>{if(e.children.length)return;const t=e.textContent.trim();if(t==='—'||t==='-'||t==='–'){e.innerHTML=`<span class="dmiss" title="${esc(tr('Il dato non c\'è in questi file'))}">${tr('manca')}</span>`;}});}
setTimeout(()=>{const m=$('main');if(!m)return;let q=0;new MutationObserver(()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;proMissing(m);});}).observe(m,{childList:true,subtree:true});proMissing(m);},0);
