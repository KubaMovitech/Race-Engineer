// ================= SETUP =================
let DIAG=null;
RENDER.setup=()=>{
  const su=byId($('#suFile').value),S=active()?.S;
  const c=cfg();[['#cfgPmin','pmin'],['#cfgPmax','pmax'],['#cfgIOmin','iomin'],['#cfgIOmax','iomax'],['#cfgBmax','bmax'],['#cfgRH','rh'],['#cfgTmin','tmin'],['#cfgTmax','tmax']].forEach(([id,k])=>{const el=$(id);if(document.activeElement!==el)el.value=c[k];});
  renderSheet(su);
  const w=[];let mismatch=false;if(su&&S){const car=(S.meta.car||S.merged?.d.car||'').toLowerCase(),sc=su.car.toLowerCase();
    const same=car&&(sc.includes(car)||(car.startsWith('hyper')&&/hypercar/.test(sc))||car.split(/\s+/).some(t=>t.length>3&&sc.includes(t)));
    if(car&&!same){mismatch=true;w.push(`Il setup è per «${su.car}», la telemetria è di «${S.meta.car||S.merged?.d.car}». I controlli sotto usano solo la telemetria e non mostrano i valori «ora» del setup: carica il .svm di questa auto.`);}
    else if(!car)w.push(`Il file .ld non indica l'auto: verifica che telemetria e setup (${su.car}) siano della stessa vettura.`);}
  $('#suWarn').innerHTML=w.map(x=>`<div class="warnbar" style="margin-bottom:10px">${esc(x)}</div>`).join('');
  if(!S){$('#suDiag').innerHTML='<div class="empty">Scegli una telemetria .ld in alto: i controlli partono da lì.</div>';DIAG=null;renderDoctor();return;}
  const laps=S.laps.filter(l=>l.complete&&l.type==='lanciato');const use=laps.length?laps:S.laps.filter(l=>l.complete);
  if(!use.length){$('#suDiag').innerHTML='<div class="empty">Servono giri completi.</div>';return;}
  $('#suDiagNote').textContent=`${use.length} ${use.length===1?'giro':'giri'} · ${S.label}`;
  const D=diagnose(S,use,mismatch?null:su);DIAG=D;DIAG.S=S;DIAG.su=mismatch?null:su;
  const order=['Gomme','Freni e trazione','Assetto e aerodinamica','Motore e rapporti','Bilanciamento'];
  setTimeout(renderDoctor,0);
  $('#suDiag').innerHTML=order.map(sec=>{const cs=D.cards.filter(c=>c.sec===sec);if(!cs.length)return'';
    return `<div class="sect">${sec}</div><div class="diag" style="margin:12px 0 16px">${cs.map(c=>`<div class="card ${c.st}"><span class="st"><span class="dot ${c.st}"></span>${esc(c.title)}${c.tag?`<em>${esc(c.tag)}</em>`:''}</span>${c.html}${c.fix?`<div class="fix"><b>Cosa provare</b>${c.fix}</div>`:''}</div>`).join('')}</div>`;}).join('');
};
function renderSheet(su){
  if(!su){$('#suMeta').textContent='';$('#suSheet').innerHTML='<div class="empty">Carica un file setup .svm (Documenti o cartella UserData/player/Settings di Le Mans Ultimate).</div>';return;}
  $('#suMeta').textContent=`${su.car}${su.head.Notes?' · '+su.head.Notes:''}`;
  const groups={},corner={};
  for(const [sec,items] of Object.entries(su.sec)){
    if(/^(FRONT|REAR)(LEFT|RIGHT)$/.test(sec)){items.forEach(x=>{if(/N\/A|Detached/.test(x.disp)||!x.disp)return;(corner[x.label]??={})[sec]=x.disp;});continue;}
    const gname=SETUP_GROUPS[sec]||sec;items.forEach(x=>{if(!x.disp||/N\/A|Non-adjustable|Detached/.test(x.disp))return;(groups[gname]??=[]).push([x.label,x.disp]);});
  }
  $('#suSheet').innerHTML=Object.entries(groups).map(([g,rows])=>`<div class="grp"><h3>${esc(g)}</h3><div class="kv">${rows.map(([l,v])=>`<span>${esc(l)}</span><span>${esc(v)}</span>`).join('')}</div></div>`).join('')+
    (Object.keys(corner).length?`<div class="grp" style="grid-column:1/-1"><h3>Ruote e sospensioni</h3><div class="tw"><table><thead><tr><th>Parametro</th><th>Ant. sx</th><th>Ant. dx</th><th>Post. sx</th><th>Post. dx</th></tr></thead><tbody>${Object.entries(corner).map(([l,o])=>`<tr><td class="l" style="font-family:var(--f-body)">${esc(l)}</td>${['FRONTLEFT','FRONTRIGHT','REARLEFT','REARRIGHT'].map(k=>`<td>${esc(o[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`:'');
}
function agg(stats,f){return mean(stats.map(f));}
const SEC_OF={FL:'FRONTLEFT',FR:'FRONTRIGHT',RL:'REARLEFT',RR:'REARRIGHT'};
function diagnose(S,laps,su){
  const st=laps.map(l=>lapStats(S,l)),c=cfg(),cards=[],summary=[],raw={};
  const now=(key,sec)=>{const v=setupVal(su,key,sec);return v?` <span class="muted">(ora ${esc(v)})</span>`:'';};
  const T={};for(const w of W)T[w]={I:agg(st,s=>s.w[w].I),C:agg(st,s=>s.w[w].C),O:agg(st,s=>s.w[w].O),carc:agg(st,s=>s.w[w].carc),p:agg(st,s=>s.w[w].p),pMax:agg(st,s=>s.w[w].pMax),bMax:Math.max(...st.map(s=>s.w[w].bMax)),rhMin:Math.min(...st.map(s=>s.w[w].rhMin)),rhLow:agg(st,s=>s.w[w].rhLow),wear:agg(st,s=>s.w[w].wear)};
  const cond=S.cond;summary.push(`Condizioni: ${cond.label}, aria ${fx(cond.air?.avg,1)} °C, pista ${fx(cond.track?.avg,1)} °C${cond.wet?`, bagnato max ${fx(cond.wet.max*100,0)}%`:''}${cond.wind?`, vento ${fx(cond.wind.avg,1)} m/s`:''}`);
  // ---- Gomme
  {const io=+c.iomin,iomax=+c.iomax;let worst='good';const fixes=[];
    const li=W.map(w=>{const d=T[w].I-T[w].O;let s='good',txt='ok';if(!Number.isFinite(d)){s='';txt='n.d.';}else if(d>iomax){s='warn';txt='troppa campanatura negativa';fixes.push(`${w}: meno negativa${now('CamberSetting',SEC_OF[w])}`);}else if(d<io){s=d<0?'bad':'warn';txt=d<0?'esterno più caldo':'poca campanatura negativa';fixes.push(`${w}: più negativa${now('CamberSetting',SEC_OF[w])}`);}
      if(s==='bad'||(s==='warn'&&worst==='good'))worst=s;return `<li><b>${w}</b> int−est ${fsign(d,1)} °C · ${txt}</li>`;});
    cards.push({sec:'Gomme',title:'Campanatura',st:worst,tag:`obiettivo ${io}–${iomax} °C`,html:`<ul>${li.join('')}</ul>`,fix:fixes.length?fixes.join('<br>')+'<br><span class="muted">Un click alla volta, poi riguarda le temperature.</span>':null});
    summary.push('Differenza temperatura interno−esterno (°C): '+W.map(w=>`${w} ${fx(T[w].I-T[w].O,1)}`).join(', '));}
  {let worst='good';const pmin=num(c.pmin),pmax=num(c.pmax),fixes=[];
    const li=W.map(w=>{const x=T[w],d=x.C-(x.I+x.O)/2;let s='good',txt='profilo uniforme';if(d>6){s='warn';txt='centro caldo → pressione alta';fixes.push(`${w}: −1 click${now('PressureSetting',SEC_OF[w])}`);}else if(d<-2){s='warn';txt='centro freddo → pressione bassa';fixes.push(`${w}: +1 click${now('PressureSetting',SEC_OF[w])}`);}
      let pt='';if(Number.isFinite(pmin)&&Number.isFinite(pmax)){if(x.p<pmin){s='warn';pt=' · sotto obiettivo';if(!fixes.some(f=>f.startsWith(w)))fixes.push(`${w}: alza la pressione a freddo${now('PressureSetting',SEC_OF[w])}`);}else if(x.p>pmax){s='warn';pt=' · sopra obiettivo';if(!fixes.some(f=>f.startsWith(w)))fixes.push(`${w}: abbassa la pressione a freddo${now('PressureSetting',SEC_OF[w])}`);}}
      if(s!=='good')worst='warn';return `<li><b>${w}</b> ${fx(x.p,1)} kPa (max ${fx(x.pMax,1)}) · centro ${fsign(d,1)} °C · ${txt}${pt}</li>`;});
    cards.push({sec:'Gomme',title:'Pressioni a caldo',st:worst,tag:Number.isFinite(pmin)?`obiettivo ${pmin}–${pmax}`:'dal profilo',html:`<ul>${li.join('')}</ul>`,fix:fixes.length?fixes.join('<br>'):null});
    summary.push('Pressione media a caldo (kPa): '+W.map(w=>`${w} ${fx(T[w].p,1)} (max ${fx(T[w].pMax,1)})`).join(', '));
    summary.push('Temperature strato interno gomma I/C/E medie (°C): '+W.map(w=>`${w} ${fx(T[w].I,0)}/${fx(T[w].C,0)}/${fx(T[w].O,0)}`).join(', '));}
  {const av=w=>Number.isFinite(T[w].carc)?T[w].carc:(T[w].I+T[w].C+T[w].O)/3;const f=mean([av('FL'),av('FR')]),r=mean([av('RL'),av('RR')]),l=mean([av('FL'),av('RL')]),rr=mean([av('FR'),av('RR')]);const s=Math.abs(f-r)>10?'warn':'good';
    cards.push({sec:'Gomme',title:'Equilibrio temperature',st:s,html:`<p>Carcassa anteriori ${fx(f,0)} °C · posteriori ${fx(r,0)} °C (${fsign(f-r,0)})</p><p>Sinistra ${fx(l,0)} °C · destra ${fx(rr,0)} °C (${fsign(l-rr,0)})</p>${Number.isFinite(num(cfg().tmin))?`<p class="small">Finestra impostata ${cfg().tmin}–${cfg().tmax} °C: ${Math.max(f,r)<+cfg().tmin?'<b style="color:var(--t-cold)">gomme sotto la finestra</b>':Math.min(f,r)>+cfg().tmax?'<b style="color:var(--t-hot)">gomme sopra la finestra</b>':'<b style="color:var(--good)">dentro la finestra</b>'}</p>`:''}<p class="muted small">${f-r>10?'Anteriori molto più caldi: tipico di sottosterzo o frenate aggressive.':r-f>10?'Posteriori molto più caldi: pattinamento in uscita o sovrasterzo.':'Assi in equilibrio.'} Pista a ${fx(cond.track?.avg,1)} °C.</p>`});
    summary.push(`Temperatura carcassa media: ant ${fx(f,0)}, post ${fx(r,0)}, sx ${fx(l,0)}, dx ${fx(rr,0)}`);}
  {const wm=W.map(w=>T[w].wear);const mx=Math.max(...wm),mn=Math.min(...wm);cards.push({sec:'Gomme',title:'Usura per giro',st:mx>1.5*mn?'warn':'good',html:`<ul>${W.map((w,i)=>`<li><b>${w}</b> ${fx(wm[i],2)} %</li>`).join('')}</ul><p class="muted small">${mx>1.5*mn?'Usura sbilanciata: la più consumata è '+WL[W[wm.indexOf(mx)]]+'.':'Usura uniforme.'}</p>`});
    summary.push('Usura per giro (%): '+W.map((w,i)=>`${w} ${fx(wm[i],2)}`).join(', '));}
  // ---- Freni e trazione
  const SL=slipEvents(S,laps.slice(0,8));raw.SL=SL;
  if(SL){const top=k=>Object.entries(SL.where).filter(([,v])=>v[k]>0.03).sort((a,b)=>b[1][k]-a[1][k]).slice(0,4).map(([n,v])=>`${n} ${fx(v[k],2)} s`).join(', ');
    const lf=SL.lockF,lr=SL.lockR;const s=Math.max(lf,lr)>0.8?'bad':Math.max(lf,lr)>0.25?'warn':'good';
    let fix=null;if(lf>0.25&&lf>lr*1.5)fix=`Bloccano le anteriori: ripartizione più indietro di 0,5–1%${now('RearBrakeSetting')}, oppure pressione freni più bassa${now('BrakePressureSetting')}. Rilascia il pedale più progressivamente in inserimento.`;
    else if(lr>0.25)fix=`Bloccano le posteriori: ripartizione più in avanti${now('RearBrakeSetting')}; differenziale in rilascio più chiuso${now('DiffCoastSetting')} per stabilizzare in ingresso${setupVal(su,'RegenerationMapSetting')?'; rigenerazione più bassa'+now('RegenerationMapSetting'):''}.`;
    cards.push({sec:'Freni e trazione',title:'Bloccaggi in frenata',st:s,tag:'s per giro',html:`<p>Anteriori <b>${fx(lf,2)} s</b> · posteriori <b>${fx(lr,2)} s</b></p>${top('lf')||top('lr')?`<p class="small">${top('lf')?'Anteriori: '+top('lf'):''}${top('lr')?'<br>Posteriori: '+top('lr'):''}</p>`:''}<p class="muted small">Ruota più lenta del 15% rispetto all'auto con freno oltre il 15%.</p>`,fix});
    const sp=SL.spin;const s2=sp>1.5?'bad':sp>0.5?'warn':'good';
    cards.push({sec:'Freni e trazione',title:'Pattinamento in uscita',st:s2,tag:'s per giro',html:`<p>Ruote posteriori che pattinano: <b>${fx(sp,2)} s</b> per giro</p>${top('sp')?`<p class="small">Dove: ${top('sp')}</p>`:''}<p class="muted small">Posteriori più veloci del 12% rispetto all'auto con gas oltre il 30%.</p>`,
      fix:s2!=='good'?`TC un gradino più alto${now('TractionControlMapSetting')}${setupVal(su,'TCPowerCutMapSetting')?', taglio potenza'+now('TCPowerCutMapSetting'):''}; differenziale in trazione meno chiuso${now('DiffPowerSetting')}; barra posteriore più morbida${now('RearAntiSwaySetting')}. Nel frattempo apri il gas più progressivo nelle curve indicate.`:null});
    summary.push(`Bloccaggi in frenata (s/giro): anteriori ${fx(lf,2)}, posteriori ${fx(lr,2)}. Pattinamento posteriore in trazione: ${fx(sp,2)} s/giro. Dove: bloccaggi ant ${top('lf')||'-'}; post ${top('lr')||'-'}; pattinamento ${top('sp')||'-'}`);}
  {const bmax=num(c.bmax),mx=Math.max(...W.map(w=>T[w].bMax));const bf=mean([T.FL.bMax,T.FR.bMax]),br=mean([T.RL.bMax,T.RR.bMax]);const s=Number.isFinite(bmax)&&mx>bmax?'warn':'good';
    cards.push({sec:'Freni e trazione',title:'Temperatura freni',st:s,tag:Number.isFinite(bmax)?`limite ${bmax} °C`:'',html:`<ul>${W.map(w=>`<li><b>${w}</b> picco ${fx(T[w].bMax,0)} °C</li>`).join('')}</ul><p class="muted small">Anteriori ${fsign(bf-br,0)} °C rispetto ai posteriori. Prese freni ant.${now('BrakeDuctSetting')}, post.${now('BrakeDuctRearSetting')}.</p>`,fix:s!=='good'?`Apri le prese freni${now('BrakeDuctSetting')}.`:null});
    summary.push('Picco temperatura freni (°C): '+W.map(w=>`${w} ${fx(T[w].bMax,0)}`).join(', '));}
  // ---- Assetto
  {const lowF=Math.max(T.FL.rhLow,T.FR.rhLow),lowR=Math.max(T.RL.rhLow,T.RR.rhLow);const s=(lowF>0.01||lowR>0.01)?'bad':(lowF>0.002||lowR>0.002)?'warn':'good';
    const ax=lowF>=lowR?'anteriore':'posteriore',sec=lowF>=lowR?'FRONTLEFT':'REARLEFT';
    cards.push({sec:'Assetto e aerodinamica',title:'Altezze e fondo',st:s,tag:`allarme < ${c.rh} mm`,html:`<ul>${W.map(w=>`<li><b>${w}</b> minima ${fx(T[w].rhMin,1)} mm · sotto soglia ${fx(T[w].rhLow*100,2)}% del giro</li>`).join('')}</ul><p class="muted small">Rake medio in movimento: ${fx(mean(st.map(s=>mean([s.w.RL.rhMed,s.w.RR.rhMed])-mean([s.w.FL.rhMed,s.w.FR.rhMed]))),1)} mm (posteriore più alto).</p>`,
      fix:s!=='good'?`Tocca il fondo all'${ax}: alza l'altezza${now('RideHeightSetting',sec)} o aumenta il packer del 3° elemento${now(lowF>=lowR?'Front3rdPackerSetting':'Rear3rdPackerSetting')}, oppure molla più rigida${now('SpringSetting',sec)}.`:null});
    summary.push('Altezza minima (mm): '+W.map(w=>`${w} ${fx(T[w].rhMin,1)} (sotto ${c.rh}mm ${fx(T[w].rhLow*100,2)}% del giro)`).join(', '));}
  {const sc=steerCheck(S,laps);if(sc){const s=sc.max>=95?'warn':'good';cards.push({sec:'Assetto e aerodinamica',title:'Angolo di sterzo',st:s,html:`<p>Massimo usato: <b>${fx(sc.max,0)}%</b> del fine corsa${sc.where?' ('+sc.where+')':''}</p>`,fix:s!=='good'?`Arrivi a fine corsa: aumenta l'angolo di sterzo${now('SteerLockSetting')}.`:null});summary.push(`Sterzo massimo usato ${fx(sc.max,0)}% ${sc.where||''}`);}}
  // ---- Motore e rapporti
  {const gc=gearingCheck(S,laps);raw.gc=gc;if(gc&&Number.isFinite(gc.lim)){const top=[...gc.straights].sort((a,b)=>b.v-a.v)[0];const pctLim=top?top.rpm/gc.lim*100:NaN;
    let s='good',fix=null;if(gc.limPerLap>0.4){s='warn';fix=`Tocchi il limitatore ${fx(gc.limPerLap,1)} s per giro: allunga il rapporto finale${now('FinalDriveSetting')} o l'ultima marcia.`;}
    else if(top&&top.gear>=gc.topGear&&pctLim<88){s='warn';fix=`Sul rettilineo più veloce arrivi solo al ${fx(pctLim,0)}% dei giri: puoi accorciare il finale${now('FinalDriveSetting')} per più accelerazione.`;}
    else if(top&&top.gear<gc.topGear){fix=null;}
    cards.push({sec:'Motore e rapporti',title:'Rapporti',st:s,html:`<p>Limitatore ${fx(gc.lim,0)} giri · a limitatore ${fx(gc.limPerLap,2)} s/giro</p>${top?`<p>Rettilineo più veloce (prima di T${top.corner}): ${fx(top.v,0)} km/h in ${fx(top.gear,0)}ª a ${fx(top.rpm,0)} giri (${fx(pctLim,0)}%)</p>`:''}`,fix});
    summary.push(`Rapporti: limitatore ${fx(gc.lim,0)} rpm, tempo a limitatore ${fx(gc.limPerLap,2)} s/giro${top?`, velocità max ${fx(top.v,0)} km/h in marcia ${top.gear} a ${fx(pctLim,0)}% del limitatore`:''}`);}}
  {const ec=engineCheck(S);raw.ec=ec;const s=ec.overheat?'bad':'good';cards.push({sec:'Motore e rapporti',title:'Temperature motore',st:s,html:`<p>Acqua max ${fx(ec.water,1)} °C · olio max ${fx(ec.oil,1)} °C</p><p class="muted small">${ec.overheat?'Il gioco segnala surriscaldamento.':'Nessun surriscaldamento segnalato dal gioco.'} Radiatori: acqua${now('WaterRadiatorSetting')}, olio${now('OilRadiatorSetting')}.</p>`,fix:ec.overheat?`Togli nastro dai radiatori${now('WaterRadiatorSetting')}.`:null});summary.push(`Motore: acqua max ${fx(ec.water,1)}, olio max ${fx(ec.oil,1)}, surriscaldamento ${ec.overheat?'sì':'no'}`);}
  // ---- Bilanciamento
  {const B=balance(S,laps.slice(0,6));raw.B=B;const P=B.phases;let s='good';const lines=[];
    for(const [k,x] of Object.entries(P)){let t='';if(B.hasGrip&&Number.isFinite(x.front)){const d=x.front-x.rear;t=` · scivolamento ant. ${fx(x.front,0)}% / post. ${fx(x.rear,0)}% → ${d>8?'<b>tende al sottosterzo</b>':d<-8?'<b>tende al sovrasterzo</b>':'neutro'}`;if(Math.abs(d)>8)s='warn';}
      lines.push(`<li><b>${k}</b>: sterzo relativo ${fx(x.steerIdx,2)}${t}</li>`);}
    const cs=B.counter;if(cs.length>laps.slice(0,6).length*2)s='warn';
    const byC={};cs.forEach(e=>{const k=e.corner?('T'+e.corner):('~'+Math.round(e.d/100)*100+' m');(byC[k]??={n:0,ph:{}}).n++;byC[k].ph[e.phase]=(byC[k].ph[e.phase]||0)+1;});
    const top=Object.entries(byC).sort((a,b)=>b[1].n-a[1].n).slice(0,5);
    cards.push({sec:'Bilanciamento',title:'Sottosterzo / sovrasterzo',st:s,html:`<ul>${lines.join('')}</ul><p>Controsterzi: <b>${cs.length}</b>${top.length?' · '+top.map(([k,v])=>`${k} ×${v.n} (${Object.keys(v.ph).join('/')})`).join(', '):''}</p><p class="muted small">Sterzo relativo &gt; 1: serve più volante del solito per la stessa accelerazione laterale (tendenza al sottosterzo in quella fase); &lt; 1: ne serve meno (tendenza al sovrasterzo). ${B.hasGrip?'Lo scivolamento viene dal canale grip delle gomme.':'Questa telemetria non ha il canale grip delle gomme: uso sterzo e controsterzi.'} Indicatore approssimativo: confermalo con le tue sensazioni.</p>`});
    summary.push('Bilanciamento per fase (sterzo relativo; >1 sottosterzo, <1 sovrasterzo): '+Object.entries(P).map(([k,x])=>`${k} ${fx(x.steerIdx,2)}${B.hasGrip?` [slittamento ant ${fx(x.front,0)}% / post ${fx(x.rear,0)}%]`:''}`).join(', '));
    summary.push(`Controsterzi: ${cs.length}. `+top.map(([k,v])=>`${k} x${v.n} fase ${Object.keys(v.ph).join('/')}`).join('; '));}
  const bl=S.best||laps[0];const g=lapGrid(S,bl,2);const cr=detectCorners(g);
  summary.push(`Miglior giro ${fmtLap(bl.time)}. Curve (apice m, vel. min km/h, marcia): `+cr.map(k=>`T${k.k} ${fx(k.dApex,0)}m ${fx(k.vMin,0)} m${fx(k.gear,0)}`).join('; '));
  raw.T=T;raw.wearAvg=mean(W.map(w=>T[w].wear));return {cards,summary,T,raw};
}

// ================= AI =================
let SAMPLE=null;
async function initAI(){
  try{if(window.claude?.use)SAMPLE=await window.claude.use('sample');}catch(e){SAMPLE=null;}
  if(!SAMPLE){['#suAnswer','#cmpAnswer'].forEach(id=>$(id).innerHTML='<div class="note">L’assistente AI funziona quando apri questa pagina su claude.ai o nell’app Claude.</div>');$('#suAsk').disabled=true;$('#cmpAsk').disabled=true;}
}
function md(s){
  const lines=esc(s).split('\n');let html='',inList=null,inTable=false;
  const inline=t=>t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<i>$2</i>');
  const close=()=>{if(inList){html+=`</${inList}>`;inList=null;}if(inTable){html+='</tbody></table></div>';inTable=false;}};
  for(const raw of lines){const l=raw.trimEnd();
    if(/^\|/.test(l)){const cells=l.replace(/^\||\|$/g,'').split('|').map(c=>c.trim());if(cells.every(c=>/^:?-+:?$/.test(c)))continue;if(!inTable){close();html+='<div class="tw"><table><thead><tr>'+cells.map(c=>`<th>${inline(c)}</th>`).join('')+'</tr></thead><tbody>';inTable=true;continue;}html+='<tr>'+cells.map(c=>`<td>${inline(c)}</td>`).join('')+'</tr>';continue;}
    let m;
    if((m=l.match(/^(#{1,4})\s+(.*)/))){close();html+=`<h4>${inline(m[2])}</h4>`;continue;}
    if((m=l.match(/^\s*[-*]\s+(.*)/))){if(inList!=='ul'){close();html+='<ul>';inList='ul';}html+=`<li>${inline(m[1])}</li>`;continue;}
    if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){if(inList!=='ol'){close();html+='<ol>';inList='ol';}html+=`<li>${inline(m[1])}</li>`;continue;}
    if(!l.trim()){close();continue;}
    close();html+=`<p>${inline(l)}</p>`;}
  close();return html;
}
async function runAI(turns,outEl,tier='complex'){
  if(!SAMPLE)return null;
  const box=document.createElement('div');box.className='answer';box.innerHTML='<span class="spin"></span> <span class="muted small">L’ingegnere sta analizzando i dati…</span>';outEl.appendChild(box);
  try{const r=await SAMPLE(turns.map((t,i)=>i===0&&t.role==="user"?{...t,content:t.content+AI_LANG()}:t),{modelTier:tier,cache:false,onText:({text})=>{box.innerHTML=md(text);}});box.innerHTML=md(r.text);return r.text;}
  catch(e){if(e?.code==='not_granted')box.innerHTML='<div class="note">Serve il tuo consenso per usare l’assistente: riprova e accetta la richiesta.</div>';else if(e?.code==='rate_limited')box.innerHTML='<div class="note">Troppe richieste ravvicinate: aspetta un minuto e riprova.</div>';else{box.innerHTML=`<div class="note">Nessuna risposta (${esc(e?.message||e?.code||'errore')}). Riprova tra poco.</div>`;if(e?.text)box.innerHTML+=md(e.text);}return null;}
}
const PROBLEMS=['Sottosterzo in ingresso','Sottosterzo a centro curva','Sottosterzo in uscita','Sovrasterzo in ingresso','Sovrasterzo in uscita','Instabile in frenata','Bloccaggio ruote','Pattina in uscita','Poca velocità di punta','Tocca il fondo / saltella','Posteriori si surriscaldano','Anteriori si surriscaldano','Gomme fredde','Consumo gomme alto','Nervosa sui cordoli'];
let suTurns=[];
function setupPrompt(){
  const su=byId($('#suFile').value),S=active()?.S;
  const probs=$$('#suChips .pchip[aria-pressed="true"]').map(b=>b.dataset.label||b.textContent),txt=$('#suText').value.trim();
  const tele=DIAG&&S?`TELEMETRIA (${S.label}, pilota ${S.meta.driver}, auto ${S.meta.car||S.merged?.d.car||'n.d.'}):\n- `+DIAG.summary.join('\n- '):'Nessuna telemetria.';
  return `Sei un ingegnere di pista esperto di Le Mans Ultimate (simulatore, fisica rFactor 2). Aiuti un pilota sim racing a risolvere problemi di guida modificando il setup. Rispondi in italiano, concreto.

PROBLEMI RIFERITI: ${probs.length?probs.join(', '):'nessuno: individua tu i problemi principali dai dati'}
DESCRIZIONE: ${txt||'(nessuna)'}

SETUP ATTUALE (${su?su.name:'non caricato'}; dopo = il valore mostrato nel gioco, l'indice è il click):
${su?setupText(su):'Setup non disponibile: ragiona in termini generici.'}

${tele}

ISTRUZIONI:
1. Diagnosi breve (3-5 righe) che collega problemi e dati; di' se i dati confermano o no il problema, e se le condizioni pista (temperatura, bagnato) possono spiegarlo.
2. Tabella Markdown delle modifiche in ordine di priorità: Priorità | Parametro (nome del menu setup) | Da | A | Perché. Passi piccoli (1-2 click), massimo 5 modifiche, partendo dai valori del setup.
3. Cosa verificare nel prossimo run (curve e numeri da guardare).
4. Se telemetria e setup sembrano di auto diverse o mancano dati, dillo in una riga. Usa solo parametri presenti nel setup.`;
}
function cmpPrompt(){
  const {SA,SB,la,lb,rows,ga,gb}=cmpCur;const tot=gb.t[gb.n-1]-ga.t[ga.n-1];
  return `Sei un coach di guida per Le Mans Ultimate. Confronta due giri sulla stessa pista e spiega dove e come guadagnare tempo. Italiano, consigli pratici (punti di frenata, velocità minima, gas, marce). Niente premesse.

Pista: ${SA.meta.venue}. Giro A ${fmtLap(la.time)} (${SA.meta.driver||'A'}, pista ${fx(SA.cond.track?.avg,1)} °C, ${SA.cond.label}). Giro B ${fmtLap(lb.time)} (${SB.meta.driver||'B'}, pista ${fx(SB.cond.track?.avg,1)} °C, ${SB.cond.label}). Distacco B−A ${tot.toFixed(3)} s. Chi chiede aiuto guida il giro più lento (${tot>0?'B':'A'}).

Curva per curva (metri dal traguardo; lift = nessuna frenata; Δ = tempo B − A nel tratto):
${rows.map(r=>`T${r.k} [${r.dS.toFixed(0)}-${r.dE.toFixed(0)}m]: frenata A ${r.brake!=null?r.brake.toFixed(0):'lift'} / B ${r.brakeB!=null?r.brakeB.toFixed(0):'lift'}; vel.min A ${r.vMin.toFixed(0)} / B ${r.vMinB.toFixed(0)}; marcia A ${r.gear}; gas pieno A ${r.fullThr!=null?r.fullThr.toFixed(0):'-'} / B ${r.fullB!=null?r.fullB.toFixed(0):'-'}; tempo A ${r.tA.toFixed(2)} / B ${r.tB.toFixed(2)}; Δ ${r.dt>0?'+':''}${r.dt.toFixed(3)}`).join('\n')}

Formato: una riga con il guadagno potenziale; le 3-4 curve più importanti con cosa fa diversamente il giro veloce (numeri) e cosa provare; un'abitudine generale se emerge un pattern. Se le condizioni pista sono diverse, dillo.`;
}

// ================= BOOT =================
async function boot(){
  applyUI();applyColors();initSettings();
  lapChart=new Stack($('#lapChart'),{onCursor:i=>{lapMap.setCursorIdx(i);lapReadout(i);},onZoom:r=>lapMap.setWindow(r&&lapCur.g?[lapChart.idxOf(r[0]),lapChart.idxOf(r[1])]:null)});
  lapMap=new TrackMap($('#lapMap'),{onCursor:i=>{lapChart.setCursorIdx(i);lapReadout(i);}});
  cmpChart=new Stack($('#cmpChart'),{onCursor:i=>{cmpMap.setCursorIdx(i);cmpReadout(i);},onZoom:r=>cmpMap.setWindow(r&&cmpCur.ga?[cmpChart.idxOf(r[0]),cmpChart.idxOf(r[1])]:null)});
  cmpMap=new TrackMap($('#cmpMap'),{onCursor:i=>{cmpChart.setCursorIdx(i);cmpReadout(i);}});
  lapChannels=buildToolbar($('#lapTools'),lapChart,{channels:LAP_CH,key:'lap',onChange:()=>drawLapChart(false),expandPanel:$('#lapChartPanel')});
  cmpChannels=buildToolbar($('#cmpTools'),cmpChart,{channels:CMP_CH,key:'cmp',onChange:()=>drawCmpChart(false),expandPanel:$('#cmpChartPanel')});
  $$('.tab').forEach(t=>t.onclick=()=>showView(t.dataset.view));
  $('#btnLoad').onclick=()=>$('#fileIn').click();
  $('#btnSync').onclick=syncLMU;
  $('#btnFiles').onclick=()=>{const d=$('#drawer');d.hidden=!d.hidden;$('#btnFiles').setAttribute('aria-expanded',!d.hidden);};
  $('#fileIn').onchange=e=>{handleFiles([...e.target.files]);e.target.value='';};
  document.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('dragging');});
  document.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('dragging');});
  document.addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('dragging');handleFiles([...e.dataTransfer.files]);});
  $('#gSess').onchange=()=>{LS.set('sess',$('#gSess').value);renderHero();RENDER[curView()]();};
  $('#lapSel').onchange=RENDER.lap;$('#lapMapCh').onchange=RENDER.lap;
  ['#cmpSessA','#cmpLapA','#cmpSessB','#cmpLapB'].forEach(id=>$(id).onchange=RENDER.cmp);
  $('#swapAB').onclick=()=>{const a=[$('#cmpSessA').value,$('#cmpLapA').value],b=[$('#cmpSessB').value,$('#cmpLapB').value];$('#cmpSessA').value=b[0];$('#cmpSessB').value=a[0];$('#cmpLapA').dataset.sess='';$('#cmpLapB').dataset.sess='';RENDER.cmp();$('#cmpLapA').value=b[1];$('#cmpLapB').value=a[1];RENDER.cmp();};
  const initCol=()=>{$('#colA').value=toHex(tok('lapA'));$('#colB').value=toHex(tok('lapB'));};initCol();
  const setCol=()=>{LS.set('colors',{A:$('#colA').value,B:$('#colB').value});applyColors();if(cmpCur.ga){const r=cmpChart.range;RENDER.cmp();if(r)cmpChart.setRange(r[0],r[1]);}};
  $('#colA').oninput=setCol;$('#colB').oninput=setCol;
  $('#suFile').onchange=RENDER.setup;
  $('#coLap').onchange=RENDER.coach;$('#coRef').onchange=RENDER.coach;
  $('#diA').onchange=RENDER.diary;$('#diB').onchange=RENDER.diary;
  $('#vsRef').onclick=()=>{const S=active()?.S;if(!S)return;const o=refOptions(S);const r=pickRef(o[0]?.[0]||'');const me=bestValid(S);if(!r||!me)return;goCompare(r.S,r.lap,S,me);};
  [['#cfgPmin','pmin'],['#cfgPmax','pmax'],['#cfgIOmin','iomin'],['#cfgIOmax','iomax'],['#cfgBmax','bmax'],['#cfgRH','rh'],['#cfgTmin','tmin'],['#cfgTmax','tmax']].forEach(([id,k])=>$(id).onchange=e=>{cfg()[k]=e.target.value;saveCfg();lds().forEach(S=>{for(const key of [...S.cache.keys()])if(key.startsWith('st'))S.cache.delete(key);});RENDER.setup();});
  $$('[data-rot],[data-flip]').forEach(b=>b.onclick=()=>{const map=(b.dataset.rot||b.dataset.flip)==='lap'?lapMap:cmpMap;if(!map.venue)return;const v=getMapView(map.venue);if(b.dataset.rot)v.rot=(v.rot+1)%4;else v.flip=!v.flip;saveMapView(map.venue);lapMap.draw();cmpMap.draw();});
  $('#suChips').innerHTML=KB.map(p=>`<button type="button" class="pchip" data-k="${p.id}" aria-pressed="false">${esc(p.label)}</button>`).join('');
  $$('#suChips .pchip').forEach(b=>b.onclick=()=>{b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')!=='true');renderDoctor();});
  initStrategy();
  $('#suAsk').onclick=async()=>{suTurns=[{role:'user',content:setupPrompt()}];$('#suAnswer').innerHTML='';$('#suAsk').disabled=true;const t=await runAI(suTurns,$('#suAnswer'));$('#suAsk').disabled=false;if(t){suTurns.push({role:'assistant',content:t});$('#suFollowWrap').hidden=false;}};
  const follow=async()=>{const q=$('#suFollow').value.trim();if(!q||!suTurns.length)return;$('#suFollow').value='';const p=document.createElement('p');p.className='q';p.textContent=q;$('#suAnswer').appendChild(p);suTurns.push({role:'user',content:q});const t=await runAI(suTurns,$('#suAnswer'),'default');if(t)suTurns.push({role:'assistant',content:t});else suTurns.pop();};
  $('#suFollowBtn').onclick=follow;$('#suFollow').onkeydown=e=>{if(e.key==='Enter')follow();};
  $('#cmpAsk').onclick=async()=>{if(!cmpCur.ga)return;$('#cmpAnswer').innerHTML='';$('#cmpAsk').disabled=true;await runAI([{role:'user',content:cmpPrompt()}],$('#cmpAnswer'),'default');$('#cmpAsk').disabled=false;};
  const redraw=()=>{initCol();if(curView()==='lap'&&lapCur.g)RENDER.lap();else if(curView()==='cmp'&&cmpCur.ga)RENDER.cmp();else RENDER[curView()]();};
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',redraw);
  new MutationObserver(redraw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  initAI();
  await IDB.open();
  const SAMPLES=[['samples/imola_p1.ld.gz.b64.txt','Imola P1 (telemetria).ld.gz'],['samples/imola_p1.xml.txt','Imola P1 (risultati).xml'],['samples/fuji_q.ld.gz.b64.txt','GO V1.4.2 Cadillac Fuji Q.ld.gz'],['samples/fuji_r.svm','GO V1.4.2 Cadillac Fuji R.svm']];
  const saved=await IDB.all();
  await Promise.all(SAMPLES.map(async([u,n])=>{try{const r=await fetch(u);if(!r.ok)throw 0;let buf;if(u.endsWith('.b64.txt')){const s=atob((await r.text()).trim());const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);buf=a.buffer;}else buf=await r.arrayBuffer();await addFile(n,buf,{sample:true});}catch(e){console.warn('sample',u,e);}}));
  for(const s of saved){try{await addFile(s.name,s.buf);}catch(e){console.warn(e);}}
  store.items.sort((a,b)=>(a.sample?1:0)-(b.sample?1:0));
  relink();learnPitLoss();learnWet();renderLib();fillSelects();
  const want=LS.get('sess',null);if(want&&[...$('#gSess').options].some(o=>o.value===want))$('#gSess').value=want;
  let tab=LS.get('tab','stint');if(location.hash&&RENDER[location.hash.slice(1)])tab=location.hash.slice(1);
  showView(tab);
}
boot();
