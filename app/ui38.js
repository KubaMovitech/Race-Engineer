// ================= SETUP: the track engineer =================
// One report that reads the telemetry like a race engineer: for every area of the car (tyres, brakes, traction,
// platform and ride heights, springs and dampers, aero and wing, balance) what the data shows, where on the lap,
// why it matters and which setting to move, with the value in your setup. It uses the analyses that already exist
// (diagnose, tyreFix, susAnalyse, slipEvents, balance, the doctor's knowledge base) and adds the ones that were
// missing: dynamic camber, third elements and packers, wheel lift on kerbs, braking platform, aero balance by speed.
// The Setup page is split in tabs so it reads in order: Ingegnere · Analisi · Setup · Generatore · Guida.

const ENG_AREAS=[['gom','Gomme','◐'],['fre','Freni','◉'],['tra','Trazione','⟳'],['pia','Piattaforma e altezze','▭'],['sos','Molle, barre e ammortizzatori','⌇'],['aer','Aerodinamica e ala','◭'],['bil','Bilanciamento','⇄']];
// order in which a track engineer works through the car (the plan follows it)
const ENG_ORDER=['gom','fre','pia','aer','bil','sos','tra'];
const q_=(a,p)=>{const s=[...a].filter(Number.isFinite).sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};

// ---------- the measurements the existing checks did not have ----------
function engMeasure(S,laps){const key='eng|'+laps.map(l=>l.i).join(',');if(S.cache.has(key))return S.cache.get(key);
  const out={dynCam:{F:[],R:[]},lift:{F:0,R:0,n:0,where:{}},third:{},kerb:NaN,bp:NaN,corners:[]};const W=['FL','FR','RL','RR'];
  laps.slice(0,5).forEach((lap,li)=>{const g=lapGrid(S,lap,2);const n=g.n;const v=g.get('Ground Speed'),gl=g.get('G Force Lat'),br=g.get('Brake Pos'),th=g.get('Throttle Pos');if(!v||!gl)return;
    const L=W.map(w=>g.get('Tyre Load '+w)),C=W.map(w=>g.get('Camber '+w)) /* degrees: parseLD converts from the file's unit */;const cor=li===0?detectCorners(g):null;if(cor)out.corners=cor;
    const cornerAt=d=>{const c=(out.corners||[]).find(c=>d>=c.dS&&d<=c.dE);return c?'T'+c.k:tr('rettilineo');};
    for(let i=0;i<n;i++){
      // outside wheels at high lateral load: the most loaded of each axle
      if(Math.abs(gl[i])>1.2&&v[i]>60&&L[0]&&C[0]){const fo=L[0][i]>L[1][i]?0:1,ro=L[2][i]>L[3][i]?2:3;if(Number.isFinite(C[fo][i]))out.dynCam.F.push(C[fo][i]);if(Number.isFinite(C[ro][i]))out.dynCam.R.push(C[ro][i]);}
      }
    // third elements and packers: vdyn.js (vdAxles). The old test «within 0.4 mm of the 99.5th percentile = on the packer»
    // is gone: a percentile of the travel observed is not a physical end of travel.
    const gv=g.get('G Force Vert');if(gv){const k=q_(gv,0.997);out.kerb=Number.isFinite(out.kerb)?Math.max(out.kerb,k):k;}
    const bp=g.get('Brake Pressure FL');if(bp){const k=q_(bp,0.99);out.bp=Number.isFinite(out.bp)?Math.max(out.bp,k):k;}});
  out.dynCamF=q_(out.dynCam.F,.5);out.dynCamR=q_(out.dynCam.R,.5);
  S.cache.set(key,out);return out;}

