// ================= THE LAP, DRAWN: the one animated moment of the app =================
// Welcome page: the track of your last session draws itself and a dot runs it once.
// Dashboard: «Guarda il giro» runs the best lap on the map with its real speed and gear, 8× faster than real time.
// Both come from the telemetry; nothing loops by itself, and with reduced motion the welcome track is shown still.

// a made-up circuit for the very first start, when no telemetry has been loaded yet
const WEL_TRACK=(()=>{const P=[];for(let i=0;i<=240;i++){const t=i/240*Math.PI*2;P.push([300+230*Math.cos(t)+40*Math.cos(3*t)-18*Math.sin(2*t),130+92*Math.sin(t)-26*Math.sin(2*t)+10*Math.cos(5*t)]);}return P;})();
function welTrack(){const S=[...lds()].filter(x=>!x.sample&&x.best).pop();if(!S)return {P:WEL_TRACK,S:null};
  try{const d=dashData(S);if(d?.xy)return {P:dashFit(d.xy,600,260,24),S,d};}catch(e){}return {P:WEL_TRACK,S:null};}
function welHeroHTML(){const {P,S}=welTrack();const path=`M${P.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L')}Z`;
  const cap=S?`${esc(S.meta?.venue||'')} · ${tr('miglior giro')} <b class="mono">${fmtLap(S.best.time)}</b>`:tr('Carica una telemetria: qui comparirà il tuo giro.');
  return `<figure class="whero" aria-label="${esc(tr('Il tracciato dell\'ultima sessione'))}"><svg viewBox="0 0 600 260" role="img"><path class="wh-bed" d="${path}"/><path class="wh-line" d="${path}" pathLength="1000"/><circle class="wh-dot" r="6"/></svg>
    <figcaption>${cap}</figcaption><button type="button" class="btn wh-again" hidden>${tr('Rivedi')}</button></figure>`;}
function welRun(fig){const svg=fig.querySelector('svg'),line=svg.querySelector('.wh-line'),dot=svg.querySelector('.wh-dot'),again=fig.querySelector('.wh-again');
  const L=line.getTotalLength(),p0=line.getPointAtLength(0);dot.setAttribute('cx',p0.x);dot.setAttribute('cy',p0.y);
  if(!MOTION_OK()){fig.classList.add('wh-done');return;}
  fig.classList.remove('wh-done','wh-go');void fig.offsetWidth;fig.classList.add('wh-go');again.hidden=true;
  // the line draws itself (CSS, 1.2 s), then the dot runs the lap once in 6 s
  setTimeout(()=>{const t0=performance.now(),T=6000;const step=now=>{if(!fig.isConnected)return;const k=Math.min(1,(now-t0)/T);const q=line.getPointAtLength(k*L);dot.setAttribute('cx',q.x);dot.setAttribute('cy',q.y);
    if(k<1)requestAnimationFrame(step);else{fig.classList.add('wh-done');again.hidden=false;}};requestAnimationFrame(step);},1200);
  again.onclick=()=>welRun(fig);}
(function(){const rh=renderHero;window.renderHero=renderHero=function(){rh();const h=$('#hero');if(!h||!h.classList.contains('welcome')||!proLook())return;
  const top=h.querySelector('.wtop');if(!top||top.querySelector('.whero'))return;try{top.insertAdjacentHTML('beforeend',welHeroHTML());welRun(top.querySelector('.whero'));}catch(e){console.error(e);}};})();

// ---------- Dashboard: run the best lap on the map ----------
const DREP={raf:0,on:false,k:0};
function drepStop(){cancelAnimationFrame(DREP.raf);DREP.on=false;}
function drepButton(S){const m=$('#stBody .dmap');if(!m||m.querySelector('.drep'))return;
  m.insertAdjacentHTML('beforeend',`<div class="drep"><button type="button" class="btn" aria-pressed="false">▶ ${tr('Guarda il giro')}</button><span class="drep-r" aria-live="off"></span></div>`);
  const b=m.querySelector('.drep button');b.onclick=()=>{if(DREP.on){drepStop();b.setAttribute('aria-pressed','false');b.textContent='▶ '+tr('Riprendi');return;}drepPlay(S,b);};}
