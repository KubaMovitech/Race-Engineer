// ================= CHANNELS: names, units, provenance and signal quality =================
// Loaded right after core.js. parseLD() calls chqPrepare() on every channel it reads and chqFinish() at the end;
// buildSession() calls chqDead(). Everything here is plain computation (no page), so tools/test_analysis.js tests it.
//
// What a channel carries after parseLD (c = S.ch[name]):
//   c.raw  = {name, unit, f, n, dtype}       what the file says, untouched
//   c.u    = unit used by the app            (mm, mm/s, °, G, km/h, %, N …)
//   c.conv = [{from, to, k, cert, why}]      conversions applied; cert: 'certa' (unit in the file) ·
//            'convenzione' (documented convention of the LMU exporter) · 'incerta' (unit missing: deduced)
//   c.src  = 'misurato'                      (channels the app computes say 'derivato' or 'stimato' where they are shown)
//   c.alias= original name when the channel was found under another name
// A channel that is in the file but carries no information (a physical signal constant for the whole session,
// e.g. LMU writes «Front Downforce» = 0 when the car does not export it) is moved to S.deadCh and treated as missing.

const CHQ_R2D=180/Math.PI;
// canonical channels the analyses rely on: [name (# = FL FR RL RR), unit, plausible min, max, kind]
// kind: 'cont' physical signal that must move while the car moves · 'state' integer state · 'slow' slowly changing
const CHQ_SPEC=[
  ['Ground Speed','km/h',-1,450,'cont'],['Throttle Pos','%',-1,101,'cont'],['Brake Pos','%',-1,101,'cont'],['Steering','%',-101,101,'cont'],
  ['Steering Wheel Position','°',-1080,1080,'cont'],['Engine RPM','rpm',0,25000,'cont'],['Gear','',-1,10,'state'],
  ['G Force Lat','G',-8,8,'cont'],['G Force Long','G',-8,8,'cont'],['G Force Vert','G',-15,15,'cont'],
  ['Susp Pos #','mm',-150,300,'cont'],['Damper Vel #','mm/s',-6000,6000,'cont'],['Ride Height #','mm',-30,400,'cont'],
  ['Front Ride Height','mm',-30,400,'cont'],['Rear Ride Height','mm',-30,400,'cont'],
  ['Front 3rd Pos','mm',-150,300,'cont'],['Rear 3rd Pos','mm',-150,300,'cont'],
  ['Tyre Load #','N',-2000,90000,'cont'],['Susp Force #','N',-200000,300000,'cont'],['Vertical Tyre Deflection #','mm',-10,150,'cont'],
  ['Body Pitch','°',-20,20,'cont'],['Body Roll','°',-20,20,'cont'],['Camber #','°',-20,20,'cont'],['Toe #','°',-15,15,'cont'],
  ['Front Downforce','N',-200000,200000,'cont'],['Rear Downforce','N',-200000,200000,'cont'],['Drag','N',-200000,200000,'cont'],
  ['Wheel Rot Speed #','rad/s',-1000,1000,'cont'],['Local Rotation Y','rad/s',-20,20,'cont'],
  ['Surface Type #','',0,20,'state'],['Lap Number','',0,100000,'state'],['Lap Distance','m',-100,30000,'cont'],
  ['Tyre Temp # Inner','°C',-30,300,'slow'],['Tyre Temp # Centre','°C',-30,300,'slow'],['Tyre Temp # Outer','°C',-30,300,'slow'],
  ['Tyre Carcass Temp #','°C',-30,300,'slow'],['Tyre Pressure #','kPa',0,600,'slow'],['Brake Temp #','°C',-30,1500,'slow'],
  ['Fuel Level','l',0,300,'slow'],['Track Temperature','°C',-30,80,'slow'],['Ambient Temperature','°C',-40,60,'slow']];
