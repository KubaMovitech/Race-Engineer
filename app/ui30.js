// ================= INTERFACCIA "PIT WALL" =================

// ---------- 1. toasts stack one above the other; the same text twice in a row shows once ----------
(function(){let last='',lastAt=0;
  window.toast=toast=function(m){const now=Date.now();if(m===last&&now-lastAt<1500)return;last=m;lastAt=now;
    let s=$('#toastStack');if(!s){s=document.createElement('div');s.id='toastStack';s.setAttribute('role','status');s.setAttribute('aria-live','polite');document.body.appendChild(s);}
    const t=document.createElement('div');t.className='toast';t.textContent=m;s.appendChild(t);while(s.children.length>3)s.firstChild.remove();setTimeout(()=>t.remove(),3400);};})();

// ---------- 2. phone: the five sections in a bar at the bottom ----------
const NAV_ICONS={ana:'<path d="M3 17l5-6 4 4 5-7 4 5"/><path d="M3 21h18"/>',set:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  str:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',prog:'<path d="M4 18l6-6 4 4 6-8"/><path d="M16 8h4v4"/>',live:'<circle cx="12" cy="12" r="2"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>'};
function botnav(){if($('#botnav')||!$('.mtabs'))return;const n=document.createElement('nav');n.id='botnav';n.setAttribute('aria-label',tr('Sezioni'));
  n.innerHTML=[...$$('.mtab')].map(b=>`<button type="button" data-group="${b.dataset.group}" aria-selected="${b.getAttribute('aria-selected')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${NAV_ICONS[b.dataset.group]||''}</svg>${esc(b.textContent.trim())}</button>`).join('');
  document.body.appendChild(n);n.querySelectorAll('button').forEach(x=>x.onclick=()=>$(`.mtab[data-group="${x.dataset.group}"]`)?.click());
  new MutationObserver(()=>n.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',$(`.mtab[data-group="${x.dataset.group}"]`)?.getAttribute('aria-selected')||'false'))).observe($('.mtabs'),{attributes:true,subtree:true,attributeFilter:['aria-selected']});}
setTimeout(botnav,0);

// ---------- 3. the session tiles: best lap against your record on the same track ----------
function trackRecord(S){if(!S?.meta?.venue)return null;let best=null;lds().forEach(x=>{if(x===S||x.sample||x.meta?.venue!==S.meta.venue||!x.best?.time)return;if(!best||x.best.time<best.time)best={time:x.best.time,label:x.label};});return best;}
(function(){const rs=RENDER.stint;RENDER.stint=()=>{rs();const S=active()?.S;if(!S?.best?.time)return;const R=trackRecord(S);if(!R)return;
  const k=[...$$('#stBody .kpi')].find(e=>/miglior giro|best lap/i.test(e.querySelector('.l')?.textContent||''));if(!k||k.querySelector('.dl'))return;
  const d=S.best.time-R.time;const v=k.querySelector('.v');v.insertAdjacentHTML('beforeend',` <span class="dl ${d<=0?'up':'dn'}" title="${esc(tr('Rispetto al tuo miglior giro su questa pista')+': '+R.label)}">${d<=0?'▲ '+tr('record'):'▼ +'+d.toFixed(3)}</span>`);};})();

// ---------- 4. home: a dashboard instead of three empty cards ----------
(function(){const wh=welcomeHTML;window.welcomeHTML=welcomeHTML=function(){const base=wh();const L=lds().filter(x=>!x.sample);const S=L[L.length-1];
  const tile=(l,v,s,c='')=>`<div class="kpi ${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const R=S?trackRecord(S):null;const nLib=typeof SETLIB!=='undefined'?SETLIB.length:0;const cars=nLib?new Set(SETLIB.map(e=>e.car)).size:0;
  const sync=typeof LIBSYNC!=='undefined'&&LIBSYNC.last?tr('collegata al gioco'):tr('importa la cartella dei setup');
  const t=[S?tile(tr('Ultima sessione'),esc(S.meta?.venue?.replace(/International|Raceway|Circuit|Autodromo Nazionale/gi,'').trim()||S.label),esc(`${S.meta?.date||''} · ${S.laps.filter(l=>l.complete).length} ${tr('giri')}`)):tile(tr('Ultima sessione'),'—',tr('carica una telemetria')),
    tile(tr('Miglior giro'),S?.best?fmtLap(S.best.time):'—',R?`${tr('record qui')} ${fmtLap(Math.min(R.time,S.best?.time||1e9))}`:tr('sulla pista dell\'ultima sessione'),'hl'),
    tile(tr('Libreria setup'),nLib||'—',nLib?`${cars} ${tr('auto')} · ${sync}`:sync),
    tile(tr('Telemetrie'),L.length||'—',L.length?tr('sessioni aperte in questo browser'):tr('trascina i file .ld qui'))];
  return base.replace('<div class="wgrid">',`<div class="kpis wstats">${t.join('')}</div><div class="wgrid">`);};})();

// ---------- 5. Muretto: race mode, full screen, few numbers, very big ----------
function raceMode(on){let o=$('#raceMode');if(!on){if(o){o.remove();clearInterval(raceMode.t);}if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});return;}
  if(!o){o=document.createElement('div');o.id='raceMode';o.innerHTML=`<div class="rmtop"><div id="rmHead"></div><div class="rmclock" id="rmClock"></div><button class="btn" type="button" id="rmExit">${tr('Esci')} · Esc</button></div><div id="rmGrid" class="rmgrid"></div><div id="rmAlert" class="rmalert"></div>`;document.body.appendChild(o);
    $('#rmExit').onclick=()=>raceMode(false);document.documentElement.requestFullscreen?.().catch(()=>{});}
  const prev={};const pull=()=>{const h=$('#lvHead');$('#rmHead').innerHTML=h?h.innerHTML:'';const tm=[...$$('#v-live .lvhdr .cchip, #v-live .cchip')].find(c=>/tempo|time/i.test(c.textContent));$('#rmClock').textContent=tm?tm.querySelector('b')?.textContent||'':'';
    const tiles=[...$$('#lvKpi .kpi')];$('#rmGrid').innerHTML=tiles.map(k=>`<div class="kpi ${k.className.replace('kpi','')}">${k.innerHTML}</div>`).join('')||`<div class="muted">${tr('Nessun dato in diretta')}</div>`;
    $$('#rmGrid .kpi').forEach((k,i)=>{const v=k.querySelector('.v')?.textContent;if(prev[i]!==undefined&&prev[i]!==v)k.classList.add('flash');prev[i]=v;});
    const al=$('#lvAlerts');$('#rmAlert').innerHTML=al&&!al.hidden?al.innerHTML:'';};
  pull();clearInterval(raceMode.t);raceMode.t=setInterval(pull,1000);}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#raceMode'))raceMode(false);});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&$('#raceMode'))raceMode(false);});
(function(){const sk=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){sk();const b=$('#v-live .lvbtns');if(b&&!$('#btnRace')){b.insertAdjacentHTML('beforeend',`<button class="btn primary" type="button" id="btnRace" title="${esc(tr('Schermo intero con i numeri che servono in gara'))}">${tr('Modalità gara')}</button>`);$('#btnRace').onclick=()=>raceMode(true);}};})();

// ---------- 6. live numbers that change flash once ----------
(function(){const seen=new WeakMap();setInterval(()=>{if(curView()!=='live')return;$$('#lvKpi .kpi .v').forEach(v=>{const t=v.textContent;const p=seen.get(v);if(p!==undefined&&p!==t){const k=v.closest('.kpi');k.classList.remove('flash');void k.offsetWidth;k.classList.add('flash');}seen.set(v,t);});},1000);})();

(function(){const st=document.createElement('style');st.textContent=`
.wstats{margin:4px 0 16px}
#raceMode{position:fixed;inset:0;z-index:95;background:radial-gradient(1000px 500px at 50% -10%,rgba(255,30,30,.12),transparent 60%),linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px) 0 0/100% 40px,#030405;display:flex;flex-direction:column;padding:18px 22px;gap:16px;overflow:auto}
#raceMode .rmtop{display:flex;align-items:center;gap:18px;border-bottom:1px solid var(--edge2);padding-bottom:12px}
#raceMode #rmHead{flex:1;min-width:0}#raceMode #rmHead h2{font-family:var(--f-display);font-size:2.2rem;letter-spacing:.04em;text-transform:uppercase}
#raceMode .rmclock{font-family:var(--f-mono);font-size:2.4rem;font-weight:700;color:var(--cyan);text-shadow:0 0 20px var(--glowc)}
#raceMode .rmgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;flex:1;align-content:start}
#raceMode .kpi{min-height:150px;padding:18px 20px}#raceMode .kpi .l{font-size:1rem}#raceMode .kpi .v{font-size:clamp(2.4rem,4.6vw,4.2rem);margin-top:10px}#raceMode .kpi .s{font-size:1rem}
#raceMode .rmalert:empty{display:none}#raceMode .rmalert{font-size:1.2rem}
@media (max-width:760px){#raceMode .rmgrid{grid-template-columns:1fr 1fr}#raceMode .kpi{min-height:110px}#raceMode .kpi .v{font-size:2rem}#raceMode .rmclock{font-size:1.4rem}}`;document.head.appendChild(st);})();
