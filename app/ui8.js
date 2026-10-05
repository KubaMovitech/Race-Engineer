// ================= LAP TYPES & EVENTS (from results .xml) =================
const KIND={partenza:['good','partenza'],'entrata box':['warn','box IN'],'uscita box':['warn','box OUT'],'rientro garage':['bad','rientro garage'],'uscita garage':['info','uscita garage'],lanciato:['info','lanciato']};
function kindBadge(k){const x=KIND[k]||KIND.lanciato;return `<span class="tag ${x[0]}">${esc(x[1])}</span>`;}
function evTags(l){if(!l||!l.ev)return '';const out=[];const ev=l.ev;
  const nfa=ev.filter(e=>e.k==='nfa').length;
  if(ev.some(e=>e.k==='inv'))out.push('<span class="tag bad" title="Giro invalidato per taglio pista">invalidato</span>');
  if(ev.some(e=>e.k==='warn'))out.push('<span class="tag warn" title="Avviso limiti di pista">avviso limiti</span>');
  ev.filter(e=>e.k==='pen').forEach(e=>out.push(`<span class="tag bad" title="${esc(e.txt)}">penalità</span>`));
  if(nfa)out.push(`<span class="tag info" title="Uscite oltre i limiti senza conseguenze">fuori pista ×${nfa}</span>`);
  ev.filter(e=>e.k==='hit').forEach(e=>out.push(e.wall?`<span class="tag bad" title="Impatto ${fx(e.mag,0)}">muro</span>`:`<span class="tag warn" title="Impatto ${fx(e.mag,0)}${e.n>1?' · '+e.n+' contatti':''}">contatto ${esc(String(e.with).replace(/#\d+$/,''))}</span>`));
  if(ev.some(e=>e.k==='dmg'))out.push('<span class="tag bad">danni</span>');
  ev.filter(e=>e.k==='sec').forEach(e=>out.push(`<span class="tag best" title="Miglior settore della classe in quel momento">best S${e.n}</span>`));
  ev.filter(e=>e.k==='tyre').forEach(e=>out.push(`<span class="tag info">${esc(e.txt)}</span>`));
  if(l.dpos)out.push(`<span class="tag ${l.dpos>0?'good':'bad'}">${l.dpos>0?'+':''}${l.dpos} pos</span>`);
  ev.filter(e=>e.k==='chat').forEach(e=>out.push(`<span class="muted small" title="messaggio in chat">«${esc(e.txt.slice(0,40))}»</span>`));
  return out.join(' ');}
function eventsSummaryHTML(D,sess){
  const L=D.laps;const box=L.filter(l=>l.pit),gar=L.filter(l=>l.kind==='rientro garage');
  const cnt=k=>L.reduce((a,l)=>a+l.ev.filter(e=>e.k===k).length,0);
  const hits=L.flatMap(l=>l.ev.filter(e=>e.k==='hit'&&!e.wall).map(e=>({l,e}))),walls=L.flatMap(l=>l.ev.filter(e=>e.k==='hit'&&e.wall).map(e=>({l,e})));
  const tyres=L.flatMap(l=>l.ev.filter(e=>e.k==='tyre').map(e=>({l,e})));
  const med=median(L.filter(l=>l.kind==='lanciato'&&!l.invalid&&Number.isFinite(l.time)).map(l=>l.time));
  const boxLoss=box.map(l=>{const i=L.indexOf(l),o=L[i+1];const t=(l.time||l.estTime||NaN)+(o?(o.time||o.estTime||NaN):NaN);return t-2*med;});
  const C=(t,v,s,c)=>`<div class="kpi" style="--kc:${c}"><div class="l">${t}</div><div class="v">${v}</div><div class="s">${s||''}</div></div>`;
  const posLap=L.filter(l=>Number.isFinite(l.dpos));const gained=posLap.reduce((a,l)=>a+Math.max(0,l.dpos),0),lost=posLap.reduce((a,l)=>a+Math.max(0,-l.dpos),0);
  return `<div class="panel"><div class="panel-h"><h3>Eventi della sessione</h3><span class="hint">${esc(D.name.replace(/#\d+$/,''))} · rilevati dal file risultati</span></div><div class="kpis">
   ${C('Soste ai box',String(box.length),box.length?'giri '+box.map((l,i)=>`${l.num}${Number.isFinite(boxLoss[i])?' (−'+fx(boxLoss[i],0)+' s)':''}`).join(', '):'',tok('warn'))}
   ${gar.length?C('Rientri in garage',String(gar.length),'giri '+gar.map(l=>l.num).join(', '),tok('bad')):''}
   ${C('Giri invalidati',String(cnt('inv')),cnt('warn')?cnt('warn')+' avvisi':'',tok('bad'))}
   ${C('Fuori pista',String(cnt('nfa')),'senza conseguenze',tok('lapA'))}
   ${C('Contatti',String(hits.length),hits.length?[...new Set(hits.map(h=>String(h.e.with).replace(/#\d+$/,'')))].slice(0,4).join(', '):'',tok('warn'))}
   ${walls.length||cnt('dmg')?C('Muro / danni',`${walls.length} / ${cnt('dmg')}`,walls.length?'giri '+[...new Set(walls.map(w=>w.l.num))].join(', '):'',tok('bad')):''}
   ${cnt('pen')?C('Penalità',String(cnt('pen')),'',tok('bad')):''}
   ${cnt('sec')?C('Miglior settore',String(cnt('sec')),'volte il più veloce della classe',tok('best')):''}
   ${tyres.length?C('Cambi gomme',String(tyres.length),tyres.map(t=>`g.${t.l.num} ${t.e.txt.replace('gomme ','')}`).join(', '),tok('lapA')):''}
   ${posLap.length?C('Posizioni',`+${gained} / −${lost}`,'guadagnate / perse in pista',tok('good')):''}
  </div></div>`;}