const CHQ_W=['FL','FR','RL','RR'];
// other names the same signals have in other exporters and MoTeC projects (# = wheel)
const CHQ_ALIAS={
  'Ground Speed':['Speed','Vehicle Speed','Corr Speed','Car Speed'],'Throttle Pos':['Throttle','Throttle Position','Throttle Pedal'],
  'Brake Pos':['Brake','Brake Position','Brake Pedal'],'Steering':['Steering Angle','Steer'],'Engine RPM':['RPM','Engine Speed'],
  'G Force Lat':['Lateral G','G Lat','Accel Lat','CG Accel Lateral'],'G Force Long':['Longitudinal G','G Long','Accel Long','CG Accel Longitudinal'],
  'G Force Vert':['Vertical G','G Vert','Accel Vert','CG Accel Vertical'],
  'Susp Pos #':['Suspension Position #','Susp Position #','Damper Pos #','Damper Position #','Susp Travel #','Suspension Travel #','Shock Pos #'],
  'Damper Vel #':['Damper Velocity #','Damper Speed #','Susp Vel #','Suspension Velocity #','Shock Vel #','Shock Velocity #'],
  'Ride Height #':['RideHeight #','Ride Height Corner #'],'Tyre Load #':['Tire Load #','Wheel Load #','Vertical Load #'],
  'Body Pitch':['Pitch','Pitch Angle'],'Body Roll':['Roll','Roll Angle']};
const CHQ_UNIT={'mm':'mm','m':'m','cm':'cm','in':'in','mm/s':'mm/s','m/s':'m/s','cm/s':'cm/s','rad':'rad','deg':'°','degree':'°','degrees':'°','°':'°',
  'g':'G','G':'G','m/s/s':'m/s²','m/s2':'m/s²','m/s^2':'m/s²','m/s²':'m/s²','km/h':'km/h','kph':'km/h','kmh':'km/h','mph':'mph','%':'%','n':'N','N':'N','kn':'kN','kN':'kN',
  'c':'°C','°c':'°C','degc':'°C','kpa':'kPa','kPa':'kPa','l':'l','L':'l','rad/s':'rad/s','rpm':'rpm','s':'s'};
// factor to bring a unit to the unit the app uses
const CHQ_TO={'mm':{'m':1000,'cm':10,'in':25.4},'mm/s':{'m/s':1000,'cm/s':10},'°':{'rad':CHQ_R2D},'G':{'m/s²':1/9.80665},'km/h':{'m/s':3.6,'mph':1.609344},'N':{'kN':1000}};

function chqSpec(name){const k=chqKey(name);return k?CHQ_SPEC.find(s=>s[0]===k)||null:null;}
// the spec key of a channel name: 'Susp Pos FL' → 'Susp Pos #'
function chqKey(name){if(CHQ_SPEC.some(s=>s[0]===name))return name;for(const w of CHQ_W){if(name.includes(w)){const k=name.replace(new RegExp('\\b'+w+'\\b'),'#');if(CHQ_SPEC.some(s=>s[0]===k))return k;}}return null;}
function chqNormUnit(u){const t=String(u||'').trim();if(!t)return '';return CHQ_UNIT[t]||CHQ_UNIT[t.toLowerCase()]||t;}

// called by parseLD for every channel: decides the unit and the conversion (applied by the channel's decoder)
function chqPrepare(name,unitRaw,f,n,dtype){const raw={name,unit:unitRaw,f,n,dtype};const u0=chqNormUnit(unitRaw);const spec=chqSpec(name);const conv=[];let u=u0,k=1;
  if(spec){const want=spec[1];
    if(!u0){
      // LMU writes camber, toe, pitch and roll in radians and no unit (exporter convention, kept from the first versions)
      if(want==='°'&&/^(Camber|Toe) [FR][LR]$|^Body (Pitch|Roll)$/.test(name)){k=CHQ_R2D;u='°';conv.push({from:'rad',to:'°',k,cert:'convenzione',why:'LMU scrive gli angoli in radianti senza unità'});}
      else if(want){u=want;conv.push({from:'',to:want,k:1,cert:'incerta',why:'unità mancante nel file: dedotta dal nome del canale'});}}
    else if(u0!==want&&want){const fac=CHQ_TO[want]?.[u0];
      if(fac){k=fac;u=want;conv.push({from:u0,to:want,k,cert:'certa',why:'unità scritta nel file'});}
      else conv.push({from:u0,to:u0,k:1,cert:'incerta',why:`unità «${u0}» diversa da quella attesa (${want}) e senza conversione nota: valori lasciati come sono`,bad:true});}}
  else if(!u0&&typeof guessUnit==='function'){u=guessUnit(name);if(u)conv.push({from:'',to:u,k:1,cert:'incerta',why:'unità mancante nel file: dedotta dal nome del canale'});}
  // −273 °C (absolute zero) is how the game writes «no value» for a temperature: it becomes missing, never a temperature
  const nil=u==='°C'?-273:null;if(nil!=null)conv.push({from:'−273,15 °C',to:'mancante',k:1,cert:'convenzione',why:'il gioco scrive lo zero assoluto quando la temperatura non c\'è',nil:true});
  return {raw,u,k,conv,nil};}

