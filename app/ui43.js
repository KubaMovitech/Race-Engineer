// ================= PRO TELEMETRIA: events along the lap, sector comparison, three insights, corner cards =================
// All of it comes from the two laps already chosen in Telemetria (A and, if set, B).

// stretches of the lap where something happens: [name, colour, test(i)]
function proEvents(g){const br=g.get('Brake Pos'),th=g.get('Throttle Pos'),mt=g.get('Motor Torque'),v=g.get('Ground Speed');const n=g.n;
  const E=[['Zone di frenata','#FF3B4E',i=>br&&br[i]>5],
    ['Sollevamenti','#FFC53D',i=>th&&br&&th[i]<90&&th[i]>3&&br[i]<3&&v&&v[i]>120],
    ['Deploy ibrido','#B57BFF',i=>mt&&mt[i]>15],
    ['Recupero ibrido','#22D3EE',i=>mt&&mt[i]<-15]];
  return E.map(([l,c,f])=>{const Z=[];let s=-1;for(let i=0;i<=n;i++){const on=i<n&&!!f(i);if(on&&s<0)s=i;if(!on&&s>=0){if(g.d[i-1]-g.d[s]>=4)Z.push([g.d[s],g.d[i-1]]);s=-1;}}return {l,c,Z,has:l==='Zone di frenata'?!!br:l==='Sollevamenti'?!!(th&&br):!!mt};}).filter(e=>e.has);}
function proEventsSVG(D){const W=1000,len=D.gA.d[D.n-1]||1;const X=m=>(m/len*W).toFixed(1);const EA=proEvents(D.gA),EB=D.gB?proEvents(D.gB):null;
  const row=(E,y,h)=>E.map((e,k)=>e.Z.map(([a,b])=>`<rect x="${X(a)}" y="${y+k*h}" width="${Math.max(1.5,X(b)-X(a))}" height="${h-3}" rx="1.5" fill="${e.c}"/>`).join('')).join('');
  const h=9,ya=4,yb=ya+EA.length*h+8;const H=(EB?yb+EB.length*h:ya+EA.length*h)+22;
  const tick=len>4000?1000:500;let ax='';for(let m=0;m<=len;m+=tick)ax+=`<text x="${X(m)}" y="${H-4}" text-anchor="middle">${m}</text><line x1="${X(m)}" x2="${X(m)}" y1="0" y2="${H-16}"/>`;
  return {svg:`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="pevs" style="height:${H*1.1}px"><g class="pg">${ax}</g>${row(EA,ya,h)}${EB?`<text x="2" y="${yb-2}" class="pbl">B</text>`+row(EB,yb,h):''}</svg>`,E:EA};}
function proSecTable(){const A=TW.SA,B=TW.SB;const lA=A?.laps.find(l=>l.i===TW.a),lB=B?.laps.find(l=>l.i===TW.b);if(!lA)return '';
  const sa=twLapSectors(A,lA),sb=lB?twLapSectors(B,lB):null;const f=x=>x==null||!Number.isFinite(x)?'—':x.toFixed(3);
  const d=(a,b)=>a==null||b==null?'':Math.abs(a-b)<5e-4?'<b class="muted">0.000</b>':`<b class="${a-b>0?'up':'dn'}">${a-b>0?'+':'−'}${Math.abs(a-b).toFixed(3)}</b>`;
  const rows=[0,1,2].map(k=>`<tr><td class="l">S${k+1}</td><td>${f(sa?.[k])}</td>${sb?`<td>${f(sb[k])}</td><td>${d(sa?.[k],sb[k])}</td>`:''}</tr>`).join('');
  return `<table class="lbt psec"><thead><tr><th class="l">${tr('Settore')}</th><th>A · ${tr('G')}${lA.num}</th>${lB?`<th>B · ${tr('G')}${lB.num}</th><th>Δ A−B</th>`:''}</tr></thead><tbody>${rows}
    <tr class="ptot"><td class="l">${tr('Giro completo')}</td><td><b>${fmtLap(lA.time)}</b></td>${lB?`<td>${fmtLap(lB.time)}</td><td>${d(lA.time,lB.time)}</td>`:''}</tr></tbody></table>${lB?'':`<p class="muted small">${tr('Scegli un giro B in alto per il confronto.')}</p>`}`;}
