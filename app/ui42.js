// ================= PRO DASHBOARD: track facts beside the map, any lap in the trace, the engineer's top findings =================
// What it adds reads the same telemetry as the rest of the app; nothing here is estimated or made up.

// the engineer's findings for a session, from telemetry only unless the Setup page already read a .svm for it
function proFindings(S){try{let laps=engLaps(S);if(!laps.length)return null;
  let D=typeof DIAG!=='undefined'&&DIAG&&DIAG.S===S?DIAG:null;
  if(!D){const k='pdiag:'+engLapMode();D=S.cache.get(k);if(!D){D=diagnose(S,laps,null);D.S=S;D.su=null;S.cache.set(k,D);}}
  return {D,laps,F:engFindings(D,S,D.su||null,laps)};}catch(e){console.error(e);return null;}}
const PSEV=[['OK','ok'],['Medio','mid'],['Alto','hi']];
function proFindRow(f,i){const s=PSEV[f.s]||PSEV[0];const fx0=f.fx.find(x=>!x.conflict);
  return `<div class="pfr s${f.s}"><span class="pfi">${f.s===2?'!':f.s===1?'⚠':'✓'}</span><div><b>${i+1}. ${esc(f.t)}</b><small>${esc(f.ev.slice(0,2).join(' · ')||f.why||'')}</small>${fx0?`<small class="pfx">→ ${esc(tr(fx0.label))}: ${esc(fx0.dir)}</small>`:''}</div><em class="${s[1]}">${tr(s[0])}</em></div>`;}
function proAIHTML(S){const R=proFindings(S);if(!R)return '';const F=[...R.F].sort((a,b)=>b.s-a.s||ENG_ORDER.indexOf(a.a)-ENG_ORDER.indexOf(b.a));
  const top=F.filter(f=>f.s>0).slice(0,3);const list=top.length?top:F.filter(f=>f.s===0).slice(0,2);
  const n=F.filter(f=>f.s>0).length;
  return `<div class="panel pai"><div class="dt"><span class="psp">✦</span> ${tr('Analisi IA')}<span class="pai-r">${tr('Data Engineer')} <b>AI</b></span></div>
    <div class="pai-h">${n?`${n} ${n===1?tr('elemento da guardare'):tr('elementi da guardare')}`:tr('Niente di urgente')}<button type="button" class="btn pai-all">${tr('Vedi tutti')} →</button></div>
    ${list.map(proFindRow).join('')||`<p class="muted small">${tr('Servono giri completi.')}</p>`}
    <p class="muted small pai-n">${R.D.su?esc(R.D.su.name):tr('Solo telemetria: per i valori del setup scegli il .svm in Race Engineer.')} · ${esc(engLapsText(R.laps))}</p></div>`;}

// track facts measured on the best lap
function proTrackFacts(S){const d=dashData(S);if(!d)return null;const step=5;let run=0,best=0,full=0;const th=d.thr,br=d.brk;
  for(let i=0;i<th.length;i++){if(th[i]>95&&!(br&&br[i]>5)){run+=step;full+=step;best=Math.max(best,run);}else run=0;}
  return {len:S.trackLen||0,corners:d.cor.length,straight:best,full:full/((th.length||1)*step)*100,brakes:d.cor.filter(c=>c.brake!=null).length};}

