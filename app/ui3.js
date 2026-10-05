// ================= SETUP DOCTOR (offline rules) =================
// Each problem: standard rFactor2/LMU setup remedies in order of effect, plus a telemetry check.
const F=(key,sec,dir,why)=>({key,sec,dir,why});
const KB=[
 {id:'us_in',label:'Sottosterzo in ingresso',fixes:[F('RearBrakeSetting',null,'ripartizione un po’ più verso il posteriore (0,5–1%)','l’anteriore frena meno e gli resta grip per inserire'),F('DiffCoastSetting',null,'differenziale in rilascio più aperto','il posteriore ruota più facilmente in inserimento'),F('FrontAntiSwaySetting',null,'barra anteriore più morbida','più grip meccanico davanti'),F('SlowBumpSetting','FRONTLEFT','bump lento anteriore più morbido','il carico passa prima sull’anteriore in frenata'),F('RWSetting',null,'un click in meno di ala posteriore','sposta il bilanciamento aerodinamico in avanti')],
  ev:D=>{const p=D.raw.B?.phases.entrata;if(!p)return null;const g=D.raw.B.hasGrip&&Number.isFinite(p.front)?p.front-p.rear:null;return {hit:p.steerIdx>1.08&&(g==null||g>0),txt:`ingresso: sterzo relativo ${fx(p.steerIdx,2)}${g!=null?`, scivolamento ant. ${fx(p.front,0)}% / post. ${fx(p.rear,0)}%`:''}`};}},
 {id:'us_mid',label:'Sottosterzo a centro curva',fixes:[F('FrontAntiSwaySetting',null,'barra anteriore più morbida','più grip all’anteriore in appoggio'),F('RearAntiSwaySetting',null,'barra posteriore più rigida','il posteriore scivola un po’ di più e l’auto chiude la curva'),F('RideHeightSetting','REARLEFT','posteriore più alto di 1–2 mm (più rake)','sposta carico aerodinamico in avanti'),F('RWSetting',null,'un click in meno di ala posteriore','meno carico dietro, bilanciamento più avanti'),F('CamberSetting','FRONTLEFT','campanatura anteriore più negativa se l’interno non è più caldo dell’esterno','più impronta a terra in appoggio')],
  ev:D=>{const p=D.raw.B?.phases.centro;if(!p)return null;const g=D.raw.B.hasGrip&&Number.isFinite(p.front)?p.front-p.rear:null;return {hit:p.steerIdx>1.08&&(g==null||g>0),txt:`centro curva: sterzo relativo ${fx(p.steerIdx,2)}${g!=null?`, scivolamento ant. ${fx(p.front,0)}% / post. ${fx(p.rear,0)}%`:''}`};}},
 {id:'us_out',label:'Sottosterzo in uscita',fixes:[F('DiffPowerSetting',null,'differenziale in trazione meno bloccato','un differenziale chiuso spinge dritto in uscita'),F('RearAntiSwaySetting',null,'barra posteriore più rigida','aiuta l’auto a ruotare quando apri il gas'),F('FrontAntiSwaySetting',null,'barra anteriore più morbida','più grip davanti in uscita'),F('SlowReboundSetting','FRONTLEFT','rebound lento anteriore più rigido','tiene giù il muso quando il carico va al posteriore')],
  ev:D=>{const p=D.raw.B?.phases.uscita;if(!p)return null;const g=D.raw.B.hasGrip&&Number.isFinite(p.front)?p.front-p.rear:null;return {hit:p.steerIdx>1.08&&(g==null||g>0),txt:`uscita: sterzo relativo ${fx(p.steerIdx,2)}${g!=null?`, scivolamento ant. ${fx(p.front,0)}% / post. ${fx(p.rear,0)}%`:''}`};}},
 {id:'os_in',label:'Sovrasterzo in ingresso',fixes:[F('RearBrakeSetting',null,'ripartizione più verso l’anteriore (0,5–1%)','il posteriore frena meno e resta stabile'),F('DiffCoastSetting',null,'differenziale in rilascio più bloccato','stabilizza il posteriore in rilascio'),F('RegenerationMapSetting',null,'rigenerazione più bassa','meno freno sull’asse posteriore dall’ibrido'),F('RearAntiSwaySetting',null,'barra posteriore più morbida','più grip meccanico dietro'),F('RearToeInSetting',null,'più convergenza posteriore','posteriore più stabile in inserimento')],
  ev:D=>{const B=D.raw.B;if(!B)return null;const p=B.phases.entrata,n=B.counter.filter(c=>c.phase==='entrata').length,g=B.hasGrip&&Number.isFinite(p.front)?p.rear-p.front:null;return {hit:n>=2||(p.steerIdx<0.95&&(g==null||g>8)),txt:`ingresso: sterzo relativo ${fx(p.steerIdx,2)}, ${n} controsterzi in frenata`};}},
 {id:'os_out',label:'Sovrasterzo in uscita',fixes:[F('TractionControlMapSetting',null,'TC un gradino più alto','taglia il pattinamento prima che il posteriore parta'),F('TCPowerCutMapSetting',null,'taglio potenza TC più alto','interviene in modo più deciso'),F('RearAntiSwaySetting',null,'barra posteriore più morbida','più trazione in appoggio'),F('SpringSetting','REARLEFT','molle posteriori più morbide','il posteriore copia meglio l’asfalto'),F('RWSetting',null,'un click in più di ala posteriore','più carico dietro, a scapito della velocità di punta'),F('DiffPowerSetting',null,'se il posteriore parte di colpo, differenziale in trazione meno bloccato','distribuisce meglio la coppia tra le ruote')],
  ev:D=>{const B=D.raw.B,SL=D.raw.SL;if(!B)return null;const n=B.counter.filter(c=>c.phase==='uscita').length;return {hit:n>=2||(SL&&SL.spin>0.5),txt:`${n} controsterzi in uscita${SL?`, pattinamento ${fx(SL.spin,2)} s/giro`:''}`};}},
 {id:'brk_unst',label:'Instabile in frenata',fixes:[F('RearBrakeSetting',null,'ripartizione più verso l’anteriore','il posteriore non si alleggerisce e non blocca'),F('DiffCoastSetting',null,'differenziale in rilascio più bloccato','tiene dritto il posteriore'),F('RearToeInSetting',null,'più convergenza posteriore','più stabilità in rettilineo e in frenata'),F('SlowReboundSetting','REARLEFT','rebound lento posteriore più morbido','il posteriore si alza meno quando il muso affonda')],
  ev:D=>{const SL=D.raw.SL;if(!SL)return null;return {hit:SL.lockR>0.15,txt:`bloccaggi posteriori ${fx(SL.lockR,2)} s/giro`};}},
 {id:'lock',label:'Bloccaggio ruote',fixes:[F('BrakePressureSetting',null,'pressione freni più bassa (2–3%)','più margine prima del bloccaggio'),F('RearBrakeSetting',null,'se bloccano le anteriori, ripartizione più al posteriore; se bloccano le posteriori, più all’anteriore','equilibra il lavoro tra gli assi'),F('BrakeMigrationSetting',null,'più migrazione verso il posteriore a fine frenata','riduce il bloccaggio anteriore in inserimento')],
  ev:D=>{const SL=D.raw.SL;if(!SL)return null;return {hit:SL.lockF>0.2||SL.lockR>0.15,txt:`bloccaggi: anteriori ${fx(SL.lockF,2)} s, posteriori ${fx(SL.lockR,2)} s per giro`};}},
 {id:'spin',label:'Pattina in uscita',fixes:[F('TractionControlMapSetting',null,'TC un gradino più alto','meno pattinamento'),F('TCPowerCutMapSetting',null,'taglio potenza più alto','riprende aderenza prima'),F('DiffPowerSetting',null,'differenziale in trazione meno bloccato','la ruota interna scarica meno coppia a vuoto'),F('RearAntiSwaySetting',null,'barra posteriore più morbida','più carico sulla ruota interna posteriore'),F('PressureSetting','REARLEFT','pressione posteriore un click più bassa (se il centro è caldo)','impronta più grande')],
  ev:D=>{const SL=D.raw.SL;if(!SL)return null;return {hit:SL.spin>0.5,txt:`pattinamento posteriore ${fx(SL.spin,2)} s/giro`};}},
 {id:'vmax',label:'Poca velocità di punta',fixes:[F('RWSetting',null,'un click in meno di ala posteriore','meno resistenza (e meno carico)'),F('WaterRadiatorSetting',null,'più nastro sul radiatore se le temperature motore lo permettono','meno resistenza aerodinamica'),F('BrakeDuctSetting',null,'prese freni più chiuse se i freni sono freddi','meno resistenza'),F('FinalDriveSetting',null,'finale più lungo solo se tocchi il limitatore prima della frenata','più velocità massima')],
  ev:D=>{const gc=D.raw.gc;if(!gc)return null;return {hit:gc.limPerLap>0.4,txt:`a limitatore ${fx(gc.limPerLap,2)} s/giro`};}},
 {id:'bottom',label:'Tocca il fondo / saltella',fixes:[F('RideHeightSetting','FRONTLEFT','altezza da terra +1–2 mm sull’asse che tocca','più margine sotto il fondo'),F('Front3rdPackerSetting',null,'packer del 3° elemento più alto','ferma la corsa prima che il fondo tocchi'),F('Front3rdSpringSetting',null,'molla del 3° elemento più rigida','regge meglio il carico aerodinamico'),F('FastBumpSetting','FRONTLEFT','bump veloce più rigido','limita i picchi sui dossi')],
  ev:D=>{const T=D.raw.T;if(!T)return null;const mx=Math.max(...W.map(w=>T[w].rhLow));return {hit:mx>0.002,txt:`altezza minima ${W.map(w=>w+' '+fx(T[w].rhMin,1)).join(', ')} mm`};}},
 {id:'hot_r',label:'Posteriori si surriscaldano',fixes:[F('TractionControlMapSetting',null,'TC un gradino più alto','meno slittamento, meno calore'),F('DiffPowerSetting',null,'differenziale in trazione meno bloccato','meno strisciamento in uscita'),F('RearToeInSetting',null,'meno convergenza posteriore','meno strisciamento sul dritto'),F('CamberSetting','REARLEFT','campanatura posteriore secondo le temperature int/est','distribuisce il calore sull’impronta')],
  ev:D=>{const T=D.raw.T;if(!T)return null;const a=w=>(T[w].I+T[w].C+T[w].O)/3,f=(a('FL')+a('FR'))/2,r=(a('RL')+a('RR'))/2;return {hit:r-f>8,txt:`posteriori ${fx(r,0)} °C, anteriori ${fx(f,0)} °C`};}},
 {id:'hot_f',label:'Anteriori si surriscaldano',fixes:[F('FrontAntiSwaySetting',null,'barra anteriore più morbida','meno sottosterzo, meno strisciamento davanti'),F('FrontToeInSetting',null,'convergenza anteriore più vicina a zero','meno strisciamento sul dritto'),F('BrakeDuctSetting',null,'prese freni più aperte','il calore dei freni scalda meno i cerchi'),F('CamberSetting','FRONTLEFT','campanatura anteriore secondo le temperature int/est','distribuisce il calore')],
  ev:D=>{const T=D.raw.T;if(!T)return null;const a=w=>(T[w].I+T[w].C+T[w].O)/3,f=(a('FL')+a('FR'))/2,r=(a('RL')+a('RR'))/2;return {hit:f-r>8,txt:`anteriori ${fx(f,0)} °C, posteriori ${fx(r,0)} °C`};}},
 {id:'cold',label:'Gomme fredde',fixes:[F('PressureSetting','FRONTLEFT','pressione a freddo un click più bassa','la gomma lavora di più e si scalda'),F('BrakeDuctSetting',null,'prese freni più chiuse','più calore ai cerchi'),F('FrontToeInSetting',null,'un po’ più di convergenza (in valore assoluto)','più strisciamento, più temperatura'),F('CamberSetting','FRONTLEFT','un po’ più di campanatura negativa','scalda l’interno')],
  ev:D=>null},
 {id:'wear',label:'Consumo gomme alto',fixes:[F('FrontToeInSetting',null,'convergenze più vicine a zero','meno strisciamento'),F('RearToeInSetting',null,'convergenza posteriore più bassa','meno strisciamento'),F('TractionControlMapSetting',null,'TC più alto','meno pattinamento'),F('CamberSetting','FRONTLEFT','meno campanatura negativa se l’interno è molto più caldo','usura più uniforme')],
  ev:D=>{const w=D.raw.wearAvg;return Number.isFinite(w)?{hit:false,txt:`usura media ${fx(w,2)}% per giro (confrontala con i tuoi stint precedenti)`}:null;}},
 {id:'kerb',label:'Nervosa sui cordoli',fixes:[F('FastBumpSetting','FRONTLEFT','bump veloce più morbido','assorbe l’urto del cordolo'),F('FastReboundSetting','FRONTLEFT','rebound veloce più morbido','la ruota torna giù prima'),F('Front3rdSpringSetting',null,'3° elemento un po’ più morbido','meno rigidità sugli urti'),F('RideHeightSetting','FRONTLEFT','+1 mm di altezza','più margine')],
  ev:D=>null}
];
KB.forEach(k=>k.fixes.forEach(f=>f.label=SETUP_LABELS[f.key]||f.key));
function renderDoctor(){
  const out=$('#docOut');if(!out)return;
  const S=active()?.S,D=DIAG&&DIAG.S===S?DIAG:null,su=D?D.su:byId($('#suFile').value);
  // mark problems detected by telemetry
  $$('#suChips .pchip').forEach(b=>{const k=KB.find(x=>x.id===b.dataset.k);let e=null;try{e=D&&k.ev(D);}catch(_){}b.dataset.label=k.label;b.innerHTML=esc(k.label)+(e&&e.hit?' <span style="color:var(--bad)">●</span>':'');b.title=e?e.txt:'';});
  const sel=$$('#suChips .pchip[aria-pressed="true"]').map(b=>KB.find(x=>x.id===b.dataset.k));
  const detected=D?KB.filter(k=>{try{return k.ev(D)?.hit;}catch(_){return false;}}):[];
  if(!sel.length){out.innerHTML=detected.length?`<div class="note">La telemetria segnala: <b>${detected.map(k=>esc(k.label)).join(', ')}</b> (pallino rosso). Tocca un problema per vedere le modifiche.</div>`:`<div class="note">Tocca uno o più problemi per vedere le modifiche consigliate.${D?' Nessun problema evidente rilevato dalla telemetria.':''}</div>`;return;}
  out.innerHTML=`<div class="diag">${sel.map(k=>{let e=null;try{e=D&&k.ev(D);}catch(_){}
    const fixes=k.fixes.filter(f=>!su||setupVal(su,f.key,f.sec)!=null);
    const st=e?(e.hit?'bad':'good'):'';
    return `<div class="card ${e&&e.hit?'warn':''}"><span class="st"><span class="dot ${st}"></span>${esc(k.label)}</span>
      <p class="small">${e?(e.hit?'<b style="color:var(--bad)">Confermato dai dati</b> · ':'<b style="color:var(--good)">Non visto nei dati</b> · ')+esc(e.txt):'<span class="muted">Nessun dato di telemetria per verificarlo.</span>'}</p>
      <ol style="margin:0;padding-left:20px;font-size:.87rem;display:grid;gap:5px">${fixes.map(f=>{const v=setupVal(su,f.key,f.sec);return `<li><b>${esc(f.label)}</b>: ${esc(f.dir)}${v?` <span class="mono muted">(ora ${esc(v)})</span>`:''}<br><span class="muted small">${esc(f.why)}</span></li>`;}).join('')||'<li class="muted">Nessuno dei parametri classici è regolabile su questa auto.</li>'}</ol></div>`;}).join('')}</div>
    <p class="muted small" style="margin-top:10px">Cambia una cosa alla volta, di 1–2 click, e rifai 3–5 giri prima di giudicare. ${su?'':'Carica il .svm per vedere i valori attuali e nascondere i parametri che la tua auto non ha.'}</p>`;
}