// called at the end of parseLD: alternative names → the canonical name (not enumerable, so lists do not show it twice)
function chqFinish(ch){const out=[];
  for(const [canon,alts] of Object.entries(CHQ_ALIAS)){const wheels=canon.includes('#')?CHQ_W:[''];
    for(const w of wheels){const cn=canon.replace('#',w);if(ch[cn])continue;
      for(const a of alts){const an=a.replace('#',w);const hit=Object.keys(ch).find(k=>k.toLowerCase()===an.toLowerCase());
        if(hit){const c=ch[hit];c.alias=hit;Object.defineProperty(ch,cn,{value:c,enumerable:false,configurable:true});out.push([cn,hit]);
          // the unit follows the canonical name now
          const sp=chqSpec(cn);if(sp&&c.raw&&!c._v){const P=chqPrepare(cn,c.raw.unit,c.f,c.n,c.raw.dtype);c.u=P.u;c._k=P.k;c.conv=P.conv;}break;}}}}
  return out;}

// ---------- signal statistics ----------
// cheap pass over a channel: finite count, range, how often it really changes, the longest hold and NaN run while the car moves
// A value held at the channel's own minimum or maximum is saturation (full throttle, pedal released), not a stuck signal:
// those samples are left out of the update rate and of the longest hold.
function chqStats(c,moving){const v=c.v,n=v.length;let nf=0,lo=Infinity,hi=-Infinity,ch=0,hold=0,maxHold=0,nanRun=0,maxNan=0,mv=0;let prev=NaN,lastChange=-1;const intervals=[];
  for(let i=0;i<n;i++){const x=v[i];if(Number.isFinite(x)){if(x<lo)lo=x;if(x>hi)hi=x;}}const eps=(hi-lo)*0.002;const sat=x=>x<=lo+eps||x>=hi-eps;
  const mvAt=new Uint8Array(n);for(let i=0;i<n;i++)mvAt[i]=moving?(moving(i/c.f)?1:0):1;
  for(let i=0;i<n;i++){const x=v[i];const m=mvAt[i];
    if(!Number.isFinite(x)){nf++;if(m){nanRun++;if(nanRun>maxNan)maxNan=nanRun;}prev=NaN;lastChange=-1;continue;}nanRun=0;
    if(m&&!sat(x)){mv++;if(x===prev){hold++;if(hold>maxHold)maxHold=hold;}else{hold=0;if(Number.isFinite(prev)){ch++;if(lastChange>=0)intervals.push(i-lastChange);lastChange=i;}}}else hold=0;prev=x;}
  const dur=n/c.f,mvDur=mv/c.f;
  // Typical update spacing distinguishes sample-and-hold from a genuinely quiet stretch of track.
  const spacing=intervals.length>=10?median(intervals):NaN;
  return {n,f:c.f,dur,nonFinite:nf,min:lo,max:hi,range:hi-lo,effHz:spacing>0?Math.min(c.f,c.f/spacing):NaN,maxHoldS:maxHold/c.f,maxNanS:maxNan/c.f};}

// a physical signal that never moves while the car does: it carries no information (exported as a constant)
function chqDead(S){const ch=S.ch,sp=ch['Ground Speed'];S.deadCh=S.deadCh||{};if(!sp)return S.deadCh;
  let lo=Infinity,hi=-Infinity;for(let i=0;i<sp.v.length;i+=Math.max(1,sp.f>>2)){const x=sp.v[i];if(x<lo)lo=x;if(x>hi)hi=x;}
  if(!(hi-lo>20))return S.deadCh; // the car did not move: nothing can be judged
  for(const name of Object.keys(ch)){if(name==='Ground Speed')continue;const s=chqSpec(name);if(!s||s[4]!=='cont')continue;const c=ch[name];const v=c.v;
    let a=Infinity,b=-Infinity,fin=0;for(let i=0;i<v.length;i++){const x=v[i];if(!Number.isFinite(x))continue;fin++;if(x<a)a=x;if(x>b)b=x;}
    if(!fin){S.deadCh[name]={c,why:'nessun valore numerico nel file'};delete ch[name];continue;}
    if(b-a<1e-6){S.deadCh[name]={c,why:`costante (${+a.toFixed(3)}) per tutta la sessione: nessuna informazione (il gioco non lo ha esportato)`};delete ch[name];}}
  // aliases point to the same object: drop them too
  for(const name of Object.getOwnPropertyNames(ch)){const c=ch[name];if(Object.values(S.deadCh).some(d=>d.c===c))delete ch[name];}
  return S.deadCh;}

