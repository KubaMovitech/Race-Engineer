// ================= MURETTO: team without codes, and what we took from the LMU Drive live timing =================

// ---------- 1. the team: one invite link instead of codes to copy ----------
// The code still exists (it is what links the bridges of the team), but nobody has to see it: the engineer sends a
// link, the teammate opens it on his PC with Data Engineer running, and both the page and his bridge join the team.
function teamInviteUrl(){const c=LS.get('live:team','');return c?'http://localhost:8790/#join&t='+encodeURIComponent(c):'';}
function teamInvite(){const url=teamInviteUrl();if(!url){toast(tr('Nessuna squadra: creane una o entra in una squadra'));return;}
  try{navigator.clipboard?.writeText(url)?.catch(()=>{});}catch(e){}
  openCode({title:tr('Invita un compagno'),help:tr('Link copiato. Il compagno avvia Data Engineer sul suo PC e apre questo link: entra nella squadra da solo, anche il suo bridge. Chi ha il link vede i dati della squadra: mandalo solo al team.'),text:url});}
// opening an invite link
(function(){const m=/^#join&t=(.+)$/.exec(location.hash);if(!m)return;let code='';try{code=decodeURIComponent(m[1]).trim();}catch(e){}history.replaceState(null,'',location.pathname);
  if(!teamParse(code)){setTimeout(()=>toast(tr('Link della squadra non valido')),900);return;}
  LS.set('live:team',code);LS.set('tab','live');
  if(isBridgeHost())bridgeTeam(code).then(()=>{toast(tr('Sei nella squadra: il bridge si riavvia con il nuovo collegamento'));setTimeout(()=>location.reload(),4000);}).catch(()=>{toast(tr('Sei nella squadra'));liveStart();});
  else{liveStart();setTimeout(()=>toast(tr('Sei nella squadra')),900);}})();
// the page knows the team but the bridge of this PC does not (first start, reinstall): give it the same team, once
(function(){if(!isBridgeHost())return;const c=LS.get('live:team','');if(!c||LS.get('team:synced','')===c)return;
  fetch('/team',{cache:'no-store'}).then(r=>r.json()).then(st=>{LS.set('team:synced',c);if(st&&!st.team)bridgeTeam(c).then(()=>toast(tr('Bridge collegato alla squadra'))).catch(()=>{});}).catch(()=>{});})();
// the Squadra menu: shows the team instead of a generic label; simpler words
(function(){const sk=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){const fresh=!$('#v-live')?.dataset.ok;sk();if(!fresh)return;
  const t=teamParse(LS.get('live:team',''));const sum=$('#v-live details.menu>summary');if(sum){sum.innerHTML=t?`<span class="tmdot"></span>${esc(t.n||tr('Squadra'))} ▾`:`${tr('Collega squadra')} ▾`;sum.classList.toggle('on',!!t);}
  const j=$('#lvJoin');if(j)j.textContent=tr('Entra in una squadra');
  const c=$('#lvCode');if(c){c.textContent=tr('Invita un compagno');c.onclick=teamInvite;}
  const n=$('#lvNew');if(n&&t)n.textContent=tr('Crea un\'altra squadra');
  // the strip with every car on the lap, visible in every tab of the Muretto
  $('#lvSess')?.insertAdjacentHTML('afterend','<div id="lvStrip" class="lvstrip" aria-label="'+esc(tr('Posizioni sul giro'))+'"></div>');};})();

// ---------- 2. every car on the lap, in one strip ----------
function lvStripHTML(){const sc=LIVE.sc;const I=sc?.i||{};const len=I.lapDist;if(!sc||!(len>0))return '';const rows=liveRows(sc);const riv=typeof liveRivals==='function'?liveRivals():[];
  const me=rows.find(r=>r.veh===LIVE.focus);
  return `<div class="lsbar"><i class="sf" title="${esc(tr('Traguardo'))}"></i>${rows.filter(r=>!r.gar).map(r=>{const f=Math.max(0,Math.min(1,(r.ld||0)/len));const us=r.veh===LIVE.focus,rv=riv.includes(r.veh);
    return `<span class="lsc${us?' us':''}${rv?' rv':''}${r.inPit?' pit':''}${me&&r.cls===me.cls?' cl':''}" style="left:${(f*100).toFixed(2)}%;--c:${LV_CLS(r.cls)}" title="${esc(`P${r.pos} · ${r.drv} · ${r.label||r.veh}`)}">${r.pos}</span>`;}).join('')}</div>`;}
(function(){const rl=renderLive;window.renderLive=renderLive=function(force){rl(force);const el=$('#lvStrip');if(!el||curView()!=='live')return;try{const h=lvStripHTML();if(el.dataset.h!==h){el.innerHTML=h;el.dataset.h=h;}}catch(e){}};})();

