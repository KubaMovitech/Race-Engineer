// ================= BOP: the official tables (LMU PDF, see tools/bop_pdf.py) and a check that they were not changed quietly =================
// The game does not publish the BOP it applies. What we can measure is the power of our own car (engine + electric motor,
// at full throttle) from the telemetry and from the bridge. The number is not the one in the PDF (each track has its own
// power curve), but for the same car on the same track it must stay the same: if it moves and the PDF did not, the BOP changed.
const BOPV=typeof BOP_DB!=='undefined'&&BOP_DB.length?BOP_DB[0]:null;
const BOP_CLS={HY:'Hypercar',GT3:'LMGT3',GTE:'LMGTE',LMP2:'LMP2',LMP3:'LMP3'};
const BOP_TRK=[[/mulsanne/i,'Le Mans Mulsanne'],[/sarthe|le ?mans/i,'Le Mans'],[/grande/i,'Monza Grande'],[/monza/i,'Monza'],[/ricard.*\b1a\b|\b1a\b.*ricard/i,'Paul Ricard 1A'],[/ricard/i,'Paul Ricard'],
  [/bahrain|sakhir/i,'Bahrain'],[/barcelona|catalunya/i,'Barcelona'],[/americas|\bcota\b|austin/i,'COTA'],[/daytona/i,'Daytona'],[/fuji/i,'Fuji'],[/imola|enzo e dino/i,'Imola'],
  [/interlagos|carlos pace|s[aã]o paulo|brazil|brasil/i,'Interlagos'],[/laguna/i,'Laguna Seca'],[/long ?beach/i,'Long Beach'],[/portim|algarve/i,'Portimao'],[/qatar|lusail|losail/i,'Qatar'],
  [/atlanta/i,'Road Atlanta'],[/sebring/i,'Sebring'],[/silverstone/i,'Silverstone'],[/\bspa\b|francorchamps/i,'Spa']];
function bopTrack(name){if(!name)return null;const n=String(name).replace(/_/g,' ');const t=BOP_TRK.find(([r])=>r.test(n));return t?t[1]:null;}
// [class, model, regex on the game's car name]; specific names first
const BOP_KEYS=[['GT3','Vantage AMR LMGT3',/vantage.*gt3/i],['GTE','Vantage AMR',/vantage/i],['HY','Valkyrie',/valkyrie/i],['HY','A424',/a424|alpine/i],
  ['GT3','M4 LMGT3',/\bm4\b/i],['HY','M Hybrid V8',/hybrid v8|m hybrid|bmw/i],['HY','V-Series.R',/v-?series|cadillac/i],['GT3','Z06 LMGT3.R',/z06/i],['GTE','C8.R',/c8\.?r|corvette/i],
  ['HY','499P',/499p/i],['GT3','296 LMGT3',/\b296\b/i],['GTE','488 GTE Evo',/\b488\b/i],['HY','GMR-001',/gmr|genesis/i],['HY','SCG 007',/glickenhaus|scg/i],['HY','Tipo 6',/isotta|tipo ?6/i],
  ['HY','SC63',/sc63/i],['GT3','Huracan LMGT3 Evo2',/huracan|lamborghini.*gt3/i],['GT3','Mustang LMGT3',/mustang|ford/i],['GT3','RC F LMGT3',/lexus|rc ?f\b/i],['GT3','720S LMGT3 Evo',/720s|mclaren/i],
  ['GT3','AMG LMGT3',/amg|mercedes/i],['HY','9x8 Evo',/9x8.*(evo|202[4-9])/i],['HY','9x8',/9x8|peugeot/i],['GT3','911 GT3 R',/911 gt3|gt3 r\b/i],['GTE','911 RSR-19',/rsr/i],['HY','963',/\b963\b/i],
  ['HY','GR010',/gr010|toyota/i],['HY','Vandervell 680',/vanwall|vandervell/i],['LMP2','07 ELMS',/oreca.*elms/i],['LMP2','07 WEC',/oreca|\b07\b/i],
  ['LMP3','AD25',/adess|ad25/i],['LMP3','D09',/duqueine|d09/i],['LMP3','G61-LT-P325-Evo',/ginetta|g61/i],['LMP3','JS P325',/ligier|js ?p3/i]];