// ---------- the findings ----------
// {a: area, s: 0 ok · 1 da controllare · 2 importante, t: title, ev: [evidence], why, fx: [{key,sec,dir,why}], d: distance on the lap, conf}
function engFindings(D,S,su,laps){const F=[];const add=(a,s,t,ev,why,fx=[],o={})=>F.push({a,s,t,ev:ev.filter(Boolean),why,fx,...o});const c=cfg();const T=D.raw?.T||{};const W=['FL','FR','RL','RR'];
  const SECW={FL:'FRONTLEFT',FR:'FRONTRIGHT',RL:'REARLEFT',RR:'REARRIGHT'};const WN={FL:tr('Ant. sx'),FR:tr('Ant. dx'),RL:tr('Post. sx'),RR:tr('Post. dx')};
  const M=engMeasure(S,laps);const cw=k=>(M.corners||[]).find(x=>'T'+x.k===k);
  // ---- tyres: camber from the inner-outer spread, with the dynamic camber of the outside wheel
  const io0=+c.iomin||3,io1=+c.iomax||12;
  W.forEach(w=>{const t=T[w];if(!t)return;const io=t.I-t.O;if(!Number.isFinite(io))return;const dyn=w[0]==='F'?M.dynCamF:M.dynCamR;
    const ev=[`${tr('interno − esterno')} ${io>0?'+':''}${fx(io,1)} °C (${tr('obiettivo')} ${io0}–${io1})`,Number.isFinite(dyn)?`${tr('campanatura in appoggio')} ${fx(dyn,2)}°`:''];
    if(io>io1)add('gom',io>io1+5?2:1,`${WN[w]}: ${tr('troppa campanatura negativa')}`,ev,tr('Il bordo interno lavora troppo: meno impronta in frenata e in trazione e usura interna.'),[{key:'CamberSetting',sec:SECW[w],dir:tr('meno negativa di 0,2–0,3°'),why:tr('appoggia di più il bordo esterno')}]);
    else if(io<io0)add('gom',io<io0-4?2:1,`${WN[w]}: ${tr('serve più campanatura negativa')}`,ev,tr('La gomma lavora sul bordo esterno in curva: perde grip in appoggio e si consuma fuori.'),[{key:'CamberSetting',sec:SECW[w],dir:tr('più negativa di 0,2–0,3°'),why:tr('in curva la gomma appoggia piatta')}]);
    else add('gom',0,`${WN[w]}: ${tr('campanatura nella finestra')}`,ev,'');});
  // pressures: centre against edges, and the hot window when the user set it
  W.forEach(w=>{const t=T[w];if(!t)return;const d=t.C-(t.I+t.O)/2;const pm=+c.pmin,px=+c.pmax;const ev=[`${tr('centro − bordi')} ${d>0?'+':''}${fx(d,1)} °C`,Number.isFinite(t.p)?`${tr('a caldo')} ${fx(t.p,1)} kPa${pm&&px?` (${tr('obiettivo')} ${pm}–${px})`:''}`:''];
    if(d>6||(px&&t.p>px))add('gom',d>9||(px&&t.p>px+3)?2:1,`${WN[w]}: ${tr('pressione alta')}`,ev,tr('La gomma lavora sul centro: meno impronta, scivola e si surriscalda al centro.'),[{key:'PressureSetting',sec:SECW[w],dir:tr('−1 click (circa −1 kPa a freddo)'),why:tr('impronta più larga')}]);
    else if(d<-2||(pm&&t.p<pm))add('gom',d<-5||(pm&&t.p<pm-3)?2:1,`${WN[w]}: ${tr('pressione bassa')}`,ev,tr('La gomma si schiaccia: lavora sui bordi, scalda la carcassa e la risposta è lenta.'),[{key:'PressureSetting',sec:SECW[w],dir:tr('+1 click'),why:tr('carcassa più sostenuta')}]);
    else add('gom',0,`${WN[w]}: ${tr('pressione equilibrata')}`,ev,'');});
  // temperature window by axle
  const ax=(a,b,k)=>(T[a]?.[k]+T[b]?.[k])/2;const cF=ax('FL','FR','carc'),cR=ax('RL','RR','carc');const tmin=+c.tmin||75,tmax=+c.tmax||95;
  [[cF,tr('anteriori'),'F'],[cR,tr('posteriori'),'R']].forEach(([v,n,a])=>{if(!Number.isFinite(v))return;
    if(v<tmin)add('gom',v<tmin-8?2:1,`${tr('Gomme')} ${n} ${tr('fredde')}`,[`${tr('carcassa')} ${fx(v,0)} °C (${tr('finestra')} ${tmin}–${tmax})`],tr('Fuori finestra la gomma non dà grip: sottosterzo o sovrasterzo che sparisce quando si scaldano.'),
      a==='F'?[{key:'PressureSetting',sec:'FRONTLEFT',dir:tr('+1 click sulle anteriori'),why:tr('la carcassa lavora e scalda')},{key:'BrakeDuctSetting',sec:null,dir:tr('prese freni anteriori più chiuse'),why:tr('il calore dei freni passa al cerchio')}]:[{key:'PressureSetting',sec:'REARLEFT',dir:tr('+1 click sulle posteriori'),why:tr('la carcassa lavora e scalda')},{key:'BrakeDuctRearSetting',sec:null,dir:tr('prese freni posteriori più chiuse'),why:tr('più calore alle gomme')}]);
    else if(v<=tmax)add('gom',0,`${tr('Gomme')} ${n} ${tr('nella finestra di temperatura')}`,[`${tr('carcassa')} ${fx(v,0)} °C (${tr('finestra')} ${tmin}–${tmax})`],'');
    else if(v>tmax)add('gom',v>tmax+8?2:1,`${tr('Gomme')} ${n} ${tr('troppo calde')}`,[`${tr('carcassa')} ${fx(v,0)} °C (${tr('finestra')} ${tmin}–${tmax})`],tr('Sopra la finestra il grip cala giro dopo giro e l\'usura sale.'),
      a==='F'?[{key:'FrontAntiSwaySetting',sec:null,dir:tr('barra anteriore più morbida'),why:tr('l\'anteriore scivola meno e scalda meno')},{key:'BrakeDuctSetting',sec:null,dir:tr('prese freni anteriori più aperte'),why:tr('meno calore dai freni')}]:[{key:'RearAntiSwaySetting',sec:null,dir:tr('barra posteriore più morbida'),why:tr('meno scivolamento in uscita')},{key:'TractionControlMapSetting',sec:null,dir:tr('TC un passo più alto'),why:tr('meno pattinamento')}]);});
  if(Number.isFinite(cF)&&Number.isFinite(cR)&&Math.abs(cF-cR)>10)add('gom',1,cF>cR?tr('Anteriori molto più calde delle posteriori'):tr('Posteriori molto più calde delle anteriori'),[`${tr('carcassa')} ${fx(cF,0)} / ${fx(cR,0)} °C`],cF>cR?tr('L\'anteriore lavora più del posteriore: di solito sottosterzo che consuma il davanti.'):tr('Il posteriore lavora più dell\'anteriore: scivola in uscita e si consuma.'));
  // ---- brakes
  const SL=D.raw?.SL;if(SL){const wh=(k)=>{const e=Object.entries(SL.where||{}).sort((a,b)=>(b[1][k]||0)-(a[1][k]||0))[0];return e&&e[1][k]>0?e[0]:null;};
    if(SL.lockF>0.25&&SL.lockF>=SL.lockR*1.5){const w=wh('lf');add('fre',SL.lockF>0.8?2:1,tr('Bloccaggi all\'anteriore'),[`${fx(SL.lockF,2)} s/${tr('giro')} ${tr('di ruota bloccata')}`,w?`${tr('soprattutto a')} ${w}`:''],tr('Ruota anteriore bloccata = spazio di frenata più lungo, sottosterzo in inserimento e spiattellamento.'),
      [{key:'RearBrakeSetting',sec:null,dir:tr('ripartizione 0,5–1% più verso il posteriore'),why:tr('l\'anteriore frena un po\' meno')},{key:'BrakePressureSetting',sec:null,dir:tr('pressione freni −2–3%'),why:tr('più margine prima del bloccaggio')},{key:'SlowBumpSetting',sec:'FRONTLEFT',dir:tr('compressione lenta anteriore +1'),why:tr('l\'auto si abbassa meno sul davanti e scarica meno il posteriore')}],{d:cw(w)?.dApex});}
    if(SL.lockR>0.15){const w=wh('lr');add('fre',SL.lockR>0.5?2:1,tr('Bloccaggi al posteriore'),[`${fx(SL.lockR,2)} s/${tr('giro')}`,w?`${tr('soprattutto a')} ${w}`:''],tr('Il posteriore bloccato rende l\'auto instabile in staccata e la fa girare in ingresso.'),
      [{key:'RearBrakeSetting',sec:null,dir:tr('ripartizione 0,5–1% più avanti'),why:tr('il posteriore frena meno')},{key:'DiffCoastSetting',sec:null,dir:tr('differenziale in rilascio più chiuso'),why:tr('le ruote posteriori girano insieme e la coda si muove meno')},{key:'RegenerationMapSetting',sec:null,dir:tr('rigenerazione più bassa'),why:tr('meno freno motore elettrico sul posteriore')}],{d:cw(w)?.dApex});}}
  if(SL&&SL.lockF<=0.25&&SL.lockR<=0.15)add('fre',0,tr('Nessun bloccaggio importante'),[`${tr('anteriore')} ${fx(SL.lockF,2)} · ${tr('posteriore')} ${fx(SL.lockR,2)} s/${tr('giro')}`],'');
  {const bb=W.map(w=>T[w]?.bMax);if(bb.every(Number.isFinite))add('fre',0,tr('Temperature freni'),[`${tr('picchi')} ${bb.map(x=>fx(x,0)).join(' / ')} °C (FL FR RL RR)`],'');}
  W.forEach(w=>{const b=T[w]?.bMax;if(!Number.isFinite(b))return;const bm=+c.bmax;
    if(bm&&b>bm)add('fre',b>bm+80?2:1,`${tr('Freno')} ${WN[w]} ${tr('troppo caldo')}`,[`${tr('picco')} ${fx(b,0)} °C (${tr('limite')} ${bm})`],tr('Freni troppo caldi perdono efficacia e si consumano.'),[{key:w[0]==='F'?'BrakeDuctSetting':'BrakeDuctRearSetting',sec:null,dir:tr('prese più aperte'),why:tr('più aria sui dischi')}]);
    else if(b<300)add('fre',1,`${tr('Freno')} ${WN[w]} ${tr('freddo')}`,[`${tr('picco')} ${fx(b,0)} °C`],tr('Dischi freddi mordono meno nelle prime staccate.'),[{key:w[0]==='F'?'BrakeDuctSetting':'BrakeDuctRearSetting',sec:null,dir:tr('prese più chiuse'),why:tr('il disco resta in temperatura')}]);});
  // ---- traction
  if(SL&&SL.spin>0.5){const e=Object.entries(SL.where||{}).sort((a,b)=>(b[1].sp||0)-(a[1].sp||0))[0];const w=e&&e[1].sp>0?e[0]:null;
    add('tra',SL.spin>1.5?2:1,tr('Pattinamento in uscita'),[`${fx(SL.spin,2)} s/${tr('giro')}`,w?`${tr('soprattutto a')} ${w}`:''],tr('Le ruote posteriori girano più dell\'auto: perdi uscita e scaldi le posteriori.'),
      [{key:'TractionControlMapSetting',sec:null,dir:tr('TC +1'),why:tr('taglia prima lo slittamento')},{key:'DiffPowerSetting',sec:null,dir:tr('differenziale in trazione più aperto'),why:tr('la ruota interna non trascina via la coda')},{key:'RearAntiSwaySetting',sec:null,dir:tr('barra posteriore più morbida'),why:tr('più carico sulla ruota interna in uscita')}],{d:cw(w)?.dApex});}
  if(SL&&SL.spin<=0.5)add('tra',0,tr('Trazione pulita'),[`${tr('pattinamento')} ${fx(SL.spin,2)} s/${tr('giro')}`],'');
  // ---- platform, springs, third element and dampers: the cards of «Analisi tecnica» (vdyn.js), each one from a
  // phenomenon measured and repeatable at one place, with its cause, reliability, one change and how to check it
  let C=[];try{C=techCards(S,laps,su,techData(S,laps));}catch(e){console.error(e);}
  C.forEach(c=>add(c.a,c.s,c.t,[c.where.txt,...c.ev,c.rep.txt],c.expect,c.fx?[{key:c.fx.key,sec:c.fx.sec,dir:c.fx.dir,why:c.fx.why}]:[],{card:c,d:c.where.d}));
  {const rhMin=Math.min(...W.map(w=>T[w]?.rhMin??Infinity));if(!C.some(c=>c.k==='low')&&Number.isFinite(rhMin))add('pia',0,tr('Altezza sempre sopra la soglia'),[`${tr('altezza minima')} ${fx(rhMin,1)} mm (${tr('soglia')} ${+c.rh||3} mm)`],'');}
  if(!C.some(c=>c.a==='sos'))add('sos',0,tr('Nessun fenomeno ripetibile su sospensioni e ammortizzatori'),[tr('dettagli in Analisi tecnica')],'');
  // ---- aero and wing: balance by speed, top speed
  const bs=typeof balSpeed==='function'?balSpeed(D):null;
  if(bs){const v=bs.veloci,l=bs.lente;const ev=[`${tr('sterzo relativo')}: ${tr('lente')} ${fx(l,2)} · ${Number.isFinite(bs.medie)?tr('medie')+' '+fx(bs.medie,2)+' · ':''}${tr('veloci')} ${fx(v,2)} (${tr('oltre 1 = sottosterzo')})`];
    // a steering index says how the car behaves, not how much downforce each axle has: the advice is a test, not a fact
    if(v>1.08&&v-l>0.06)add('aer',v>1.15?2:1,tr('Più sottosterzo nelle curve veloci che nelle lente'),ev,tr('Compatibile con un bilanciamento aerodinamico spostato verso il posteriore, ma è un indice di sterzo, non una misura del carico. Prima di cambiare, controlla in Analisi tecnica che la piattaforma sia stabile nei curvoni (gomme e cordoli possono dare lo stesso effetto).'),[{key:'RWSetting',sec:null,dir:tr('ala posteriore −1'),why:tr('di solito sposta il bilanciamento in avanti; verifica lo sterzo relativo nelle curve veloci')}]);
    else if(v<0.93&&l-v>0.06)add('aer',v<0.88?2:1,tr('Più sovrasterzo nelle curve veloci che nelle lente'),ev,tr('Compatibile con poco carico al posteriore alle alte velocità, ma è un indice di sterzo, non una misura del carico. Controlla prima piattaforma e gomme posteriori.'),[{key:'RWSetting',sec:null,dir:tr('ala posteriore +1'),why:tr('di solito dà più stabilità al posteriore; verifica lo sterzo relativo nelle curve veloci')}]);
    else if(l>1.08&&l-v>0.06)add('bil',1,tr('Sottosterzo nelle curve lente'),ev,tr('Nelle curve lente comanda il grip meccanico: barre, molle e differenziale, non l\'ala.'),[{key:'FrontAntiSwaySetting',sec:null,dir:tr('barra anteriore più morbida'),why:tr('più grip meccanico davanti')},{key:'DiffPreloadSetting',sec:null,dir:tr('precarico differenziale più basso'),why:tr('l\'auto ruota di più a centro curva')}]);
    else if(l<0.93&&v-l>0.06)add('bil',1,tr('Sovrasterzo nelle curve lente'),ev,tr('Il posteriore perde grip meccanico nelle curve lente.'),[{key:'RearAntiSwaySetting',sec:null,dir:tr('barra posteriore più morbida'),why:tr('più grip meccanico dietro')},{key:'DiffPowerSetting',sec:null,dir:tr('differenziale in trazione più aperto'),why:tr('meno spinta laterale in uscita')}]);
    else add('aer',0,tr('Sterzo simile tra curve lente e veloci'),ev,tr('Nessuna differenza evidente tra curve lente e veloci nell\'indice di sterzo.'));}
  const gc=D.raw?.gc;if(gc){if(gc.limPerLap>0.4)add('aer',1,tr('Limitatore sul rettilineo'),[`${fx(gc.limPerLap,1)} s/${tr('giro')} ${tr('al limitatore')}`],tr('Stai perdendo velocità di punta: rapporto finale troppo corto o troppo carico.'),[{key:'FinalDriveSetting',sec:null,dir:tr('rapporto finale più lungo'),why:tr('più velocità di punta')},{key:'RWSetting',sec:null,dir:tr('ala posteriore −1'),why:tr('meno resistenza')}]);}
  // ---- balance by phase, from the doctor's knowledge base (entry / mid / exit, counter-steers)
  const B=D.raw?.B;const kb=id=>typeof KB!=='undefined'?KB.find(k=>k.id===id):null;
  if(B&&B.phases){const cnt=ph=>(B.counter||[]).filter(x=>x.phase===ph).length;const PN={entrata:tr('in ingresso'),centro:tr('a centro curva'),uscita:tr('in uscita')};const ID={entrata:'in',centro:'mid',uscita:'out'};
    ['entrata','centro','uscita'].forEach(ph=>{const p=B.phases[ph];if(!p||!(p.n>=40)||!Number.isFinite(p.steerIdx))return;const k=p.steerIdx;const cs=cnt(ph);
      const ev=[`${tr('sterzo relativo')} ${fx(k,2)} (1 = ${tr('neutro')})`,B.hasGrip&&Number.isFinite(p.front)?`${tr('scivolamento')} ${tr('ant.')} ${fx(p.front,0)}% · ${tr('post.')} ${fx(p.rear,0)}%`:'',cs?`${cs} ${tr('controsterzi')}`:''];
      const us=k>1.12&&(!B.hasGrip||!Number.isFinite(p.front)||p.front>=p.rear),os=k<0.88||cs>=Math.max(2,laps.length);
      const K=us?kb('us_'+ID[ph]):os&&ph!=='centro'?kb('os_'+ID[ph]):os?{fixes:[{key:'RearAntiSwaySetting',sec:null,dir:tr('barra posteriore più morbida'),why:tr('più grip meccanico dietro in appoggio')},{key:'FrontAntiSwaySetting',sec:null,dir:tr('barra anteriore più rigida'),why:tr('l\'anteriore prende un po\' più carico e l\'auto ruota meno')},{key:'DiffPreloadSetting',sec:null,dir:tr('precarico differenziale più alto'),why:tr('il posteriore resta più stabile a centro curva')}]}:null;
      if(us||os)add('bil',(us?k>1.2:k<0.8||cs>=2*laps.length)?2:1,`${us?tr('Sottosterzo'):tr('Sovrasterzo')} ${PN[ph]}`,ev,us?tr('L\'anteriore arriva al limite prima del posteriore: devi sterzare di più per fare la stessa curva.'):tr('Il posteriore arriva al limite prima: l\'auto ruota troppo e devi correggere.'),K?K.fixes.slice(0,3).map(f=>({key:f.key,sec:f.sec,dir:f.dir,why:f.why})):[]);
      else add('bil',0,`${tr('Equilibrio')} ${PN[ph]}`,ev,'');});}
  // values of the setup, and the fixes for settings this car does not have are dropped
  F.forEach(f=>{f.fx=f.fx.filter(x=>x&&(!x.key||!su||setupVal(su,x.key,x.sec||undefined)!=null||!su.sec)).map(x=>({...x,label:x.label||SETUP_LABELS[x.key]||x.key,now:x.now??(x.key&&su?setupVal(su,x.key,x.sec||undefined):null)}));});
  const seen={};[...F].sort((a,b)=>b.s-a.s).forEach(f=>f.fx.forEach(x=>{if(!x.key)return;const k=x.key+'|'+(x.sec||'');const o=seen[k];if(!o){seen[k]={f,dir:x.dir};return;}if(o.dir!==x.dir&&o.f!==f)x.conflict=o.f.t;}));
  return F;}

