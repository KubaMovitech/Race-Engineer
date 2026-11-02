// ================= ANALISI TECNICA: telemetry quality, dampers, axles and third element, platform and aero, events, diagnosis =================
// The Setup page tab «Analisi tecnica» (su:tab = 'dyn', menu «Analisi tecnica»). Computation is in chq.js and vdyn.js; this
// file draws it, links every event to the map and to synchronised traces, writes the setup cards (fenomeno → verifica) and
// keeps the setup each session was run with (a copy of its content, not only the name).
// A = the session you study (blue), B = the one you compare with (orange).

const TECH={tab:LS.get('vd:tab','q'),ev:null,full:false};
const TECH_TABS=[['q','Qualità telemetria'],['damp','Ammortizzatori'],['axle','Molle, assi e 3° elemento'],['plat','Piattaforma e aero'],['ev','Eventi'],['diag','Diagnosi']];
const TECH_WN={FL:'Ant. sx',FR:'Ant. dx',RL:'Post. sx',RR:'Post. dx'},TECH_SEC={FL:'FRONTLEFT',FR:'FRONTRIGHT',RL:'REARLEFT',RR:'REARRIGHT'};
const techPhN=k=>tr((VD_PH.find(p=>p[0]===k)||[0,k==='fast'?'Curva veloce':k||'—'])[1]);
const techOpt=()=>({knee:Math.max(10,+LS.get('vd:knee',LS.get('su:knee',50))||50),range:Math.max(100,+LS.get('vd:range',250)||250),bin:Math.max(5,+LS.get('vd:bin',10)||10)});
const REL_CLS={alta:'good',media:'warn',bassa:'bad','non analizzabile':'bad'};

// ---------- which laps, which part of the lap ----------
function techLaps(S){const m=LS.get('vd:laps','eng');if(m==='all'){const L=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid);return L.length?L:S.laps.filter(l=>l.complete);}return engLaps(S);}
function techSel(){const s=LS.get('vd:sel',null)||{};return {lap:s.lap??null,d0:s.d0??null,d1:s.d1??null,ph:s.ph||'all',c:s.c||''};}
// corners of the session on its best lap; distances of other laps are scaled to it
function techCorners(S){try{return dashData(S)?.cor||[];}catch(e){return [];}}
const techLen=S=>S.best?lapTrace(S,S.best).len:S.trackLen||0;
function techWhere(S,d,lapLen){const L=techLen(S);const dd=lapLen&&L?d*L/lapLen:d;const c=techCorners(S).find(c=>dd>=c.dS&&dd<=c.dE);return {d:dd,c:c?'T'+c.k:null,txt:`${c?'T'+c.k+' · ':''}${Math.round(dd)} m`};}
// the other session to compare with: same track, chosen by the user (or none)
function techB(S){const id=LS.get('vd:B','');const B=id?byId(id):null;return B&&B!==S&&B.kind==='ld'&&B.meta?.venue===S.meta?.venue?B:null;}

// ---------- the analyses for a session, cached by laps and options ----------
function techData(S,laps){const o=techOpt();const k='tech|'+laps.map(l=>l.i).join(',')+'|'+o.knee+'|'+o.range+'|'+o.bin+'|'+JSON.stringify(techSel())+'|'+(cfg().rh||3);if(S.cache.has(k))return S.cache.get(k);
  const sel=techSel();const X={laps,sel,opt:o};X.sus=vdSusp(S,laps,{...o,sel:sel.lap!=null||sel.d0!=null||sel.ph!=='all'?sel:null});X.ax=vdAxles(S,laps);X.pl=vdPlatform(S,laps,{rhMin:+cfg().rh||3});
  X.rel={};for(const a of ANA)X.rel[a.id]=chqReliability(S,laps,a.id,techRelOpts(a.id,X));S.cache.set(k,X);return X;}
// what each analysis uses for repeatability: one number per lap and the spread considered small
function techRelOpts(id,X){const W=Object.values(X.sus.w||{});const avgLap=k=>{const n=Math.max(0,...W.map(w=>w.perLap[k].length));return Array.from({length:n},(_,i)=>vdMean(W.map(w=>w.perLap[k][i])));};
  if(id==='damp')return {perLap:avgLap('bump95'),tol:15,unit:'mm/s',dec:0,samples:Math.min(...W.map(w=>w.n)),minSamples:3000};
  if(id==='susp')return {perLap:avgLap('travel'),tol:1,unit:'mm',dec:1};
  if(id==='axle'||id==='third')return {perLap:X.ax.perLap.map(p=>p.heaveF),tol:1,unit:'mm',dec:1};
  if(id==='plat'||id==='aero'){const o=X.pl.oscF?.perLap;return o?{perLap:techPerLapMean(o,'rms'),tol:0.6,unit:'mm',dec:1}:{};}
  return {};}
function techPerLapMean(arr,k){const by={};arr.forEach(o=>(by[o.lap]??=[]).push(o[k]));return Object.values(by).map(a=>vdMean(a));}

// ---------- small drawing helpers ----------
function techRel(r,lab){if(!r)return '';return `<span class="trel ${REL_CLS[r.label]||''}" title="${esc(r.why.join(' · '))}">${lab?esc(tr(lab))+' · ':''}${tr('affidabilità')} <b>${tr(r.label)}</b></span>`;}
function techRelWhy(r){return r?`<details class="trelw"><summary>${tr('Perché questa affidabilità')}</summary><ul>${r.why.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></details>`:'';}
// a line chart: series [{x:[],y:[],col,lab,w}], axes labels; numbers on the axes, no decoration
function techChart(series,{w=700,h=230,xl='',yl='',x0,x1,y0,y1,mark}={}){const P={l:48,r:12,t:12,b:34};const all=series.flatMap(s=>s.x.map((x,i)=>[x,s.y[i]])).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  if(all.length<2)return `<div class="empty small">${tr('Dati insufficienti per il grafico.')}</div>`;
  let X0=x0??Math.min(...all.map(p=>p[0])),X1=x1??Math.max(...all.map(p=>p[0])),Y0=y0??Math.min(...all.map(p=>p[1])),Y1=y1??Math.max(...all.map(p=>p[1]));if(Y1-Y0<1e-6){Y0-=1;Y1+=1;}const py=(Y1-Y0)*0.08;Y0-=py;Y1+=py;
  const sx=x=>P.l+(x-X0)/(X1-X0||1)*(w-P.l-P.r),sy=y=>h-P.b-(y-Y0)/(Y1-Y0)*(h-P.t-P.b);const tk=(a,b,n=5)=>{const st=Math.pow(10,Math.floor(Math.log10((b-a)/n||1)));const m=[1,2,5,10].find(m=>(b-a)/(st*m)<=n)*st;const o=[];for(let v=Math.ceil(a/m)*m;v<=b+1e-9;v+=m)o.push(+v.toFixed(6));return o;};
  const grid=tk(Y0,Y1).map(v=>`<line x1="${P.l}" x2="${w-P.r}" y1="${sy(v)}" y2="${sy(v)}" class="tg"/><text x="${P.l-6}" y="${sy(v)+4}" text-anchor="end">${+v.toFixed(2)}</text>`).join('')+tk(X0,X1,6).map(v=>`<text x="${sx(v)}" y="${h-P.b+16}" text-anchor="middle">${+v.toFixed(2)}</text>`).join('');
  const lines=series.map(s=>{const pts=s.x.map((x,i)=>Number.isFinite(x)&&Number.isFinite(s.y[i])?`${sx(x).toFixed(1)},${sy(s.y[i]).toFixed(1)}`:null);const segs=[];let cur=[];pts.forEach(p=>{if(p)cur.push(p);else if(cur.length){segs.push(cur);cur=[];}});if(cur.length)segs.push(cur);
    return segs.map(sg=>`<polyline points="${sg.join(' ')}" fill="none" stroke="${s.col}" stroke-width="${s.w||2}" stroke-linejoin="round"/>`).join('')+(s.dots?s.x.map((x,i)=>Number.isFinite(x)&&Number.isFinite(s.y[i])?`<circle cx="${sx(x).toFixed(1)}" cy="${sy(s.y[i]).toFixed(1)}" r="2.6" fill="${s.col}"/>`:'').join(''):'');}).join('');
  const mk=mark!=null&&mark>=X0&&mark<=X1?`<line x1="${sx(mark)}" x2="${sx(mark)}" y1="${P.t}" y2="${h-P.b}" class="tmk"/>`:'';
  const leg=series.filter(s=>s.lab).map(s=>`<span><i style="background:${s.col}"></i>${esc(s.lab)}</span>`).join('');
  return `<figure class="tch"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(yl)}">${grid}${lines}${mk}<text x="${w-P.r}" y="${h-4}" text-anchor="end" class="tal">${esc(xl)}</text><text x="${P.l}" y="${P.t-2}" class="tal">${esc(yl)}</text></svg>${leg?`<figcaption>${leg}</figcaption>`:''}</figure>`;}

// ---------- damper histogram with units, knee and samples out of range ----------
function techHist(H,knee,HB,sign){const W=Math.max(360,Math.min(760,(($('#techP')?.clientWidth||1560)-64)/2)),Hh=154,P={l:8,r:8,t:8,b:42};const nb=H.h.length,bw=(W-P.l-P.r)/nb;const tot=H.n||1,totB=HB?.n||1;
  const mx=Math.max(...H.h.map(x=>x/tot),...(HB?HB.h.map(x=>x/totB):[0]),1e-6);const x=v=>P.l+(v+H.range)/(2*H.range)*(W-P.l-P.r);const y=p=>Hh-P.b-p/mx*(Hh-P.t-P.b);
  const bars=H.h.map((c,i)=>{const v=-H.range+i*H.bin;const fast=Math.abs(v+H.bin/2)>=knee;return `<rect x="${(P.l+i*bw+0.4).toFixed(1)}" y="${y(c/tot).toFixed(1)}" width="${Math.max(0.5,bw-0.8).toFixed(1)}" height="${(Hh-P.b-y(c/tot)).toFixed(1)}" fill="var(--lapA)" opacity="${fast?0.5:0.95}"/>`;}).join('');
  const bl=HB?`<polyline fill="none" stroke="var(--lapB)" stroke-width="2" points="${HB.h.map((c,i)=>`${(P.l+(i+0.5)*bw).toFixed(1)},${y(c/totB).toFixed(1)}`).join(' ')}"/>`:'';
  const ticks=[-H.range,-H.range/2,0,H.range/2,H.range].map((v,i)=>`<text x="${x(v)}" y="${Hh-P.b+18}" text-anchor="${i===0?'start':i===4?'end':'middle'}">${v}</text>`).join('');
  const lo=H.lo/tot*100,hi=H.hi/tot*100;const neg=sign?tr('estensione'):tr('verso −'),pos=sign?tr('compressione'):tr('verso +');
  return `<svg class="thist" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(tr('Istogramma velocità ammortizzatore'))}">${bars}${bl}
    <line x1="${x(-knee)}" x2="${x(-knee)}" y1="${P.t}" y2="${Hh-P.b}" class="tmk"/><line x1="${x(knee)}" x2="${x(knee)}" y1="${P.t}" y2="${Hh-P.b}" class="tmk"/><line x1="${x(0)}" x2="${x(0)}" y1="${P.t}" y2="${Hh-P.b}" class="tz"/>
    ${ticks}<text x="${W/2}" y="${Hh-8}" text-anchor="middle" class="tal">mm/s · ← ${esc(neg)} · ${esc(pos)} →</text></svg>
    <div class="thx"><span class="${lo>0.5?'w':''}">${fx(lo,1)}% ${tr('sotto')} −${H.range}</span><span>${tr('soglia lento/veloce')} ±${knee} mm/s</span><span class="${hi>0.5?'w':''}">${fx(hi,1)}% ${tr('sopra')} +${H.range}</span></div>`;}