function drepPlay(S,b){const d=dashData(S),svg=$('#dashMap');if(!d?.xy||!svg)return;const vb=svg.viewBox.baseVal;const W=vb.width,H=vb.height;
  const P=dashFit(d.xy,W,H,Math.min(110,W*0.12));const t=d.g.t,n=Math.min(P.length,t.length);const gear=d.g.get('Gear');const lap=t[n-1]-t[0];
  let g=svg.querySelector('#dRep');if(!g){svg.insertAdjacentHTML('beforeend','<g id="dRep"><circle r="13" class="dr-halo"/><circle r="6.5" class="dr-dot"/><text class="dr-lbl" dy="-18" text-anchor="middle"></text></g>');g=svg.querySelector('#dRep');}
  const readout=$('#stBody .drep-r');if(DREP.k>=1)DREP.k=0;DREP.on=true;b.setAttribute('aria-pressed','true');b.textContent='❚❚ '+tr('Pausa');
  const SPEED=8;let last=performance.now();let i=0;
  const step=now=>{if(!DREP.on||!svg.isConnected){DREP.on=false;return;}DREP.k=Math.min(1,DREP.k+(now-last)/1000*SPEED/lap);last=now;
    const tt=t[0]+DREP.k*lap;while(i<n-1&&t[i+1]<tt)i++;while(i>0&&t[i]>tt)i--;const p=P[i];if(p){g.setAttribute('transform',`translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`);
      const v=Math.round(d.speed[i]),gr=gear?Math.round(gear[i]):null;g.querySelector('text').textContent=`${v} km/h${gr!=null?' · '+gr+'ª':''}`;
      if(readout)readout.textContent=`${fmtLap(tt-t[0])} / ${fmtLap(lap)} · ×${SPEED}`;g.classList.toggle('brk',d.brk[i]>5);}
    if(DREP.k<1)DREP.raf=requestAnimationFrame(step);else{DREP.on=false;b.setAttribute('aria-pressed','false');b.textContent='↻ '+tr('Rivedi');}};
  DREP.raf=requestAnimationFrame(step);}
(function(){const rs=RENDER.stint;RENDER.stint=()=>{drepStop();rs();const S=active()?.S;if(S&&proLook()&&$('#dashMap'))try{DREP.k=0;drepButton(S);}catch(e){console.error(e);}};})();
(function(){const sv=showView;window.showView=showView=function(v){if(v!=='stint')drepStop();sv(v);};})();

(function(){const st=document.createElement('style');st.textContent=`
/* welcome: the track draws itself (the one long animation of the app: 1.2 s, then the 6 s lap) */
html[data-look="pro"] .hero.welcome .wtop{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,560px);grid-template-rows:auto auto;align-content:center;gap:6px 32px}
html[data-look="pro"] .hero.welcome .wtop .ey{grid-column:1;align-self:end}html[data-look="pro"] .hero.welcome .wtop h1{grid-column:1;align-self:start}
.whero{grid-column:2;grid-row:1/3}
.whero{margin:0;display:grid;gap:6px;justify-items:end}
.whero svg{width:100%;height:auto;overflow:visible}
.whero .wh-bed{fill:none;stroke:var(--panel2);stroke-width:14;stroke-linejoin:round}
.whero .wh-line{fill:none;stroke:var(--pacc,#C9A54C);stroke-width:2.5;stroke-linejoin:round;stroke-dasharray:1000;stroke-dashoffset:0}
.whero.wh-go .wh-line{animation:whDraw 1.2s cubic-bezier(.16,1,.3,1) both}
@keyframes whDraw{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}
.whero .wh-dot{fill:#fff;stroke:var(--pacc,#C9A54C);stroke-width:3;opacity:0;transition:opacity 150ms ease-out}
.whero.wh-go .wh-dot{opacity:1;transition-delay:1.1s}.whero.wh-done .wh-dot{opacity:1}
.whero figcaption{font-size:.9rem;color:var(--muted)}.whero figcaption b{color:var(--ink)}
.whero .wh-again{height:30px}
@media (max-width:900px){html[data-look="pro"] .hero.welcome .wtop{grid-template-columns:1fr}.whero{grid-column:1;grid-row:auto;justify-items:start}}
/* dashboard: the lap on the map */
.drep{position:absolute;right:222px;top:44px;display:flex;gap:6px;align-items:flex-end;flex-direction:column;z-index:1}
.drep .btn{height:32px}.drep-r{font:600 .82rem var(--f-mono);color:var(--muted)}
#dRep .dr-halo{fill:color-mix(in srgb,var(--pacc,#C9A54C) 25%,transparent)}#dRep .dr-dot{fill:#fff;stroke:var(--pacc,#C9A54C);stroke-width:3}
#dRep.brk .dr-dot{stroke:#FF3B4E}#dRep.brk .dr-halo{fill:rgba(255,59,78,.25)}
#dRep .dr-lbl{font:700 13px "JetBrains Mono",monospace;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:4px}
@media (max-width:1100px){.drep{position:static;margin:6px 8px 0}}
@media (prefers-reduced-motion:reduce){.whero.wh-go .wh-line{animation:none}.whero .wh-dot{transition:none}}
`;document.head.appendChild(st);})();
