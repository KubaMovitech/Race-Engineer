// ================= SOSPENSIONI E AMMORTIZZATORI (Setup) =================
// From the MoTeC file: damper speed histograms (slow / fast, bump / rebound) per corner, suspension
// travel, ride heights at speed, pitch under braking and roll per g. Then setup hints tied to the .svm.
// LMU channel names are looked up by pattern, so the panel says which channels it found.
const SUS_W=['FL','FR','RL','RR'],SUS_SEC={FL:'FRONTLEFT',FR:'FRONTRIGHT',RL:'REARLEFT',RR:'REARRIGHT'};
const susFind=(S,re)=>Object.keys(S.ch).find(k=>re.test(k.trim()));
function susChannels(S){const o={pos:{},vel:{},rh:{}};
  SUS_W.forEach(w=>{const end='\\s*[-_ ]?\\s*'+w+'$';
    o.pos[w]=susFind(S,new RegExp('^(susp(ension)?\\s*(pos(ition)?|travel|defl\\w*|length)|damper\\s*(pos(ition)?|travel|defl\\w*)|shock\\s*(pos|travel))'+end,'i'));
    o.vel[w]=susFind(S,new RegExp('^(damper|susp(ension)?|shock)\\s*(vel(ocity)?|speed)'+end,'i'));
    o.rh[w]=susFind(S,new RegExp('^ride\\s*height'+end,'i'));});
  o.lat=susFind(S,/^g\s*force\s*lat/i);o.brk=susFind(S,/^brake\s*pos/i);o.thr=susFind(S,/^throttle\s*pos/i);o.spd=S.ch['Ground Speed']?'Ground Speed':null;
  return o;}
// all the samples of the chosen laps at a fixed rate
function susSamples(S,laps,name,hz){const c=S.ch[name];if(!c)return null;const out=[];laps.forEach(l=>{const n=Math.floor(l.time*hz);for(let i=0;i<n;i++)out.push(sampleAt(c,l.t0+i/hz));});return Float32Array.from(out);}
const susRange=a=>{let lo=Infinity,hi=-Infinity;for(const x of a){if(x<lo)lo=x;if(x>hi)hi=x;}return hi-lo;};
const susPct=(a,p)=>{const s=Float32Array.from(a).sort();return s.length?s[Math.min(s.length-1,Math.floor(p*(s.length-1)))]:NaN;};
function susMean(a,mask){let s=0,n=0;for(let i=0;i<a.length;i++)if(mask(i)){s+=a[i];n++;}return n>20?s/n:NaN;}
// least squares slope of y on x over the samples that pass the mask
function susSlope(x,y,mask){let n=0,sx=0,sy=0,sxx=0,sxy=0;for(let i=0;i<x.length;i++){if(!mask(i))continue;n++;sx+=x[i];sy+=y[i];sxx+=x[i]*x[i];sxy+=x[i]*y[i];}const d=n*sxx-sx*sx;return n>50&&d?(n*sxy-sx*sy)/d:NaN;}