// ---------- 1. quality ----------
function techQualityHTML(S,X){const rows=ANA.map(a=>{const A=chqAnalysis(S,a);const r=X.rel[a.id];const st=A.st==='no'?['bad','Non utilizzabile']:A.st==='lim'?['warn','Limitata']:['good','Utilizzabile'];
    const lim=[...A.miss.map(m=>m.why),...A.lim.map(m=>m.why),...(A.optMiss.length?[tr('facoltativi mancanti')+': '+A.optMiss.map(m=>m.n.replace('#','FL/FR/RL/RR')).join(', ')]:[]),A.derived?tr('velocità ricavata dalla posizione'):'',A.st==='no'&&A.why?A.why:''].filter(Boolean);
    return `<tr><td class="l"><b>${tr(a.l)}</b></td><td><span class="tst ${st[0]}">${tr(st[1])}</span></td><td>${r?`<span class="tst ${REL_CLS[r.label]}">${tr(r.label)}</span>`:''}</td><td class="l small">${lim.length?[...new Set(lim)].map(esc).join('<br>'):'—'}${r&&A.st!=='no'?`<div class="muted">${esc(r.why.join(' · '))}</div>`:''}</td></tr>`;}).join('');
  const names=[...new Set([...CHQ_BASE,...ANA.flatMap(a=>[...a.need.flat(),...(a.opt||[])]).flatMap(chqExpand)])];
  const ch=names.map(n=>chqChannel(S,n)).filter(c=>c.st!=='mancante'||!/Damper Vel|Bump|Packer/.test(c.name));
  const certN={certa:'certa',convenzione:'convenzione LMU',incerta:'incerta'};
  const chRows=ch.map(c=>{const st=c.st==='misurato'?['good','misurato']:c.st==='limitato'?['warn','misurato, con limiti']:c.st==='piatto'?['bad','piatto: trattato come mancante']:['muted','non disponibile'];
    const conv=(c.conv||[]).filter(x=>x.k!==1||x.cert!=='certa').map(x=>`${x.from||'—'} → ${x.to}${x.k!==1?` (×${+x.k.toFixed(4)})`:''} · <span class="${x.cert==='incerta'?'w':''}">${tr(certN[x.cert]||x.cert)}</span>`).join('<br>');
    return `<tr><td class="l mono">${esc(c.name)}${c.alias?`<div class="muted">${tr('nel file')}: ${esc(c.alias)}</div>`:''}</td><td><span class="tst ${st[0]}">${tr(st[1])}</span></td><td class="mono">${c.raw?esc(c.raw.unit||'—'):'—'} → ${esc(c.u||'—')}</td><td class="l small">${conv||'—'}</td><td class="mono">${c.f?c.f+' Hz':'—'}${c.effHz&&c.f&&c.effHz<c.f*0.9?` <span class="w">(~${fx(c.effHz,0)})</span>`:''}</td><td class="l small">${esc(c.why||'')}</td></tr>`;}).join('');
  const sw=Object.values(X.sus.w);const vs=sw[0];
  const der=[[tr('Velocità ammortizzatore'),vs?.velSrc==='misurato'?tr('misurata (canale Damper Vel)'):vs?.filt?`${tr('derivata dalla posizione')}: Savitzky–Golay ${2*vs.filt.m+1} ${tr('campioni')} (${vs.filt.ms} ms) ${tr('su ogni giro separato, con 1 s di margine')}`:tr('non disponibile')],
    [tr('Segno compressione'),sw.length?VD_W.filter(w=>X.sus.w[w]).map(w=>`${w}: ${tr(X.sus.w[w].sign.cert)}`).join(' · '):tr('non disponibile')],
    [tr('Movimento comune e differenziale degli assi, indice di beccheggio'),X.ax.have?tr('derivati dalle quattro posizioni (indicatori, non la corsa delle molle)'):tr('non disponibile')],
    [tr('Rake'),X.pl.none?tr('non disponibile'):tr('derivato: altezza posteriore − anteriore in mm (non è un angolo: il passo non è nel file)')],
    [tr('Contatto con tampone / packer'),Object.values(X.ax.stops).some(r=>r?.st==='misurato')?tr('misurato'):Object.values(X.ax.stops).some(r=>r?.st==='stimato')||Object.values(X.ax.third).some(t=>t?.packer?.st==='stimato')?tr('stimato da evidenze convergenti (vedi Molle, assi e 3° elemento)'):tr('non determinabile o non rilevato')],
    [tr('Carico aerodinamico'),X.pl.aero?X.pl.aero.src:S.deadCh?.['Front Downforce']?tr('non disponibile: il gioco scrive 0 per questa auto'):tr('non disponibile')],
    [tr('Cordoli'),S.ch['Surface Type FL']?tr('misurati (Surface Type = cordolo)'):tr('non disponibili: senza Surface Type le analisi per cordolo sono escluse')]];
  return `<div class="tq"><div class="tqh"><p class="small">${tr('Prima di guardare i grafici: quali analisi si possono fare con questo file, quali canali mancano e cosa è misurato, derivato o stimato.')}</p></div>
    <table class="lbt tqt"><thead><tr><th class="l">${tr('Analisi')}</th><th>${tr('Canali')}</th><th>${tr('Affidabilità')}</th><th class="l">${tr('Limiti')}</th></tr></thead><tbody>${rows}</tbody></table>
    <h4>${tr('Grandezze calcolate')}</h4><div class="tkv">${der.map(([a,b])=>`<span>${esc(a)}</span><span>${esc(b)}</span>`).join('')}</div>
    <details class="tqd"><summary>${tr('Canali, unità, conversioni e frequenze')} (${ch.length})</summary><table class="lbt tqt"><thead><tr><th class="l">${tr('Canale')}</th><th>${tr('Stato')}</th><th>${tr('Unità')}</th><th class="l">${tr('Conversione')}</th><th>${tr('Frequenza')}</th><th class="l">${tr('Problemi')}</th></tr></thead><tbody>${chRows}</tbody></table>
      <p class="muted small">${tr('«Certa»: unità scritta nel file. «Convenzione LMU»: il gioco scrive gli angoli in radianti senza unità. «Incerta»: unità mancante, dedotta dal nome. Un canale piatto (sempre uguale con l\'auto in movimento) non contiene informazioni e viene trattato come mancante, non come zero.')}</p></details></div>`;}

// ---------- 2. dampers ----------
function techDampHTML(S,X,XB){const R=X.sus,RB=XB?.sus;const ws=VD_W.filter(w=>R.w[w]);
  if(!ws.length)return `<div class="warnbar">${tr('In questo file non ci sono le posizioni delle sospensioni: niente analisi degli ammortizzatori.')}</div>`;
  const o=X.opt;const signTxt=x=>{const s=x.sign;const ev=s.ev.map(e=>`${tr(e.lab)} ${e.r>0?'+':'−'}${fx(Math.abs(e.r),2)}`).join(', ');
    return s.sign?`${tr('compressione')} = ${tr('posizione che')} ${s.sign>0?tr('aumenta'):tr('diminuisce')} · <b class="${s.cert==='verificato'?'pos':'w'}">${tr(s.cert)}</b>${ev?` (${ev})`:''}`:`<b class="w">${tr('direzione di compressione non determinabile')}</b>: ${esc(tr(s.why||''))}`;};
  const cards=ws.map(w=>{const x=R.w[w],xb=RB?.w[w];const z=x.z;
    if(!x.hist.n)return `<div class="tdc"><div class="tdh"><b>${tr(TECH_WN[w])}</b><span class="tst bad">${tr('non analizzabile')}</span></div><p>${esc(x.velWhy||tr('Dati insufficienti'))}</p><p class="muted small">${tr('Nessun consiglio ammortizzatori da questo segnale.')}</p></div>`;
    return `<div class="tdc" data-w="${w}"><div class="tdh"><b>${tr(TECH_WN[w])}</b><span class="tst ${x.velSrc==='misurato'?'good':'muted'}">${tr(x.velSrc==='misurato'?'velocità misurata':'velocità derivata')}</span><span class="muted small">${fx(x.s,0)} s ${tr('di dati')}</span></div>
      <div class="small tsg">${signTxt(x)}</div>${techHist(x.hist,o.knee,xb?.hist,x.sign.sign)}
      <table class="lbt tzt"><thead><tr><th class="l"></th><th>${tr(x.sign.sign?'Estensione veloce':'Verso − veloce')}</th><th>${tr(x.sign.sign?'Estensione lenta':'Verso − lento')}</th><th>${tr(x.sign.sign?'Compressione lenta':'Verso + lento')}</th><th>${tr(x.sign.sign?'Compressione veloce':'Verso + veloce')}</th></tr></thead><tbody>
       <tr><td class="l"><b class="ca">A</b> % ${tr('tempo')}</td><td>${fx(z.fr,1)}</td><td>${fx(z.sr,1)}</td><td>${fx(z.sb,1)}</td><td>${fx(z.fb,1)}</td></tr>
       ${xb?`<tr><td class="l"><b class="cb">B</b> % ${tr('tempo')}</td><td>${fx(xb.z.fr,1)}</td><td>${fx(xb.z.sr,1)}</td><td>${fx(xb.z.sb,1)}</td><td>${fx(xb.z.fb,1)}</td></tr>`:''}</tbody></table>
      <div class="tkv small"><span>${tr('Velocità al 95%')}</span><span>${tr('compressione')} ${fx(x.bump95,0)} · ${tr('estensione')} ${fx(Math.abs(x.reb95),0)} mm/s${xb?` · <span class="cb">B ${fx(xb.bump95,0)} · ${fx(Math.abs(xb.reb95),0)}</span>`:''}</span>
       <span>${tr('Corsa usata (1–99%)')}</span><span>${x.travel?`${fx(x.travel.p1,1)} … ${fx(x.travel.p99,1)} mm · ${tr('massima osservata')} ${fx(x.travel.max,1)} mm`:'—'}${xb?.travel?` · <span class="cb">B ${fx(xb.travel.p1,1)} … ${fx(xb.travel.p99,1)}</span>`:''}</span></div></div>`;}).join('');
  const phs=VD_PH.map(p=>p[0]).filter(k=>ws.some(w=>R.w[w].ph[k]));
  const ptab=`<table class="lbt tpt"><thead><tr><th class="l">${tr('Fase')}</th>${ws.map(w=>`<th colspan="2">${w}</th>`).join('')}</tr><tr><th class="l"></th>${ws.map(()=>`<th>${tr('compr./est. 95%')}</th><th>${tr('corsa 1–99%')}</th>`).join('')}</tr></thead><tbody>
    ${phs.map(k=>`<tr><td class="l">${techPhN(k)} <span class="muted">${fx(Math.max(...ws.map(w=>R.w[w].ph[k]?.s||0)),0)} s</span></td>${ws.map(w=>{const p=R.w[w].ph[k];return p?`<td>${fx(p.bump95,0)} / ${fx(Math.abs(p.reb95),0)}</td><td>${fx(p.p1,1)} … ${fx(p.p99,1)}</td>`:'<td>—</td><td>—</td>';}).join('')}</tr>`).join('')}</tbody></table>`;
  return `<div class="tctl"><label class="f">${tr('Soglia lento / veloce')} (mm/s)<input type="number" id="vdKnee" min="10" step="5" value="${o.knee}"></label><label class="f">${tr('Scala')} ± (mm/s)<input type="number" id="vdRange" min="100" step="50" value="${o.range}"></label><label class="f">${tr('Classe')} (mm/s)<input type="number" id="vdBin" min="5" step="5" value="${o.bin}"></label>${techRel(X.rel.damp)}</div>
    <div class="tdg">${cards}</div><h4>${tr('Per fase del giro')}</h4>${ptab}
    <p class="muted small">${tr('Gli istogrammi descrivono come lavorano gli ammortizzatori; la loro forma o simmetria, da sola, non dice se una regolazione è giusta. Le barre chiare sono oltre la soglia lento/veloce; le percentuali fuori scala sono contate a parte. Fasi: frenata (freno > 5% e g laterale < 0,5), inserimento (freno con g laterale, o g laterale in aumento), appoggio, uscita (gas ≥ 30% con g laterale), rettilineo (g laterale < 0,3 sopra 100 km/h), cordolo (Surface Type della ruota).')}</p>${techRelWhy(X.rel.damp)}`;}