function bopCar(name){if(!name)return null;const n=String(name).replace(/_/g,' ');const k=BOP_KEYS.find(([,,r])=>r.test(n));return k?{cls:k[0],model:k[1]}:null;}
function bopRow(cls,model,trk,V=BOPV){return V?.tracks[trk]?.cls[cls]?.find(r=>r.model===model)||null;}
// the BOP document in force on a date (null = older than any we know)
function bopAt(ms){if(!Number.isFinite(ms))return BOPV;const d=x=>{const [g,m,a]=x.date.split('/').map(Number);return Date.UTC(a,m-1,g);};return (typeof BOP_DB!=='undefined'?BOP_DB:[]).find(v=>d(v)<=ms)||null;}
const bopPow=(cls,row)=>row?(cls==='HY'?row.kw:row.pw)??null:null;

// columns: key, label, unit, which way is better (+1 more is better, -1 less is better, 0 neutral)
const BOP_COLS={HY:[['kg','Peso min.','kg',-1],['kw','Potenza','kW',1],['s1','Fine stadio 1','km/h',0],['s2','Inizio stadio 2','km/h',0],['kw2','Potenza stadio 2','kW',1],['dep','Ibrido da','km/h',-1],['mj','Energia stint','MJ',1],['dock','Attesa rifornimento','s',-1]],
  GT3:[['kg','Peso min.','kg',-1],['pw','Potenza','%',1],['s1','Fine stadio 1','km/h',0],['s2','Inizio stadio 2','km/h',0],['pw2','Potenza stadio 2','%',1],['mj','Energia stint','MJ',1],['wmin','Ala min.','°',0],['wmax','Ala max.','°',0],['rh','Altezza min.','mm',0]],
  GTE:[['kg','Peso min.','kg',-1],['pw','Potenza','%',1],['tank','Serbatoio','L',1],['refuel','Rifornimento','L/s',1],['aero','Aero','',0]],
  LMP2:[['kg','Peso min.','kg',-1],['power','Motore','',0],['rpm','Giri max','rpm',1],['tank','Serbatoio','L',1],['aero','Aero','',0],['dive','Deviatori','',0],['cover','Cofano','',0],['gurney','Gurney ala','',0],['strakes','Diffusore','',0]],
  LMP3:[['kg','Peso min.','kg',-1],['dive','Deviatori','',0],['cover','Gurney cofano','',0]]};
function bopCell(row,[k,,,good]){const v=row[k];const d=row.d?.[k];const t=v==null?'—':typeof v==='number'?String(v):esc(v);
  if(d==null)return `<td>${t}</td>`;const cls=good===0?'nt':(d*good>0?'up':'dn');return `<td class="bopch">${t} <span class="bd ${cls}" title="${esc(tr('Cambiato rispetto al BOP precedente'))}">${d>0?'▲':'▼'}${Math.abs(d)}</span></td>`;}
function bopTable(cls,rows,mine,lead){const C=BOP_COLS[cls];const pw=cls==='HY'||cls==='GT3';
  return `<div class="tw"><table class="boptab"><thead><tr><th>${lead}</th>${C.map(([,l,u])=>`<th>${tr(l)}${u?` <span class="muted">${u}</span>`:''}</th>`).join('')}${cls==='HY'?`<th title="${esc(tr('Potenza per tonnellata: più alto = più veloce sul dritto'))}">kW/t</th>`:''}</tr></thead><tbody>${rows.map(([name,r,key])=>`<tr class="${key===mine?'ours':''}${r.d?' chg':''}"><td class="l"><b>${esc(name)}</b></td>${C.map(c=>bopCell(r,c)).join('')}${cls==='HY'?`<td>${fx(r.kw/r.kg*1000,0)}</td>`:''}</tr>`).join('')}</tbody></table></div>`;}