function xmlStripHTML(D){
  const L=D.laps;const valid=L.filter(l=>l.kind==='lanciato'&&!l.invalid&&Number.isFinite(l.time));const best=valid.length?valid.reduce((a,b)=>a.time<b.time?a:b):null;
  const col=l=>{const t=Number.isFinite(l.time)?l.time:l.estTime;if(l.kind==='entrata box'||l.kind==='uscita box')return null;if(l.kind==='rientro garage')return tok('line');if(l.invalid)return tok('bad');if(l.kind!=='lanciato')return tok('faint');if(!Number.isFinite(t)||!best)return tok('line');if(l===best)return tok('best');if(t<=best.time+0.4)return tok('good');if(t<=best.time*1.01)return '#C9D1D9';if(t<=best.time*1.03)return tok('warn');return tok('lapB');};
  const cells=L.map(l=>{const c=col(l),pit=l.kind==='entrata box'||l.kind==='uscita box';const t=Number.isFinite(l.time)?l.time:l.estTime;const hit=l.ev.some(e=>e.k==='hit'||e.k==='dmg');
    return `${l.kind==='uscita garage'?'<span class="sep" title="dopo rientro in garage"></span>':''}<span class="lp ${pit?'pit':''}" style="${c?`background:${c}`:''}" title="Giro ${l.num} · ${Number.isFinite(t)?fmtLap(t):'senza tempo'} · ${l.kind}${l.invalid?' · invalidato':''}${hit?' · contatto':''}">${hit?'<span class="rn" style="background:var(--warn)"></span>':''}${l.num%5===0?`<span class="n">${l.num}</span>`:''}</span>`;}).join('');
  return `<div class="panel"><div class="panel-h"><h3>Giro per giro</h3><span class="hint">passa sopra un giro per i dettagli</span></div><div class="strip">${cells}</div>
   <div class="slegend"><span><i style="background:var(--best)"></i>miglior giro</span><span><i style="background:var(--good)"></i>entro 0,4 s</span><span><i style="background:#C9D1D9"></i>entro 1%</span><span><i style="background:var(--warn)"></i>entro 3%</span><span><i style="background:var(--lapB)"></i>più lento</span><span><i style="background:var(--bad)"></i>invalidato</span><span><i style="background:repeating-linear-gradient(45deg,var(--panel2) 0 3px,var(--line) 3px 6px)"></i>box in/out</span><span><i style="background:var(--line)"></i>garage / senza tempo</span><span><i style="background:var(--warn);height:4px;vertical-align:4px"></i>contatto</span></div></div>`;}