// ================= STRATEGY (offline) =================
const STR_FIELDS=[
 ['race','Durata gara (minuti)',60,1],['laps','oppure giri fissi (0 = a tempo)',0,1],['lap','Tempo sul giro (m:ss.000)','1:45.000','t'],
 ['fuel','Carburante per giro (L)',3.0,0.01],['tank','Serbatoio (L)',100,0.1],['ve','Energia virtuale per giro (%)',0,0.01],['veMax','Limite energia per stint (%)',100,1],['ratio','Rapporto carburante attuale (fuel ratio)','',0.01],
 ['wear','Usura gomme per giro (%)',0.8,0.01],['wearMax','Usura massima per treno (%)',35,1],['res','Margine di sicurezza (giri)',0.5,0.1],
 ['pit','Tempo perso per sosta (s)',25,0.5],['t4','Cambio 4 gomme (s)',12,0.5],['t2','Cambio 2 gomme (s)',5,0.5],['rate','Rifornimento (L al secondo, vuoto = ignora)','',0.1]
];
function parseLapT(s){s=String(s).trim();const m=s.match(/^(\d+):(\d+(?:\.\d+)?)$/);return m?+m[1]*60+ +m[2]:+s;}
function initStrategy(){
  const v=LS.get('strategy',{});
  $('#stForm').innerHTML=STR_FIELDS.map(([k,l,d,st])=>`<label class="f">${l}<input ${st==='t'?'type="text"':`type="number" step="${st}"`} id="sf_${k}" value="${esc(v[k]??d)}"></label>`).join('')+`<label class="f">Gomme alla sosta<select id="sf_tyres"><option value="auto">Automatico (in base all'usura)</option><option value="4">Sempre 4</option><option value="0">Mai</option></select></label><label class="f">Stint<select id="sf_mode"><option value="first">Primo stint al massimo (sosta più corta)</option><option value="even">Stint uguali</option></select></label><label class="f">Servizi<select id="sf_par"><option value="1">Gomme e benzina insieme</option><option value="0">Uno dopo l'altro</option></select></label>`;
  if(v.tyres)$('#sf_tyres').value=v.tyres;if(v.mode)$('#sf_mode').value=v.mode;if(v.par)$('#sf_par').value=v.par;
  $$('#stForm input,#stForm select').forEach(i=>i.oninput=()=>{saveStr();calcStrategy();});
  $('#stFromTele').onclick=()=>{fillStrFromTele(true);calcStrategy();};
}
function saveStr(){const o={};STR_FIELDS.forEach(([k])=>o[k]=$('#sf_'+k).value);o.tyres=$('#sf_tyres').value;o.mode=$('#sf_mode').value;o.par=$('#sf_par').value;LS.set('strategy',o);}
function fillStrFromTele(announce){
  const a=active(),S=a?.S;const set=(k,v)=>{if(v!=null&&Number.isFinite(+v)||typeof v==='string')$('#sf_'+k).value=v;};const got=[];
  if(S){const fl=S.laps.filter(l=>l.complete&&l.type==='lanciato');const st=fl.map(l=>lapStats(S,l));
    const valid=st.filter(s=>!s.lap.invalid&&S.best&&s.time<=S.best.time*1.05);if(valid.length){set('lap',fmtLap(mean(valid.map(s=>s.time))));got.push('tempo sul giro');}
    const dry=st.filter((s,k)=>{const c=lapConditions(S,s.lap);return !(c.rain>0.01||c.wet>0.01);});const base=dry.length>=3?dry:st;const fu=median(base.map(s=>s.fuel).filter(v=>v>0));if(Number.isFinite(fu)){set('fuel',fu.toFixed(2));got.push('carburante');}
    const w=median(base.map(s=>Math.max(...W.map(x=>s.w[x].wear))).filter(v=>Number.isFinite(v)&&v>0));if(Number.isFinite(w)){set('wear',w.toFixed(2));got.push('usura');}
    if(S.merged){const ve=mean(fl.map(l=>l.veUsed).filter(v=>v>0));if(Number.isFinite(ve)){set('ve',(ve*100).toFixed(2));got.push('energia virtuale');}}}
  else if(a?.xml){const D=a.xml.sessions[a.si].drivers.find(d=>d.isPlayer)||a.xml.sessions[a.si].drivers[0];const A=stintAnalysis(D.laps);if(Number.isFinite(A.avg)){set('lap',fmtLap(A.avg));got.push('tempo sul giro');}if(Number.isFinite(A.vePerLap)){set('ve',(A.vePerLap*100).toFixed(2));got.push('energia virtuale');}}
  const su=byId($('#suFile').value);const car=(S?.meta.car||S?.merged?.d.car||'').toLowerCase(),sc=(su?.car||'').toLowerCase();const okCar=su&&(!car||sc.includes(car)||(car.startsWith('hyper')&&/hypercar/.test(sc))||car.split(/\s+/).some(t=>t.length>3&&sc.includes(t)));if(okCar){const r=setupVal(su,'FuelSetting');if(r&&/^[\d.]+$/.test(r)){set('ratio',r);got.push('rapporto carburante dal setup');}
    const veS=setupVal(su,'VirtualEnergySetting'),m2=veS&&veS.match(/([\d.]+)%\s*\(([\d.]+)\s*laps\)/);if(m2&&!(+$('#sf_ve').value>0&&S?.merged)){set('ve',(+m2[1]/+m2[2]).toFixed(2));got.push('energia per giro stimata dal gioco (setup)');}}
  const cap=okCar&&setupVal(su,'FuelCapacitySetting');if(cap){const m=cap.match(/([\d.]+)\s*L/);if(m){set('tank',m[1]);got.push('serbatoio dal setup');}}
  const venue=S?.meta.venue||a?.xml?.venue;const pl=venue&&LS.get('pitloss:'+venue,null);if(pl&&Number.isFinite(pl.loss)){set('pit',pl.loss.toFixed(1));got.push(`tempo perso ai box a ${venue} (${pl.src})`);}
  saveStr();if(announce)toast(got.length?'Preso: '+got.join(', '):'Nessun dato disponibile nella sessione selezionata');
}
RENDER.str=()=>{if(!LS.get('strategy',null))fillStrFromTele(false);calcStrategy();$('#rainWrap').innerHTML=rainPanelHTML();$$('#rainP input,#rainP select').forEach(i=>i.oninput=calcRain);calcRain();};
function calcStrategy(){
  const g=k=>{const v=$('#sf_'+k).value;return v===''?NaN:+v;};
  const lap=parseLapT($('#sf_lap').value),fuel=g('fuel'),tank=g('tank'),ve=g('ve'),veMax=g('veMax')||100,wear=g('wear'),wearMax=g('wearMax'),res=g('res')||0,pit=g('pit')||0,t4=g('t4')||0,t2=g('t2')||0,rate=g('rate'),par=$('#sf_par').value==='1',tyreMode=$('#sf_tyres').value;
  const out=$('#stOut');
  if(!(lap>0)||!(fuel>0)||!(tank>0)){out.innerHTML='<div class="panel empty">Inserisci tempo sul giro, carburante per giro e serbatoio.</div>';return;}
  const ratioNow=g('ratio'),useVE=ve>0,ratioReco=useVE?Math.ceil(fuel/ve*1.03*100)/100:NaN;const byFuel=useVE?Infinity:tank/fuel-res,byVE=useVE?veMax/ve-res:Infinity,stintMax=Math.max(1,Math.floor(Math.min(byFuel,byVE)));const mode=$('#sf_mode').value;
  const limiter=byVE<byFuel?'energia virtuale':'carburante';
  const tyreLaps=wear>0&&wearMax>0?Math.floor(wearMax/wear):Infinity;
  const stopTime=(fuelAdd,tyres)=>{const tf=Number.isFinite(rate)&&rate>0?fuelAdd/rate:0,tt=tyres===4?t4:tyres===2?t2:0;return pit+(par?Math.max(tf,tt):tf+tt);};
  // plan for a given number of laps
  function plan(total){const stints=Math.ceil(total/stintMax),base=Math.floor(total/stints),extra=total%stints;const L=[];if(mode==='first'){let rem=total;while(rem>0){const n=Math.min(stintMax,rem);L.push(n);rem-=n;}}else for(let i=0;i<stints;i++)L.push(base+(i<extra?1:0));
    const rows=[];let tyreAge=0,t=0,lapNo=0;
    L.forEach((n,i)=>{const needV=useVE?Math.min(veMax,Math.ceil((n+res)*ve)):null,needF=useVE?needV*ratioReco:Math.min(tank,(n+res)*fuel);
      let tyres=0;if(i>0){if(tyreMode==='4')tyres=4;else if(tyreMode==='auto'&&tyreAge+n>tyreLaps)tyres=4;}if(tyres)tyreAge=0;
      const prevLeft=i>0?Math.max(0,rows[i-1].fuelStart-L[i-1]*fuel):0;const add=i>0?Math.max(0,needF-prevLeft):needF;
      const st=i>0?stopTime(add,tyres):0;t+=st+n*lap;tyreAge+=n;
      rows.push({i,from:lapNo+1,to:lapNo+n,n,fuelStart:needF,add,ve:needV,tyres,stop:st});lapNo+=n;});
    return {rows,time:t,stops:L.length-1};}
  let total,p;
  if(g('laps')>0){total=Math.round(g('laps'));p=plan(total);}
  else{const T=g('race')*60;total=Math.floor(T/lap)+1;for(let k=0;k<8;k++){p=plan(total);const pitT=p.rows.reduce((a,r)=>a+r.stop,0);const nt=Math.floor((T-pitT)/lap)+1;if(nt===total)break;total=nt;}p=plan(total);}
  const pitTot=p.rows.reduce((a,r)=>a+r.stop,0);
  // one stop fewer: what consumption would be needed
  let fewer='';if(p.stops>0){const st=p.stops,lapsPer=Math.ceil(total/st);const nf=tank/(lapsPer+res),nv=ve>0?veMax/(lapsPer+res):NaN;
    fewer=`<div class="card"><span class="st"><span class="dot"></span>${st-1===0?'Per correre senza soste':`Per fare ${st-1} ${st-1===1?'sosta':'soste'} invece di ${st}`}</span><p>Stint da ${lapsPer} giri: ${useVE?`energia ≤ <b>${fx(nv,2)} %/giro</b> (${fsign((nv/ve-1)*100,1)}%)`:`carburante ≤ <b>${fx(nf,2)} L/giro</b> (${fsign((nf/fuel-1)*100,1)}%)`}.</p><p class="muted small">Ogni sosta costa circa ${fx(pitTot/st,1)} s: conviene se il risparmio (lift-and-coast) ti fa perdere meno di ${fx(pitTot/st/total,2)} s a giro.</p></div>`;}
  out.innerHTML=`<div class="panel"><div class="kpis">
    <div class="kpi hl"><div class="l">Giri totali</div><div class="v">${total}</div><div class="s">${g('laps')>0?'gara a giri':'stimati in '+g('race')+' min'}</div></div>
    <div class="kpi"><div class="l">Soste</div><div class="v">${p.stops}</div><div class="s">tempo ai box ${fx(pitTot,1)} s</div></div>
    <div class="kpi"><div class="l">Stint massimo</div><div class="v">${stintMax} giri</div><div class="s">limitato da ${limiter}</div></div>
    <div class="kpi"><div class="l">Treno di gomme</div><div class="v">${Number.isFinite(tyreLaps)?tyreLaps+' giri':'—'}</div><div class="s">fino al ${fx(wearMax,0)}% di usura</div></div>
    <div class="kpi hl"><div class="l">Al via</div><div class="v">${useVE?fx(p.rows[0].ve,0)+' % NRG':fx(p.rows[0].fuelStart,1)+' L'}</div><div class="s">${useVE?'carburante '+fx(p.rows[0].fuelStart,1)+' L':''}</div></div>${useVE?`<div class="kpi hl"><div class="l">Rapporto carburante ideale</div><div class="v">${fx(ratioReco,2)}</div><div class="s">${Number.isFinite(ratioNow)?`ora ${fx(ratioNow,2)} · `:''}${fx(fuel,2)} L ÷ ${fx(ve,2)} % a giro +3%</div></div>`:''}
  </div></div>
  <div class="panel"><div class="panel-h"><h3>Piano soste</h3></div><div class="tw"><table><thead><tr><th>Stint</th><th>Giri</th><th>N. giri</th><th>Carburante da mettere</th><th>Carburante stint</th>${ve>0?'<th>Energia (NRG) da impostare</th>':''}<th class="l">Gomme</th><th>Sosta (s)</th></tr></thead><tbody>
  ${p.rows.map(r=>`<tr><td>${r.i+1}</td><td>${r.from}–${r.to}</td><td>${r.n}</td><td>${r.i?fx(r.add,1)+' L':'partenza'}</td><td>${fx(r.fuelStart,1)} L</td>${ve>0?`<td>${fx(r.ve,1)} %</td>`:''}<td class="l">${r.i?(r.tyres?r.tyres+' gomme':'nessun cambio'):'—'}</td><td>${r.i?fx(r.stop,1):'—'}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="muted small">Il margine di sicurezza (${res} giri) è già incluso. Tempi di cambio gomme predefiniti: 12 s per quattro, 5 s per due. Controllali in gioco, come il tempo perso in pit lane, che cambia da pista a pista. ${Number.isFinite(rate)&&rate>0?'':'Il tempo di rifornimento non è conteggiato: inserisci i litri al secondo se lo conosci.'}</p></div>
  ${fewer?`<div class="diag">${fewer}</div>`:''}`;
}