// a lap of the session in the speed / throttle / brake strip, with axes, braking zones and corners
function proTelSVG(S,lap,W=900,H=230){const g=lapGrid(S,lap,5);const v=g.get('Ground Speed'),th=g.get('Throttle Pos'),br=g.get('Brake Pos');if(!v)return '';
  const n=v.length,X=i=>(46+i/(n-1)*(W-56)).toFixed(1);let hi=0;for(const x of v)hi=Math.max(hi,x);hi=Math.ceil(hi/10)*10;
  const yv=x=>(10+(1-x/hi)*120).toFixed(1),yp=(x,top)=>(top+30-(x/100)*30).toFixed(1);
  const line=(a,f)=>Array.from(a,(x,i)=>X(i)+','+f(x)).join(' ');
  let z='';let s=-1;for(let i=0;i<=n;i++){const on=i<n&&br&&br[i]>5;if(on&&s<0)s=i;if(!on&&s>=0){z+=`<rect x="${X(s)}" y="8" width="${(X(i-1)-X(s)).toFixed(1)}" height="${H-34}" fill="rgba(229,53,75,.10)"/>`;s=-1;}}
  const len=g.d[n-1]||S.trackLen||0;const tick=len>4000?1000:500;let ax='';for(let m=0;m<=len;m+=tick)ax+=`<text x="${X(Math.round(m/len*(n-1)))}" y="${H-6}" text-anchor="middle">${m.toLocaleString()}</text>`;
  const cor=detectCorners(g);
  return `<g class="pg">${[0,.5,1].map(f=>`<line x1="46" x2="${W-10}" y1="${10+f*120}" y2="${10+f*120}"/><text x="40" y="${14+f*120}" text-anchor="end">${Math.round(hi*(1-f))}</text>`).join('')}<text x="4" y="22" class="pu">km/h</text>
    <line x1="46" x2="${W-10}" y1="${yp(0,140)}" y2="${yp(0,140)}"/><line x1="46" x2="${W-10}" y1="${yp(0,176)}" y2="${yp(0,176)}"/><text x="40" y="${+yp(50,140)+4}" text-anchor="end">${tr('Gas')}</text><text x="40" y="${+yp(50,176)+4}" text-anchor="end">${tr('Freno')}</text></g>
    ${z}${cor.map(c=>`<text x="${X(c.apex)}" y="8" text-anchor="middle" class="pc">T${c.k}</text>`).join('')}
    <polyline points="${line(v,yv)}" fill="none" stroke="#fff" stroke-width="1.7"/>
    ${th?`<polyline points="${line(th,x=>yp(x,140))}" fill="none" stroke="#2BE38A" stroke-width="1.3"/>`:''}
    ${br?`<polyline points="${line(br,x=>yp(x,176))}" fill="none" stroke="#FF3B4E" stroke-width="1.3"/>`:''}
    <g class="pg pax">${ax}</g>`;}

function proTelDraw(S){const t=$('#stBody .dtel.ptel');if(!t)return;const L=S.laps.filter(l=>l.complete);const lap=L.find(l=>l.i===LS.get('pdl:'+S.id,S.best?.i))||S.best||L[0];if(!lap)return;
  const sv=t.querySelector('svg');sv.setAttribute('viewBox','0 0 900 230');sv.innerHTML=proTelSVG(S,lap);}