// ---------- 3. springs, axles, third element ----------
function techAxleHTML(S,X,XB){const A=X.ax,AB=XB?.ax;if(!A.have)return `<div class="warnbar">${tr('Servono le quattro posizioni delle sospensioni per l\'analisi degli assi.')}</div>`;
  const P=(o,k,d=1)=>o?.[k]?`${fx(o[k].p50,d)} <span class="muted">(${fx(o[k].p1,d)} … ${fx(o[k].p99,d)})</span>`:'—';
  const keys=[['heaveF','Anteriore · comune (mm)'],['heaveR','Posteriore · comune (mm)'],['rollF','Anteriore · sx − dx (mm)'],['rollR','Posteriore · sx − dx (mm)'],['pitchI','Indice di beccheggio: ant. − post. (mm)'],['t3F','3° elemento ant. (mm)'],['t3R','3° elemento post. (mm)'],['pitch','Beccheggio misurato (°)'],['roll','Rollio misurato (°)']];
  const phs=['str','brk','ent','mid','ext','kerb'].filter(k=>A.ph[k]);
  const tab=`<table class="lbt tpt"><thead><tr><th class="l"></th>${phs.map(k=>`<th>${techPhN(k)}</th>`).join('')}</tr></thead><tbody>${keys.filter(([k])=>phs.some(p=>A.ph[p][k])).map(([k,l])=>`<tr><td class="l">${tr(l)}</td>${phs.map(p=>`<td>${P(A.ph[p],k,k==='pitch'||k==='roll'?2:1)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  // against speed
  const sp=A.speed,spB=AB?.speed;let ch='';if(sp){const xs=sp.rows.map(b=>b+10);const sr=(o,k,col,lab)=>o&&o.curve[k]?{x:o.rows.map(b=>b+10),y:o.curve[k],col,lab}:null;
    ch=`<div class="tcg">${techChart([sr(sp,'heaveF','var(--lapA)','A'),sr(spB,'heaveF','var(--lapB)','B')].filter(Boolean),{xl:'km/h',yl:tr('Anteriore · compressione comune (mm)')})}${techChart([sr(sp,'heaveR','var(--lapA)','A'),sr(spB,'heaveR','var(--lapB)','B')].filter(Boolean),{xl:'km/h',yl:tr('Posteriore · compressione comune (mm)')})}</div>
      <div class="tkv small">${['heaveF','heaveR','t3F','t3R'].filter(k=>sp.fit[k]).map(k=>`<span>${tr(keys.find(x=>x[0]===k)[1])}</span><span>${fx(sp.fit[k].b,2)} mm ${tr('per')} (100 km/h)² · r² ${fx(sp.fit[k].r2,2)}${spB?.fit[k]?` · <span class="cb">B ${fx(spB.fit[k].b,2)}</span>`:''}</span>`).join('')}</div>`;}
  // third element and packers
  const th=['F','R'].map(ax=>{const t=A.third[ax];if(!t)return '';const pk=t.packer;const cls={stimato:'warn',possibile:'muted','non rilevato':'good','non determinabile':'muted'}[pk.st]||'muted';
    return `<div class="tbox"><b>${tr(ax==='F'?'3° elemento anteriore':'3° elemento posteriore')}</b> <span class="muted small">${tr('canale misurato')}</span>
      <div class="tkv small"><span>${tr('Posizione in rettilineo')}</span><span>${fx(t.p50,1)} mm (${fx(t.p1,1)} … ${fx(t.p99,1)})</span>
      ${Number.isFinite(t.same)?`<span>${tr('Rispetto alla media delle due ruote')}</span><span>r = ${fx(t.same,2)}${t.same>0.98?' · '+tr('il canale coincide con il movimento comune delle ruote: non aggiunge informazioni'):''}</span>`:''}
      <span>${tr('Contatto con il packer')}</span><span><span class="tst ${cls}">${tr(pk.st)}</span>${pk.at!=null?` ${tr('livello')} ≈ ${fx(t.bands?.top??pk.at,1)} mm`:''}</span></div>
      ${pk.ev.length?`<ul class="small">${pk.ev.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:''}${pk.why?`<p class="muted small">${esc(pk.why)}</p>`:''}</div>`;}).join('');
  const st=VD_W.map(w=>{const r=A.stops[w];if(!r)return '';const cls={misurato:'good',stimato:'warn','non rilevato':'good','non determinabile':'muted'}[r.st];
    return `<tr><td class="l">${tr(TECH_WN[w])}</td><td>${fx(r.obsMax,1)} mm</td><td><span class="tst ${cls}">${tr(r.st)}</span></td><td>${r.at!=null?`≈ ${fx(r.at,0)} mm`:'—'}</td><td>${r.st==='stimato'&&Number.isFinite(r.obsP99)?`${fx(r.at-r.obsP99,1)} mm`:'—'}</td><td class="l small">${esc(r.why||'')}${r.ev?.length?' · '+esc(r.ev.join(' · ')):''}</td></tr>`;}).join('');
  const br=A.brake,rl=A.roll;
  const extra=`<div class="tkv small">${br?`<span>${tr('Frenata: movimento comune per % di freno')}</span><span>${tr('ant.')} ${fx(br.F?.b,3)} · ${tr('post.')} ${fx(br.R?.b,3)} mm/%${Number.isFinite(br.diveF)?` · ${tr('con freno > 60% rispetto al rettilineo')}: ${tr('ant.')} ${br.diveF>0?'+':''}${fx(br.diveF,1)} · ${tr('post.')} ${br.diveR>0?'+':''}${fx(br.diveR,1)} mm`:''}</span>`:''}
    ${rl?`<span>${tr('Rollio per g laterale')}</span><span>${tr('ant.')} ${fx(Math.abs(rl.F?.b),2)} · ${tr('post.')} ${fx(Math.abs(rl.R?.b),2)} mm/g${rl.body?` · ${tr('scocca')} ${fx(Math.abs(rl.body.b),2)} °/g (${tr('misurato')})`:''}</span>`:''}</div>
    <p class="muted small">${tr('Il rollio per g di anteriore e posteriore dipende da molle, barre, rapporti di installazione e geometria: il loro rapporto da solo non dice il bilanciamento meccanico. Sostegno a regime (molle, 3° elemento, packer) e controllo dei transitori (ammortizzatori) si leggono separatamente: il primo nelle mediane per fase e con la velocità, il secondo negli istogrammi e negli eventi.')}</p>`;
  return `<div class="tctl">${techRel(X.rel.axle,'Assi')}${techRel(X.rel.third,'3° elemento')}</div>${tab}<h4>${tr('Con la velocità (rettilinei)')}</h4>${ch}
    <h4>${tr('Terzo elemento e packer')}</h4><div class="tcg">${th}</div>
    <h4>${tr('Tamponi alle ruote')}</h4><table class="lbt tpt"><thead><tr><th class="l"></th><th>${tr('Massima corsa osservata')}</th><th>${tr('Contatto')}</th><th>${tr('Dove')}</th><th>${tr('Margine dal contatto stimato')}</th><th class="l"></th></tr></thead><tbody>${st}</tbody></table>
    <p class="muted small">${tr('La massima corsa osservata non è il fine corsa: un percentile non identifica un tampone. Il contatto è «misurato» solo con un canale dedicato, «stimato» quando la rigidezza (forza della sospensione rispetto alla posizione, a bassa velocità dell\'ammortizzatore) sale di colpo, altrimenti non determinabile.')}</p>${extra}${techRelWhy(X.rel.axle)}`;}

// ---------- 4. platform and aero ----------
function techPlatHTML(S,X,XB){const P=X.pl,PB=XB?.pl;if(P.none)return `<div class="warnbar">${tr('In questo file non ci sono le altezze da terra: niente analisi della piattaforma.')}</div>`;
  const sr=(o,k,col,lab)=>o?.speed?{x:o.speed.rows.map(b=>b+10),y:o.speed[k],col,lab}:null;
  const charts=P.speed?`<div class="tcg3">${techChart([sr(P,'F','var(--lapA)','A'),sr(PB,'F','var(--lapB)','B')].filter(Boolean),{w:480,xl:'km/h',yl:tr('Altezza anteriore (mm)')})}${techChart([sr(P,'R','var(--lapA)','A'),sr(PB,'R','var(--lapB)','B')].filter(Boolean),{w:480,xl:'km/h',yl:tr('Altezza posteriore (mm)')})}${techChart([sr(P,'rake','var(--lapA)','A'),sr(PB,'rake','var(--lapB)','B')].filter(Boolean),{w:480,xl:'km/h',yl:tr('Rake: post. − ant. (mm)')})}</div>`:`<p class="muted">${tr('Pochi dati in rettilineo per il grafico con la velocità.')}</p>`;
  const phs=['str','brk','fast','mid','ext','kerb'].filter(k=>P.ph[k]);
  const row=(l,f,d=1)=>`<tr><td class="l">${tr(l)}</td>${phs.map(k=>`<td>${f(P.ph[k],PB?.ph[k])}</td>`).join('')}</tr>`;const ab=(a,b,k,d=1)=>`${fx(a?.[k],d)}${b?` <span class="cb">${fx(b[k],d)}</span>`:''}`;
  const tab=`<table class="lbt tpt"><thead><tr><th class="l"></th>${phs.map(k=>`<th>${techPhN(k)}</th>`).join('')}</tr></thead><tbody>${row('Velocità mediana (km/h)',(a,b)=>ab(a,b,'v',0))}${row('Altezza anteriore (mm)',(a,b)=>ab(a,b,'F'))}${row('Altezza posteriore (mm)',(a,b)=>ab(a,b,'R'))}${row('Rake post. − ant. (mm)',(a,b)=>ab(a,b,'rake'))}${row('Minima ant. / post. (1%)',(a,b)=>`${fx(a?.Fmin,1)} / ${fx(a?.Rmin,1)}`)}${row('Tempo (s)',(a)=>fx(a?.s,0))}</tbody></table>`;
  const osc=['F','R'].map(ax=>{const o=P['osc'+ax],ob=PB?.['osc'+ax];return o?`<span>${tr(ax==='F'?'Oscillazione anteriore in rettilineo':'Oscillazione posteriore in rettilineo')}</span><span>± ${fx(o.rms,1)} mm ${tr('a circa')} ${fx(o.hz,1)} Hz${ob?` · <span class="cb">B ± ${fx(ob.rms,1)} mm</span>`:''}</span>`:'';}).join('');
  const aero=P.aero?`<h4>${tr('Carico aerodinamico')}</h4><p class="small">${esc(P.aero.src)}</p>${techChart([{x:P.aero.rows.map(b=>b+10),y:P.aero.bal,col:'var(--lapA)',lab:tr('% anteriore')}],{xl:'km/h',yl:tr('Ripartizione anteriore (%)')})}`
    :`<p class="muted small">${tr('Carico aerodinamico')}: ${S.deadCh?.['Front Downforce']?tr('i canali ci sono ma valgono sempre 0 per questa auto: non disponibile.'):tr('non presente nel file.')} ${tr('Senza mappe aerodinamiche dell\'auto non si può dire quanto carico c\'è né come si ripartisce: le altezze con la velocità mostrano come si muove la piattaforma, non il carico.')}</p>`;
  const low=P.lowG.slice(0,8).map(g=>{const e=g.ev[0];const W=techWhere(S,g.d,lapTrace(S,S.laps[e.li]).len);const gv=vdMed(g.ev.map(x=>x.gv));
    return `<tr class="tevr" data-k="low" data-w="${g.w}" data-d="${Math.round(g.d)}" data-li="${e.li}" data-t="${e.t}"><td class="l">${esc(W.txt)}</td><td>${g.w}</td><td>${techPhN(g.ph)}</td><td>${g.n}/${X.laps.length}${g.rep?' ✓':''}</td><td>${fx(vdMed(g.ev.map(x=>x.min)),1)} mm</td><td>${g.kerb>0.5?tr('su cordolo'):Number.isFinite(gv)&&gv>2?tr('possibile contatto col suolo (picco')+' '+fx(gv,1)+' g)':'—'}</td></tr>`;}).join('');
  return `<div class="tctl">${techRel(X.rel.plat,'Piattaforma')}${techRel(X.rel.aero,'Aerodinamica')}</div>${charts}
    <p class="muted small">${tr('Rake = altezza posteriore − anteriore, in mm: non è un angolo (servirebbe il passo dell\'auto). Più rake non vuol dire sempre più carico anteriore: dipende dalla vettura. Per capire l\'effetto sulla tua auto: prova controllata, cambia solo l\'altezza posteriore di 1 mm e confronta le curve veloci a parità di carburante e gomme.')}</p>
    <h4>${tr('Per fase')}</h4>${tab}<div class="tkv small">${osc}</div>
    <h4>${tr('Altezze sotto')} ${P.rhMin} mm <span class="muted small">(${tr('soglia in Obiettivi di riferimento')})</span></h4>${low?`<table class="lbt tpt tev"><thead><tr><th class="l">${tr('Dove')}</th><th>${tr('Ruota')}</th><th>${tr('Fase')}</th><th>${tr('Giri')}</th><th>${tr('Minima')}</th><th>${tr('Indizi')}</th></tr></thead><tbody>${low}</tbody></table>`:`<p class="small">${tr('Nessun punto sotto la soglia.')}</p>`}
    <p class="muted small">${tr('Come distinguere: su cordolo = cordolo (non è la piattaforma); in frenata = beccheggio e sostegno anteriore; in rettilineo o curva veloce = carico aerodinamico e sostegno a regime; se capita in un solo giro è più probabilmente guida o traffico.')}</p>${aero}${techRelWhy(X.rel.plat)}`;}

// ---------- 5. events: list, map and synchronised traces ----------
function techEvRows(S,X){const R=X.sus;const n=X.laps.length;const lenOf=li=>lapTrace(S,S.laps[li]).len;
  return R.groups.filter(g=>g.k!=='max'||g.rep).slice(0,40).map(g=>{const e=g.ev[0];const W=techWhere(S,g.d,lenOf(e.li));const m=k=>vdMed(g.ev.map(x=>x[k]));
    const val=g.k==='unload'?`${tr('minimo')} ${fx(m('min'),0)} N · ${fx(m('dur'),2)} s · ${tr('recupero')} ${fx(m('rec'),2)} s`:g.k==='osc'?`${fx(m('cycles'),1)} ${tr('cicli')} · ${fx(m('hz'),1)} Hz · ${tr('smorzamento')} ${fx(m('decay'),2)}`:g.k==='rec'?`${tr('scarto')} ${fx(m('dev'),1)} mm · ${tr('recupero')} ${Number.isFinite(m('rec'))?fx(m('rec'),2)+' s':'> '+VD_EV.recMax+' s'}`:g.k==='pack'?`+${fx(m('rise'),1)} mm ${tr('in')} ${fx(m('hits'),0)} ${tr('colpi')}`:`${fx(m('val'),1)} mm (${tr('soglia')} ${fx(e.thr,1)})`;
    return `<tr class="tevr" data-k="${g.k}" data-w="${g.w}" data-d="${Math.round(g.d)}" data-li="${e.li}" data-t="${e.t.toFixed(3)}"><td class="l"><b>${tr(VD_EVN[g.k])}</b></td><td>${g.w}</td><td class="l">${esc(W.txt)}</td><td>${techPhN(g.ph)}${g.kerb>0.5&&g.ph!=='kerb'?' · '+tr('cordolo'):''}</td><td>${g.n}/${n}${g.rep?` <span class="pos">${tr('ripetibile')}</span>`:''}</td><td class="l small">${val}</td></tr>`;}).join('');}
function techEvHTML(S,X){const rows=techEvRows(S,X);
  return `<div class="tevw"><div class="tevl">${rows?`<table class="lbt tpt tev"><thead><tr><th class="l">${tr('Evento')}</th><th>${tr('Ruota')}</th><th class="l">${tr('Dove')}</th><th>${tr('Fase')}</th><th>${tr('Giri')}</th><th class="l">${tr('Valori tipici')}</th></tr></thead><tbody>${rows}</tbody></table>`:`<p>${tr('Nessun evento trovato nei giri scelti.')}</p>`}
    <p class="muted small">${tr('Soglie')}: ${tr('ruota scarica sotto il 10% del carico mediano del giro (minimo 300 N) per almeno 30 ms; oscillazione = almeno 4 estremi alternati oltre')} ${VD_EV.amin} mm ${tr('entro 0,6 s da una sollecitazione oltre')} ${VD_EV.vstim} mm/s; ${tr('recupero lento oltre')} ${VD_EV.recSlow} s ${tr('(valutato solo con pedali e g laterale stabili)')}; ${tr('accumulo = almeno 3 colpi a meno di 0,5 s con la posizione tra un colpo e l\'altro che sale di oltre')} ${VD_EV.pack} mm. ${tr('Ripetibile = nello stesso punto (± 40 m) in almeno il 60% dei giri.')}</p></div>
    <div class="tevd" id="techEvD">${TECH.ev?'':`<div class="empty small">${tr('Scegli un evento: qui compaiono il punto sulla mappa e i segnali sincronizzati.')}</div>`}</div></div>`;}
// detail of one event: the map with the point, and position / velocity / load / speed around it, with one cursor for all
function techEvDetail(S,ev){const box=$('#techEvD');if(!box)return;const lap=S.laps[ev.li];if(!lap){box.innerHTML='';return;}
  const sg=vdSign(S,techLaps(S),ev.w);const L=ev.k==='low'?null:vdLap(S,lap,ev.w,sg.sign||1);const t=+ev.t,T=1.2;
  const series=[];const add=(lab,arr,f,t0,u,col)=>{if(!arr)return;const i0=Math.max(0,Math.floor((t-T-t0)*f)),i1=Math.min(arr.length,Math.ceil((t+T-t0)*f));const x=[],y=[];for(let i=i0;i<i1;i++){x.push(t0+i/f-t);y.push(arr[i]);}series.push({lab,u,x,y,col});};
  if(L){add(tr('Compressione'),L.comp,L.f,L.t0,'mm','var(--lapA)');add(tr('Velocità ammortizzatore'),L.cv,L.f,L.t0,'mm/s','var(--lapA)');add(tr('Carico gomma'),L.ld,L.f,L.t0,'N','#E6C877');add(tr('Velocità'),L.sp,L.f,L.t0,'km/h','#C9CDD3');}
  else{const c=S.ch['Ride Height '+ev.w];if(c){const s=vdSeg(c,lap.t0,lap.t1,0);add(tr('Altezza da terra'),s.v.subarray(s.a,s.b),s.f,s.ts+s.a/s.f-lap.t0,'mm','var(--lapA)');}const g=S.ch['G Force Vert'];if(g){const s=vdSeg(g,lap.t0,lap.t1,0);add(tr('G verticale'),s.v.subarray(s.a,s.b),s.f,s.ts+s.a/s.f-lap.t0,'g','#E6C877');}const v=S.ch['Ground Speed'];if(v){const s=vdSeg(v,lap.t0,lap.t1,0);add(tr('Velocità'),s.v.subarray(s.a,s.b),s.f,s.ts+s.a/s.f-lap.t0,'km/h','#C9CDD3');}}
  const W=360,H=78;const tr_=lapTrace(S,lap);const where=techWhere(S,vdDist(tr_,t),tr_.len);
  const traces=series.map((s,k)=>{const fin=s.y.filter(Number.isFinite);if(!fin.length)return '';let lo=Math.min(...fin),hi=Math.max(...fin);if(hi-lo<1e-6){lo-=1;hi+=1;}const X=x=>(x+T)/(2*T)*W,Y=y=>H-6-(y-lo)/(hi-lo)*(H-14);
    const pts=s.x.map((x,i)=>Number.isFinite(s.y[i])?`${X(x).toFixed(1)},${Y(s.y[i]).toFixed(1)}`:'').filter(Boolean).join(' ');
    return `<div class="tetr"><div class="tetl"><span>${esc(s.lab)}</span><b data-k="${k}">—</b><small>${s.u}</small></div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="${W/2}" x2="${W/2}" y1="0" y2="${H}" class="tz"/><polyline points="${pts}" fill="none" stroke="${s.col}" stroke-width="1.6"/><line class="tcur" x1="${W/2}" x2="${W/2}" y1="0" y2="${H}"/></svg></div>`;}).join('');
  let map='';try{const d=dashData(S);if(d?.xy){const P=dashFit(d.xy,300,200,14);const BL=techLen(S);const at=dd=>P[Math.max(0,Math.min(P.length-1,Math.round(dd/BL*(P.length-1))))];const p=at(where.d);
    map=`<svg class="temap" viewBox="0 0 300 200"><path d="M${P.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join('L')}" class="tmapl"/><circle cx="${p[0]}" cy="${p[1]}" r="7" class="tmapp"/><circle class="tmapc" cx="${p[0]}" cy="${p[1]}" r="4"/></svg>`;TECH._map={at,tr:tr_,len:tr_.len,BL};}}catch(e){}
  box.innerHTML=`<div class="tedh"><b>${tr(VD_EVN[ev.k]||'Altezza molto bassa')}</b> · ${ev.w} · ${tr('giro')} ${lap.num} · ${esc(where.txt)}<button type="button" class="btn" id="techTele">${tr('Apri in Telemetria')}</button></div>
    <div class="tedb">${map}<div class="tetrs" id="techTr">${traces}<div class="tetx"><span>−${T} s</span><span>${tr('evento')}</span><span>+${T} s</span></div></div></div>`;
  const tw=$('#techTr');const upd=fx_=>{const x=(fx_-0.5)*2*T;tw.querySelectorAll('.tcur').forEach(l=>{l.setAttribute('x1',fx_*W);l.setAttribute('x2',fx_*W);});
    series.forEach((s,k)=>{let j=0;for(let i=0;i<s.x.length;i++)if(Math.abs(s.x[i]-x)<Math.abs(s.x[j]-x))j=i;const b=tw.querySelector(`b[data-k="${k}"]`);if(b)b.textContent=fx(s.y[j],s.u==='N'||s.u==='mm/s'||s.u==='km/h'?0:1);});
    const M=TECH._map;if(M){const p=M.at(vdDist(M.tr,t+x)*M.BL/M.len);const c=box.querySelector('.tmapc');if(c&&p){c.setAttribute('cx',p[0]);c.setAttribute('cy',p[1]);}}};
  tw.querySelectorAll('svg').forEach(sv=>sv.addEventListener('pointermove',e=>{const r=sv.getBoundingClientRect();upd(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)));}));upd(0.5);
  $('#techTele').onclick=()=>techOpenTele(S,lap,vdDist(tr_,t));}