// ---------- telemetry quality, channel by channel and analysis by analysis ----------
// the analyses and what they need. need: all required (any one of a list in an inner array) · opt: they add confidence
// minHz: real update rate the derivative-based analyses need
const ANA=[
  {id:'damp',l:'Ammortizzatori (velocità)',need:[['Damper Vel #','Susp Pos #']],minHz:50,laps:true},
  {id:'susp',l:'Corsa sospensioni',need:['Susp Pos #'],opt:['Ride Height #','Tyre Load #'],laps:true},
  {id:'third',l:'Terzo elemento',need:[['Front 3rd Pos','Rear 3rd Pos']],opt:['Tyre Load #'],laps:true},
  {id:'axle',l:'Assi: comune, differenziale, beccheggio, rollio',need:['Susp Pos #'],opt:['Body Pitch','Body Roll','G Force Lat','G Force Long'],laps:true},
  {id:'plat',l:'Piattaforma e altezze',need:['Ride Height #'],opt:['G Force Vert','Body Pitch'],laps:true},
  {id:'aero',l:'Aerodinamica (altezze e velocità)',need:['Ride Height #'],opt:['Front Downforce','Rear Downforce','Drag','Tyre Load #'],laps:true},
  {id:'load',l:'Carico ruote e scarichi',need:['Tyre Load #'],opt:['G Force Vert','Wheel Rot Speed #'],laps:true},
  {id:'kerb',l:'Cordoli',need:['Surface Type #'],opt:['G Force Vert','Susp Pos #'],laps:true},
  {id:'bal',l:'Bilanciamento (sterzo e imbardata)',need:['Steering','G Force Lat'],opt:['Local Rotation Y'],laps:true},
  {id:'slip',l:'Bloccaggi e pattinamento',need:['Wheel Rot Speed #','Brake Pos'],opt:['Throttle Pos'],laps:true},
  {id:'tyre',l:'Temperature e pressioni gomme',need:['Tyre Temp # Centre','Tyre Pressure #'],opt:['Tyre Carcass Temp #'],laps:true}];
const CHQ_BASE=['Ground Speed','Throttle Pos','Brake Pos'];
// the concrete channel names behind a spec name; 'Susp Pos #' → the four wheels
const chqExpand=n=>n.includes('#')?CHQ_W.map(w=>n.replace('#',w)):[n];

// state of one channel: 'misurato' (usable) · 'limitato' (present with problems) · 'mancante' · 'piatto' (present, no information)
function chqChannel(S,name){const key='chq:'+name;if(S.cache?.has(key))return S.cache.get(key);let r;
  const c=S.ch[name],d=S.deadCh?.[name];
  if(!c&&d)r={name,st:'piatto',why:d.why,raw:d.c.raw};
  else if(!c)r={name,st:'mancante',why:'non presente nel file'};
  else{const sp=S.ch['Ground Speed'];const mv=sp?t=>sampleAt(sp,t)>30:null;const st=chqStats(c,mv);const spec=chqSpec(name);const P=[];
    const ref=sp?sp.v.length/sp.f:st.dur;
    if(st.nonFinite)P.push(`${st.nonFinite} ${tr('valori non numerici')} (${fx(st.nonFinite/st.n*100,1)}%)`);
    if(spec&&(st.min<spec[2]||st.max>spec[3]))P.push(`${tr('valori fuori scala')} (${fx(st.min,1)} … ${fx(st.max,1)} ${c.u}; ${tr('atteso')} ${spec[2]} … ${spec[3]})`);
    if(Math.abs(st.dur-ref)>Math.max(2/c.f,ref*0.005))P.push(`${tr('durata')} ${fx(st.dur,1)} s ${tr('contro')} ${fx(ref,1)} s ${tr('della velocità: canali non allineati')}`);
    if(spec&&spec[4]==='cont'&&Number.isFinite(st.effHz)&&st.effHz<c.f*0.4)P.push(`${tr('registrato a')} ${c.f} Hz ${tr('ma cambia solo')} ~${fx(st.effHz,0)} ${tr('volte al secondo')}`);
    if(spec&&spec[4]==='cont'&&st.maxHoldS>0.5)P.push(`${tr('fermo sullo stesso valore per')} ${fx(st.maxHoldS,1)} s ${tr('con l\'auto in movimento')}`);
    if(st.maxNanS>0.2)P.push(`${tr('interrotto per')} ${fx(st.maxNanS,1)} s`);
    if((c.conv||[]).some(x=>x.bad))P.push(tr('unità non riconosciuta'));
    const effHz=spec&&spec[4]==='cont'&&Number.isFinite(st.effHz)?Math.min(c.f,st.effHz):c.f;
    r={name,st:P.length?'limitato':'misurato',why:P.join(' · '),raw:c.raw,u:c.u,f:c.f,effHz,conv:c.conv||[],alias:c.alias||null,stats:st,problems:P};}
  S.cache?.set(key,r);return r;}

