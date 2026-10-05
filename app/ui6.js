// ================= SESSION (timing-screen style) =================
function tHeat(t){const lo=+cfg().tmin||75,hi=+cfg().tmax||95;if(!Number.isFinite(t))return tok('panel2');
  if(t<lo)return lerpColor(tok('t-cold'),tok('t-ok'),Math.max(0,Math.min(1,(t-(lo-25))/25)));if(t<=hi)return tok('t-ok');return lerpColor(tok('t-ok'),tok('t-hot'),Math.min(1,(t-hi)/15));}
function lapClass(l,t,best){if(l.invalid)return 't-bad';if(l.type!=='lanciato')return 't-dim';if(!best||!Number.isFinite(t))return '';if(l===best)return 't-best';if(t<=best.time+0.4)return 't-pb';if(t<=best.time*1.01)return '';return 't-slow';}
function lapColor(l,t,best){if(l.type==='rientro box'||l.type==='uscita box')return null;if(l.invalid)return tok('bad');if(l.type!=='lanciato')return tok('faint');if(l===best)return tok('best');if(t<=best.time+0.4)return tok('good');if(t<=best.time*1.01)return '#C9D1D9';if(t<=best.time*1.03)return tok('warn');return tok('lapB');}
const CMPC={Soft:'#FF3B3B',Medium:'#F5C518',Hard:'#F2F4F6',Wet:'#3A8DFF',Inter:'#19D26B',Intermediate:'#19D26B'};
function q4(vals,fmt,color){return `<span class="q4 ${color?'':'txt'}">${W.map(w=>`<span${color?` style="background:${color(vals[w])}"`:''} title="${w}">${fmt(vals[w])}</span>`).join('')}</span>`;}
function stintLD(S,body){
  const laps=S.laps.filter(l=>l.complete||l.start);
  if(!laps.length){body.innerHTML='<div class="panel empty">Nessun giro completo in questa telemetria.</div>';return;}
  const st=laps.map(l=>lapStats(S,l)),fl=st.filter(s=>s.lap.type==='lanciato'),valid=fl.filter(s=>!s.lap.invalid);
  const best=S.best,paceSet=valid.filter(s=>best&&s.time<=best.time*1.07);
  const fuelL=median(fl.map(s=>s.fuel).filter(v=>v>0)),wearL=W.map(w=>mean(fl.map(s=>s.w[w].wear)));
  const last=st[st.length-1],hasBat=st.some(s=>Number.isFinite(s.batMax)),ve=S.merged?mean(fl.map(s=>s.lap.veUsed).filter(v=>v>0)):NaN;
  const worstWear=Math.max(...wearL.filter(Number.isFinite));
  const cond=laps.map(l=>lapConditions(S,l));const trackVar=Math.max(...cond.map(c=>c.track))-Math.min(...cond.map(c=>c.track));
  const wet=S.cond.state==='wet',hasVE=!!S.merged&&S.laps.some(l=>Number.isFinite(l.ve)),hasSec=!!S.merged&&S.laps.some(l=>l.s&&l.s.some(Number.isFinite));
  const stints=[];let cur=null;st.forEach((s,k)=>{const prev=st[k-1];if(!cur||s.fuel<-0.5||(prev&&prev.lap.type==='rientro box')){cur={from:k,list:[]};stints.push(cur);}cur.list.push(s);});
  const bestSec=[0,1,2].map(i=>Math.min(...S.laps.filter(l=>!l.invalid&&l.s&&Number.isFinite(l.s[i])).map(l=>l.s[i])));
  const carcAvg=s=>mean(W.map(w=>s.w[w].carc));
  const comp=s=>{const c=s.lap.x?.fc;return c?c.replace(/^\d+,/,''):null;};
  const lim=[['carburante',last.fuelEnd/fuelL],['energia virtuale',Number.isFinite(ve)&&last.lap.ve?last.lap.ve/ve:NaN]].filter(x=>Number.isFinite(x[1])).sort((a,b)=>a[1]-b[1])[0];
  const totalFuel=st.reduce((a,s)=>a+(s.fuel>0?s.fuel:0),0);
  // ---- KPIs
  const K=(l,v,s,c,cls='')=>`<div class="kpi ${cls}" style="--kc:${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s||''}</div></div>`;
  const kp=[K('Miglior giro',best?fmtLap(best.time):'—',best?'giro '+best.num+(best.official?' · ufficiale':''):'',tok('best'),'hl'),
    K(`Passo · ${paceSet.length} giri`,fmtLap(mean(paceSet.map(s=>s.time))),`σ ${fx(std(paceSet.map(s=>s.time)),3)} s`,tok('good')),
    K('Carburante / giro',fx(fuelL,2)+' L',`totale ${fx(totalFuel,1)} L · fine ${fx(last.fuelEnd,1)} L`,tok('warn')),
    K('Energia / giro',Number.isFinite(ve)?fx(ve*100,2)+' %':'—',Number.isFinite(ve)?'≈ '+fx(1/ve,1)+' giri al 100%':(S.merged?'non registrata (gara online)':'serve il .xml'),tok('lapA')),
    K('Carcassa media',fx(mean(fl.map(carcAvg)),0)+' °C',`finestra ${cfg().tmin}–${cfg().tmax} °C`,tHeat(mean(fl.map(carcAvg)))),
    K('Usura / giro',fx(mean(wearL),2)+' %',`peggiore ${fx(worstWear,2)} %`,tok('lapB')),
    hasBat?K('Batteria',`${fx(mean(fl.map(s=>s.batMin)),0)}–${fx(mean(fl.map(s=>s.batMax)),0)} %`,`bilancio ${fsign(mean(fl.map(s=>s.batEnd-s.batStart)),1)} %/giro`,tok('lapA')):'',
    stints.length>1?K('Soste',String(stints.length-1),`rifornito ${fx(stints.reduce((a,z)=>a+(z.list[0].fuel<-0.5?-z.list[0].fuel:0),0),1)} L`,tok('accent')):K('Autonomia',lim?'≈ '+fx(lim[1],1)+' giri':'—',lim?'limitata da '+lim[0]:'',tok('accent'))].join('');
  // ---- lap strip
  const strip=st.map((s,k)=>{const l=s.lap,c=cond[k],col=lapColor(l,s.time,best);const isPit=l.type==='rientro box'||l.type==='uscita box';const sep=k>0&&stints.some(z=>z.from===k)?'<span class="sep" title="sosta"></span>':'';
    return sep+`<span class="lp ${isPit?'pit':''}" style="${col?`background:${col}`:''}" title="Giro ${l.num} · ${fmtLap(s.time)}${l.invalid?' · non valido':''} · ${l.type}${c.rain>0.01?' · pioggia':''}">${c.rain>0.01||c.wet>0.01?'<span class="rn"></span>':''}${l.num%5===0?`<span class="n">${l.num}</span>`:''}</span>`;}).join('');
  // ---- stint cards
  const cards=stints.map((z,i)=>{const ls=z.list,ok=ls.filter(s=>s.lap.type==='lanciato'&&!s.lap.invalid),bb=Math.min(...ok.map(s=>s.time)),pc=ok.filter(s=>s.time<=bb*1.07);
    const add=ls[0].fuel<-0.5?-ls[0].fuel:0,startF=ls[0].lap.start&&S.ch['Fuel Level']?sampleAt(S.ch['Fuel Level'],ls[0].lap.t0):NaN;const cm=ls.map(comp).find(Boolean);
    const rainy=ls.filter((s,k)=>{const c=cond[z.from+k];return c.rain>0.01||c.wet>0.01;}).length;
    return `<div class="stc" style="--sc:${cm?CMPC[cm]||tok('accent'):tok('accent')}"><div class="h"><span>Stint ${i+1} · giri ${ls[0].lap.num}–${ls[ls.length-1].lap.num}</span>${cm?`<span class="cmp" style="--cc:${CMPC[cm]||'#fff'}" title="${esc(cm)}">${esc(cm[0])}</span>`:''}</div>
      <div class="big">${fmtLap(mean(pc.map(s=>s.time)))}</div>
      <dl><dt>Miglior giro</dt><dd class="${Number.isFinite(bb)&&best&&bb===best.time?'t-best':''}">${fmtLap(bb)}</dd><dt>Carburante</dt><dd>${fx(median(ls.filter(s=>s.lap.type==='lanciato').map(s=>s.fuel).filter(v=>v>0)),2)} L/giro</dd>
      ${add?`<dt>Rifornimento</dt><dd>+${fx(add,1)} L</dd>`:''}${Number.isFinite(startF)?`<dt>Al via</dt><dd>${fx(startF,1)} L</dd>`:''}
      <dt>Usura</dt><dd>${fx(mean(ls.map(s=>mean(W.map(w=>s.w[w].wear))).filter(v=>v>0)),2)} %/giro</dd><dt>Carcassa</dt><dd style="color:${tHeat(mean(ls.map(carcAvg)))}">${fx(mean(ls.map(carcAvg)),0)} °C</dd>
      <dt>Meteo</dt><dd>${rainy?`<span class="wx">pioggia o bagnato ${rainy}/${ls.length} giri</span>`:'asciutto'}</dd></dl></div>`;}).join('');
  body.innerHTML=`
  <div class="panel"><div class="kpis">${kp}</div></div>
  <div class="panel"><div class="panel-h"><h3>Giro per giro</h3><span class="hint">passa sopra un giro per il tempo</span></div>
    <div class="strip">${strip}</div>
    <div class="slegend"><span><i style="background:var(--best)"></i>miglior giro</span><span><i style="background:var(--good)"></i>entro 0,4 s</span><span><i style="background:#C9D1D9"></i>entro 1%</span><span><i style="background:var(--warn)"></i>entro 3%</span><span><i style="background:var(--lapB)"></i>più lento</span><span><i style="background:var(--bad)"></i>non valido</span><span><i style="background:repeating-linear-gradient(45deg,var(--panel2) 0 3px,var(--line) 3px 6px)"></i>box</span><span><i style="background:var(--t-cold);height:4px;vertical-align:4px"></i>pioggia / bagnato</span></div>
    <div class="stints" style="margin-top:16px">${cards}</div></div>
  <div class="grid2">
    <div class="panel"><h3>Tempi sul giro</h3><canvas class="mini" id="stL0"></canvas><div class="legend"><span><i style="background:var(--lapA)"></i>validi</span><span><i style="background:var(--bad)"></i>non validi</span><span><i style="background:var(--best)"></i>best</span></div></div>
    <div class="panel"><h3>Temperatura carcassa (°C)</h3><canvas class="mini" id="stL1"></canvas><div class="legend">${W.map((w,i)=>`<span><i style="background:${COLS4()[i]}"></i>${WL[w]}</span>`).join('')}<span><i style="background:var(--t-ok);opacity:.35;height:8px"></i>finestra ${cfg().tmin}–${cfg().tmax} °C</span></div></div>
    <div class="panel"><h3>Pressione media a caldo (kPa)</h3><canvas class="mini" id="stL2"></canvas><div class="legend">${W.map((w,i)=>`<span><i style="background:${COLS4()[i]}"></i>${WL[w]}</span>`).join('')}</div></div>
    <div class="panel"><h3>${trackVar>0.3?'Temperatura pista e aria (°C)':'Usura cumulata (%)'}</h3><canvas class="mini" id="stL3"></canvas><div class="legend">${trackVar>0.3?'<span><i style="background:var(--accent)"></i>pista</span><span><i style="background:var(--lapA)"></i>aria</span>':W.map((w,i)=>`<span><i style="background:${COLS4()[i]}"></i>${WL[w]}</span>`).join('')}</div></div>
  </div>
  <div class="panel">
  <div class="panel-h"><h3>Tabella tempi</h3>${S.merged?'<span class="badge">tempi e settori ufficiali dal .xml</span>':''}</div>
  <div class="tw"><table><thead><tr><th>Giro</th><th class="l">Tipo</th><th>Tempo</th>${hasSec?'<th>S1</th><th>S2</th><th>S3</th>':''}<th>V max</th><th class="l">Carburante</th>${hasVE?'<th>NRG</th>':''}${hasBat?'<th>Batt.</th>':''}<th>Pista</th><th class="l">Carcassa °C</th><th class="l">Gomma I/C/E ant.</th><th class="l">Pressione kPa</th><th class="l">Usura %</th><th class="l">Freni °C</th><th class="l">Note</th></tr></thead><tbody>
  ${st.map((s,k)=>{const l=s.lap,c=cond[k];const sc=i=>{const v=l.s?.[i];if(!Number.isFinite(v))return '<td class="t-dim">—</td>';return `<td class="${v===bestSec[i]?'t-best':v<=bestSec[i]+0.1?'t-pb':''}">${v.toFixed(3)}</td>`;};
    const sep=stints.length>1&&stints.some(z=>z.from===k)?`<tr class="sep"><td colspan="30">Stint ${stints.findIndex(z=>z.from===k)+1}</td></tr>`:'';
    const cap=Math.max(...st.map(q=>q.fuelEnd).filter(Number.isFinite));
    return sep+`<tr><td>${l.num}</td><td class="l"><span class="tag ${l.type==='lanciato'?'info':l.type==='partenza'?'good':'warn'}">${l.type}</span></td><td class="lt ${lapClass(l,s.time,best)}">${fmtLap(s.time)}</td>${hasSec?sc(0)+sc(1)+sc(2):''}<td>${fx(s.vmax,0)}</td>
      <td class="l">${s.fuel<-0.5?`<span class="pos">+${fx(-s.fuel,1)} L</span>`:fx(s.fuel,2)}<span class="fbar"><i style="width:${Math.max(0,Math.min(100,s.fuelEnd/cap*100))}%"></i></span> <span class="muted">${fx(s.fuelEnd,1)}</span></td>
      ${hasVE?`<td>${Number.isFinite(l.ve)?fx(l.ve*100,0)+'%':'—'}</td>`:''}${hasBat?`<td>${fx(s.batMin,0)}–${fx(s.batMax,0)}</td>`:''}
      <td>${fx(c.track,1)}°${c.rain>0.01||c.wet>0.01?` <span class="wx" title="pioggia ${fx(c.rain*100,0)}% · bagnato ${fx(c.wet*100,0)}%">●</span>`:''}</td>
      <td class="l">${q4(Object.fromEntries(W.map(w=>[w,s.w[w].carc])),v=>fx(v,0),tHeat)}</td>
      <td class="l"><span class="q4" style="grid-template-columns:repeat(3,28px)">${['FL','FR'].map(w=>[s.w[w].I,s.w[w].C,s.w[w].O].map(v=>`<span style="background:${tHeat(v)}">${fx(v,0)}</span>`).join('')).join('')}</span></td>
      <td class="l">${q4(Object.fromEntries(W.map(w=>[w,s.w[w].p])),v=>fx(v,0))}</td><td class="l">${q4(Object.fromEntries(W.map(w=>[w,s.w[w].wear])),v=>fx(v,1))}</td><td class="l">${q4(Object.fromEntries(W.map(w=>[w,s.w[w].bMax])),v=>fx(v,0))}</td>
      <td class="l">${best&&l===best?'<span class="tag best">best</span>':''}${l.x?evTags(l.x):(l.invalid?'<span class="tag bad">non valido</span>':'')}</td></tr>`;}).join('')}
  </tbody></table></div>
  <p class="muted small">Ogni riquadro 2×2 è disposto come l'auto vista dall'alto: sopra le anteriori (sx, dx), sotto le posteriori. Carcassa e strato interno della gomma sono medie sopra i 50 km/h: la temperatura di superficie cambia troppo tra curve e rettilinei per giudicare la finestra. Colori: blu sotto la finestra, verde dentro, rosso sopra (la finestra si imposta in Setup › Obiettivi). Tempi: viola miglior giro, verde entro 0,4 s, giallo oltre l'1%.</p></div>`;
  if(S.merged)body.insertAdjacentHTML('beforeend',eventsSummaryHTML(S.merged.d,S.merged.sess));
  if(S.merged&&S.merged.sess.drivers.length>1){body.insertAdjacentHTML('beforeend',rivalsHTML(S.merged.sess,S.merged.d));drawRivals(S.merged.sess,S.merged.d);body.insertAdjacentHTML('beforeend',paceHTML(S.merged.sess,S.merged.d));wirePace(S.merged.sess,S.merged.d);}
  const x=st.map(s=>s.lap.num),C=COLS4();
  lineChart($('#stL0'),{x,series:[{data:st.map(s=>s.lap.invalid||s.lap.type!=='lanciato'?NaN:s.time),color:tok('lapA'),dot:i=>st[i].lap===best},{data:st.map(s=>s.lap.invalid?s.time:NaN),color:tok('bad'),nolines:true}],yfmt:v=>fmtLap(v).slice(0,-2)});
  lineChart($('#stL1'),{x,series:W.map((w,i)=>({data:st.map(s=>s.w[w].carc),color:C[i]})),yfmt:v=>v.toFixed(0),band:[+cfg().tmin,+cfg().tmax]});
  lineChart($('#stL2'),{x,series:W.map((w,i)=>({data:st.map(s=>s.w[w].p),color:C[i]})),yfmt:v=>v.toFixed(0)});
  if(trackVar>0.3)lineChart($('#stL3'),{x,series:[{data:cond.map(c=>c.track),color:tok('accent')},{data:cond.map(c=>c.air),color:tok('lapA')}],yfmt:v=>v.toFixed(0)});
  else lineChart($('#stL3'),{x,series:W.map((w,i)=>({data:st.map(s=>s.w[w].wearEnd),color:C[i]})),yfmt:v=>v.toFixed(1)});
}