// open Telemetria on this lap at this distance (the trace panels the user chose stay as they are)
function techOpenTele(S,lap,d){TW.SA=S;TW.a=lap.i;TW.auto=false;showView('tele');setTimeout(()=>{const D=TW.D;if(!D||!TW.tr)return;const i=Math.max(0,Math.min(D.n-1,Math.round(d/D.step)));TW.tr.setRange(Math.max(0,d-160),d+160,true);TW.map?.fitRange?.(Math.max(0,i-160/D.step|0),Math.min(D.n-1,i+160/D.step|0));twCursor(i,'corner');},450);}

// ---------- 6. diagnosis: one card per phenomenon, from what was measured ----------
// card: fenomeno · dove/quando · evidenze · ripetibilità · cause (supportate o no) · affidabilità e limiti · una modifica ·
// valore nel .svm · risultato atteso e metrica · esito prima/dopo (from the guided test, when one was run)
function techPerLapAt(S,laps,kind,w,frac,field){return laps.map(l=>{const len=lapTrace(S,l).len,d=frac*len;
  if(kind==='low'){const c=S.ch['Ride Height '+w];if(!c)return NaN;const tr_=lapTrace(S,l);let mn=Infinity;for(let i=0;i<tr_.t.length;i++){if(Math.abs(tr_.d[i]-d)>40)continue;const v=sampleAt(c,l.t0+tr_.t[i]);if(v<mn)mn=v;}return Number.isFinite(mn)?mn:NaN;}
  const sg=vdSign(S,laps,w);const L=vdLap(S,l,w,sg.sign||1);if(!L)return NaN;const E=vdEvents(S,[L],w,sg).filter(e=>e.k===kind&&Math.abs(e.d-d)<40);
  if(!E.length)return kind==='rec'?NaN:0;return field==='rec'?vdMed(E.map(e=>e.rec)):Math.max(...E.map(e=>e[field]));});}