// is this analysis possible on this file, and what limits it (channels only; laps and repeatability come with chqReliability)
function chqDamperInput(S,w){
  const rejected=[];
  for(const name of ['Damper Vel '+w,'Susp Pos '+w]){const c=S.ch[name];if(!c)continue;
    const q=chqChannel(S,name),hz=q.effHz??c.f;
    if(c.conv?.some(x=>x.bad)){rejected.push(name+': '+tr('unità non riconosciuta'));continue;}
    if(!(hz>=50)){rejected.push(name+': '+tr('frequenza insufficiente')+' ('+fx(hz,0)+' Hz; ≥ 50 Hz)');continue;}
    return {name,c,q,derived:name.startsWith('Susp Pos'),why:''};
  }
  return {name:null,c:null,derived:false,why:rejected.join(' · ')||tr('canali mancanti')};
}
function chqAnalysis(S,a){const miss=[],lim=[],ok=[],optMiss=[];let effHz=Infinity;
  if(a.id==='damp'){
    const inputs=CHQ_W.map(w=>({w,...chqDamperInput(S,w)}));
    for(const x of inputs){const r={n:x.name||x.w,L:x.q?[x.q]:[],why:x.why};
      (!x.c?miss:x.q.st==='limitato'?lim:ok).push(r);}
    return {a,st:miss.length?'no':lim.length?'lim':'ok',miss,lim,ok,optMiss,inputs,
      derived:inputs.some(x=>x.derived),why:inputs.filter(x=>!x.c).map(x=>x.w+': '+x.why).join(' · ')};
  }
  const one=n=>{const L=chqExpand(n).map(x=>chqChannel(S,x));const bad=L.filter(x=>x.st==='mancante'||x.st==='piatto');
    if(bad.length)return {n,st:'mancante',L,why:bad.map(x=>`${x.name}: ${tr(x.st)}${x.why?' ('+tr(x.why)+')':''}`).join(' · ')};
    const l=L.filter(x=>x.st==='limitato');L.forEach(x=>{if(x.effHz<effHz)effHz=x.effHz;});
    return {n,st:l.length?'limitato':'misurato',L,why:l.map(x=>`${x.name}: ${x.why}`).join(' · ')};};
  for(const need of a.need){const alts=Array.isArray(need)?need:[need];let best=null;for(const n of alts){const r=one(n);if(!best||r.st==='misurato'||(r.st==='limitato'&&best.st==='mancante'))best=r;if(r.st==='misurato')break;}
    (best.st==='mancante'?miss:best.st==='limitato'?lim:ok).push(best);}
  for(const n of a.opt||[]){const r=one(n);if(r.st==='mancante')optMiss.push(r);else if(r.st==='limitato')lim.push(r);else ok.push(r);}
  // velocity derived from the position needs a real update rate
  let derived=false;if(a.id==='damp'){const v=ok.concat(lim).find(r=>r.n==='Damper Vel #');derived=!v;
    const p=ok.concat(lim).find(r=>r.n==='Susp Pos #');const hz=p?Math.min(...p.L.map(x=>x.effHz||x.f)):NaN;
    if(derived&&p&&!(hz>=a.minHz))return {a,st:'no',miss,lim,ok,optMiss,derived,why:`${tr('posizione aggiornata a')} ~${fx(hz,0)} Hz: ${tr('troppo lenta per ricavare la velocità dell\'ammortizzatore (serve almeno')} ${a.minHz} Hz)`};}
  const st=miss.length?'no':lim.length?'lim':'ok';
  return {a,st,miss,lim,ok,optMiss,derived,why:miss.map(m=>m.why).join(' · ')};}