// ---------- measured power: full-throttle samples → 90th percentile ----------
function q90(a){if(a.length<40)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(.9*(s.length-1))];}
function ldPower(S){const C=S.ch,E=C['Engine Torque'],R=C['Engine RPM'],TH=C['Throttle Pos'];if(!E||!R||!TH)return null;const M=C['Motor Torque'],MR=C['Motor RPM'];
  const at=(c,t)=>c.v[Math.min(c.v.length-1,Math.floor(t*c.f))];const T=E.v.length/E.f;const thMax=Math.max(...Array.from({length:50},(_,i)=>at(TH,i*T/50)))>1.5?99:0.99;const out=[];
  for(let t=0;t<T;t+=0.02){if(at(TH,t)<thMax)continue;const p=(at(E,t)*at(R,t)+(M&&MR?at(M,t)*at(MR,t):0))*Math.PI/30/1000;if(p>20)out.push(p);}return {kw:q90(out),n:out.length};}
const BOPFP=()=>LS.get('bop:fp',{});
function bopSave(id,e){const F=BOPFP();F[id]={...F[id],...e};LS.set('bop:fp',F);}
function ldDate(S){const m=/(\d\d)\/(\d\d)\/(\d{4})/.exec(S.meta?.date||'');return m?Date.UTC(+m[3],m[2]-1,+m[1]):NaN;}
// a telemetry file has no car model: the label, the file name or the setup loaded with it usually say it
function ldCar(S){for(const s of [S.label,S.meta?.car,S.name,S.file,S.svm?.car,S.setup?.car])if(s){const c=bopCar(s);if(c)return c;}return null;}
function bopScanLds(){const F=BOPFP();let ch=false;lds().forEach(S=>{if(S.sample)return;const id='ld|'+S.id;if(F[id])return;const p=ldPower(S);if(!p||!p.kw)return;const c=ldCar(S);
  F[id]={src:'ld',label:S.label,trk:bopTrack(S.meta?.venue),cls:c?.cls||null,model:c?.model||null,kw:Math.round(p.kw*10)/10,n:p.n,at:ldDate(S)||Date.now()};ch=true;});if(ch)LS.set('bop:fp',F);}
// verdict of one measurement against the previous one of the same car on the same track
function bopVerdict(e,F){if(!e.model||!e.trk||!e.kw)return {k:'info',t:tr('scegli l\'auto')};
  const prev=Object.values(F).filter(x=>x!==e&&x.model===e.model&&x.trk===e.trk&&x.kw&&x.at<e.at).sort((a,b)=>b.at-a.at)[0];if(!prev)return {k:'info',t:tr('prima misura su questa pista')};
  const Va=bopAt(e.at),Vb=bopAt(prev.at);const oa=bopPow(e.cls,bopRow(e.cls,e.model,e.trk,Va)),ob=bopPow(e.cls,bopRow(e.cls,e.model,e.trk,Vb));
  const meas=e.kw/prev.kw-1;const exp=Va&&Vb&&oa&&ob?oa/ob-1:(Va&&Va===Vb?0:null);const pc=x=>(x>0?'+':'')+(x*100).toFixed(1)+'%';
  if(exp==null)return {k:Math.abs(meas)>0.02?'warn':'info',t:`${pc(meas)} ${tr('rispetto al')} ${new Date(prev.at).toLocaleDateString()} · ${tr('BOP di allora sconosciuto')}`};
  const dev=(1+meas)/(1+exp)-1;if(Math.abs(dev)<=0.02)return {k:'good',t:`${tr('coerente con il BOP')} (${pc(meas)})`};
  return {k:'bad',t:`⚠ ${tr('potenza')} ${pc(meas)} ${tr('rispetto al')} ${new Date(prev.at).toLocaleDateString()}${exp?` (${tr('il BOP ufficiale dice')} ${pc(exp)})`:` ${tr('senza cambi nel BOP ufficiale')}`}`};}