const TECH_METRIC={unload:['dur','Durata dello scarico','s',2],osc:['cycles','Cicli di oscillazione','',1],rec:['rec','Tempo di recupero','s',2],pack:['rise','Compressione accumulata','mm',1],low:['min','Altezza minima nel punto','mm',1]};
function techCards(S,laps,su,X){X=X||techData(S,laps);const C=[];const n=laps.length;const lenOf=li=>lapTrace(S,S.laps[li]).len;
  const val=(k,sec)=>su?setupVal(su,k,sec):null;const m=(g,k)=>vdMed(g.ev.map(e=>e[k]));
  // the same phenomenon of the same wheel (or axle, for a wheel lifting in a corner) in several places is ONE card:
  // its place is the worst one, the other places are listed
  const score=g=>{const k={unload:'dur',rec:'rec',osc:'cycles',pack:'rise',low:'min'}[g.k];const v=vdMed(g.ev.map(e=>e[k]));return g.k==='low'?-v:Number.isFinite(v)?v:9;};
  const keyOf=g=>g.k==='unload'&&!(g.kerb>0.5)?g.k+':'+g.w[0]+':n':g.k+':'+g.w+':'+(g.kerb>0.5?'k':'n');
  const merge=G=>{const by={};G.forEach(g=>(by[keyOf(g)]??=[]).push(g));return Object.values(by).map(a=>{a.sort((x,y)=>score(y)-score(x));return {...a[0],others:a.slice(1)};});};
  const mk=(g,o)=>{const e=g.ev[0];const L=lenOf(e.li);const W=techWhere(S,g.d,L);
    if(g.others?.length)o.ev=[...o.ev,`${tr('stesso fenomeno anche in')} ${g.others.length} ${g.others.length===1?tr('altro punto'):tr('altri punti')}: ${g.others.slice(0,5).map(x=>techWhere(S,x.d,lenOf(x.ev[0].li)).txt).join(', ')}${g.others.length>5?'…':''}`];const frac=g.d/L;const M=TECH_METRIC[g.k];const per=techPerLapAt(S,laps,g.k,g.w,frac,M[0]);
    const rel=chqReliability(S,laps,g.k==='low'?'plat':g.k==='unload'?'load':'damp',{perLap:per,tol:o.tol,unit:M[2],dec:M[3]});
    // Observations may remain visible, but unusable signals must never generate setup changes.
    const directionOK=!['rec','pack','osc'].includes(g.k)||X.sus.w[g.w]?.sign.sign;
    const available=!su||!o.fx?.key||val(o.fx.key,o.fx.sec)!=null;
    const fx0=o.fx&&rel.lv>0&&directionOK&&available?{...o.fx,label:SETUP_LABELS[o.fx.key]||o.fx.key,now:o.fx.key?val(o.fx.key,o.fx.sec):null}:null;
    C.push({id:g.k+':'+g.w+':'+Math.round(frac*1000),k:g.k,w:g.w,s:o.s,a:o.a,cat:o.cat,t:o.t,where:{txt:`${W.txt} · ${techPhN(g.ph)}${g.kerb>0.5&&g.ph!=='kerb'?' · '+tr('cordolo'):''}`,d:W.d,li:e.li,te:e.t},
      ev:o.ev.filter(Boolean),rep:{n:g.n,of:n,txt:`${g.n} ${tr('giri su')} ${n}${g.rep?' · '+tr('ripetibile'):' · '+tr('non ripetibile')}`,per},causes:o.causes,rel,fx:fx0,expect:o.expect,
      pt:{loc:1,k:g.k,w:g.w,frac,field:M[0],label:M[1],unit:M[2],dec:M[3],better:g.k==='low'?1:-1,minDiff:o.minDiff||0}});};
  for(const g of merge(X.sus.groups.filter(g=>g.rep&&g.k!=='max'))){const ax=g.w[0]==='F'?'Front':'Rear',sec=TECH_SEC[g.w],WNw=tr(TECH_WN[g.w]);
    if(g.k==='unload'){const kerb=g.kerb>0.5,rec=m(g,'rec'),dur=m(g,'dur');
      mk(g,{s:kerb&&rec>0.4?2:1,a:'sos',cat:kerb?'transitori':'rollio',t:kerb?`${WNw}: ${tr('la ruota si scarica sul cordolo')}`:`${tr(g.w[0]==='F'?'Anteriore':'Posteriore')}: ${tr('la ruota interna si scarica in curva')}`,tol:0.05,minDiff:0.02,
        ev:[g.others?.length&&!(g.kerb>0.5)?`${tr('ruota')} ${g.w}`:'',`${tr('carico minimo')} ${fx(m(g,'min'),0)} N (${tr('soglia')} ${fx(m(g,'lim'),0)} N)`,`${tr('scarico per')} ${fx(dur,2)} s`,Number.isFinite(rec)?`${tr('carico all\'80% dopo')} ${fx(rec,2)} s`:tr('carico che non torna all\'80% entro 1 s'),Number.isFinite(m(g,'gv'))?`${tr('picco verticale')} ${fx(m(g,'gv'),1)} g`:''],
        causes:kerb?[{t:tr('Cordolo: la ruota viene sollevata'),sup:'sì',why:`${fx(g.kerb*100,0)}% ${tr('dei casi con Surface Type = cordolo')}`},{t:tr('Estensione veloce lenta a riportare giù la ruota'),sup:rec>0.15?'compatibile':'no',why:`${tr('recupero del carico')} ${fx(rec,2)} s`},{t:tr('Quanto cordolo prendi (traiettoria)'),sup:'non valutabile',why:tr('confronta Path Lateral in Telemetria tra i giri')}]
          :[{t:tr('Trasferimento di carico in rollio: ruota interna scarica'),sup:['mid','ext','ent'].includes(g.ph)?'compatibile':'no',why:`${tr('fase')}: ${techPhN(g.ph)}`},{t:tr('Barra antirollio rigida su questo asse'),sup:'possibile',why:tr('la rigidezza in rollio non si misura dalla telemetria: si verifica con la prova')},{t:tr('Sconnessione della pista'),sup:m(g,'gv')>1.5?'compatibile':'no',why:Number.isFinite(m(g,'gv'))?`${tr('picco verticale')} ${fx(m(g,'gv'),1)} g`:tr('manca G verticale')}],
        fx:kerb?{key:'FastReboundSetting',sec,dir:tr('estensione veloce 1 click più morbida'),why:tr('la ruota torna a terra prima dopo il cordolo')}:{key:ax+'AntiSwaySetting',sec:null,dir:tr('barra 1 click più morbida'),why:tr('resta più carico sulla ruota interna (effetto anche sul bilanciamento)')},
        expect:kerb?tr('Nello stesso punto lo scarico dura meno e il carico torna prima. Verifica: durata dello scarico e tempo di recupero del carico nella prova successiva.'):tr('Nello stesso punto la ruota interna resta più carica. Verifica: durata dello scarico; controlla anche che il bilanciamento in curva non peggiori.')});}
    else if(g.k==='rec'){const comp=vdMode(g.ev.map(e=>e.dir))==='compressione';const vret=m(g,'dev')/Math.max(0.01,m(g,'rec')||VD_EV.recMax);const fast=vret>=X.opt.knee;
      const key=comp?(fast?'FastReboundSetting':'SlowReboundSetting'):(fast?'FastBumpSetting':'SlowBumpSetting');
      mk(g,{s:1,a:'sos',cat:'transitori',t:`${WNw}: ${tr('recupero lento dopo una sollecitazione')}`,tol:0.08,minDiff:0.03,
        ev:[`${tr('scarto')} ${fx(m(g,'dev'),1)} mm ${tr('in')} ${tr(comp?'compressione':'estensione')}`,`${tr('torna entro il 25% in')} ${Number.isFinite(m(g,'rec'))?fx(m(g,'rec'),2)+' s':'> '+VD_EV.recMax+' s'} (${tr('soglia')} ${VD_EV.recSlow} s)`,`${tr('velocità media di ritorno')} ≈ ${fx(vret,0)} mm/s`],
        causes:[{t:tr(comp?'Smorzamento in estensione che frena il ritorno':'Smorzamento in compressione che frena il ritorno'),sup:'compatibile',why:tr('ritorno lento con pedali e g laterale stabili')},{t:tr('Molla morbida'),sup:'non determinabile',why:tr('la molla decide dove si ferma la sospensione: senza la curva dell\'ammortizzatore non si separano i due effetti')},{t:tr('Cambio di guida durante il recupero'),sup:'no',why:tr('evento valutato solo con pedali e g laterale stabili')}],
        fx:{key,sec,dir:tr(`${comp?'estensione':'compressione'} ${fast?'veloce':'lenta'} 1 click più morbida`),why:tr('la sospensione torna prima alla sua posizione')},
        expect:tr('Tempo di recupero più corto nello stesso punto, senza nuove oscillazioni. Verifica: tempo di recupero e oscillazioni nella prova successiva.')});}
    else if(g.k==='osc'){const hz=m(g,'hz'),dec=m(g,'decay');const wheel=hz>=6;
      mk(g,{s:1,a:'sos',cat:'transitori',t:`${WNw}: ${tr('oscillazioni ripetute dopo una sollecitazione')}`,tol:0.6,minDiff:0.5,
        ev:[`${fx(m(g,'cycles'),1)} ${tr('cicli')} ${tr('a')} ${fx(hz,1)} Hz`,`${tr('ampiezza finale / iniziale')} ${fx(dec,2)}`,`${tr('ampiezza')} ${fx(m(g,'amp'),1)} mm`],
        causes:[{t:tr('Smorzamento basso per questo movimento'),sup:dec>0.5?'compatibile':'possibile',why:`${tr('l\'ampiezza cala solo al')} ${fx(dec*100,0)}%`},{t:tr(wheel?'Movimento della ruota e della gomma (alta frequenza)':'Movimento della scocca (bassa frequenza)'),sup:'sì',why:`${fx(hz,1)} Hz`},{t:tr('Cordolo o sconnessione ripetuta'),sup:g.kerb>0.5?'sì':'no',why:`${fx(g.kerb*100,0)}% ${tr('su cordolo')}`}],
        fx:{key:wheel?'FastBumpSetting':'SlowReboundSetting',sec,dir:tr(wheel?'compressione veloce 1 click più rigida':'estensione lenta 1 click più rigida'),why:tr('più smorzamento per il movimento che oscilla')},
        expect:tr('Meno cicli e ampiezza che cala prima nello stesso punto. Verifica: numero di cicli; controlla che non compaiano scarichi della ruota.')});}
    else if(g.k==='pack'){mk(g,{s:1,a:'sos',cat:'transitori',t:`${WNw}: ${tr('la compressione si accumula sulle sollecitazioni')}`,tol:0.8,minDiff:0.5,
        ev:[`+${fx(m(g,'rise'),1)} mm ${tr('in')} ${fx(m(g,'hits'),0)} ${tr('colpi')} (${fx(m(g,'dur'),2)} s)`],
        causes:[{t:tr('Estensione troppo lenta tra un colpo e l\'altro'),sup:'compatibile',why:tr('la sospensione non torna giù prima del colpo successivo')},{t:tr('Sequenza di cordoli'),sup:g.kerb>0.5?'sì':'no',why:`${fx(g.kerb*100,0)}% ${tr('su cordolo')}`}],
        fx:{key:'FastReboundSetting',sec,dir:tr('estensione veloce 1 click più morbida'),why:tr('torna giù tra un colpo e l\'altro')},expect:tr('Compressione accumulata più bassa nello stesso punto. Verifica: compressione accumulata.')});}}
  // very low ride height, repeatable
  for(const g of merge((X.pl.lowG||[]).filter(g=>g.rep).map(g=>({...g,k:'low'})))){const kerb=g.kerb>0.5,ph=g.ph,front=g.w[0]==='F',ax=front?'Front':'Rear';
    mk({...g,k:'low'},{s:kerb?1:2,a:'pia',cat:'regime',t:`${tr(TECH_WN[g.w])}: ${tr('altezza sotto')} ${X.pl.rhMin} mm${kerb?' '+tr('sul cordolo'):''}`,tol:1.5,minDiff:0.5,
      ev:[`${tr('minima')} ${fx(m(g,'min'),1)} mm`,`${tr('per')} ${fx(m(g,'dur'),2)} s`,Number.isFinite(m(g,'gv'))?`${tr('picco verticale')} ${fx(m(g,'gv'),1)} g`:''],
      causes:[{t:tr('Cordolo'),sup:kerb?'sì':'no',why:`${fx(g.kerb*100,0)}% ${tr('su cordolo')}`},{t:tr('Beccheggio in frenata e sostegno anteriore'),sup:ph==='brk'||ph==='ent'?'compatibile':'no',why:`${tr('fase')}: ${techPhN(ph)}`},{t:tr('Carico aerodinamico ad alta velocità e sostegno a regime'),sup:ph==='str'||ph==='fast'?'compatibile':'no',why:`${tr('fase')}: ${techPhN(ph)}`},{t:tr('Contatto col suolo'),sup:m(g,'gv')>2?'possibile':'non determinabile',why:tr('nessun canale misura il contatto: indizio dal picco di g verticale')}],
      fx:kerb?null:ph==='brk'||ph==='ent'?{key:ax+'3rdSpringSetting',sec:null,dir:tr('3° elemento 1 passo più rigido'),why:tr('meno abbassamento in frenata')}:{key:'RideHeightSetting',sec:front?'FRONTLEFT':'REARLEFT',dir:tr('altezza +1 mm su questo asse'),why:tr('più margine dal suolo (cambia anche la piattaforma aerodinamica)')},
      expect:kerb?tr('È il cordolo: prima di cambiare il setup prova a prenderne meno e ricontrolla.'):tr('Altezza minima più alta nello stesso punto. Verifica: altezza minima nel punto e tempi nei tratti veloci.')});}
  // third element on the packer: information on the steady support, no change proposed by itself
  for(const ax of ['F','R']){const t=X.ax.third[ax];if(t?.packer?.st==='stimato')C.push({id:'pk:'+ax,k:'pk',s:0,a:'pia',cat:'regime',t:tr(ax==='F'?'Anteriore sul packer del 3° elemento ad alta velocità (stima)':'Posteriore sul packer del 3° elemento ad alta velocità (stima)'),
    where:{txt:tr('rettilinei veloci')},ev:t.packer.ev,rep:{txt:tr('andamento su tutti i rettilinei dei giri scelti')},causes:[{t:tr('Packer che sostiene la piattaforma (spesso voluto sulle Hypercar)'),sup:'compatibile',why:t.packer.why}],rel:X.rel.third,fx:null,
    expect:tr('Nessuna modifica proposta da sola: diventa un problema se compare insieme a fondo che tocca o instabilità nei curvoni.')});}
  return C.sort((a,b)=>b.s-a.s);}