function proTeleInsights(D){if(D.gB){const C=D.corners.filter(c=>c.dt!=null&&Number.isFinite(c.dt));if(!C.length)return '';
    const lose=[...C].filter(c=>c.dt<-0.02).sort((a,b)=>a.dt-b.dt).slice(0,2),gain=[...C].filter(c=>c.dt>0.02).sort((a,b)=>b.dt-a.dt).slice(0,1);
    const item=(c,good)=>`<div class="pfr ${good?'s0':'s2'}" data-c="${c.k}"><span class="pfi">${good?'▲':'▼'}</span><div><b>${good?tr('Guadagni in'):tr('Perdi in')} T${c.k}</b><small>${esc(twCornerHint(c).replace(/ → .*$/,'')||tr('stesso modo di guidare, differenza piccola'))}</small></div><em class="${good?'ok':'hi'}">${good?'−':'+'}${Math.abs(c.dt).toFixed(3)}s</em></div>`;
    const L=[...lose.map(c=>item(c,false)),...gain.map(c=>item(c,true))];
    return L.length?L.join(''):`<p class="muted small">${tr('A e B sono quasi uguali in tutte le curve.')}</p>`;}
  const S=TW.SA,R=typeof proFindings==='function'?proFindings(S):null;if(!R)return '';const F=[...R.F].filter(f=>f.s>0).sort((a,b)=>b.s-a.s).slice(0,3);
  return F.length?F.map(proFindRow).join(''):`<p class="muted small">${tr('Niente di urgente. Scegli un giro B per vedere dove guadagni e dove perdi.')}</p>`;}
function proCornerCards(D){return `<div class="pcc">${D.corners.map(c=>{const b=c.B;const dt=c.dt;const has=D.gB&&dt!=null&&Number.isFinite(dt);
  const st=!has?'':dt<-0.02?'hi':dt>0.02?'ok':'eq';const z=has&&Math.abs(dt)<5e-4;const hint=has?(twCornerHint(c).replace(/ → .*$/,'').split(' · ')[0]||tr('Nessuna differenza importante')):'';
  return `<button type="button" class="pcard ${st}" data-c="${c.k}"><div class="pch"><b>T${c.k}</b>${has?`<em>${z?'':dt<0?'+':'−'}${Math.abs(dt).toFixed(3)}s</em>`:`<em class="n">${fx(c.time,2)} s</em>`}</div>
    <div class="pcv"><span>${tr('Vel. min')}<b>${fx(c.vMin,0)} <small>km/h</small></b></span><span>${tr('Frenata')}<b>${c.brake!=null?Math.round(c.dApex-c.brake)+' <small>m</small>':'—'}</b></span></div>
    ${hint?`<div class="pcn"><i></i>${esc(hint)}</div>`:`<div class="pcn n">${tr('Marcia')} ${fx(c.gear,0)} · ${tr('uscita')} ${fx(c.vExit,0)} km/h</div>`}</button>`;}).join('')}</div>`;}