// ---------- live: the bridge sends the power of our car ----------
const BOPLIVE={seen:new Map(),buf:new Map()};
setInterval(()=>{if(typeof LIVE==='undefined')return;const trk=bopTrack(LIVE.sc?.i?.trk);Object.values(LIVE.drivers||{}).forEach(D=>{const d=D.car;if(!d||BOPLIVE.seen.get(D)===D.carAt)return;BOPLIVE.seen.set(D,D.carAt);
  if(!trk||!(d.kw>20)||!(d.thr>=0.99)||d.pit)return;const c=bopCar(d.car);if(!c)return;const day=new Date().toISOString().slice(0,10);const id=`live|${c.model}|${trk}|${day}|${LIVE.sc?.i?.ses??''}`;
  const B=BOPLIVE.buf.get(id)||[];B.push(d.kw);if(B.length>4000)B.splice(0,B.length-4000);BOPLIVE.buf.set(id,B);
  if(B.length>=40&&B.length%20===0)bopSave(id,{src:'live',label:d.car,trk,cls:c.cls,model:c.model,kw:Math.round(q90(B)*10)/10,n:B.length,at:Date.now()});});},200);

// ---------- the BOP view (Setup › BOP) ----------
function bopMine(){const f=typeof LIVE!=='undefined'?Object.values(LIVE.drivers||{}).find(D=>D.car?.car&&bopCar(D.car.car))?.car.car:null;const s=LS.get('bop:car',null);
  if(s)return s;const c=f?bopCar(f):null;if(c)return c.cls+'|'+c.model;const S=active()?.S;const g=S?ldCar(S):null;return g?g.cls+'|'+g.model:'HY|M Hybrid V8';}