const TECH_SUP={'sì':'pos','compatibile':'pos','possibile':'w','no':'muted','non determinabile':'muted','non valutabile':'muted'};
const TECH_CAT={regime:'Sostegno a regime: molle, 3° elemento, packer',transitori:'Transitori: ammortizzatori',rollio:'Rollio: barre e molle'};
function techCardHTML(c,S,laps){const t=typeof ptAll==='function'?[...ptAll()].reverse().find(x=>x.cardId===c.id&&x.venue===S.meta?.venue):null;
  let out=tr('nessuna prova ancora');if(t){if(t.res)out=`${tr(PT_R[t.res.r]?.[0]||'Inconcludente')} (${tr(t.closed==='keep'?'tenuta':t.closed==='back'?'tolta':'annullata')})`;
    else if(t.base.id!==S.id){const J=techJudge(t,S,laps,analysisSetup(S));out=`${tr(PT_R[J.r][0])}: ${fx(vdMean(t.base.per||[]),c.pt.dec)} → ${fx(vdMean(J.now),c.pt.dec)} ${c.pt.unit}${J.why?' · '+J.why:''}`;}else out=tr('prova in corso: carica la telemetria dopo la modifica');}
  return `<article class="tcard s${c.s}" data-id="${esc(c.id)}"><header><i></i><b>${esc(c.t)}</b><span class="muted small">${tr(TECH_CAT[c.cat]||'')}</span>${c.where.li!=null?`<button type="button" class="btn icon tcgo" data-li="${c.where.li}" data-t="${c.where.te}" data-w="${c.w}" data-k="${c.k}" title="${esc(tr('Apri nei grafici sincronizzati'))}">⌖</button>`:''}</header>
    <div class="tbrief"><span>${esc(c.where.txt)}</span><span class="${REL_CLS[c.rel?.label]||'muted'}">${tr('affidabilità')} ${tr(c.rel?.label||'non analizzabile')}</span><span>${esc(c.rep.txt)}</span></div>
    <p class="tproposal">${c.fx?`<b>${esc(tr(c.fx.label))}</b> · ${esc(c.fx.dir)}${c.fx.now?` <small>(${tr('ora')} ${esc(c.fx.now)})</small>`:''}`:tr('Nessuna modifica proposta: verifica prima i dati e le evidenze.')}</p>
    ${c.fx&&c.fx.now&&c.pt&&!t?`<button type="button" class="btn tcpt" data-id="${esc(c.id)}">${tr('Prova questa modifica')}</button>`:''}
    <details class="tproof"><summary>${tr('Evidenze, cause e verifica')}</summary><ol class="t10">
     <li><span>${tr('Fenomeno')}</span><div>${esc(c.t)}</div></li>
     <li><span>${tr('Dove e quando')}</span><div>${esc(c.where.txt)}</div></li>
     <li><span>${tr('Evidenze')}</span><div class="eev">${c.ev.map(e=>`<span>${esc(e)}</span>`).join('')}</div></li>
     <li><span>${tr('Ripetibilità')}</span><div>${esc(c.rep.txt)}</div></li>
     <li><span>${tr('Possibili cause')}</span><div>${c.causes.map(x=>`<div class="tcz"><b class="${TECH_SUP[x.sup]||''}">${tr(x.sup)}</b> ${esc(x.t)} <small class="muted">${esc(x.why||'')}</small></div>`).join('')}</div></li>
     <li><span>${tr('Affidabilità e limiti')}</span><div>${c.rel?`<b class="${REL_CLS[c.rel.label]}">${tr(c.rel.label)}</b> · <small>${esc(c.rel.why.join(' · '))}</small>`:'—'}</div></li>
     <li><span>${tr('Modifica da provare')}</span><div>${c.fx?`<b>${esc(tr(c.fx.label))}</b>: ${esc(c.fx.dir)} <small class="muted">${esc(c.fx.why)}</small>`:tr('nessuna')}</div></li>
     <li><span>${tr('Valore nel .svm')}</span><div class="mono">${c.fx?(c.fx.now?esc(c.fx.now):`<span class="muted">${tr('carica o conferma il setup della sessione')}</span>`):'—'}</div></li>
     <li><span>${tr('Risultato atteso e verifica')}</span><div>${esc(c.expect)}${c.pt?` <small class="muted">(${tr('metrica')}: ${tr(c.pt.label)}${c.rep.per?` · ${tr('ora')} ${c.rep.per.map(v=>fx(v,c.pt.dec)).join(' / ')} ${c.pt.unit}`:''})</small>`:''}</div></li>
     <li><span>${tr('Esito prima/dopo')}</span><div>${esc(out)}</div></li></ol></details></article>`;}
function techDiagHTML(S,X,su){const C=techCards(S,X.laps,su,X);
  const top=C.slice(0,6),rest=C.slice(6);
  return C.length?`<p class="small muted">${tr('Ogni scheda parte da un fenomeno misurato e ripetibile. Una modifica alla volta; un tempo migliore non dimostra da solo che il problema è risolto: guarda la metrica della scheda.')}</p><div class="tcards">${top.map(c=>techCardHTML(c,S,X.laps)).join('')}</div>${rest.length?`<details class="tmore"><summary>${tr('Altre schede')} (${rest.length})</summary><div class="tcards">${rest.map(c=>techCardHTML(c,S,X.laps)).join('')}</div></details>`:''}`
    :`<p>${tr('Nessun fenomeno ripetibile da collegare al setup nei giri scelti.')}</p><p class="muted small">${tr('Con meno di 2 giri lo stesso fenomeno non può risultare ripetibile.')}</p>`;}

function techOverviewHTML(S,X){
  const usable=Object.values(X.rel).filter(r=>r.lv>0).length;
  const events=X.sus.groups.filter(g=>g.rep&&g.k!=='max').length+(X.pl.lowG||[]).filter(g=>g.rep).length;
  const cards=techCards(S,X.laps,analysisSetup(S),X).filter(c=>c.fx).length;
  const steps=[['q','01','Controlla i dati',usable+' / '+ANA.length+' '+tr('analisi disponibili'),'Canali, unità e frequenze prima dei consigli.'],
    ['damp','02','Leggi la macchina',events+' '+tr('eventi ripetibili'),'Ammortizzatori, terzo elemento e piattaforma.'],
    ['diag','03','Verifica una modifica',cards+' '+tr('prove suggerite'),'Una modifica, una metrica, un confronto prima e dopo.']];
  return `<div class="tworkflow">${steps.map(([tab,n,t,v,d])=>`<button type="button" data-tt="${tab}" class="tstep"><span class="tstepn">${n}</span><span><b>${tr(t)}</b><strong>${v}</strong><small>${tr(d)}</small></span><span aria-hidden="true">→</span></button>`).join('')}</div>`;
}