// ---------- 3. the leaderboard: last 3 laps of energy, trend, incidents ----------
// consumption of each of the last 3 laps (virtual energy, or fuel when the car has none), in % of the tank
function last3(veh){const L=fLaps(veh);const pick=L.some(l=>l[9]>0)?9:8;const out=[];
  for(let i=L.length-1;i>0&&out.length<3;i--){const a=L[i-1],b=L[i];if(b[0]!==a[0]+1||b[3]||a[3])continue;const d=a[pick]-b[pick];if(d>0&&d<0.3)out.unshift(d*100);}
  return {v:out,k:pick===9?'VE':(LANG==='en'?'F':'B')};}
function incidents(){const n={};const rows=liveRows(LIVE.sc);const byDrv=d=>rows.find(r=>r.drv===d)?.veh||Object.entries(LIVE.field?.cars||{}).find(([,c])=>c.drivers?.includes(d)||c.name===d)?.[0];
  (LIVE.field?.stream||[]).forEach(e=>{if(e.tag!=='Incident')return;const v=byDrv(e.drv);if(v)n[v]=(n[v]||0)+1;});return n;}
(function(){const lb=lvBoard;window.lvBoard=lvBoard=function(x){lb(x);const t=$('#lvStand table');if(!t||t.querySelector('th.l3'))return;
  const hr=t.querySelector('thead tr');if(!hr)return;
  hr.insertAdjacentHTML('beforeend',`<th class="l3" title="${esc(tr('Consumo di ognuno degli ultimi 3 giri (energia virtuale, o benzina se l\'auto non ne ha), in % del serbatoio'))}">${tr('Ultimi 3')}</th><th title="${esc(tr('Ultimo giro meno la media degli ultimi 5: negativo = sta andando più forte'))}">${tr('Tend.')}</th><th title="${esc(tr('Contatti segnalati dal gioco in questa sessione'))}">Inc</th>`);
  const inc=incidents();const rows=liveRows(LIVE.sc);
  t.querySelectorAll('tbody tr[data-car]').forEach(tr_=>{const veh=tr_.dataset.car;const r=rows.find(z=>z.veh===veh);let l3={v:[]},trd=NaN;try{l3=last3(veh);const s=carStats(veh,r);trd=s.lastT-s.pace5;}catch(e){}
    const c=l3.v.length?`<span class="l3v"><em>${l3.k}</em>${l3.v.map(v=>v.toFixed(2)).join(' ')}</span>`:'<span class="muted">—</span>';
    const td=Number.isFinite(trd)&&Math.abs(trd)<20?`<b class="${trd<-0.05?'pos':trd>0.05?'neg':''}">${trd>0?'+':''}${trd.toFixed(2)}</b>`:'<span class="muted">—</span>';
    const ni=inc[veh]||0;tr_.insertAdjacentHTML('beforeend',`<td class="l3">${c}</td><td>${td}</td><td>${ni?`<b class="${ni>=3?'neg':''}">${ni}</b>`:'<span class="muted">0</span>'}</td>`);});};})();

(function(){const st=document.createElement('style');st.textContent=`
.lvstrip:empty{display:none}.lvstrip{margin:10px 0 2px;padding:14px 10px 8px}
.lsbar{position:relative;height:30px;border-top:2px solid rgba(255,255,255,.18);margin:0 10px}
.lsbar .sf{position:absolute;left:0;top:-8px;width:3px;height:14px;background:repeating-linear-gradient(0deg,#fff 0 3px,#000 3px 6px)}
.lsc{position:absolute;top:-12px;transform:translateX(-50%);min-width:22px;height:22px;padding:0 4px;border-radius:11px;background:#0B0C0F;border:2px solid var(--c);color:#fff;font:700 11px/18px var(--f-mono);text-align:center;opacity:.55;transition:left .9s linear}
.lsc.cl{opacity:1}.lsc.rv{opacity:1;box-shadow:0 0 0 2px #FFD23F}.lsc.pit{top:6px;opacity:.35}
.lsc.us{opacity:1;z-index:2;background:var(--c);color:#0B0C0F;transform:translateX(-50%) scale(1.2);box-shadow:0 0 14px var(--c)}
td.l3{white-space:nowrap}.l3v{font:12px var(--f-mono)}.l3v em{font-style:normal;font-size:.68rem;color:var(--muted);margin-right:5px}
details.menu>summary.on{color:#fff}.tmdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--good);margin-right:7px;box-shadow:0 0 8px var(--good);vertical-align:1px}
@media (prefers-reduced-motion:reduce){.lsc{transition:none}}`;document.head.appendChild(st);})();
