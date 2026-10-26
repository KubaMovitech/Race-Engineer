// ================= SESSIONE: the carbon dashboard on top of the session =================
// Best lap with LED sectors and the ideal lap, the circuit drawn like a blueprint with a callout per corner,
// the four tyres around the car, the telemetry of the best lap, the laps and the energy. Everything else of the
// session view stays below it.
function dashData(S){const k='dash';if(S.cache.has(k))return S.cache.get(k);const B=S.best;if(!B)return null;
  const L=S.laps.filter(l=>l.complete);const g=lapGrid(S,B,5);const la=g.get('GPS Latitude'),lo=g.get('GPS Longitude');
  let xy=null;if(la&&lo){const c=Math.cos(la[0]*Math.PI/180);xy=Array.from(la,(v,i)=>[(lo[i]-lo[0])*c*111320,(v-la[0])*110574]);}
  const sec=L.map(l=>typeof twLapSectors==='function'?twLapSectors(S,l):null);const okSec=sec.filter(Boolean);
  const best3=okSec.length?[0,1,2].map(k=>Math.min(...okSec.map(s=>s[k]))):null;
  const st=lapStats(S,B);const cor=detectCorners(g);
  const d={B,L,g,xy,sec,best3,st,cor,bsec:typeof twLapSectors==='function'?twLapSectors(S,B):null,speed:g.get('Ground Speed'),thr:g.get('Throttle Pos'),brk:g.get('Brake Pos')};S.cache.set(k,d);return d;}
function dashFit(xy,w,h,pad){const xs=xy.map(p=>p[0]),ys=xy.map(p=>p[1]);let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const rot=(x1-x0)<(y1-y0)*0.8&&w>h;const P=rot?xy.map(([x,y])=>[y,x]):xy.map(([x,y])=>[x,-y]);
  const X=P.map(p=>p[0]),Y=P.map(p=>p[1]);x0=Math.min(...X);x1=Math.max(...X);y0=Math.min(...Y);y1=Math.max(...Y);const k=Math.min((w-2*pad)/(x1-x0),(h-2*pad)/(y1-y0));const ox=(w-(x1-x0)*k)/2,oy=(h-(y1-y0)*k)/2;
  return P.map(([x,y])=>[ox+(x-x0)*k,oy+(y-y0)*k]);}