function susAnalyse(S,laps){const C=susChannels(S);const hz=50;const knee=+LS.get('su:knee',50)||50;
  const spd=susSamples(S,laps,C.spd,hz),brk=C.brk&&susSamples(S,laps,C.brk,hz),thr=C.thr&&susSamples(S,laps,C.thr,hz);let lat=C.lat&&susSamples(S,laps,C.lat,hz);
  if(lat&&susPct(lat.map(Math.abs),0.99)>6)lat=lat.map(v=>v/9.81); // m/s² → g
  const bScale=brk&&susPct(brk,0.99)>1.5?1:100,tScale=thr&&susPct(thr,0.99)>1.5?1:100; // pedals in % (0–100) or 0–1
  const R={C,knee,hz,w:{},n:spd?spd.length:0};
  // ride heights (mm)
  const rh={};SUS_W.forEach(w=>{let a=C.rh[w]&&susSamples(S,laps,C.rh[w],hz);if(a&&susRange(a)<1)a=a.map(v=>v*1000);rh[w]=a;});
  SUS_W.forEach(w=>{let p=C.pos[w]&&susSamples(S,laps,C.pos[w],hz),v=C.vel[w]&&susSamples(S,laps,C.vel[w],hz);if(!p&&!v)return;
    if(p&&susRange(p)<1)p=p.map(x=>x*1000); // metres → mm
    if(v&&susPct(v.map(Math.abs),0.99)<5)v=v.map(x=>x*1000); // m/s → mm/s
    if(!v){v=new Float32Array(p.length);for(let i=1;i<p.length-1;i++)v[i]=(p[i+1]-p[i-1])*hz/2;
      const s=new Float32Array(v.length);for(let i=1;i<v.length-1;i++)s[i]=(v[i-1]+v[i]+v[i+1])/3;v=s;}
    // which sign is compression: the suspension compresses when the ride height goes down, or under braking at the front
    let sign=1;if(p&&rh[w]){const r=rh[w];let s=0;const ma=susMean(p,()=>true),mb=susMean(r,()=>true);for(let i=0;i<p.length;i++)s+=(p[i]-ma)*(r[i]-mb);if(s>0)sign=-1;}
    else if(p&&brk&&w[0]==='F'){const a=susMean(p,i=>brk[i]*bScale>60&&spd[i]>100),b=susMean(p,i=>thr&&thr[i]*tScale>90&&spd[i]>100);if(a<b)sign=-1;}
    const hist=new Array(41).fill(0);let sb=0,sr=0,fb=0,fr=0,n=0;
    for(let i=0;i<v.length;i++){if(spd&&spd[i]<20)continue;const x=v[i]*sign;n++;if(x>=0){if(x<knee)sb++;else fb++;}else{if(-x<knee)sr++;else fr++;}const k=Math.max(0,Math.min(40,Math.round(x/10)+20));hist[k]++;}
    if(!n)return;const pc=x=>x/n*100;
    R.w[w]={sb:pc(sb),sr:pc(sr),fb:pc(fb),fr:pc(fr),hist:hist.map(h=>h/n),travel:p?susPct(p,0.99)-susPct(p,0.01):NaN,src:C.vel[w]?'vel':'pos'};});
  // ride heights at speed and pitch under braking
  const fast=i=>spd[i]>200,slow=i=>spd[i]>60&&spd[i]<120;
  const ax=(a,b,m)=>{const x=susMean(a,m),y=susMean(b,m);return Number.isFinite(x)&&Number.isFinite(y)?(x+y)/2:NaN;};
  if(rh.FL&&rh.FR&&spd){R.fFast=ax(rh.FL,rh.FR,fast);R.fSlow=ax(rh.FL,rh.FR,slow);
    if(brk)R.pitch=ax(rh.FL,rh.FR,i=>!(brk[i]*bScale>5)&&spd[i]>120&&spd[i]<220)-ax(rh.FL,rh.FR,i=>brk[i]*bScale>60&&spd[i]>120&&spd[i]<220);}
  if(rh.RL&&rh.RR&&spd){R.rFast=ax(rh.RL,rh.RR,fast);R.rSlow=ax(rh.RL,rh.RR,slow);}
  R.rakeFast=R.rFast-R.fFast;R.rakeSlow=R.rSlow-R.fSlow;
  // roll: left−right difference per g of lateral force, front and rear (from ride heights, else suspension positions)
  if(lat){const src=rh.FL&&rh.FR&&rh.RL&&rh.RR?rh:null;const side=(a,b)=>{const d=new Float32Array(a.length);for(let i=0;i<a.length;i++)d[i]=a[i]-b[i];return d;};
    const m=i=>Math.abs(lat[i])>0.4&&spd[i]>60&&!(brk&&brk[i]*bScale>10);
    if(src){R.rollF=Math.abs(susSlope(lat,side(src.FL,src.FR),m));R.rollR=Math.abs(susSlope(lat,side(src.RL,src.RR),m));}}
  return R;}