// ---------- the report ----------
function engPlan(F){const used=new Set();const out=[];[...F].filter(f=>f.s>0&&f.fx.some(x=>!x.conflict)).sort((a,b)=>b.s-a.s||ENG_ORDER.indexOf(a.a)-ENG_ORDER.indexOf(b.a)).forEach(f=>{if(out.length>=3||used.has(f.a))return;used.add(f.a);out.push(f);});return out;}
function engHTML(D,S,su,laps,mismatch){const F=engFindings(D,S,su,laps);const P=engPlan(F);const nb=F.filter(f=>f.s===2).length,nw=F.filter(f=>f.s===1).length;
  const RL=chqReliability(S,laps,'bal',{});const conf=`<span title="${esc(RL.why.join(' · '))}">${tr(RL.label)}</span>`;
  const fxRow=x=>`<div class="efx"><span class="kv"><span>${esc(tr(x.label))}</span></span><b>${esc(x.dir)}</b>${x.now?`<span class="enow">${tr('ora')} <span class="mono">${esc(x.now)}</span></span>`:''}${x.why?`<small>${esc(x.why)}</small>`:''}${x.conflict?`<small class="ecf">⚠ ${tr('in contrasto con')} «${esc(x.conflict)}»: ${tr('risolvi prima quello più importante')}</small>`:''}</div>`;
  const card=f=>`<div class="ef s${f.s}"><div class="eft"><i></i><b>${esc(f.t)}</b>${f.d!=null?`<button class="btn icon etl" type="button" data-d="${Math.round(f.d)}" title="${esc(tr('Apri il punto in Telemetria'))}">⌖</button>`:''}</div>
    ${f.ev.length?`<div class="eev">${f.ev.map(e=>`<span>${esc(e)}</span>`).join('')}</div>`:''}${f.why?`<p>${esc(f.why)}</p>`:''}${f.fx.length?`<div class="efxs">${f.fx.map(fxRow).join('')}</div>`:''}</div>`;
  const areas=ENG_AREAS.map(([k,l,ic])=>{const L=F.filter(f=>f.a===k).sort((a,b)=>b.s-a.s);const worst=L.reduce((m,f)=>Math.max(m,f.s),-1);
    return `<div class="panel ea s${Math.max(0,worst)}"><div class="eah"><span class="eic">${ic}</span><h3>${tr(l)}</h3><span class="ebadge s${Math.max(0,worst)}">${worst<=0?tr('a posto'):worst===1?tr('da controllare'):tr('importante')}</span></div>
      ${L.filter(f=>f.s>0).map(card).join('')}${(()=>{const ok=L.filter(f=>f.s===0);if(!ok.length)return L.length?'':`<p class="muted small">${tr('Nessun dato per questa area in questa telemetria.')}</p>`;
        return `<details class="eok"${L.some(f=>f.s>0)?'':' open'}><summary>✓ ${ok.length} ${ok.length===1?tr('controllo a posto'):tr('controlli a posto')}</summary>${ok.map(f=>`<div class="eokr"><b>${esc(f.t)}</b><span>${esc(f.ev.join(' · '))}</span>${f.why?`<small>${esc(f.why)}</small>`:''}</div>`).join('')}</details>`;})()}</div>`;}).join('');
  const T=D.raw?.T||{};const tyreMini=['FL','FR','RL','RR'].map(w=>{const t=T[w];if(!t)return '';const col=x=>!Number.isFinite(x)?'#333':x<70?'#3B82F6':x<78?'#22D3EE':x<92?'#2BE38A':x<102?'#FFD23F':'#FF1A2D';const o=w.endsWith('L')?[t.O,t.C,t.I]:[t.I,t.C,t.O];
    return `<div class="etm"><b>${w}</b><div>${o.map(v=>`<i style="background:${col(v)}">${fx(v,0)}</i>`).join('')}</div><small>${fx(t.p,1)} kPa · ${fx(t.carc,0)}°</small></div>`;}).join('');
  return `<div class="panel ehead"><div class="eh1"><div><div class="ey">${tr('Ingegnere di pista')}</div><h2>${esc(S.meta?.venue||'')}</h2><p class="muted small">${esc(su?su.name:tr('nessun setup scelto: indicazioni senza i valori attuali'))} · ${tr('analizza')} ${esc(engLapsText(laps))} · ${tr('affidabilità')} ${conf}</p></div>
     <div class="ecount"><span class="s2"><b>${nb}</b>${tr('importanti')}</span><span class="s1"><b>${nw}</b>${tr('da controllare')}</span></div></div>
     ${mismatch?`<div class="warnbar">${tr('Il setup scelto non sembra della stessa auto della telemetria: i valori attuali potrebbero non corrispondere.')}</div>`:''}
     <div class="etyres">${tyreMini}</div>
     <div class="eplan"><h4>${tr('Piano di lavoro')}</h4>${P.length?`<ol>${P.map(f=>`<li><b>${esc(f.t)}</b> → ${f.fx.filter(x=>!x.conflict).slice(0,1).map(x=>`<span class="ep">${esc(tr(x.label))}: ${esc(x.dir)}${x.now?` (${tr('ora')} <span class="mono">${esc(x.now)}</span>)`:''}</span>`).join('')}<div class="muted small">${esc(f.why||f.ev[0]||'')}</div></li>`).join('')}</ol>
       <p class="muted small">${tr('Una modifica alla volta, nell\'ordine. Poi 3–5 giri puliti nelle stesse condizioni e ricarica la telemetria: l\'ingegnere ricontrolla.')}</p>`:`<p class="small">${tr('Niente di urgente: il setup lavora nella finestra giusta. Per il tempo sul giro guarda Telemetria e Coach.')}</p>`}</div></div>
   <div class="egrid">${areas}</div>`;}
