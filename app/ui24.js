// ================= OFFLINE: GARA DAI RISULTATI, PRESSIONI ESATTE, DEGRADO GOMME, STORICO SETUP =================

// ---------- race from the .xml: class positions lap by lap and every car's strategy ----------
function raceStints(d){const L=d.laps;const st=[];let cur=null;
  L.forEach((l,i)=>{if(!cur||L[i-1]?.pit){cur={laps:[],comp:(l.fc||'').replace(/^\d+,/,'')};st.push(cur);}cur.laps.push(l);});
  return st.map(s=>{const clean=s.laps.filter((l,i)=>i>0&&!l.pit&&!l.invalid&&Number.isFinite(lapT(l))).map(lapT);
    return {from:s.laps[0].num,to:s.laps[s.laps.length-1].num,n:s.laps.length,pace:median(clean),comp:s.comp};});}
function raceExtraHTML(sess,me){const field=sess.drivers.filter(d=>d.cls===me.cls&&d.laps.length).sort((a,b)=>(a.cpos||99)-(b.cpos||99));if(field.length<2)return '';
  const rows=field.map(d=>{const S=raceStints(d),ds=driverStats(d);const box=ds.box.reduce((x,y)=>x+y,0)-2*ds.box.length*ds.allPace; /* in + out lap minus two laps at race pace */const bestP=Math.min(...S.map(s=>s.pace).filter(Number.isFinite));
    return `<tr class="${d===me?'ours':''}"><td>${d.cpos||'—'}</td><td class="l">${esc(d.name.replace(/#\d+$/,''))}<div class="muted small">${esc(d.car||'')}</div></td><td>${S.length-1}</td>
      <td class="l">${S.map(s=>`<span class="rcst">${s.n}</span>`).join(' ')}</td><td class="l">${S.map(s=>`<span class="rcst${s.pace===bestP?' best':''}">${fmtLap(s.pace)}</span>`).join(' ')}</td>
      <td class="l">${S.map(s=>esc(s.comp||'—')).join(' · ')}</td><td>${box>0?fx(box,1)+' s':'—'}</td></tr>`;}).join('');
  return `<div class="panel" id="rcP"><div class="panel-h"><h3>${tr('Posizioni giro per giro')}</h3><span class="muted small">${tr('classe')} ${esc(me.cls||'')} · ${tr('in alto il primo')}</span></div><canvas id="rcPos" style="width:100%;height:230px"></canvas></div>
    <div class="panel"><div class="panel-h"><h3>${tr('Strategie a confronto')}</h3><span class="muted small">${tr('giri per stint, passo per stint (mediana dei giri puliti), gomme e tempo perso alle soste (giro di entrata + uscita rispetto al passo)')}</span></div>
    <div class="tw"><table class="lbt"><thead><tr><th>${tr('Cl.')}</th><th class="l">${tr('Pilota')}</th><th>${tr('Soste')}</th><th class="l">${tr('Giri per stint')}</th><th class="l">${tr('Passo per stint')}</th><th class="l">${tr('Gomme')}</th><th>${tr('Perso ai box')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;}
function drawRacePos(sess,me){const cv=$('#rcPos');if(!cv)return;const field=sess.drivers.filter(d=>d.cls===me.cls&&d.laps.length);
  const endT=(d,i)=>{const n=d.laps[i+1];if(n&&Number.isFinite(n.et))return n.et;const l=d.laps[i];return l&&Number.isFinite(l.et)&&Number.isFinite(lapT(l))?l.et+lapT(l):NaN;};
  const nl=Math.max(...field.map(d=>d.laps.length));const x=[...Array(nl).keys()].map(i=>i+1);
  // class position at the end of each lap: who has done that lap first
  const pos=new Map(field.map(d=>[d,[]]));x.forEach((_,i)=>{const t=field.map(d=>[d,endT(d,i)]).filter(([,v])=>Number.isFinite(v)).sort((a,b)=>a[1]-b[1]);t.forEach(([d],k)=>pos.get(d)[i]=k+1);});
  const sorted=[...field].sort((a,b)=>(a.cpos||99)-(b.cpos||99));const pick=[...new Set([sorted[0],...sorted.filter(d=>Math.abs((d.cpos||99)-(me.cpos||99))<=2),me])].slice(0,6);
  const palette=[tok('muted'),tok('lapB'),tok('good'),tok('warn'),tok('best'),tok('faint')];let k=0;
  lineChart(cv,{x,series:pick.map(d=>({data:x.map((_,i)=>{const p=pos.get(d)[i];return Number.isFinite(p)?-p:NaN;}),color:d===me?tok('lapA'):palette[k++%palette.length],name:d.name})),yfmt:v=>'P'+Math.round(-v),h:230});
  cv.insertAdjacentHTML('afterend',`<div class="rcleg">${pick.map((d,i)=>`<span><i style="background:${d===me?tok('lapA'):palette[pick.filter(z=>z!==me).indexOf(d)%palette.length]}"></i>${esc(d.name.replace(/#\d+$/,''))}</span>`).join('')}</div>`);}
(function(){const os=stintXML;window.stintXML=stintXML=function(R,sess,body){os(R,sess,body);try{if(!/race/i.test(sess.name))return;const D=sess.drivers[myDriverIdx(R,sess)];if(!D||!D.laps.length)return;
    const h=raceExtraHTML(sess,D);if(!h)return;body.insertAdjacentHTML('beforeend',h);drawRacePos(sess,D);}catch(e){console.error(e);}};})();

// ---------- tyre degradation from the .ld: time lost per lap to the tyres, wear, when to change ----------
function tyreDeg(S){const b=bestValid(S);const pool=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid&&b&&l.time<=b.time*1.07);if(pool.length<5)return null;
  const xs=pool.map(l=>l.num),ys=pool.map(l=>l.time),xm=avg_(xs),ym=avg_(ys);let n=0,d=0;xs.forEach((x,i)=>{n+=(x-xm)*(ys[i]-ym);d+=(x-xm)**2;});const slope=d?n/d:NaN;
  const st=pool.map(l=>lapStats(S,l));const fuel=median(st.map(s=>s.fuel).filter(v=>v>0&&v<20));const fe=+LS.get('su:fuelEff',0.03);
  // fuel burnt makes the car faster lap after lap: add it back to see what the tyres cost
  const deg=slope+(Number.isFinite(fuel)?fe*fuel:0);
  // wear channel as used (rising) or left (falling), in % or as a fraction: per-lap change in %
  const raw=W.map(w=>st.map(s=>Math.abs(s.w[w].wear)).filter(v=>v>0)).flat();const ws=raw.length&&median(raw)<0.05?100:1;
  const wear={};W.forEach(w=>{wear[w]=median(st.map(s=>Math.abs(s.w[w].wear)*ws).filter(v=>v>0&&v<10));});const wv=W.map(w=>wear[w]).filter(Number.isFinite);const maxW=wv.length?Math.max(...wv):NaN;
  const sp=LS.get('strategy',{});const wearMax=+sp.wearMax||35,t4=+sp.t4||12;const lapsWear=maxW>0?wearMax/maxW:NaN;const nOpt=deg>0.01?Math.sqrt(2*t4/deg):Infinity;
  return {n:pool.length,slope,fuel,fe,deg,wear,maxW,wearMax,lapsWear,t4,nOpt,stint:Math.min(nOpt,Number.isFinite(lapsWear)?lapsWear:Infinity)};}
function tyreDegHTML(X){if(!X)return `<div class="muted small">${tr('Servono almeno 5 giri lanciati validi vicini al migliore.')}</div>`;
  const worst=W.reduce((a,w)=>X.wear[w]>(X.wear[a]||-1)?w:a,'FL');
  const k=[liveTile('Calo del tempo',`${X.slope>0?'+':''}${fx(X.slope,3)} s`,tr('a giro, misurato')),liveTile('Calo dovuto alle gomme',`${X.deg>0?'+':''}${fx(X.deg,3)} s`,Number.isFinite(X.fuel)?`${tr('a giro, togliendo la benzina')} (${fx(X.fuel,2)} L × ${X.fe} s)`:tr('a giro')),
    liveTile('Usura per giro',Number.isFinite(X.maxW)?fx(X.maxW,2)+'%':'—',Number.isFinite(X.maxW)?`${tr('la più consumata')}: ${tr(WN[W.indexOf(worst)])}`:''),
    liveTile(`${tr('Gomme al')} ${X.wearMax}%`,Number.isFinite(X.lapsWear)?`${Math.floor(X.lapsWear)} ${tr('giri')}`:'—',tr('da nuove')),
    liveTile('Cambio gomme conveniente',Number.isFinite(X.stint)?`${tr('ogni')} ≈ ${Math.max(1,Math.round(X.stint))} ${tr('giri')}`:tr('non serve'),X.nOpt<X.lapsWear?`${tr('il calo supera i')} ${X.t4} s ${tr('del cambio')}`:Number.isFinite(X.lapsWear)?tr('limite di usura'):'')];
  return `<div class="kpis">${k.join('')}</div><p class="muted small" style="margin:8px 0 0">${tr('Il tempo sul giro di uno stint sale per le gomme e scende per la benzina che si consuma: qui la benzina è tolta con')} <label style="display:inline-flex;gap:4px;align-items:center"><input type="number" id="dgFe" step="0.005" min="0" value="${X.fe}" style="width:70px"> ${tr('s per litro')}</label>. ${tr('Il cambio conviene quando il tempo perso dalle gomme vecchie supera il tempo del cambio gomme (Strategia › Cambio 4 gomme) o quando arrivano al limite di usura (Strategia › Usura massima).')}</p>`;}
function wireDeg(re){const i=$('#dgFe');if(i)i.onchange=()=>{LS.set('su:fuelEff',Math.max(0,+i.value||0));re();};}
(function(){const os=stintLD;window.stintLD=stintLD=function(S,body){os(S,body);try{const X=tyreDeg(S);body.insertAdjacentHTML('beforeend',`<div class="panel" id="dgP"><div class="panel-h"><h3>${tr('Degrado gomme')}</h3><span class="muted small">${X?X.n+' '+tr('giri entro il 107% del migliore'):''}</span></div>${tyreDegHTML(X)}</div>`);wireDeg(()=>RENDER.stint());}catch(e){console.error(e);}};})();

// ---------- pressures and camber: exactly how much to change ----------
// hot pressure follows the gas law: a change of the cold pressure moves the hot one by about (T hot / T cold)
function tyreFix(D,S){const T=D?.raw?.T;if(!T)return null;const c=cfg();const pmin=num(c.pmin),pmax=num(c.pmax),io=num(c.iomin),iomax=num(c.iomax);
  const air=Number.isFinite(S.cond?.air?.avg)?S.cond.air.avg:20;const su=D.su;const tgt=Number.isFinite(pmin)&&Number.isFinite(pmax)?(pmin+pmax)/2:NaN;
  return W.map(w=>{const x=T[w];const th=Number.isFinite(x.carc)?x.carc:mean([x.I,x.C,x.O]);const dHot=tgt-x.p;const dCold=dHot*(air+273.15)/(th+273.15);
    const now=setupVal(su,'PressureSetting',SEC_OF[w]);const nowN=now?parseFloat(String(now).replace(',','.')):NaN;
    const io_=x.I-x.O,ioT=Number.isFinite(io)&&Number.isFinite(iomax)?(io+iomax)/2:NaN;
    return {w,pHot:x.p,th,tgt,dCold,now,nowN,io:io_,ioT,dIO:io_-ioT,cam:setupVal(su,'CamberSetting',SEC_OF[w])};});}
function tyreFixHTML(D,S){const F=tyreFix(D,S);if(!F)return `<div class="empty">${tr('Scegli una telemetria .ld in alto.')}</div>`;const hasT=F.some(f=>Number.isFinite(f.tgt));
  const rows=F.map(f=>{const ok=Math.abs(f.dCold)<0.5;const camTxt=!Number.isFinite(f.dIO)?'—':Math.abs(f.dIO)<2?`<span class="pos">ok</span>`:f.dIO>0?`${tr('meno negativa')} <small>(${fx(f.dIO,1)} °C ${tr('in più all\'interno')})</small>`:`${tr('più negativa')} <small>(${fx(-f.dIO,1)} °C ${tr('in più all\'esterno')})</small>`;
    return `<tr><td class="l"><b>${tr(WN[W.indexOf(f.w)])}</b></td><td>${fx(f.pHot,1)} kPa</td><td>${Number.isFinite(f.tgt)?fx(f.tgt,1)+' kPa':'—'}</td>
      <td class="${ok?'pos':''}"><b>${!Number.isFinite(f.dCold)?'—':ok?'ok':(f.dCold>0?'+':'')+fx(f.dCold,1)+' kPa'}</b>${f.now&&Number.isFinite(f.nowN)&&Number.isFinite(f.dCold)&&!ok?` <small class="muted">(${esc(f.now)} → ≈ ${fx(f.nowN+f.dCold,1)})</small>`:f.now?` <small class="muted">(${tr('ora')} ${esc(f.now)})</small>`:''}</td>
      <td>${fx(f.io,1)} °C</td><td class="l">${camTxt}${f.cam&&Number.isFinite(f.dIO)&&Math.abs(f.dIO)>=2?` <small class="muted">(${tr('ora')} ${esc(f.cam)})</small>`:''}</td></tr>`;}).join('');
  return `${hasT?'':`<div class="warnbar" style="margin-bottom:8px">${tr('Imposta la pressione a caldo obiettivo (min e max) qui sopra in «Obiettivi di riferimento»: senza obiettivo non posso dire di quanti kPa cambiare.')}</div>`}
    <div class="tw"><table class="lbt"><thead><tr><th class="l">${tr('Gomma')}</th><th>${tr('A caldo')}</th><th>${tr('Obiettivo')}</th><th>${tr('Cambia a freddo')}</th><th>${tr('Int − est')}</th><th class="l">${tr('Campanatura')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted small" style="margin:8px 0 0">${tr('A freddo serve meno della differenza a caldo: la gomma calda (carcassa) gonfia l\'aria. Il calcolo usa la temperatura dell\'aria della sessione come temperatura a freddo. Per la campanatura l\'obiettivo è la differenza interno − esterno impostata negli obiettivi.')}</p>`;}

// ---------- setup history: every analysed run with its setup, and what each change did ----------
const SH_SEC={FRONTLEFT:'ant. sx',FRONTRIGHT:'ant. dx',REARLEFT:'post. sx',REARRIGHT:'post. dx'};
function shRecord(S,D,su){if(!S||!D||!su)return;const b=bestValid(S);if(!b)return;const fl=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid&&l.time<=b.time*1.07);
  const vals={};Object.entries(su.sec).forEach(([sec,items])=>items.forEach(x=>{if(x.disp&&!/N\/A|Non-adjustable|Detached/.test(x.disp))vals[sec+'|'+x.key]=x.disp;}));
  const B=D.raw.B||{};const ph=B.phases||{},sp=B.speedIdx||{};const T=D.raw.T||{};const tav=ws=>mean(ws.map(w=>T[w]?.carc));
  const H=LS.get('suhist',{});H[S.id]={id:S.id,venue:S.meta.venue||'',car:(S.meta.car||S.merged?.d.car||su.car||''),when:`${S.meta.date||''} ${(S.meta.time||'').slice(0,5)}`,su:su.name,vals,
    best:b.time,pace:median(fl.map(l=>l.time)),n:fl.length,track:S.cond?.track?.avg,cond:S.cond?.label,
    idx:{entrata:ph.entrata?.steerIdx,centro:ph.centro?.steerIdx,uscita:ph.uscita?.steerIdx,lente:sp.lente?.idx,veloci:sp.veloci?.idx},tf:tav(['FL','FR']),tr:tav(['RL','RR']),at:Date.now()};
  const keys=Object.keys(H);if(keys.length>200)keys.sort((a,b)=>H[a].at-H[b].at).slice(0,keys.length-200).forEach(k=>delete H[k]);LS.set('suhist',H);}
function shDiff(a,b){const out=[];new Set([...Object.keys(a.vals),...Object.keys(b.vals)]).forEach(k=>{if(a.vals[k]===b.vals[k])return;const [sec,key]=k.split('|');
  out.push(`${SETUP_LABELS[key]||key.replace(/Setting$/,'')}${SH_SEC[sec]?' '+SH_SEC[sec]:''}: ${a.vals[k]??'—'} → <b>${b.vals[k]??'—'}</b>`);});return out;}
function shHTML(S){const H=Object.values(LS.get('suhist',{}));const venue=S?.meta.venue,car=(S?.meta.car||S?.merged?.d.car||'').toLowerCase();
  const runs=H.filter(h=>h.venue===venue&&(!car||!h.car||h.car.toLowerCase()===car)).sort((a,b)=>String(a.when).localeCompare(String(b.when))||a.at-b.at);
  if(!runs.length)return `<div class="muted small">${tr('Ogni telemetria aperta qui con il suo .svm viene salvata: le uscite sulla stessa pista con la stessa auto compaiono in questa tabella con le modifiche fatte e il loro effetto.')}</div>`;
  const d=(a,b,k,dp,inv)=>{const x=b[k]-a[k];if(!Number.isFinite(x))return '';const good=inv?x>0:x<0;return ` <small class="${Math.abs(x)<(dp===3?0.05:0.03)?'muted':good?'pos':'neg'}">${x>0?'+':''}${fx(x,dp)}</small>`;};
  const idx=(r,k)=>Number.isFinite(r.idx?.[k])?fx(r.idx[k],2):'—';
  const rows=runs.map((r,i)=>{const p=runs[i-1];const ch=p?shDiff(p,r):[];const di=(k)=>p&&Number.isFinite(r.idx?.[k])&&Number.isFinite(p.idx?.[k])?` <small class="${Math.abs(r.idx[k]-p.idx[k])<0.03?'muted':''}">${r.idx[k]-p.idx[k]>0?'+':''}${fx(r.idx[k]-p.idx[k],2)}</small>`:'';
    return `<tr class="${r.id===S?.id?'ours':''}"><td class="l">${esc(r.when)}<div class="muted small">${esc(r.su)}</div></td><td>${fmtLap(r.best)}</td><td>${fmtLap(r.pace)}${p?d(p,r,'pace',3):''}</td><td>${idx(r,'lente')}${di('lente')}</td><td>${idx(r,'veloci')}${di('veloci')}</td><td>${fx(r.track,0)} °C</td>
      <td class="l small">${!p?`<span class="muted">${tr('prima uscita')}</span>`:ch.length?ch.slice(0,6).join('<br>')+(ch.length>6?`<br><span class="muted">+${ch.length-6} ${tr('altre')}</span>`:''):`<span class="muted">${tr('stesso setup')}</span>`}</td></tr>`;}).join('');
  const last=runs[runs.length-1],prev=runs[runs.length-2];let sum='';
  if(prev){const ch=shDiff(prev,last);const dp=last.pace-prev.pace;const dl=last.idx?.lente-prev.idx?.lente,dv=last.idx?.veloci-prev.idx?.veloci;const dt=last.track-prev.track;
    sum=`<p class="small" style="margin:0 0 8px"><b>${tr('Ultima modifica')}</b>: ${ch.length?ch.slice(0,3).join(', '):tr('nessuna modifica al setup')} → ${tr('passo')} ${Number.isFinite(dp)?`<b class="${Math.abs(dp)<0.05?'':dp<0?'pos':'neg'}">${dp>0?'+':''}${fx(dp,3)} s</b>`:'—'}${Number.isFinite(dl)?`, ${tr('sterzo nelle lente')} ${dl>0?'+':''}${fx(dl,2)}`:''}${Number.isFinite(dv)?`, ${tr('nelle veloci')} ${dv>0?'+':''}${fx(dv,2)}`:''}.${Number.isFinite(dt)&&Math.abs(dt)>3?` <span class="warn">${tr('Attenzione: pista')} ${dt>0?'+':''}${fx(dt,0)} °C ${tr('rispetto all\'uscita prima, il confronto vale meno.')}</span>`:''}</p>`;}
  return `${sum}<div class="tw"><table class="lbt"><thead><tr><th class="l">${tr('Uscita')}</th><th>${tr('Migliore')}</th><th>${tr('Passo')}</th><th>${tr('Sterzo lente')}</th><th>${tr('Sterzo veloci')}</th><th>${tr('Pista')}</th><th class="l">${tr('Modifiche rispetto alla precedente')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted small" style="margin:8px 0 0">${tr('Sterzo nelle curve lente e veloci: oltre 1 = sottosterzo, sotto 1 = sovrasterzo; se scende dopo una modifica, il sottosterzo è diminuito. Il passo è la mediana dei giri entro il 107% del migliore.')}</p>`;}

// panels in the Setup tab, after the automatic checks (RENDER.setup is defined later in the bundle)
setTimeout(()=>{const anchor=$('#suDiag')?.closest('.panel');if(anchor&&!$('#suTyreP'))anchor.insertAdjacentHTML('afterend',`<div class="panel" id="suTyreP"><div class="panel-h"><h3>${tr('Pressioni e campanature: quanto cambiare')}</h3></div><div id="suTyre"></div></div>`);
  const sus=$('#suSuspP');if(sus&&!$('#suHistP'))sus.insertAdjacentHTML('afterend',`<div class="panel" id="suHistP"><div class="panel-h"><h3>${tr('Storico setup e risultati')}</h3><span class="muted small">${tr('stessa pista e stessa auto')}</span></div><div id="suHist"></div></div>`);
  const base=RENDER.setup;RENDER.setup=()=>{base();try{const S=active()?.S;const D=DIAG&&DIAG.S===S?DIAG:null;$('#suTyre').innerHTML=S?tyreFixHTML(D,S):`<div class="empty">${tr('Scegli una telemetria .ld in alto.')}</div>`;
      if(S&&D&&D.su)shRecord(S,D,D.su);$('#suHist').innerHTML=S?shHTML(S):'';}catch(e){console.error(e);}};if(curView()==='setup')RENDER.setup();},0);

// the debrief also reports the tyre degradation
(function(){const od=sessDebrief;window.sessDebrief=sessDebrief=function(S){const X=od(S);if(!X)return X;try{const G=tyreDeg(S);if(G){X.deg=G;
    if(G.deg>0.05&&Number.isFinite(G.stint))X.next.push(`${tr('Gomme: perdi')} ${fx(G.deg,2)} s ${tr('a giro per il degrado; conviene cambiarle ogni')} ≈ ${Math.round(G.stint)} ${tr('giri')}.`);}}catch(e){}return X;};})();