// hints: one or two clicks at a time, tied to what the doctor saw in the same laps
function susHints(R,su,D){const H=[];const val=(k,sec)=>setupVal(su,k,sec);
  const ax=(a,b)=>{const A=R.w[a],B=R.w[b];if(!A||!B)return null;const m=k=>(A[k]+B[k])/2;return {sb:m('sb'),sr:m('sr'),fb:m('fb'),fr:m('fr')};};
  const hit=id=>{try{const k=KB.find(x=>x.id===id);return !!(D&&k&&k.ev(D)?.hit);}catch(e){return false;}};
  [['Anteriore','FL','FR','FRONTLEFT'],['Posteriore','RL','RR','REARLEFT']].forEach(([name,a,b,sec])=>{const X=ax(a,b);if(!X)return;
    const bal=(X.sr-X.sb)/Math.max(1,X.sr+X.sb);
    if(bal>0.12)H.push({k:'warn',t:`${name} · rebound lento`,d:`La ruota passa più tempo a tornare giù lentamente che a salire (${fx(X.sr,0)}% contro ${fx(X.sb,0)}% del tempo): il rebound lento è duro rispetto al bump.`,f:[['SlowReboundSetting',sec,'1 click più morbido'],['SlowBumpSetting',sec,'oppure 1 click più rigido']]});
    else if(bal<-0.12)H.push({k:'warn',t:`${name} · bump lento`,d:`La ruota passa più tempo a salire lentamente che a tornare giù (${fx(X.sb,0)}% contro ${fx(X.sr,0)}% del tempo): il bump lento è duro rispetto al rebound.`,f:[['SlowBumpSetting',sec,'1 click più morbido'],['SlowReboundSetting',sec,'oppure 1 click più rigido']]});
    else H.push({k:'good',t:`${name} · bilanciato`,d:`${fx(X.sb,0)}% compressione lenta, ${fx(X.sr,0)}% estensione lenta: non serve toccarli.`,f:[]});
    const fast=X.fb+X.fr;if(fast>22)H.push({k:'warn',t:`${name} · movimenti veloci`,d:`${fx(fast,0)}% del tempo oltre ${R.knee} mm/s. `+'Cordoli e sconnessioni: se l\'auto salta o è nervosa sui cordoli, ammorbidisci il bump veloce; se dopo un cordolo la ruota resta in aria, ammorbidisci il rebound veloce.',f:[['FastBumpSetting',sec,'1 click più morbido'],['FastReboundSetting',sec,'se la ruota stacca: 1 click più morbido']]});});
  // roll balance against the balance problems the doctor found
  if(Number.isFinite(R.rollF)&&Number.isFinite(R.rollR)&&R.rollR>0){const q=R.rollF/R.rollR;
    if(hit('us_mid')&&q<0.9)H.push({k:'bad',t:'Rollio · sottosterzo',d:`Il dottore vede sottosterzo a centro curva e l'anteriore rolla meno del posteriore. Rollio anteriore ${fx(R.rollF,1)} mm/g contro ${fx(R.rollR,1)} mm/g al posteriore.`,f:[['FrontAntiSwaySetting',null,'1 click più morbida'],['RearAntiSwaySetting',null,'oppure 1 click più rigida']]});
    else if((hit('os_out')||hit('os_in'))&&q>1.1)H.push({k:'bad',t:'Rollio · sovrasterzo',d:`Il dottore vede sovrasterzo e il posteriore rolla meno dell'anteriore. Rollio posteriore ${fx(R.rollR,1)} mm/g contro ${fx(R.rollF,1)} mm/g all'anteriore.`,f:[['RearAntiSwaySetting',null,'1 click più morbida'],['FrontAntiSwaySetting',null,'oppure 1 click più rigida']]});}
  // pitch under braking and bottoming
  if(R.pitch>10&&hit('bottom'))H.push({k:'bad',t:'Frenata · tocca il fondo',d:`L'anteriore scende di ${fx(R.pitch,0)} mm in frenata e tocca il fondo: serve più sostegno.`,f:[['SlowBumpSetting','FRONTLEFT','1–2 click più rigido'],['Front3rdPackerSetting',null,'packer più alto'],['Front3rdSpringSetting',null,'oppure 3° elemento più rigido']]});
  return H.map(h=>({...h,f:h.f.filter(([k,sec])=>!su||val(k,sec)!=null).map(([k,sec,dir])=>({label:SETUP_LABELS[k]||k,dir,now:val(k,sec),sec}))}));}