(function(){const dd=dashDraw;window.dashDraw=dashDraw=function(S){dd(S);try{proTelDraw(S);}catch(e){console.error(e);}};})();
(function(){const rs=RENDER.stint;RENDER.stint=()=>{rs();const S=active()?.S;const dash=$('#stBody .dash');if(!S||!dash||!proLook())return;
  try{
    // track facts beside the map
    const m=dash.querySelector('.dmap'),f=proTrackFacts(S);if(m&&f&&!m.querySelector('.pinfo')){m.classList.add('pmapx');m.insertAdjacentHTML('beforeend',`<div class="pinfo">
      <div><span>${tr('Lunghezza')}</span><b>${fx(f.len/1000,3)} km</b></div><div><span>${tr('Curve')}</span><b>${f.corners}</b><small>${f.brakes} ${tr('con frenata')}</small></div>
      <div><span>${tr('Tratto in pieno più lungo')}</span><b>${Math.round(f.straight)} m</b></div><div><span>${tr('Gas pieno')}</span><b>${fx(f.full,0)}%</b><small>${tr('del giro')}</small></div></div>`);dashDraw(S);}
    // the trace: any complete lap, with arrows
    const L=S.laps.filter(l=>l.complete);const t=dash.querySelector('.dtel');
    if(t&&L.length){let k=Math.max(0,L.indexOf(L.find(l=>l.i===LS.get('pdl:'+S.id,S.best?.i))));if(k<0)k=0;
      const draw=()=>{const lap=L[k];LS.set('pdl:'+S.id,lap.i);t.querySelector('.dt').innerHTML=`${tr('Telemetria')}`;
        t.querySelector('.plap b').textContent=`${tr('Giro')} ${lap.num} · ${fmtLap(lap.time)}${lap===S.best?' ★':''}`;
        proTelDraw(S);};
      t.classList.add('ptel');t.insertAdjacentHTML('beforeend',`<div class="plap"><button type="button" class="btn icon" data-k="-1" aria-label="${tr('Giro precedente')}">‹</button><b></b><button type="button" class="btn icon" data-k="1" aria-label="${tr('Giro successivo')}">›</button><button type="button" class="btn pcmp">${tr('Confronta')}</button></div>
        <div class="plg"><span><i style="background:#fff"></i>${tr('Velocità')} (km/h)</span><span><i style="background:#2BE38A"></i>${tr('Gas')} (%)</span><span><i style="background:#FF3B4E"></i>${tr('Freno')} (%)</span><span><i style="background:rgba(229,53,75,.35)"></i>${tr('frenate')}</span></div>`);
      t.querySelectorAll('.plap [data-k]').forEach(b=>b.onclick=()=>{k=(k+ +b.dataset.k+L.length)%L.length;draw();});
      t.querySelector('.pcmp').onclick=()=>{TW.SA=S;TW.a=L[k].i;TW.auto=false;showView('tele');};
      draw();}
    // the engineer's top findings instead of the lap list and energy (both are further down the page)
    const ai=proAIHTML(S);if(ai){dash.insertAdjacentHTML('beforeend',ai);dash.classList.add('pdash');
      dash.querySelector('.pai-all').onclick=()=>$('#proNav .pn[data-n="eng"]')?.click();}
    // the top speed tile joins the key numbers below
    const st=dashData(S)?.st;const kp=$('#stBody .kpis');if(kp&&st&&Number.isFinite(st.vmax)&&!kp.querySelector('.pvmax'))kp.insertAdjacentHTML('beforeend',`<div class="kpi pvmax"><div class="l">${tr('Velocità max')}</div><div class="v">${fx(st.vmax,0)} <small>km/h</small></div><div class="s">${tr('Giro')} ${S.best.num}</div></div>`);
  }catch(e){console.error(e);}};})();