RENDER.bop=()=>{const el=$('#bopBody');if(!BOPV){el.innerHTML=`<div class="panel"><div class="empty">${tr('Nessun BOP caricato.')}</div></div>`;return;}
  bopScanLds();const mode=LS.get('bop:mode','trk');const mine=bopMine();const [mc,mm]=mine.split('|');const trks=Object.keys(BOPV.tracks);
  const S=active()?.S;const liveT=typeof LIVE!=='undefined'?bopTrack(LIVE.sc?.i?.trk):null;let trk=LS.get('bop:trk',null);if(!trk||!BOPV.tracks[trk])trk=liveT||bopTrack(S?.meta?.venue)||trks[0];
  const cls=LS.get('bop:cls',mc);const allCars=Object.entries(BOP_COLS).flatMap(([k])=>(BOPV.tracks[trks[0]].cls[k]||[]).map(r=>[k+'|'+r.model,`${BOP_CLS[k]} · ${r.mfr} ${r.model}`]));
  const nChg=Object.values(BOPV.tracks).reduce((s,T)=>s+Object.values(T.cls).flat().filter(r=>r.d).length,0);
  let body='';
  if(mode==='trk'){const T=BOPV.tracks[trk];const rows=(T.cls[cls]||[]).map(r=>[`${r.mfr} ${r.model}`,r,cls+'|'+r.model]);
    body=`<div class="row bopbar"><label class="f" style="min-width:200px">${tr('Pista')}<select id="bopTrk">${trks.map(t=>`<option${t===trk?' selected':''}>${esc(t)}</option>`).join('')}</select></label>
      <span class="seg" id="bopCls">${Object.keys(BOP_COLS).filter(k=>T.cls[k]).map(k=>`<button type="button" data-c="${k}" aria-pressed="${k===cls}">${BOP_CLS[k]}</button>`).join('')}</span><span class="sp"></span>
      <span class="muted small">${T.layouts?.length?esc(T.layouts.join(' · '))+' · ':''}${T.tyres?tr('gomme asciutto')+': '+T.tyres.map(tr).join(', ')+' · ':''}${T.acf?tr('correzione ambiente')+' '+T.acf:''}</span></div>${bopTable(cls,rows,mine,tr('Auto'))}`;}
  else if(mode==='car'){const rows=trks.map(t=>{const r=bopRow(mc,mm,t);return r?[t,r,t]:null;}).filter(Boolean);
    body=`<div class="row bopbar"><label class="f" style="min-width:280px">${tr('Auto')}<select id="bopCar">${allCars.map(([v,l])=>`<option value="${esc(v)}"${v===mine?' selected':''}>${esc(l)}</option>`).join('')}</select></label><span class="muted small">${tr('La stessa auto su tutte le piste. In evidenza la pista della sessione.')}</span></div>${bopTable(mc,rows,liveT||bopTrack(S?.meta?.venue),tr('Pista'))}`;}
  else{const F=BOPFP();const E=Object.entries(F).sort((a,b)=>b[1].at-a[1].at);
    body=`<p class="muted small" style="margin:0 0 10px">${tr('Il gioco non dice che BOP sta usando. Per la nostra auto misuriamo la potenza (motore + elettrico, a gas pieno) dalla telemetria MoTeC e, in diretta, dal bridge. Per la stessa auto sulla stessa pista deve restare uguale: se cambia di più del 2% e il BOP ufficiale no, il BOP è stato cambiato senza dirlo.')}</p>
      ${E.length?`<div class="tw"><table class="boptab"><thead><tr><th>${tr('Data')}</th><th>${tr('Fonte')}</th><th>${tr('Pista')}</th><th>${tr('Auto')}</th><th>${tr('Potenza misurata')}</th><th>${tr('BOP ufficiale')}</th><th>${tr('Esito')}</th><th></th></tr></thead><tbody>${E.map(([id,e])=>{const V=bopAt(e.at);const o=e.model?bopRow(e.cls,e.model,e.trk,V):null;const v=bopVerdict(e,F);
        return `<tr><td>${new Date(e.at).toLocaleDateString()}</td><td>${e.src==='live'?tr('in diretta'):'MoTeC'}</td><td class="wrap">${esc(e.trk||'—')}<div class="muted small">${esc(e.label||'')}</div></td>
        <td>${e.src==='ld'?`<select data-fp="${esc(id)}"><option value="">${tr('— scegli —')}</option>${allCars.map(([k,l])=>`<option value="${esc(k)}"${e.model&&k===e.cls+'|'+e.model?' selected':''}>${esc(l)}</option>`).join('')}</select>`:esc(e.model?BOP_CLS[e.cls]+' · '+e.model:'—')}</td>
        <td><b>${fx(e.kw,1)} kW</b><div class="muted small">${e.n} ${tr('campioni')}</div></td><td>${o?`${bopPow(e.cls,o)} ${e.cls==='HY'?'kW':'%'} · ${o.kg} kg`:'—'}<div class="muted small">${V?'BOP '+V.ver:tr('BOP precedente')}</div></td>
        <td class="wrap"><span class="bopv ${v.k}">${esc(v.t)}</span></td><td><button class="btn icon" type="button" data-fpdel="${esc(id)}" title="${esc(tr('Elimina'))}">✕</button></td></tr>`;}).join('')}</tbody></table></div>`
      :`<div class="empty">${tr('Ancora nessuna misura: carica una telemetria MoTeC della tua auto o corri con il bridge acceso.')}</div>`}`;}
  el.innerHTML=`<div class="panel"><div class="panel-h"><h2>BOP ${esc(BOPV.ver)}</h2><span class="muted small">${tr('ufficiale LMU del')} ${esc(BOPV.date)} · ${nChg} ${tr('auto cambiate rispetto al precedente')}</span><span class="sp"></span>
    <span class="seg" id="bopMode"><button type="button" data-m="trk" aria-pressed="${mode==='trk'}">${tr('Per pista')}</button><button type="button" data-m="car" aria-pressed="${mode==='car'}">${tr('Per auto')}</button><button type="button" data-m="chk" aria-pressed="${mode==='chk'}">${tr('Controllo cambi nascosti')}</button></span></div>
    ${body}<div class="muted small" style="margin-top:10px">${tr('▲▼ = cambiato rispetto al BOP precedente (verde meglio per quell\'auto, rosso peggio). Peso minimo con pilota (82 kg). Potenza Hypercar con la correzione ambiente della pista.')}</div></div>`;
  $$('#bopMode button').forEach(b=>b.onclick=()=>{LS.set('bop:mode',b.dataset.m);RENDER.bop();});
  $$('#bopCls button').forEach(b=>b.onclick=()=>{LS.set('bop:cls',b.dataset.c);RENDER.bop();});
  const t=$('#bopTrk');if(t)t.onchange=()=>{LS.set('bop:trk',t.value);RENDER.bop();};
  const c=$('#bopCar');if(c)c.onchange=()=>{LS.set('bop:car',c.value);LS.set('bop:cls',c.value.split('|')[0]);RENDER.bop();};
  $$('[data-fp]').forEach(s=>s.onchange=()=>{const [k,m]=s.value.split('|');bopSave(s.dataset.fp,{cls:k||null,model:m||null});RENDER.bop();});
  $$('[data-fpdel]').forEach(b=>b.onclick=()=>{const F=BOPFP();delete F[b.dataset.fpdel];LS.set('bop:fp',F);RENDER.bop();});};