// histogram in bins of 10 mm/s from −200 to +200 (the ends collect everything faster)
function susHistSvg(h,knee){const W=410,Hh=60,bw=W/h.length,mx=Math.max(...h,0.001);const kx=v=>W/2+v/10*bw;
  return `<svg class="sushist" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true">${h.map((x,i)=>{const v=(i-20)*10;const fastZ=Math.abs(v)>=knee;const col=v<0?'var(--lapB)':'var(--lapA)';
    return `<rect x="${(i*bw+0.5).toFixed(1)}" y="${(Hh-x/mx*Hh).toFixed(1)}" width="${(bw-1).toFixed(1)}" height="${(x/mx*Hh).toFixed(1)}" fill="${col}" opacity="${fastZ?0.4:0.95}"/>`;}).join('')}
    <line x1="${kx(-knee)}" x2="${kx(-knee)}" y1="0" y2="${Hh}" stroke="var(--faint)" stroke-dasharray="2 2"/><line x1="${kx(knee)}" x2="${kx(knee)}" y1="0" y2="${Hh}" stroke="var(--faint)" stroke-dasharray="2 2"/><line x1="${W/2}" x2="${W/2}" y1="0" y2="${Hh}" stroke="var(--line)"/></svg>
    <div class="sushx"><span>← ${tr('estensione')}</span><span>0</span><span>${tr('compressione')} →</span></div>`;}