// ---------- which laps the engineer reads: the 5 fastest flying laps (clean laps) or the last 5 (after a setup change) ----------
const ENG_LAPN=5;
function engLapMode(){return LS.get('eng:laps','best')==='last'?'last':'best';}
function engLaps(S){let L=S.laps.filter(l=>l.complete&&l.type==='lanciato');if(!L.length)L=S.laps.filter(l=>l.complete);
  return engLapMode()==='last'?L.slice(-ENG_LAPN).sort((a,b)=>a.time-b.time):[...L].sort((a,b)=>a.time-b.time).slice(0,ENG_LAPN);}
// how the laps were chosen, said in words, with the lap numbers
function engLapsText(laps){const m=engLapMode();const n=laps.length;
  return `${m==='last'?(n===1?tr('ultimo giro'):tr('ultimi')+' '+n+' '+tr('giri')):(n===1?tr('giro più veloce'):n+' '+tr('giri più veloci'))} (${laps.map(l=>tr('G')+l.num).sort((a,b)=>parseInt(a.slice(1))-parseInt(b.slice(1))).join(', ')})`;}
function renderEng(){const el=$('#suEng');if(!el)return;const S=active()?.S;const D=typeof DIAG!=='undefined'?DIAG:null;
  if(!S||!D||D.S!==S){el.innerHTML=`<div class="panel"><div class="empty">${tr('Carica la telemetria (.ld) della sessione e il setup (.svm) che usavi: l\'ingegnere li legge insieme e ti dice cosa cambiare.')}</div></div>`;return;}
  let laps=engLaps(S);
  const su=D.su||null;const mismatch=!!$('#suWarn')?.textContent.trim();
  try{el.innerHTML=engHTML(D,S,su,laps,mismatch);}catch(e){console.error(e);el.innerHTML=`<div class="warnbar">${esc(e.message)}</div>`;return;}
  el.querySelectorAll('.etl').forEach(b=>b.onclick=()=>{const d=+b.dataset.d;showView('tele');setTimeout(()=>{const D2=TW.D;if(!D2)return;const c=D2.corners.reduce((m,x)=>!m||Math.abs(x.dApex-d)<Math.abs(m.dApex-d)?x:m,null);if(c)twZoomCorner(c);},500);});}