(function(){const st=document.createElement('style');st.textContent=`
html[data-look="pro"] .dash{font-family:"Titillium Web",sans-serif}
html[data-look="pro"] .dash .dt{font:700 .92rem "Titillium Web",sans-serif;letter-spacing:.06em;color:#fff}html[data-look="pro"] .dash .dt b{color:#fff}
html[data-look="pro"] .dbig{font:600 clamp(2.6rem,4.6vw,4.4rem)/1 "JetBrains Mono",monospace;color:#fff;letter-spacing:-.03em}
html[data-look="pro"] .dl{font:600 .78rem "Titillium Web",sans-serif;letter-spacing:.05em}html[data-look="pro"] .dv{font:600 1.5rem "JetBrains Mono",monospace}
html[data-look="pro"] .dideal{font:500 .9rem "Titillium Web",sans-serif}html[data-look="pro"] .dideal b{font:600 1.05rem "JetBrains Mono",monospace}
html[data-look="pro"] .dred{width:120px;height:3px}
html[data-look="pro"] .dmap.pmapx{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:10px;padding:46px 12px 12px!important}
html[data-look="pro"] .dmap.pmapx svg{height:540px}
.pinfo{display:flex;flex-direction:column;gap:8px}.pinfo>div{background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.pinfo span{display:block;font:600 .78rem "Titillium Web",sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}.pinfo b{display:block;font:600 1.15rem "JetBrains Mono",monospace;color:#fff;margin-top:2px}.pinfo small{color:var(--muted);font-size:.75rem}
html[data-look="pro"] .dash.pdash .dlaps,html[data-look="pro"] .dash.pdash .den{display:none}
@media (min-width:1101px){html[data-look="pro"] .dash.pdash{grid-template-columns:minmax(0,1.45fr) minmax(0,1fr)}html[data-look="pro"] .dash.pdash .dside{grid-column:2}html[data-look="pro"] .dash.pdash .pai{grid-column:2}}
.ptel .plap{position:absolute;right:14px;top:9px;display:flex;gap:6px;align-items:center}.ptel .plap b{font:600 .85rem "JetBrains Mono",monospace;color:#fff;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:6px 12px;white-space:nowrap}
.ptel .plap .btn{height:32px}.ptel svg{height:230px!important}
.ptel .pg line{stroke:rgba(255,255,255,.07)}.ptel .pg text{fill:var(--muted);font:11px "JetBrains Mono",monospace}.ptel .pu{fill:var(--muted);font-size:10px}.ptel .pc{fill:var(--psil);font:600 11px "Titillium Web",sans-serif}
.plg{display:flex;gap:18px;flex-wrap:wrap;margin-top:8px;font-size:.8rem;color:var(--psil)}.plg i{display:inline-block;width:16px;height:3px;border-radius:2px;margin-right:6px;vertical-align:middle}
.pai{padding:50px 18px 14px!important}.pai .psp{color:var(--pacc2)}.pai-r{position:absolute;right:0;font-size:.72rem;color:var(--muted);letter-spacing:.14em}.pai-r b{color:var(--pacc2)}
.pai-h{display:flex;justify-content:space-between;align-items:center;gap:10px;font:600 1.05rem "Titillium Web",sans-serif;color:var(--pacc2);margin-bottom:10px}.pai-h .btn{height:30px;font-size:.78rem;color:var(--pacc2)}
.pfr{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:start;padding:12px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.02);margin-bottom:8px}
.pfr .pfi{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;font-weight:700;font-size:1.05rem}
.pfr.s2 .pfi{background:rgba(255,59,78,.15);color:#FF3B4E}.pfr.s1 .pfi{background:var(--pwarnbg);color:var(--pwarn)}.pfr.s0 .pfi{background:rgba(43,227,138,.12);color:#2BE38A}
.pfr b{display:block;color:#fff;font-size:.92rem}.pfr.s2 b{color:#FF5A6A}.pfr.s1 b{color:var(--pwarn)}
.pfr small{display:block;color:var(--psil3);font-size:.86rem;margin-top:2px}.pfr .pfx{color:var(--pacc2)}
.pfr em{font-style:normal;font:600 .72rem "Titillium Web",sans-serif;padding:4px 10px;border-radius:6px;white-space:nowrap}
.pfr em.hi{background:rgba(255,59,78,.15);color:#FF5A6A}.pfr em.mid{background:var(--pwarnbg);color:var(--pwarn)}.pfr em.ok{background:rgba(43,227,138,.12);color:#2BE38A}
.pai-n{margin:6px 0 0}
html[data-look="pro"] #stBody .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr))}
.pvmax .v small{font-size:.8rem;color:var(--muted)}
@media (max-width:1100px){html[data-look="pro"] .dmap.pmapx{grid-template-columns:1fr}html[data-look="pro"] .dmap.pmapx svg{height:400px}.pinfo{display:grid;grid-template-columns:repeat(4,1fr)}}
@media (max-width:760px){.pinfo{grid-template-columns:repeat(2,1fr)}html[data-look="pro"] .dmap.pmapx svg{height:300px}.ptel .plap{position:static;margin:-6px 0 8px}.ptel .plap b{flex:1;text-align:center}}
`;document.head.appendChild(st);})();