function renderSusp(S=active()?.S){const el=$("#suSusp");if(!el)return;
  if(!S){el.innerHTML=`<div class="empty">${tr('Scegli una telemetria .ld in alto.')}</div>`;return;}
  const laps=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid);const use=laps.length?laps:S.laps.filter(l=>l.complete);
  if(!use.length){el.innerHTML=`<div class="empty">${tr('Servono giri completi.')}</div>`;return;}
  const key='sus|'+use.map(l=>l.i).join(',')+'|'+LS.get('su:knee',50);let R=S.cache.get(key);if(!R){R=susAnalyse(S,use);S.cache.set(key,R);}
  const su=DIAG&&DIAG.S===S?DIAG.su:byId($('#suFile').value);const D=DIAG&&DIAG.S===S?DIAG:null;
  const found=SUS_W.filter(w=>R.w[w]);const C=R.C;
  const chList=[...new Set([...SUS_W.map(w=>C.pos[w]||C.vel[w]),...SUS_W.map(w=>C.rh[w])].filter(Boolean))];
  let h=`<div class="row" style="gap:12px;align-items:end;margin-bottom:10px"><label class="f" style="max-width:220px">${tr('Soglia lento / veloce (mm/s)')}<input type="number" id="suKnee" step="5" min="10" value="${R.knee}"></label>
    <span class="muted small">${use.length} ${tr('giri lanciati')} · ${tr('canali')}: ${chList.length?esc(chList.join(', ')):tr('nessun canale sospensioni trovato')}</span></div>`;
  if(!found.length){const cand=Object.keys(S.ch).filter(k=>/susp|damp|shock|height|3rd|travel|defl/i.test(k));
    h+=`<div class="warnbar">${tr('In questo file non trovo la posizione delle sospensioni, quindi niente istogrammi degli ammortizzatori.')} ${cand.length?tr('Canali simili presenti')+': <span class="mono">'+esc(cand.join(', '))+'</span>. '+tr('Mandami questo elenco e li collego.'):''}</div>`;}
  else h+=`<div class="susgrid">${SUS_W.map(w=>{const x=R.w[w];if(!x)return `<div class="suscard"><b>${w}</b><div class="muted small">—</div></div>`;
    return `<div class="suscard"><div class="lbh"><b>${tr(WN[SUS_W.indexOf(w)])}</b><span class="muted small">${Number.isFinite(x.travel)?tr('corsa usata')+' '+fx(x.travel,0)+' mm':''}</span></div>${susHistSvg(x.hist,R.knee)}
      <div class="susz"><span>${tr('Ritorno veloce')}<b>${fx(x.fr,0)}%</b></span><span>${tr('Ritorno lento')}<b>${fx(x.sr,0)}%</b></span><span>${tr('Compressione lenta')}<b>${fx(x.sb,0)}%</b></span><span>${tr('Compressione veloce')}<b>${fx(x.fb,0)}%</b></span></div></div>`;}).join('')}</div>`;
  const kp=[];if(Number.isFinite(R.fFast))kp.push(liveTile('Altezza ant. in velocità',fx(R.fFast,1)+' mm',Number.isFinite(R.fSlow)?`${tr('lento')} ${fx(R.fSlow,1)} mm`:''));
  if(Number.isFinite(R.rFast))kp.push(liveTile('Altezza post. in velocità',fx(R.rFast,1)+' mm',Number.isFinite(R.rSlow)?`${tr('lento')} ${fx(R.rSlow,1)} mm`:''));
  if(Number.isFinite(R.rakeFast))kp.push(liveTile('Rake in velocità',fx(R.rakeFast,1)+' mm',Number.isFinite(R.rakeSlow)?`${tr('lento')} ${fx(R.rakeSlow,1)} mm`:''));
  if(Number.isFinite(R.pitch))kp.push(liveTile('Beccheggio in frenata',fx(R.pitch,1)+' mm',tr('quanto scende l\'anteriore')));
  if(Number.isFinite(R.rollF))kp.push(liveTile('Rollio',`${fx(R.rollF,1)} / ${fx(R.rollR,1)}`,tr('mm per g, anteriore / posteriore')));
  if(kp.length)h+=`<div class="kpis" style="margin-top:12px">${kp.join('')}</div>`;
  const H=susHints(R,su,D);
  if(H.length)h+=`<div class="diag" style="margin-top:12px">${H.map(x=>`<div class="card ${x.k==='good'?'':'warn'}"><span class="st"><span class="dot ${x.k}"></span>${esc(tr(x.t))}</span><p class="small">${esc(x.d)}</p>${x.f.length?`<ol style="margin:0;padding-left:20px;font-size:.87rem;display:grid;gap:4px">${x.f.map(f=>`<li><b>${esc(f.label)}</b>${f.sec&&/LEFT|RIGHT/.test(f.sec)?` (${tr(f.sec.startsWith('FRONT')?'anteriori':'posteriori')})`:''}: ${esc(tr(f.dir))}${f.now?` <span class="mono muted">(${tr('ora')} ${esc(f.now)})</span>`:''}</li>`).join('')}</ol>`:''}</div>`).join('')}</div>`;
  h+=`<p class="muted small" style="margin-top:10px">${tr('Come leggere gli istogrammi: a sinistra la ruota che torna giù (estensione), a destra la ruota che sale (compressione); le barre chiare sono i movimenti veloci (cordoli, sconnessioni), quelle piene i movimenti lenti (trasferimenti di carico, che decidono il bilanciamento). Un istogramma simmetrico è il punto di partenza. Sono indicazioni: cambia una cosa alla volta, di un click, e rifai 3–5 giri.')}${su?'':' '+tr('Carica il .svm della stessa auto per vedere i valori attuali.')}</p>`;
  el.innerHTML=h;const kn=$('#suKnee');if(kn)kn.onchange=()=>{LS.set('su:knee',Math.max(10,+kn.value||50));renderSusp();};}

// RENDER.setup is defined later in the bundle (ui2.js): hook in once everything has loaded
setTimeout(()=>{const doc=$('#doc');if(doc&&!$('#suSuspP'))doc.insertAdjacentHTML('afterend',`<div class="panel" id="suSuspP"><div class="panel-h"><h3>${tr('Sospensioni e ammortizzatori')}</h3><span class="badge off">${tr('dalla telemetria MoTeC · regole fisse, niente AI')}</span></div><div id="suSusp"></div></div>`);
  const base=RENDER.setup;RENDER.setup=()=>{base();try{renderSusp();}catch(e){console.error(e);$('#suSusp').innerHTML=`<div class="warnbar">${esc(e.message)}</div>`;}};if(curView()==='setup')RENDER.setup();},0);