// laps that can be compared with each other: complete flying laps, valid, out of the pits, same wet/dry state
function chqComparable(S,laps){const c=S.cond||{};const out=[],why=[];
  const fast=Math.min(...laps.filter(l=>l.complete&&!l.invalid).map(l=>l.time));
  laps.forEach(l=>{if(!l.complete||l.type!=='lanciato'){why.push(`${tr('G')}${l.num}: ${tr(l.type)}`);return;}if(l.invalid){why.push(`${tr('G')}${l.num}: ${tr('non valido')}`);return;}
    if(Number.isFinite(fast)&&l.time>fast*1.04){why.push(`${tr('G')}${l.num}: ${tr('più lento del 4%')}`);return;}out.push(l);});
  let tSpread=NaN;if(typeof lapConditions==='function'&&out.length>1){const T=out.map(l=>lapConditions(S,l).track).filter(Number.isFinite);if(T.length>1)tSpread=Math.max(...T)-Math.min(...T);}
  const wetMix=!!(c.wet&&c.wet.max-c.wet.min>0.1);
  return {laps:out,why,tSpread,wetMix};}

// reliability of ONE analysis: channels + number of comparable laps + amount of useful data + conditions + repeatability.
// opts: {samples: useful samples for this analysis, minSamples, perLap: [metric per lap] for repeatability, tol: spread considered small}
// level: 'alta' · 'media' · 'bassa' · 'no' (not analysable). Three laps alone are never 'alta'.
function chqReliability(S,laps,id,opts={}){const a=ANA.find(x=>x.id===id);const A=a?chqAnalysis(S,a):{st:'ok',miss:[],lim:[],optMiss:[]};const why=[];let lv=3;
  if(A.st==='no')return {lv:0,label:'non analizzabile',why:[A.why||tr('canali mancanti')],A};
  if(A.st==='lim'){lv=Math.min(lv,2);why.push(tr('canali con problemi')+': '+A.lim.map(x=>x.n).join(', '));}
  if(A.derived){why.push(tr('velocità ricavata dalla posizione (non misurata)'));}
  if(A.optMiss?.length){lv=Math.min(lv,2.5);why.push(tr('mancano')+' '+A.optMiss.map(x=>x.n).join(', '));}
  const C=chqComparable(S,laps);const n=C.laps.length;
  if(!n)return {lv:0,label:'non analizzabile',why:[tr('nessun giro lanciato valido')],A,C};
  if(n<3){lv=Math.min(lv,1);why.push(`${n} ${n===1?tr('giro confrontabile'):tr('giri confrontabili')}: ${tr('troppo pochi per dire se è ripetibile')}`);}
  else if(n<5){lv=Math.min(lv,2);why.push(`${n} ${tr('giri confrontabili')} (${tr('per «alta» ne servono almeno 5 e un risultato ripetibile')})`);}
  else why.push(`${n} ${tr('giri confrontabili')}`);
  if(Number.isFinite(opts.samples)&&Number.isFinite(opts.minSamples)&&opts.samples<opts.minSamples){lv=Math.min(lv,opts.samples<opts.minSamples/3?0.5:1);why.push(`${tr('pochi dati utili')} (${opts.samples} ${tr('campioni')}, ${tr('ne servono')} ${opts.minSamples})`);}
  if(C.tSpread>4){lv=Math.min(lv,2);why.push(`${tr('pista cambiata di')} ${fx(C.tSpread,0)} °C ${tr('tra i giri')}`);}
  if(C.wetMix){lv=Math.min(lv,1);why.push(tr('asciutto e bagnato mischiati'));}
  if(opts.perLap){const v=opts.perLap.filter(Number.isFinite);if(v.length>=3){const m=mean(v),s=std(v);const tol=opts.tol??Math.abs(m)*0.25;
      if(s>tol){lv=Math.min(lv,1.5);why.push(`${tr('poco ripetibile tra i giri')} (± ${fx(s,opts.dec??1)}${opts.unit?' '+opts.unit:''})`);}else why.push(`${tr('ripetibile tra i giri')} (± ${fx(s,opts.dec??1)}${opts.unit?' '+opts.unit:''})`);}
    else if(lv>2){lv=2;why.push(tr('ripetibilità non verificabile'));}}
  else if(lv>2){lv=2;why.push(tr('ripetibilità non verificata'));}
  if(lv<=0)return {lv:0,label:'non analizzabile',why,A,C};
  const label=lv>=3?'alta':lv>=2?'media':'bassa';return {lv,label,why,A,C};}