const dPath=(P,a=0,b=P.length-1)=>'M'+P.slice(a,b+1).map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L');
const dTc=t=>!Number.isFinite(t)?'#333':t<70?'#3B82F6':t<78?'#22D3EE':t<92?'#2BE38A':t<102?'#FFD23F':'#FF1A2D';
function dashMap(d,W,H){if(!d.xy)return `<text x="20" y="40" fill="#8B9098">${tr('Questa telemetria non ha la posizione GPS: la mappa non è disponibile.')}</text>`;
  const P=dashFit(d.xy,W,H,Math.min(110,W*0.12));let m=`<defs><pattern id="dgr" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="rgba(255,255,255,.05)"/></pattern>
    <pattern id="dck" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#fff"/><rect x="2" y="2" width="2" height="2" fill="#fff"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#dgr)"/>
    <path d="${dPath(P)}Z" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="16" stroke-linejoin="round"/><path d="${dPath(P)}Z" fill="none" stroke="#0E0F12" stroke-width="13" stroke-linejoin="round"/>`;
  // racing line by inputs, grouped in runs of the same colour
  const cs=P.map((_,i)=>d.brk[i]>5?'#FF1A2D':d.thr[i]>95?'#F3F4F6':'#8B9098');let i=0;while(i<P.length-1){let j=i+1;while(j<P.length-1&&cs[j]===cs[i])j++;m+=`<path d="${dPath(P,i,j)}" stroke="${cs[i]}" stroke-width="3" fill="none"/>`;i=j;}
  const cx=P.reduce((s,q)=>s+q[0],0)/P.length,cy=P.reduce((s,q)=>s+q[1],0)/P.length;const placed=[];const bw=150,bh=52;
  const hit=(x,y)=>placed.some(([u,v])=>Math.abs(u-x)<bw+8&&Math.abs(v-y)<bh+6);
  if(W<600){d.cor.forEach(c=>{const p=P[c.apex];if(!p)return;let dx=p[0]-cx,dy=p[1]-cy;const L=Math.hypot(dx,dy)||1;const x=p[0]+dx/L*26,y=p[1]+dy/L*20;
      m+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#FF1A2D"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="12" font-weight="700" fill="#FF1A2D">T${c.k}<tspan fill="#fff" font-weight="600"> ${Math.round(c.vMin)}</tspan></text>`;});}
  else d.cor.forEach(c=>{const p=P[c.apex];if(!p)return;let dx=p[0]-cx,dy=p[1]-cy;const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;
    let bx=Math.max(10,Math.min(W-bw-10,p[0]+dx*110-bw/2)),by=Math.max(36,Math.min(H-bh-40,p[1]+dy*80-bh/2));
    if(hit(bx,by)){const b0=[bx,by];out:for(const ox of [0,-170,170,-340,340])for(const oy of [0,-62,62,-124,124]){const x=Math.max(10,Math.min(W-bw-10,b0[0]+ox)),y=Math.max(36,Math.min(H-bh-40,b0[1]+oy));if(!hit(x,y)){bx=x;by=y;break out;}}}
    placed.push([bx,by]);
    m+=`<line x1="${p[0]}" y1="${p[1]}" x2="${bx+bw/2}" y2="${by+bh/2}" stroke="rgba(255,255,255,.45)"/><circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#FF1A2D"/>
     <polygon points="${bx+8},${by} ${bx+bw},${by} ${bx+bw},${by+bh-8} ${bx+bw-8},${by+bh} ${bx},${by+bh} ${bx},${by+8}" fill="rgba(11,12,15,.92)" stroke="rgba(255,255,255,.35)"/>
     <text x="${bx+10}" y="${by+20}" fill="#FF1A2D" font-weight="700" font-size="14">T${c.k}</text><text x="${bx+42}" y="${by+20}" fill="#fff" font-weight="600" font-size="15">${Math.round(c.vMin)} km/h</text>
     <text x="${bx+10}" y="${by+40}" fill="#8B9098" font-size="12">${c.brake!=null?tr('frenata')+' '+Math.round(c.brake)+' m':tr('senza frenata')}${c.gear>0?' · '+Math.round(c.gear)+'ª':''}</text>`;});
  const s0=P[0];m+=`<rect x="${s0[0]-11}" y="${s0[1]-4}" width="22" height="8" fill="url(#dck)"/>
    <g transform="translate(20,${H-18})" font-size="12" fill="#8B9098"><rect width="14" height="3" y="-4" fill="#F3F4F6"/><text x="20">${tr('gas pieno')}</text><rect x="110" width="14" height="3" y="-4" fill="#FF1A2D"/><text x="130">${tr('freno')}</text><rect x="190" width="14" height="3" y="-4" fill="#8B9098"/><text x="210">${tr('parziale')}</text></g>`;
  return m;}
function dashCar(d){const w=d.st.w;const tyr={FL:[345,64],FR:[345,188],RL:[205,64],RR:[205,188]};
  let c=`<g transform="translate(275 126) rotate(90) scale(.95)" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.3">
    <path d="M0 -220 C22 -220 30 -170 33 -120 L58 -104 L58 -70 L38 -60 L44 60 L62 74 L62 120 C62 136 46 146 0 146 C-46 146 -62 136 -62 120 L-62 74 L-44 60 L-38 -60 L-58 -70 L-58 -104 L-33 -120 C-30 -170 -22 -220 0 -220Z"/>
    <path d="M0 -100 L18 -70 L16 10 L0 26 L-16 10 L-18 -70Z" stroke="rgba(255,255,255,.4)"/></g>`;
  W.forEach(k=>{const [x,y]=tyr[k];c+=`<rect x="${x-26}" y="${y-13}" width="52" height="26" rx="4" fill="${dTc(w[k].C)}" opacity=".85"/>`;});
  [['RL',10,6],['RR',10,134],['FL',408,6],['FR',408,134]].forEach(([k,x,y])=>{const t=w[k];const order=k.endsWith('L')?[t.O,t.C,t.I]:[t.I,t.C,t.O];
    c+=`<g transform="translate(${x},${y})"><polygon points="8,0 130,0 130,108 122,116 0,116 0,8" fill="rgba(11,12,15,.92)" stroke="rgba(255,255,255,.3)"/>
     <text x="10" y="20" fill="#fff" font-weight="700" font-size="15">${k}</text><text x="122" y="20" text-anchor="end" fill="#8B9098" font-size="12">${tr('usura')} ${fx(t.wear,2)}%</text>
     ${order.map((v,j)=>`<rect x="${10+j*38}" y="30" width="34" height="22" fill="${dTc(v)}"/><text x="${27+j*38}" y="46" text-anchor="middle" fill="#0B0C0F" font-weight="700" font-size="13">${fx(v,0)}</text>`).join('')}
     <text x="10" y="72" fill="#8B9098" font-size="12">${tr('carcassa')}</text><text x="122" y="72" text-anchor="end" fill="#fff" font-weight="600" font-size="13">${fx(t.carc,0)}°</text>
     <text x="10" y="89" fill="#8B9098" font-size="12">${tr('pressione')}</text><text x="122" y="89" text-anchor="end" fill="#fff" font-weight="600" font-size="13">${fx(t.p,0)} kPa</text>
     <text x="10" y="106" fill="#8B9098" font-size="12">${tr('freno max')}</text><text x="122" y="106" text-anchor="end" fill="${t.bMax>600?'#FF1A2D':'#FFD23F'}" font-weight="600" font-size="13">${fx(t.bMax,0)}°</text></g>`;});
  return c;}
function dashStrip(d,Wt){const n=d.speed.length;const tr_=(a,h,lo,hi,dy)=>Array.from(a,(v,i)=>`${(i/(n-1)*Wt).toFixed(1)},${(dy+h-(v-lo)/(hi-lo)*h).toFixed(1)}`).join(' ');
  let lo=Infinity,hi=-Infinity;for(const v of d.speed){lo=Math.min(lo,v);hi=Math.max(hi,v);}
  let t=`<g stroke="rgba(255,255,255,.06)">${[0,1,2,3].map(i=>`<line x1="0" x2="${Wt}" y1="${i*36+2}" y2="${i*36+2}"/>`).join('')}</g><polyline points="${tr_(d.speed,110,lo-10,hi+5,0)}" fill="none" stroke="#fff" stroke-width="1.8"/>
    <polyline points="${tr_(d.thr,34,0,100,124)}" fill="none" stroke="#2BE38A" stroke-width="1.4"/><polyline points="${tr_(d.brk,34,0,100,164)}" fill="none" stroke="#FF1A2D" stroke-width="1.4"/>`;
  d.cor.forEach(c=>{const x=c.apex/(n-1)*Wt;t+=`<line x1="${x}" x2="${x}" y1="0" y2="200" stroke="rgba(255,26,45,.35)" stroke-dasharray="3 4"/><text x="${x+4}" y="210" fill="#8B9098" font-size="11">T${c.k}</text>`;});
  return t;}
const dLeds=(f,c,n=22)=>`<div class="leds">${Array.from({length:n},(_,i)=>`<i style="${i<Math.round(Math.max(0,Math.min(1,f))*n)?`background:${c};box-shadow:0 0 6px ${c}`:''}"></i>`).join('')}</div>`;
function dashHTML(S){const d=dashData(S);if(!d)return '';const B=d.B,st=d.st;const col={p:'var(--best)',g:'var(--good)',y:'var(--warn)'};
  const cls=k=>{if(!d.best3||!d.bsec)return 'y';const v=d.bsec[k],b=d.best3[k];return Math.abs(v-b)<1e-4?'p':v-b<0.15?'g':'y';};
  const ideal=d.best3?d.best3.reduce((a,b)=>a+b,0):null;
  const secs=d.bsec?d.bsec.map((s,k)=>{const c=cls(k);return `<div><div class="dl">${tr('Settore')} ${k+1}</div><div class="dv" style="color:${col[c]}">${s.toFixed(3)}</div>${dLeds(1-(s-d.best3[k])*4,col[c],12)}</div>`;}).join(''):'';
  const fuel=st.fuel,bat=st.batEnd;const vmax=st.vmax;
  return `<div class="dash">
   <div class="panel dmap"><div class="dt">${tr('Circuito')} · <b>${esc(S.meta?.venue||'')}</b> · ${Math.round(S.trackLen||0)} m</div><svg id="dashMap" preserveAspectRatio="xMidYMid meet"></svg></div>
   <div class="dside"><div class="panel dbest"><div class="dt">${tr('Miglior giro')} · <b>${tr('G')}${B.num}</b> · ${esc(S.meta?.driver||'')}</div><div class="dbig">${fmtLap(B.time)}</div><div class="dred"></div>
      <div class="dsecs">${secs}</div>${ideal?`<div class="dideal"><span>${tr('Ideale')} <b style="color:var(--best)">${fmtLap(ideal)}</b></span><span>${tr('Potenziale')} <b style="color:var(--good)">−${(B.time-ideal).toFixed(3)}</b></span><span>${tr('Giri')} <b>${d.L.length}</b></span></div>`:''}</div>
     <div class="panel dcar"><div class="dt">${tr('Gomme')} · <b>${tr('interno / centro / esterno')}</b></div><svg viewBox="0 0 550 252">${dashCar(d)}</svg></div></div>
   <div class="panel dtel"><div class="dt">${tr('Telemetria')} · <b>${tr('G')}${B.num}</b> · ${tr('velocità / gas / freno')}</div><svg id="dashTel" viewBox="0 0 900 214" preserveAspectRatio="none"></svg></div>
   <div class="panel dlaps"><div class="dt">${tr('Giri')}</div><div class="dll">${d.L.map(l=>`<div class="kvr"><span>${tr('Giro')} ${l.num}</span><b style="color:${l===B?'var(--best)':l.invalid?'var(--bad)':'#fff'}">${fmtLap(l.time)}</b></div>`).join('')}</div></div>
   <div class="panel den"><div class="dt">${tr('Energia')}</div>
     ${Number.isFinite(fuel)?`<div class="kvr"><span>${tr('Carburante / giro')}</span><b>${fx(fuel,2)}<small> L</small></b></div>${dLeds(fuel/4,'#FFD23F')}`:''}
     ${Number.isFinite(bat)?`<div class="kvr"><span>${tr('Batteria fine giro')}</span><b>${fx(bat,0)}<small> %</small></b></div>${dLeds(bat/100,'#2BE38A')}`:''}
     <div class="kvr"><span>${tr('Velocità max')}</span><b>${fx(vmax,0)}<small> km/h</small></b></div>${dLeds(vmax/340,'#F3F4F6')}</div></div>`;}
function dashDraw(S){const d=dashData(S);const m=$('#dashMap');if(m){const r=m.getBoundingClientRect();const W=Math.max(300,Math.round(r.width)),H=Math.max(260,Math.round(r.height));m.setAttribute('viewBox',`0 0 ${W} ${H}`);m.innerHTML=dashMap(d,W,H);}
  const t=$('#dashTel');if(t)t.innerHTML=dashStrip(d,900);}
(function(){const rs=RENDER.stint;RENDER.stint=()=>{rs();const S=active()?.S;const body=$('#stBody');if(!S||!body||!S.best||S.sample&&!S.best)return;
  try{body.insertAdjacentHTML('afterbegin',dashHTML(S));dashDraw(S);}catch(e){console.error(e);}};})();
window.addEventListener('resize',()=>{if(curView()==='stint'&&$('#dashMap')){const S=active()?.S;if(S)dashDraw(S);}});

(function(){const st=document.createElement('style');st.textContent=`
.dash{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);grid-template-rows:auto auto;gap:16px;margin-bottom:16px;font-family:"Chakra Petch",var(--f-display)}
.dash .panel{position:relative;padding:50px 22px 18px!important}
.dash .dt{position:absolute;left:22px;top:14px;font:600 12px "Chakra Petch",var(--f-display);letter-spacing:.3em;color:var(--muted);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;right:16px}.dash .dt b{color:#fff}
.dmap{padding:40px 6px 6px!important;min-height:600px}.dmap svg{width:100%;height:560px;display:block;font-family:"Chakra Petch",sans-serif}
.dside{display:flex;flex-direction:column;gap:16px}
.dbig{font:700 clamp(3.2rem,6.4vw,6.4rem)/0.9 "Chakra Petch",var(--f-display);color:#fff;letter-spacing:-.01em}
.dred{height:4px;width:220px;background:var(--accent);margin:12px 0 18px}
.dsecs{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.dl{font:600 12px "Chakra Petch",var(--f-display);letter-spacing:.3em;color:var(--muted);text-transform:uppercase}.dv{font:600 28px "Chakra Petch",var(--f-display);margin:2px 0 4px}
.dideal{display:flex;gap:24px;flex-wrap:wrap;margin-top:14px;font:500 14px "Chakra Petch",var(--f-display);color:var(--muted);letter-spacing:.06em}.dideal b{font-size:20px;margin-left:4px}
.dcar svg{width:100%;height:auto;display:block;font-family:"Chakra Petch",sans-serif}
.dtel{grid-column:1/2}.dtel svg{width:100%;height:214px;display:block;font-family:"Chakra Petch",sans-serif}
.dash .dlaps,.dash .den{grid-column:2/3}
.dash .bottom{display:contents}
.kvr{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--line);font-size:15px;color:#C7CBD1}.kvr b{font:600 20px "Chakra Petch",var(--f-display);color:#fff}.kvr small{font-size:13px;color:var(--muted)}
.den .leds{margin:4px 0 10px}
@media (min-width:1101px){.dash{grid-template-columns:minmax(0,1.55fr) minmax(0,.5fr) minmax(0,.5fr)}.dmap{grid-column:1}.dside{grid-column:2/4}.dtel{grid-column:1}.dash .dlaps{grid-column:2}.dash .den{grid-column:3}}
@media (max-width:1100px){.dash{grid-template-columns:1fr}.dash .dlaps,.dash .den,.dtel,.dside{grid-column:1}.dmap{min-height:420px}.dmap svg{height:400px}}
@media (max-width:760px){.dmap svg{height:320px}.dmap{min-height:340px}.dsecs{gap:8px}.dv{font-size:20px}}`;document.head.appendChild(st);})();