// ---------- Muretto › Auto: the BOP of our car on this track ----------
(function(){const sk=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){const fresh=!$('#v-live').dataset.ok;sk();if(!fresh||$('#lvBop'))return;
  $('#v-live .lvsub[data-p="car"] .lvgrid3')?.insertAdjacentHTML('afterend',`<div class="panel"><div class="panel-h"><h3>BOP</h3><span class="muted small" id="lvBopT"></span></div><div id="lvBop"></div></div>`);};})();
(function(){const lc=lvCar;window.lvCar=lvCar=function(x){lc(x);const el=$('#lvBop');if(!el)return;const c=x.c;const trk=bopTrack(x.I?.trk);const car=bopCar(c?.car||x.me?.label);
  $('#lvBopT').textContent=BOPV?`${tr('ufficiale')} ${BOPV.ver} · ${trk||tr('pista non trovata')}`:'';
  if(!BOPV||!trk||!car){el.innerHTML=`<div class="muted small">${!BOPV?tr('Nessun BOP caricato.'):!trk?tr('Pista non presente nel BOP.'):tr('Auto non riconosciuta nel BOP.')}</div>`;return;}
  const r=bopRow(car.cls,car.model,trk);const day=new Date().toISOString().slice(0,10);const F=BOPFP();const id=`live|${car.model}|${trk}|${day}|${x.I?.ses??''}`;const e=F[id];
  const B=BOPLIVE.buf.get(id)||[];const v=e?bopVerdict(e,F):null;
  el.innerHTML=(r?bopTable(car.cls,[[`${r.mfr} ${r.model}`,r,'x']],'x',tr('Auto')):'')+
   `<div class="lvrow" style="margin-top:8px"><span>${tr('Potenza misurata a gas pieno')}</span><b>${e?fx(e.kw,1)+' kW':B.length?`${tr('raccolta')} ${B.length}/40`:tr('serve un tratto a gas pieno')}</b></div>${v?`<div class="lvrow"><span>${tr('Controllo BOP')}</span><b class="bopv ${v.k}">${esc(v.t)}</b></div>`:''}`;};})();

(function(){const st=document.createElement('style');st.textContent=`
.bopbar{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end;margin-bottom:12px}.bopbar .sp{flex:1}
table.boptab td,table.boptab th{text-align:right;white-space:nowrap;padding:6px 8px}table.boptab td.l,table.boptab th:first-child{text-align:left}
table.boptab tr.ours td{background:color-mix(in srgb,var(--accent) 16%,transparent)!important}table.boptab tr.ours td:first-child{box-shadow:inset 3px 0 var(--accent)}
.bd{display:inline-block;font:600 .7rem var(--f-mono);padding:0 5px;margin-left:4px;border-radius:2px}.bd.up{color:var(--good);background:color-mix(in srgb,var(--good) 14%,transparent)}.bd.dn{color:var(--bad);background:color-mix(in srgb,var(--bad) 14%,transparent)}.bd.nt{color:var(--warn);background:color-mix(in srgb,var(--warn) 14%,transparent)}
.bopv{font-size:.8rem}.bopv.good{color:var(--good)}.bopv.bad{color:var(--bad);font-weight:700}.bopv.warn{color:var(--warn)}.bopv.info{color:var(--muted)}
table.boptab select{min-width:200px}table.boptab td.wrap{white-space:normal;min-width:150px;max-width:300px;text-align:left}`;document.head.appendChild(st);})();