(function(){const rt=RENDER.tele;RENDER.tele=()=>{rt();const D=TW.D;const body=$('#twBody');if(!D||!body||!proLook())return;
  try{const tr_=body.querySelector('.twtr');if(!tr_)return;
    const ev=proEventsSVG(D);
    tr_.insertAdjacentHTML('afterend',`<div class="panel pevp"><div class="panel-h"><h3>${tr('Eventi sul giro')}</h3><div class="pevl">${ev.E.map(e=>`<span><i style="background:${e.c}"></i>${tr(e.l)}</span>`).join('')}${D.gB?`<span class="muted">${tr('sopra A, sotto B')}</span>`:''}</div></div>${ev.svg}</div>
      <div class="pcmpr"><div class="panel"><div class="panel-h"><h3>${tr('Confronto giri')}</h3><span class="muted small">${tr('tempi settore')}</span></div>${proSecTable()}</div>
      <div class="panel pai2"><div class="panel-h"><h3><span class="psp">⚙</span> ${tr('Analisi automatica')}</h3><span class="muted small">${D.gB?tr('A contro B'):tr('dalla telemetria')}</span></div>${proTeleInsights(D)}</div></div>`);
    const low=body.querySelector('.twlow');if(low)low.insertAdjacentHTML('beforebegin',`<div class="panel pccp"><div class="panel-h"><h3>${tr('Analisi curva per curva')}</h3><span class="muted small">${D.gB?tr('Δ = quanto A perde (+) o guadagna (−) su B'):tr('scegli un giro B per i Δ')}</span></div>${proCornerCards(D)}</div>`);
    body.querySelectorAll('.pcard[data-c],.pai2 .pfr[data-c]').forEach(b=>b.onclick=()=>{twZoomCorner(D.corners.find(c=>c.k===+b.dataset.c));$('.twmapp')?.scrollIntoView({behavior:'smooth',block:'start'});});
  }catch(e){console.error(e);}};})();

(function(){const st=document.createElement('style');st.textContent=`
.pevp .panel-h{flex-wrap:wrap;gap:8px}.pevl{display:flex;gap:14px;flex-wrap:wrap;font-size:.8rem;color:var(--psil)}.pevl i{display:inline-block;width:12px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.pevs{width:100%;display:block}.pevs .pg line{stroke:rgba(255,255,255,.06)}.pevs .pg text{fill:var(--muted);font:10px "JetBrains Mono",monospace}.pevs .pbl{fill:#F59E0B;font:600 9px sans-serif}
.pcmpr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin:16px 0}
.psec td,.psec th{text-align:right}.psec .l{text-align:left}.psec b.up{color:#FF5A6A}.psec b.dn{color:#2BE38A}.psec .ptot td{border-top:1px solid var(--line);font-weight:600}
.pai2 .psp{color:var(--pacc2)}.pai2 .pfr{cursor:pointer}.pai2 .pfr:hover{border-color:var(--edge2)}
.pcc{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(170px,1fr);gap:10px;overflow-x:auto;padding-bottom:4px}
.pcard{text-align:left;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.02);color:inherit;padding:10px 12px;cursor:pointer;font:inherit;display:flex;flex-direction:column;gap:8px}
.pcard:hover{border-color:var(--edge2);background:rgba(255,255,255,.04)}
.pch{display:flex;justify-content:space-between;align-items:center}.pch b{font:700 1rem "Titillium Web",sans-serif;color:#fff}.pch em{font:600 .85rem "JetBrains Mono",monospace;font-style:normal}
.pcard.hi .pch em{color:#FF5A6A}.pcard.ok .pch em{color:#2BE38A}.pcard.eq .pch em{color:var(--psil)}.pch em.n{color:var(--psil)}
.pcv{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pcv span{font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.pcv b{display:block;font:600 .95rem "JetBrains Mono",monospace;color:#fff;text-transform:none;letter-spacing:0}.pcv small{font-size:.7rem;color:var(--muted)}
.pcn{font-size:.84rem;color:var(--psil3);display:flex;gap:6px;align-items:flex-start;line-height:1.3}.pcn i{width:8px;height:8px;border-radius:50%;flex:none;margin-top:4px;background:var(--psil)}
.pcard.hi .pcn i{background:#FF3B4E}.pcard.ok .pcn i{background:#2BE38A}.pcn.n{color:var(--muted)}
.pccp{margin-bottom:16px}
@media (max-width:900px){.pcmpr{grid-template-columns:1fr}}
`;document.head.appendChild(st);})();