// ---------- the Setup page in tabs ----------
const SU_TABS=[['eng','Ingegnere'],['dyn','Analisi tecnica'],['det','Analisi dettagliata'],['set','Setup e confronto'],['gen','Generatore'],['gui','Guida']];
function suTabOf(p){const id=p.id;const has=s=>p.querySelector(s);
  if(id==='suEngP'||id==='suAI'||id==='suNoTele')return 'eng';if(id==='techP')return 'dyn';if(id==='genP')return 'gen';if(id==='guideP')return 'gui';
  if(id==='suCmpP'||id==='suHistP'||has('#suSheet'))return 'set';if(has('#suDiag')||id==='suTyreP'||id==='doc')return 'det';return null;}
function suTabsApply(){const v=$('#v-setup');if(!v)return;let nav=$('#suTabs');const top=v.querySelector('.panel');
  if(!nav&&top){top.insertAdjacentHTML('afterend',`<nav id="suTabs" class="sutabs" role="tablist">${SU_TABS.map(([k,l])=>`<button type="button" role="tab" data-t="${k}">${tr(l)}</button>`).join('')}</nav>`);nav=$('#suTabs');
    nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{LS.set('su:tab',b.dataset.t);suTabsApply();if(b.dataset.t==='dyn')renderTech();window.scrollTo({top:0});});}
  const cur=LS.get('su:tab','eng');nav?.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===cur));
  [...v.children].forEach(p=>{if(p===top||p===nav)return;const t=suTabOf(p);if(t)p.classList.toggle('sutab-off',t!==cur);});}