// ---------- the setup each session was run with ----------
// stored by session: {st: 'confermato' | 'suggerito', name, car, hash, text (copy of the .svm), at}. «Mancante» = nothing stored.
function sesKey(S){const m=S.meta||{};return ['ses',m.venue,m.date,m.time,(m.driver||'').replace(/#\d+$/,''),m.car].map(x=>String(x||'').trim()).join('|');}
function svmHash(t){let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16);}
function sesSetupAll(){return LS.get('sesSetup',{})||{};}
function sesSetupGet(S){return sesSetupAll()[sesKey(S)]||null;}
// The confirmed copy is the default analysis input. Exploring another setup is an explicit choice per session.
function sesSetupResolve(S,selected){
  if(!S)return selected;
  const a=sesSetupGet(S);if(!a||a.st!=='confermato'||LS.get('sesMode:'+sesKey(S),'saved')==='selected')return selected;
  if(S._setupCopy?.hash!==a.hash){const su=parseSVM(a.text,a.name);su.label=a.name.replace(/\.svm$/i,'');su.snapshot=true;S._setupCopy={hash:a.hash,su};}
  return S._setupCopy.su;
}
function analysisSetup(S=active()?.S){return sesSetupResolve(S,byId($('#suFile')?.value));}
function sesSetupSet(S,su,st){const A=sesSetupAll();const k=sesKey(S);if(!su){delete A[k];LS.set('sesSetup',A);return;}const text=su.text||setupText(su);
  A[k]={st,name:su.name,car:su.car||'',hash:svmHash(text),text,at:Date.now()};const keys=Object.keys(A).sort((a,b)=>A[a].at-A[b].at);while(keys.length>60)delete A[keys.shift()];LS.set('sesSetup',A);LS.set('sesMode:'+k,'saved');}
// is the car of the setup the car of the telemetry?
function suCarMatch(S,su){const car=(S.meta?.car||S.merged?.d.car||'').toLowerCase(),sc=(su?.car||'').toLowerCase();if(!car||!sc)return null;return sc.includes(car)||(car.startsWith('hyper')&&/hypercar/.test(sc))||car.split(/\s+/).some(t=>t.length>3&&sc.includes(t));}
// does the telemetry agree with this setup? Only settings the car reports back are compared: the brake balance
// (channel Brake Bias Rear against RearBrakeSetting, a direct reading) and the camber on the straights (indicative:
// the measured camber also depends on ride height and load). A mismatch of the brake balance rules a setup out;
// agreement only makes it compatible, never certain (the brake balance can also be moved from the cockpit).
function suTeleCheck(S,su){if(!S||!su)return null;const ev=[];let bad=false,ok=0;
  const bb=S.ch['Brake Bias Rear'];const rb=setupVal(su,'RearBrakeSetting');const m=rb&&/([\d.]+)\s*:\s*([\d.]+)/.exec(rb);
  if(bb&&m){const meas=vdMed(Array.from(bb.v.filter((_,i)=>i%10===0)));const set=+m[2];if(Number.isFinite(meas)){const same=Math.abs(meas-set)<=0.15;same?ok++:bad=true;
    ev.push(`${tr('ripartizione frenata post.')} ${fx(meas,1)}% ${tr('in telemetria')}, ${fx(set,1)}% ${tr('nel setup')} ${same?'✓':'✗'}`);}}
  const cam=(w,sec)=>{const c=S.ch['Camber '+w],sp=S.ch['Ground Speed'],la=S.ch['G Force Lat'];const v=setupVal(su,'CamberSetting',sec);if(!c||!sp||!la||!v)return;const o=[];
    for(let i=0;i<c.v.length;i+=5){const t=i/c.f,s=sampleAt(sp,t);if(s>80&&s<140&&Math.abs(sampleAt(la,t))<0.1)o.push(c.v[i]);}const meas=vdMed(o),set=parseFloat(v);if(!Number.isFinite(meas)||!Number.isFinite(set))return;
    ev.push(`${tr(w[0]==='F'?'campanatura ant.':'campanatura post.')} ${fx(meas,2)}° ${tr('misurata in rettilineo')}, ${fx(set,1)}° ${tr('nel setup')} (${tr('indicativo')})`);};
  cam('FL','FRONTLEFT');cam('RL','REARLEFT');
  return {st:bad?'no':ok?'compatibile':'non verificabile',ev};}
function sesSetupHTML(S){const a=sesSetupGet(S);const su=byId($('#suFile')?.value);const loaded=a?svms().find(x=>x.name===a.name):null;const changed=!!(a&&loaded&&svmHash(loaded.text||setupText(loaded))!==a.hash);
  const saved=a?.st==='confermato'&&LS.get('sesMode:'+sesKey(S),'saved')!=='selected';const used=sesSetupResolve(S,su);const different=a&&su&&(a.name!==su.name||svmHash(su.text||setupText(su))!==a.hash);
  const st=a?a.st:'mancante';const cls={confermato:'good',suggerito:'warn',mancante:'muted'}[st];const mm=su?suCarMatch(S,su):null;
  return `<div class="tses"><span>${tr('Setup della sessione')}</span><span class="tst ${cls}">${tr(st==='confermato'?'setup confermato':st==='suggerito'?'abbinamento suggerito':'setup mancante')}</span>${a?`<b>${esc(a.name)}</b> <small class="muted">${tr('copia salvata il')} ${new Date(a.at).toLocaleDateString()}</small>`:''}
    <span class="tused">${tr('Analisi con')}: <b>${esc(used?.name||tr('setup mancante'))}</b> · ${tr(saved?'copia confermata':'setup selezionato')}</span>
    ${changed?`<span class="w small">${tr('Il file originale è cambiato. La copia storica è conservata.')}</span>`:''}${mm===false?`<span class="w small">${tr('auto del setup diversa da quella della telemetria')}</span>`:''}
    ${(()=>{const K=su?suTeleCheck(S,su):null;if(!K||!K.ev.length)return '';return `<span class="tsck ${K.st==='no'?'w':K.st==='compatibile'?'pos':'muted'} small" title="${esc(K.ev.join(' · '))}">${K.st==='no'?'✗ '+tr('la telemetria non corrisponde a questo setup (a meno che la ripartizione non sia stata cambiata in macchina)'):K.st==='compatibile'?'✓ '+tr('telemetria compatibile con questo setup'):tr('compatibilità non verificabile')}: ${esc(K.ev[0])}</span>`;})()}
    <span class="tsesb">${saved&&different?`<button type="button" class="btn" data-ses="selected">${tr('Prova il setup selezionato')}</button>`:''}${a?.st==='confermato'&&!saved?`<button type="button" class="btn" data-ses="saved">${tr('Torna al setup confermato')}</button>`:''}${su&&(!a||different||a.st!=='confermato')?`<button type="button" class="btn" data-ses="ok">${tr('Conferma')}: ${esc(su.name)}</button>`:''}${a?`<button type="button" class="btn" data-ses="rm">${tr('Togli')}</button>`:''}</span></div>`;}
function sesSetupBind(S,root=document){$$('[data-ses]',root).forEach(b=>b.onclick=async()=>{const k=b.dataset.ses;const su=byId($('#suFile').value);
  if(k==='selected'||k==='saved')LS.set('sesMode:'+sesKey(S),k);
  if(k==='ok'&&su){if(suCarMatch(S,su)===false&&!confirm(tr('Il setup sembra di un\'altra auto. Confermare lo stesso?')))return;sesSetupSet(S,su,'confermato');toast(tr('Setup confermato per questa sessione'));}
  if(k==='rm')sesSetupSet(S,null);
  if(k==='old'){const a=sesSetupGet(S);if(a){const name=a.name.replace(/\.svm$/i,'')+` (${tr('copia')} ${new Date(a.at).toLocaleDateString().replace(/\//g,'-')}).svm`;const it=await addFile(name,new TextEncoder().encode(a.text).buffer,{persist:false});relink();refreshAll();if(it?.id)$('#suFile').value=it.id;}}
  RENDER.setup();});}
// a setup opened together with a session (Libreria) is a suggestion until the user confirms it
function sesSetupSuggest(S,su){if(!S||!su)return;const a=sesSetupGet(S);if(a&&a.st==='confermato')return;sesSetupSet(S,su,'suggerito');}

// ---------- the page ----------
function renderTech(){const host=$('#techP');if(!host)return;const S=active()?.S;if(LS.get('su:tab','eng')!=='dyn')return;
  if(!S){host.innerHTML=`<div class="panel"><div class="empty">${tr('Scegli una telemetria .ld: l\'analisi tecnica parte da lì.')}</div></div>`;return;}
  const laps=techLaps(S);if(!laps.length){host.innerHTML=`<div class="panel"><div class="empty">${tr('Servono giri completi.')}</div></div>`;return;}
  if(!host.querySelector('.tech')||host.dataset.s!==S.id){host.dataset.s=S.id;host.innerHTML=`<div class="panel tech"><div class="empty">${tr('Calcolo…')}</div></div>`;}
  clearTimeout(TECH._t);TECH._t=setTimeout(()=>{try{techDraw(S,laps);}catch(e){console.error(e);host.innerHTML=`<div class="warnbar">${esc(e.message)}</div>`;}},30);}
function techDraw(S,laps){const host=$('#techP');const X=techData(S,laps);const SB=techB(S);const XB=SB?techData(SB,techLaps(SB)):null;const sel=techSel();
  const su=typeof DIAG!=='undefined'&&DIAG&&DIAG.S===S?DIAG.su:analysisSetup(S);
  const others=lds().filter(x=>x!==S&&x.kind==='ld'&&!x.sample&&x.meta?.venue===S.meta?.venue);
  const cond=XB?vdCondDiffs(vdConditions(S,laps,su),vdConditions(SB,XB.laps,sesSetupResolve(SB,null))):[];
  const cor=techCorners(S);const tab=TECH_TABS.find(t=>t[0]===TECH.tab)?TECH.tab:'q';
  const body=tab==='q'?techQualityHTML(S,X):tab==='damp'?techDampHTML(S,X,XB):tab==='axle'?techAxleHTML(S,X,XB):tab==='plat'?techPlatHTML(S,X,XB):tab==='ev'?techEvHTML(S,X):techDiagHTML(S,X,su);
  host.innerHTML=`<div class="panel tech${TECH.full?' tfull':''}" data-tech-tab="${tab}">
   <div class="ttop"><div class="ttl"><div class="ey">${tr('Analisi tecnica')}</div><b>${esc(S.meta?.venue||'')}</b><span class="muted small">${esc(engLapsText(laps))}</span></div>
    <label class="f tsetup">${tr('Setup da confrontare')}<select id="techSetup"><option value="">${tr('setup mancante')}</option>${svms().map(x=>`<option value="${esc(x.id)}"${$('#suFile').value===x.id?' selected':''}>${esc(x.label||x.name)}</option>`).join('')}</select></label>
    <div class="tsel"><label class="f">${tr('Giri')}<select id="vdLaps"><option value="eng"${LS.get('vd:laps','eng')!=='all'?' selected':''}>${tr('come Race Engineer')}</option><option value="all"${LS.get('vd:laps','eng')==='all'?' selected':''}>${tr('tutti i giri lanciati validi')}</option></select></label>
     <label class="f">${tr('Giro')}<select id="vdLap"><option value="">${tr('tutti')}</option>${laps.map(l=>`<option value="${l.i}"${sel.lap===l.i?' selected':''}>${tr('G')}${l.num} · ${fmtLap(l.time)}</option>`).join('')}</select></label>
     <label class="f">${tr('Tratto')}<select id="vdCor"><option value="">${tr('tutto il giro')}</option>${cor.map(c=>`<option value="${c.k}"${sel.c==String(c.k)?' selected':''}>T${c.k} · ${Math.round(c.dS)}–${Math.round(c.dE)} m</option>`).join('')}<option value="r"${sel.c==='r'?' selected':''}>${tr('intervallo…')}</option></select></label>
     ${sel.c==='r'?`<label class="f">${tr('da')} (m)<input type="number" id="vdD0" value="${sel.d0??0}" step="10"></label><label class="f">${tr('a')} (m)<input type="number" id="vdD1" value="${sel.d1??Math.round(techLen(S))}" step="10"></label>`:''}
     <label class="f">${tr('Fase')}<select id="vdPh"><option value="all">${tr('tutte')}</option>${VD_PH.map(([k,l])=>`<option value="${k}"${sel.ph===k?' selected':''}>${tr(l)}</option>`).join('')}</select></label>
     <label class="f tsb">${tr('Confronta con (B)')}<select id="vdB"><option value="">${tr('nessuna')}</option>${others.map(o=>`<option value="${esc(o.id)}"${SB===o?' selected':''}>${esc((o.meta?.date||'')+' '+(o.meta?.time||'').slice(0,5)+' · '+(o.label||o.name))}</option>`).join('')}</select></label>
     <button type="button" class="btn icon" id="vdFull" title="${esc(tr(TECH.full?'Riduci':'Ingrandisci il pannello'))}" aria-pressed="${TECH.full}">${TECH.full?'⤡':'⤢'}</button></div></div>
   ${sesSetupHTML(S)}
   ${techOverviewHTML(S,X)}
   ${XB?`<div class="${cond.length?'pcw2':'pcok'} tcond">${cond.length?`<b>⚠ ${tr('A e B non sono nelle stesse condizioni')}:</b> ${cond.map(c=>`<span>${esc(c)}</span>`).join('')}<small>${tr('Le differenze possono venire da qui e non dal setup.')}</small>`:`✓ ${tr('Nessuna differenza rilevata nei dati disponibili. Controlla anche le condizioni non registrate.')}`} <span class="muted small">A: ${X.laps.length} ${tr('giri')} · B: ${XB.laps.length} ${tr('giri')}</span></div>`:''}
   <nav class="ttabs" role="tablist">${TECH_TABS.map(([k,l])=>`<button type="button" role="tab" data-tt="${k}" aria-selected="${k===tab}">${tr(l)}</button>`).join('')}</nav>
   <div class="tbody">${body}</div></div>`;
  host.querySelectorAll('.tbody table').forEach(t=>{const wrap=document.createElement('div');wrap.className='ttable';t.before(wrap);wrap.append(t);});
  techBind(S,X);sesSetupBind(S);setTimeout(techFocus,60);}
function techBind(S,X){const host=$('#techP');const setSel=o=>{LS.set('vd:sel',{...techSel(),...o});renderTech();};
  const setup=$('#techSetup');if(setup)setup.onchange=()=>{const original=$('#suFile');original.value=setup.value;original.dispatchEvent(new Event('change'));};
  host.querySelectorAll('[data-tt]').forEach(b=>b.onclick=()=>{TECH.tab=b.dataset.tt;LS.set('vd:tab',TECH.tab);TECH.ev=null;renderTech();});
  const on=(id,f)=>{const e=$('#'+id);if(e)e.onchange=()=>f(e.value);};
  on('vdLaps',v=>{LS.set('vd:laps',v);LS.set('vd:sel',{});renderTech();});on('vdLap',v=>setSel({lap:v===''?null:+v}));
  on('vdCor',v=>{if(v==='r')return setSel({c:'r',d0:0,d1:Math.round(techLen(S))});if(!v)return setSel({c:'',d0:null,d1:null});const c=techCorners(S).find(c=>String(c.k)===v);setSel({c:v,d0:Math.round(c.dS),d1:Math.round(c.dE)});});
  on('vdD0',v=>setSel({d0:+v||0}));on('vdD1',v=>setSel({d1:+v||0}));on('vdPh',v=>setSel({ph:v}));on('vdB',v=>{LS.set('vd:B',v);renderTech();});
  on('vdKnee',v=>{LS.set('vd:knee',Math.max(10,+v||50));renderTech();});on('vdRange',v=>{LS.set('vd:range',Math.max(100,+v||250));renderTech();});on('vdBin',v=>{LS.set('vd:bin',Math.max(5,+v||10));renderTech();});
  $('#vdFull').onclick=()=>{TECH.full=!TECH.full;renderTech();};
  const openEv=d=>{TECH.ev=d;if(TECH.tab!=='ev'){TECH.tab='ev';LS.set('vd:tab','ev');techDraw(S,X.laps);}techEvDetail(S,d);host.querySelectorAll('.tevr').forEach(r=>r.classList.toggle('on',r.dataset.li==d.li&&r.dataset.t==d.t&&r.dataset.w===d.w));};
  host.querySelectorAll('.tevr').forEach(r=>r.onclick=()=>openEv({...r.dataset}));
  host.querySelectorAll('.tcgo').forEach(b=>b.onclick=()=>openEv({...b.dataset}));
  host.querySelectorAll('.tcpt').forEach(b=>b.onclick=()=>{const su=typeof DIAG!=='undefined'&&DIAG&&DIAG.S===S?DIAG.su:analysisSetup(S);const c=techCards(S,X.laps,su,X).find(x=>x.id===b.dataset.id);if(!c)return;techStartTest(S,X.laps,c,su);renderTech();toast(tr('Prova iniziata: cambia solo questo nel gioco, poi carica la nuova telemetria'));});
  if(TECH.ev&&TECH.tab==='ev')techEvDetail(S,TECH.ev);}
// the guided test of ui45 (ptests), with a metric measured at the place of the card
function techStartTest(S,laps,c,su){const L=ptAll().filter(t=>!(t.venue===S.meta?.venue&&!t.closed&&(t.car||'').toLowerCase()===(proCarOf(S)||'').toLowerCase()));
  const P=typeof proPace==='function'?proPace(S):null;
  L.push({id:'pt'+Date.now(),at:Date.now(),venue:S.meta?.venue||'',car:proCarOf(S),cardId:c.id,problem:c.t,change:{label:c.fx?.label||'',dir:c.fx?.dir||'',key:c.fx?.key||'',sec:c.fx?.sec||null,now:c.fx?.now||''},metric:'loc',loc:c.pt,
    hyp:`${tr(c.fx?.label||'')}: ${c.fx?.dir||''} → ${c.t}`,base:{conditions:vdConditions(S,laps,su),id:S.id,when:`${S.meta?.date||''} ${(S.meta?.time||'').slice(0,5)}`,per:c.rep.per,lapTimes:laps.map(l=>l.time),pace:P?.t,best:S.best?.time,n:laps.length,lm:engLapMode(),
      track:S.cond?.track?.avg,cond:S.cond?.label,su:su?.name||'',val:c.fx?.key&&su?setupVal(su,c.fx.key,c.fx.sec||undefined):null,fuel:su?suFind(su,'GENERAL',/^FuelCapacity/)||suFind(su,'GENERAL',/^FuelSetting/):null,cmp:su?suFind(su,'FRONTLEFT',/^CompoundSetting/):null}});ptSave(L);}
// before / after for a test with a place metric: the same metric at the same place in the new session, lap by lap
function techJudge(t,S,laps,su){const p=t.loc;const now=techPerLapAt(S,laps,p.k,p.w,p.frac,p.field);const C=vdCompare(t.base.per||[],now,{better:p.better,minDiff:p.minDiff||0});
  const T=vdCompare(t.base.lapTimes||[],laps.map(l=>l.time),{better:-1,minDiff:0.05});
  const limits=t.base.conditions?vdCondDiffs(t.base.conditions,vdConditions(S,laps,su)):[];
  if(t.venue&&t.venue!==S.meta?.venue)limits.push(tr('pista diversa'));
  if(t.change?.key&&su&&t.base.val!=null&&setupVal(su,t.change.key,t.change.sec||undefined)===t.base.val)limits.push(tr('la modifica non risulta nel setup scelto'));
  const a=chqAnalysis(S,ANA.find(x=>x.id===(p.k==='low'?'plat':p.k==='unload'?'load':'damp')));
  if(a.st==='no')limits.push(tr('dati insufficienti per questa metrica'));
  return {r:limits.length?'inc':C.verdict==='migliorato'?'ok':C.verdict==='peggiorato'?'ko':'inc',why:limits.length?limits.join(' · '):C.why,C,T,now};}

// open «Analisi tecnica» on a tab, with a wheel or a card in view (from Setup Builder and Race Engineer)
function techGo(tab,o={}){TECH.tab=tab;LS.set('vd:tab',tab);TECH.focus=o;LS.set('su:tab','dyn');$('#proNav .pn[data-n="tech"]')?.click();if(curView()!=='setup')showView('setup');renderTech();}
function techFocus(){const o=TECH.focus;if(!o)return;const el=o.w?$(`#techP .tdc[data-w="${o.w}"]`):o.card?$(`#techP .tcard[data-id="${CSS.escape(o.card)}"]`):null;
  if(!el){const more=$('#techP .tmore');if(o.card&&more&&!more.open){more.open=true;return techFocus();}return;}TECH.focus=null;
  el.closest('details')?.setAttribute('open','');el.scrollIntoView({behavior:MOTION_OK()?'smooth':'auto',block:'center'});el.classList.add('tfocus');setTimeout(()=>el.classList.remove('tfocus'),1600);}

// ---------- the menu entry and the tab ----------
setTimeout(()=>{const v=$('#v-setup');if(v&&!$('#techP')){const anchor=$('#suEngP')||v.querySelector('.panel');anchor?.insertAdjacentHTML('afterend','<div id="techP"></div>');}
  if(typeof suTabsApply==='function')suTabsApply();if(curView()==='setup')renderTech();},0);

(function(){const st=document.createElement('style');st.textContent=`
#techP .tech{padding:16px 18px}
.tech.tfull{position:fixed;inset:8px;z-index:60;overflow:auto;margin:0;background:var(--panel,#111)}
.ttop{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px}.ttl{display:flex;flex-direction:column;gap:2px;min-width:200px}.ttl .ey{font:600 .72rem var(--f-display);letter-spacing:.24em;text-transform:uppercase;color:var(--pacc,var(--accent))}.ttl b{font:600 1.3rem var(--f-display)}
.tsel{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-left:auto}.tsel .f{min-width:120px}.tsel .tsb{min-width:220px}.tsel select,.tsel input{height:34px}
.tses{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--line);border-radius:8px;margin:6px 0 10px;font-size:.9rem}.tses>span:first-child{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.tsesb{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}.tsesb .btn{height:30px}
.tcond{margin:0 0 10px}
.ttabs{display:flex;gap:2px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:4px 0 14px}.ttabs button{border:0;background:transparent;color:var(--muted);padding:10px 14px;cursor:pointer;font:600 .86rem var(--f-body);border-bottom:2px solid transparent;margin-bottom:-1px}
.ttabs button:hover{color:#fff}.ttabs button[aria-selected="true"]{color:#fff;border-bottom-color:var(--pacc,var(--accent))}
.tbody h4{margin:18px 0 8px;font:600 .8rem var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--psil,#C9CDD3)}
.tst{display:inline-block;padding:1px 8px;border-radius:999px;font-size:.78rem;border:1px solid var(--line);white-space:nowrap}.tst.good{color:var(--good);border-color:color-mix(in srgb,var(--good) 45%,transparent)}.tst.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,transparent)}.tst.bad{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 45%,transparent)}.tst.muted{color:var(--muted)}
.trel{font-size:.84rem;color:var(--muted);padding:4px 10px;border:1px solid var(--line);border-radius:999px}.trel b{font-weight:600}.trel.good b{color:var(--good)}.trel.warn b{color:var(--warn)}.trel.bad b{color:var(--bad)}
.trelw{margin-top:12px}.trelw summary{cursor:pointer;color:var(--muted);font-size:.86rem}.trelw ul{margin:6px 0 0;padding-left:20px;font-size:.88rem}
.tctl{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px}.tctl .f{max-width:170px}
.tqt{width:100%;table-layout:auto}.tqt td{vertical-align:top;white-space:normal!important;overflow-wrap:anywhere;font-family:var(--f-body)}.tqt td.mono{font-family:var(--f-mono)}.tqt td.small{font-size:.84rem}.tqd{margin-top:14px}.tqd summary{cursor:pointer;color:var(--psil,#C9CDD3);font-weight:600}
.tkv{display:grid;grid-template-columns:minmax(200px,auto) 1fr;gap:4px 16px;margin:8px 0}.tkv>span:nth-child(odd){color:var(--muted)}
.w{color:var(--warn)}.pos{color:var(--good)}.ca{color:var(--lapA)}.cb{color:var(--lapB)}
.tdg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tdc{border:1px solid var(--line);border-radius:10px;padding:10px 12px}.tdh{display:flex;gap:10px;align-items:center;margin-bottom:4px}.tdh .muted{margin-left:auto}
.tsg{color:var(--psil,#C9CDD3);margin-bottom:4px}
.thist{width:100%;height:auto;display:block}.thist text,.tch text{font:12px var(--f-mono);fill:var(--muted)}.thist .tal,.tch .tal{fill:var(--psil,#C9CDD3)}
.tmk{stroke:var(--faint,#666);stroke-dasharray:3 3}.tz{stroke:var(--line)}.tg{stroke:rgba(255,255,255,.06)}
.thx{display:flex;justify-content:space-between;font-size:.8rem;color:var(--muted);margin:2px 0 6px}
.tzt,.tpt{width:100%;font-size:.86rem}.tpt td,.tpt th{white-space:nowrap;font-family:var(--f-body)}.tpt td.l,.tpt th.l{white-space:normal}
.tcg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tcg3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tch{margin:0}.tch svg{width:100%;height:auto;display:block;max-width:760px}.tmore{margin-top:12px}.tmore summary{cursor:pointer;color:var(--psil,#C9CDD3);font-weight:600;margin-bottom:10px}.tch figcaption{display:flex;gap:14px;font-size:.82rem;color:var(--muted)}.tch figcaption i{display:inline-block;width:14px;height:3px;margin-right:6px;vertical-align:middle}
.tbox{border:1px solid var(--line);border-radius:10px;padding:10px 12px}.tbox ul{margin:6px 0;padding-left:18px}
.tevw{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}.tevl{min-width:0;overflow:auto;max-height:70vh}
.tevr{cursor:pointer}.tevr:hover td{background:rgba(255,255,255,.04)}.tevr.on td{background:color-mix(in srgb,var(--pacc,#C9A54C) 14%,transparent)}
.tevd{position:sticky;top:8px;border:1px solid var(--line);border-radius:10px;padding:10px;min-height:200px}
.tedh{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;font-size:.92rem}.tedh .btn{margin-left:auto;height:30px}
.tedb{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}.temap{width:100%;max-height:220px}.tmapl{fill:none;stroke:var(--panel2,#333);stroke-width:6;stroke-linejoin:round}.tmapp{fill:color-mix(in srgb,var(--pacc,#C9A54C) 30%,transparent)}.tmapc{fill:#fff;stroke:var(--pacc,#C9A54C);stroke-width:2}
.tetr{display:grid;grid-template-columns:150px 1fr;gap:8px;align-items:center}.tetr svg{width:100%;height:70px;cursor:crosshair}.tetl{display:flex;flex-direction:column;font-size:.8rem;color:var(--muted)}.tetl b{font:600 1rem var(--f-mono);color:#fff}
.tcur{stroke:#fff;stroke-width:1}.tetx{display:flex;justify-content:space-between;margin-left:158px;font-size:.78rem;color:var(--muted)}
.tcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:12px}
.tfocus{outline:2px solid var(--pacc,#C9A54C);outline-offset:2px;transition:outline-color 300ms}
/* compact top on the technical page: the session line stays, the big numbers and the setup goals go */
html[data-look="pro"][data-pnav="tech"] .pstrip .pmain{display:none}
html[data-pnav="tech"] #v-setup>.panel:first-child h2,html[data-pnav="tech"] #v-setup>.panel:first-child details.set{display:none}
html[data-pnav="tech"] #v-setup>.panel:first-child{padding-top:8px;padding-bottom:8px}
.tcard{border:1px solid var(--line);border-left:3px solid var(--good);border-radius:10px;padding:10px 14px}.tcard.s1{border-left-color:var(--warn)}.tcard.s2{border-left-color:var(--bad)}
.tcard header{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.tcard header b{font-size:1rem}.tcard header .tcgo{margin-left:auto}
.t10{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:5px;counter-reset:t}.t10 li{display:grid;grid-template-columns:170px 1fr;gap:10px;font-size:.88rem;counter-increment:t}.t10 li>span{color:var(--muted)}.t10 li>span::before{content:counter(t) ". ";color:var(--faint,#777)}
.t10 .eev{display:flex;flex-wrap:wrap;gap:6px}.t10 .eev span{font:12px var(--f-mono);background:rgba(255,255,255,.05);padding:2px 8px}.tcz{margin:1px 0}.tcz b{font-weight:600;margin-right:4px}.t10 .tcpt{height:28px;margin-left:8px}
@media (max-width:1400px){.tdg{grid-template-columns:1fr}.tcg3{grid-template-columns:1fr 1fr}.tevw{grid-template-columns:1fr}.tevd{position:static}}
@media (max-width:900px){.tcg,.tcg3{grid-template-columns:1fr}.tcards{grid-template-columns:1fr}.t10 li{grid-template-columns:1fr}}
`;document.head.appendChild(st);})();