setTimeout(()=>{const v=$('#v-setup');if(v&&!$('#suEngP')){const top=v.querySelector('.panel');top?.insertAdjacentHTML('afterend','<div id="suEngP" class="suengp"><div id="suEng"></div></div>');
    // the AI engineer goes with the track engineer
    const ai=$('#suAI');if(ai)$('#suEngP').after(ai);}
  const base=RENDER.setup;RENDER.setup=()=>{base();try{renderEng();}catch(e){console.error(e);}try{renderTech();}catch(e){console.error(e);}suTabsApply();};if(curView()==='setup')RENDER.setup();},0);

(function(){const st=document.createElement('style');st.textContent=`
.sutab-off{display:none!important}
.sutabs{display:flex;gap:2px;flex-wrap:wrap;margin:0 0 14px}.sutabs button{border:0;cursor:pointer;padding:10px 20px;background:rgba(255,255,255,.05);color:var(--muted);font:600 .82rem var(--f-display);letter-spacing:.2em;text-transform:uppercase;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)}
.sutabs button:hover{color:#fff;background:rgba(255,255,255,.09)}.sutabs button[aria-selected="true"]{background:#F3F4F6;color:#0B0C0F}
.suengp{display:block}
.ehead{margin-bottom:14px}.eh1{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}.eh1 .ey{font:600 .72rem var(--f-display);letter-spacing:.3em;color:var(--accent);text-transform:uppercase}.eh1 h2{margin:2px 0;font:700 1.8rem var(--f-display);text-transform:uppercase}
.ecount{margin-left:auto;display:flex;gap:10px}.ecount span{display:flex;flex-direction:column;align-items:center;padding:8px 16px;background:rgba(255,255,255,.04);font:600 .7rem var(--f-display);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.ecount b{font:700 1.8rem var(--f-display);color:#fff}.ecount .s2 b{color:var(--bad)}.ecount .s1 b{color:var(--warn)}
.etyres{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0}.etm{background:rgba(255,255,255,.035);padding:8px 10px}.etm b{font:700 .9rem var(--f-display)}.etm div{display:flex;gap:2px;margin:5px 0}.etm i{flex:1;font-style:normal;text-align:center;color:#0B0C0F;font:700 12px var(--f-mono);padding:4px 0}.etm small{color:var(--muted);font-family:var(--f-mono)}
.eplan{border-left:3px solid var(--accent);padding:6px 0 4px 14px}.eplan h4{margin:0 0 6px;font:600 .8rem var(--f-display);letter-spacing:.24em;text-transform:uppercase}.eplan ol{margin:0;padding-left:20px}.eplan li{margin:6px 0}.eplan .ep{color:var(--good)}
.egrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px;align-items:start}
.ea .eah{display:flex;align-items:center;gap:10px;margin-bottom:10px}.ea .eah h3{margin:0;font:600 .86rem var(--f-display);letter-spacing:.2em;text-transform:uppercase}.eic{width:28px;height:28px;display:grid;place-items:center;background:rgba(255,255,255,.06);font-size:16px}
.ebadge{margin-left:auto;font:600 .66rem var(--f-display);letter-spacing:.16em;text-transform:uppercase;padding:3px 9px}.ebadge.s0{color:var(--good);background:color-mix(in srgb,var(--good) 12%,transparent)}.ebadge.s1{color:var(--warn);background:color-mix(in srgb,var(--warn) 12%,transparent)}.ebadge.s2{color:var(--bad);background:color-mix(in srgb,var(--bad) 14%,transparent)}
.ef{border-top:1px solid var(--line);padding:10px 0}.eft{display:flex;align-items:center;gap:8px}.eft i{width:8px;height:8px;flex:none;transform:skewX(-12deg)}.ef.s0 .eft i{background:var(--good)}.ef.s1 .eft i{background:var(--warn)}.ef.s2 .eft i{background:var(--bad)}.eft b{font-size:.95rem}.etl{margin-left:auto}
.eev{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.eev span{font:12px var(--f-mono);background:rgba(255,255,255,.05);padding:2px 8px;color:#D5DAE0}
.ef p{margin:4px 0;color:#B8BEC6;font-size:.86rem}.efxs{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.efx{display:grid;grid-template-columns:minmax(120px,auto) 1fr auto;gap:2px 10px;align-items:baseline;background:rgba(255,255,255,.03);padding:6px 9px;border-left:2px solid var(--accent)}.efx .kv{display:contents}.efx .kv span{color:#fff;font-weight:600;font-size:.86rem}.efx b{color:var(--good);font-weight:600;font-size:.86rem}.enow{font:11px var(--f-mono);color:var(--muted);white-space:nowrap}.efx small{grid-column:1/-1;color:var(--muted);font-size:.76rem}.efx small.ecf{color:var(--warn)}.ef.s0{padding:6px 0}.ef.s0 p:empty{display:none}
.eok{margin-top:8px;border-top:1px solid var(--line);padding-top:8px}.eok summary{cursor:pointer;color:var(--good);font:600 .8rem var(--f-display);letter-spacing:.1em}.eokr{display:flex;flex-wrap:wrap;gap:2px 10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.84rem}.eokr b{font-weight:600}.eokr span{font:12px var(--f-mono);color:var(--muted)}.eokr small{flex-basis:100%;color:var(--muted);font-size:.76rem}
@media (max-width:760px){.egrid{grid-template-columns:1fr}.etyres{grid-template-columns:1fr 1fr}.efx{grid-template-columns:1fr}.ecount{margin-left:0}}`;document.head.appendChild(st);})();
