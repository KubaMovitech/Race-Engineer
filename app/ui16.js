// ================= MURETTO 1.4: nomi auto, gomme viste dall'alto, stato pista/box, VE in classifica,
// strategie avversari, aggancio, setup dal gioco, debrief =================

// readable car names: "Cadillac V-Series.R · #35 · Team name" instead of "VLMDH Custom Team 2026 #397"
function carLabel(o){const veh=o.veh||'';const num=o.num||(veh.match(/#\s*(\d+)/)||[])[1]||'';
  const team=o.team&&!/custom team/i.test(o.team)&&o.team!==veh?o.team:'';
  let model=o.model||'';if(!model){model=veh.replace(/#\s*\d+.*$/,'').replace(/\bcustom team\b/i,'').replace(/\b20\d\d\b/,'').replace(/\s+/g,' ').trim();if(/^[A-Z0-9]{3,6}$/.test(model))model='';}
  return [model,num?'#'+num:'',team].filter(Boolean).join(' · ')||veh;}
(function(){const base=R;window.R=R=function(r){const o=base(r);o.model=r[46]||'';o.team=r[47]||'';o.num=r[48]||'';o.label=carLabel(o);return o;};})();

// tyres seen from above: a small car with the four compounds
function tyreCar(comp,big){if(!comp)return '';const c=[...comp];const col=k=>COMP_COL[k]||COMP_COL['?'];const w=big?54:22,h=big?80:32;
  const t=(x,y,k)=>`<rect x="${x}" y="${y}" width="${big?12:6}" height="${big?20:9}" rx="${big?3:1.5}" fill="${col(k)}"/>${big?`<text x="${x+6}" y="${y+14}" text-anchor="middle" font-size="10" font-weight="700" fill="${COMP_INK(k)}">${k}</text>`:''}`;
  const P=big?{fl:[2,8],fr:[40,8],rl:[2,52],rr:[40,52]}:{fl:[1,3],fr:[15,3],rl:[1,20],rr:[15,20]};
  return `<svg class="tycar${big?' big':''}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(c.map(k=>COMP_N[k]||k).join(', '))}">
    <rect x="${big?11:5}" y="${big?2:1}" width="${big?32:12}" height="${big?76:30}" rx="${big?10:4}" fill="var(--panel2)" stroke="var(--line)"/>${big?`<rect x="18" y="26" width="18" height="22" rx="4" fill="var(--grid)"/>`:''}
    ${t(...P.fl,c[0])}${t(...P.fr,c[1])}${t(...P.rl,c[2])}${t(...P.rr,c[3])}</svg>`;}
window.compHTML=compHTML=function(comp,cf,cr){if(!comp)return cf||cr?`<span class="muted small">${esc([cf,cr].filter(Boolean).join('/'))}</span>`:'—';
  const mixed=new Set(comp).size>1;const name=mixed?[...comp].map(k=>k).join(''):(COMP_N[comp[0]]||comp[0]);
  return `<span class="tyc${mixed?' mixed':''}" title="${esc([...comp].map((c,i)=>['Ant. sx','Ant. dx','Post. sx','Post. dx'][i]+': '+(COMP_N[c]||c)).join(' · '))}">${tyreCar(comp)}<small>${esc(name)}</small></span>`;};

// on track / in the pits, at a glance
function statusChip(r){if(r.fin===1)return '<span class="st st-fin">🏁</span>';if(r.fin===2)return '<span class="st st-out">DNF</span>';if(r.fin===3)return '<span class="st st-out">DQ</span>';
  if(r.gar)return `<span class="st st-gar">${tr('GARAGE')}</span>`;
  if(r.inPit){const k=r.pitSt===3?tr('FERMO'):r.pitSt===4?tr('USCITA'):r.pitSt===2?tr('ENTRA'):tr('BOX');return `<span class="st st-box">${k}</span>`;}
  return `<span class="st st-on">${tr('PISTA')}</span>`;}
function bigStatus(stt,c,me){let k='off',t=tr('NON IN PISTA');if(me&&me.gar){k='gar';t=tr('IN GARAGE');}else if((c&&c.pit)||(me&&me.inPit)){k='box';t=me&&me.pitSt===3?tr('AI BOX · FERMO'):tr('AI BOX');}else if(stt.live||me){k='on';t=tr('IN PISTA');}
  return `<span class="bigst ${k}"><i></i>${t}</span>`;}
// energy first: virtual energy (or fuel for cars without it), always visible
function veCell(r){if(r.ve>=0){const p=Math.max(0,Math.min(1,r.ve));return `<span class="vebar${p<0.12?' low':''}" title="${esc(tr('Energia virtuale'))}"><i style="width:${p*100}%"></i><b>${Math.round(p*100)}%</b></span>${r.fuel>=0?`<small class="muted vefuel">${tr('benz.')} ${Math.round(r.fuel*100)}%</small>`:''}`;}
  if(r.fuel>=0){const p=Math.max(0,Math.min(1,r.fuel));return `<span class="vebar fuel${p<0.12?' low':''}" title="${esc(tr('Carburante'))}"><i style="width:${p*100}%"></i><b>${Math.round(p*100)}%</b></span><small class="muted vefuel">${tr('benzina')}</small>`;}
  return `<span class="muted" title="${esc(tr('Il gioco non manda questo dato per questa auto'))}">?</span>`;}

// when we catch the car ahead, or the car behind catches us, at the current pace
function ovtText(rel,theirPace,ourPace,me,rows){if(!Number.isFinite(rel)||!(theirPace>0)||!(ourPace>0))return '—';const fl=finishLaps(rows,me,LIVE.sc);
  if(rel>0){const close=theirPace-ourPace;if(close<0.05)return `<span class="muted">${tr('non lo prendi')}</span>`;const n=Math.ceil(rel/close);const lap=me.laps+n;
    return Number.isFinite(fl)&&n>fl?`<span class="muted">${tr('dopo la bandiera')}</span>`:`<span class="pos">${tr('giro')} ${lap}</span> <small class="muted">(${n})</small>`;}
  const close=ourPace-theirPace;if(close<0.05)return `<span class="muted">${tr('non ti prende')}</span>`;const n=Math.ceil(-rel/close);
  return Number.isFinite(fl)&&n>fl?`<span class="muted">${tr('dopo la bandiera')}</span>`:`<span class="neg">${tr('ti prende al giro')} ${me.laps+n}</span>`;}

// everyone's strategy, from what each car actually did
function lvStratAll(x){const {rows,kind,names,I}=x;const el=$('#lvStrat');if(!el)return;
  const list=rows.filter(r=>!LIVE.cls||r.cls===LIVE.cls).sort((a,b)=>a.pos-b.pos);if(!list.length){el.innerHTML=`<div class="muted small">${tr('In attesa dei dati…')}</div>`;return;}
  el.innerHTML=`<table><thead><tr><th>Pos</th><th class="l">Pilota</th><th>Stato</th><th>Soste</th><th class="l">Stint (giri)</th><th>Fermo medio</th><th>Corsia</th><th>Gomme cambiate</th><th>Cambi pilota</th><th>VE/giro</th><th>Benz./giro</th><th>Box stimato</th><th>Soste ancora</th></tr></thead><tbody>${list.map(r=>{
    const s=carStats(r.veh,r);const P=s.pits.filter(p=>!p.garage);const stints=[];let prev=0;P.forEach(p=>{stints.push(p.lap-prev);prev=p.lap;});stints.push(Math.max(0,r.laps-prev));
    const tyreStops=P.filter(p=>p.tyres>0);const lastT=tyreStops[tyreStops.length-1];
    const stintLen=Number.isFinite(s.vpl)&&s.vpl>0?Math.floor(1/s.vpl):Number.isFinite(s.fpl)&&s.fpl>0?Math.floor(1/s.fpl):NaN;
    const toGo=kind==='race'?finishLaps(rows,r,LIVE.sc):NaN;const more=Number.isFinite(toGo)&&Number.isFinite(s.left)&&Number.isFinite(stintLen)&&stintLen>0?(s.left>=toGo?0:Math.ceil((toGo-s.left)/stintLen)):NaN;
    return `<tr class="${names.includes(r.veh)?'ours':''}${r.inPit||r.gar?' inpit':''}" data-car="${esc(r.veh)}"><td>${r.pos}</td><td class="l">${esc(r.drv)}<div class="muted small">${esc(r.label)}</div></td><td>${statusChip(r)}</td><td>${r.pits}</td>
      <td class="l mono">${stints.map((n,i)=>`<span class="${i===stints.length-1?'cur':''}">${n}</span>`).join(' · ')}</td><td>${P.length?fx(avg_(P.map(p=>p.stop)),1)+' s':'—'}</td><td>${P.length?fx(avg_(P.map(p=>p.lane-p.stop)),1)+' s':'—'}</td>
      <td>${tyreStops.length?`${tyreStops.length}/${P.length}${lastT?' · '+compHTML(lastT.c1):''}`:P.length?tr('mai'):'—'}</td><td>${s.swaps.length||'—'}</td>
      <td>${Number.isFinite(s.vpl)?fx(s.vpl*100,2)+'%':'—'}</td><td>${Number.isFinite(s.fpl)?fx(s.fpl*100,1)+'%':'—'}</td><td>${Number.isFinite(s.nextPit)?tr('giro')+' '+s.nextPit:'—'}</td><td>${Number.isFinite(more)?more:'—'}</td></tr>`;}).join('')}</tbody></table>
    <p class="muted small" style="margin:6px 0 0">${tr('Fermo = secondi da fermo nella piazzola; corsia = tempo passato nella pit lane in movimento. Gomme cambiate: quante soste con cambio gomme e ultima mescola montata. Le stime usano i consumi giro per giro di ogni auto.')}</p>`;}

// ---------- setup from the game ----------
const SETUP_IT={FRONT_WING:'Ala anteriore',REAR_WING:'Ala posteriore',BRAKE_BALANCE:'Ripartizione frenata',BRAKE_BIAS:'Ripartizione frenata',BRAKE_PRESSURE:'Pressione freni',BRAKE_MIGRATION:'Migrazione freno',
  TRACTION_CONTROL:'Controllo trazione',TRACTIONCONTROLMAP:'Mappa TC',TC_POWER_CUT:'TC taglio',TC_SLIP:'TC slip',ABS:'ABS',ANTILOCKBRAKESYSTEMMAP:'ABS',FRONT_ANTISWAY:'Barra ant.',REAR_ANTISWAY:'Barra post.',
  STEER_LOCK:'Angolo sterzo',RADIATOR:'Radiatore',RADIATOR_WATER:'Radiatore acqua',RADIATOR_OIL:'Radiatore olio',BRAKE_DUCTS:'Prese freni',FRONT_BRAKE_DUCT:'Presa freno ant.',REAR_BRAKE_DUCT:'Presa freno post.',
  FINAL_DRIVE:'Rapporto finale',GEAR_RATIOS:'Rapporti',DIFF_POWER:'Differenziale trazione',DIFF_COAST:'Differenziale rilascio',DIFF_PRELOAD:'Precarico differenziale',ENGINE_MIXTURE:'Miscela',REGEN:'Rigenerazione',
  FUEL:'Carburante',VIRTUAL_ENERGY:'Energia virtuale',FUEL_RATIO:'Ratio carburante'};
const SETUP_POS=[['FL','ant. sx'],['FR','ant. dx'],['RL','post. sx'],['RR','post. dx'],['FRONT','ant.'],['REAR','post.'],['LEFT','sx'],['RIGHT','dx']];
const SETUP_W={TIRE_PRESSURE:'Pressione',PRESSURE:'Pressione',CAMBER:'Campanatura',TOE:'Convergenza',RIDE_HEIGHT:'Altezza',SPRING:'Molla',SLOW_BUMP:'Bump lento',FAST_BUMP:'Bump veloce',SLOW_REBOUND:'Rebound lento',FAST_REBOUND:'Rebound veloce',PACKER:'Packer',THIRD:'3° elemento',TIRE:'Gomma',COMPOUND:'Mescola',WING:'Ala',ANTISWAY:'Barra'};
function setupName(k){const raw=k.replace(/^VM_/,'');if(SETUP_IT[raw])return tr(SETUP_IT[raw]);let pos='',rest=raw;
  for(const [a,b] of SETUP_POS){const re=new RegExp('(^|_)'+a+'(_|$)');if(re.test(rest)){pos=b;rest=rest.replace(re,'$1').replace(/^_|_$/g,'');break;}}
  for(const [a,b] of Object.entries(SETUP_W))if(rest===a||rest.endsWith(a)){return tr(b+(pos?' '+pos:''));}
  const t=rest.toLowerCase().replace(/_/g,' ');return (t.charAt(0).toUpperCase()+t.slice(1))+(pos?' '+tr(pos):'');}
const SETUP_LOG=[];
function setupDiff(id,prev,d){const ch=[];Object.entries(d.v).forEach(([k,v])=>{if(k in prev&&String(prev[k])!==String(v))ch.push({k,from:prev[k],to:v});});if(!ch.length)return;
  SETUP_LOG.unshift({at:Date.now(),et:LIVE.L.sc?.i?.et,car:d.car,drv:d.drv,ch});if(SETUP_LOG.length>40)SETUP_LOG.pop();
  let box=$('#lvToasts');if(!box){box=document.createElement('div');box.id='lvToasts';document.body.appendChild(box);}
  const el=document.createElement('div');el.className='lvtoast warn';el.innerHTML=`<b>${tr('Setup cambiato')}</b><div>${esc(d.drv||'')}: ${ch.slice(0,4).map(c=>`${esc(setupName(c.k))} ${esc(String(c.from))} → <b>${esc(String(c.to))}</b>`).join(' · ')}</div>`;box.prepend(el);setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400);},9000);}
function lvSetupPanel(x){const el=$('#lvSetup');if(!el)return;const {stt}=x;const D=(stt.Ds||[]).filter(D=>D.setup).sort((a,b)=>(b.setupAt||0)-(a.setupAt||0))[0];const st=D?.setup;
  if(!st||!st.v){el.innerHTML=`<div class="muted small">${tr('Appare con il bridge 1.4 quando il pilota è in pista: è il setup letto dal garage del gioco.')}</div>`;return;}
  $('#lvSetupT').textContent=`${tr('dal garage di LMU')}${st.drv?' · '+st.drv:''}`;
  const log=SETUP_LOG.filter(l=>l.car===st.car);const changed=new Set(log.flatMap(l=>l.ch.map(c=>c.k)));
  const entries=Object.entries(st.v).sort((a,b)=>setupName(a[0]).localeCompare(setupName(b[0])));
  el.innerHTML=`<div class="setupgrid">${entries.map(([k,v])=>`<div class="${changed.has(k)?'chg':''}"><span>${esc(setupName(k))}</span><b>${esc(String(v))}</b></div>`).join('')}</div>
    ${log.length?`<h4 style="margin:12px 0 6px">${tr('Modifiche durante la sessione')}</h4>${log.slice(0,10).map(l=>`<div class="lve warn"><span class="t">${hms(l.et)}</span><span>${esc(l.drv||'')}: ${l.ch.map(c=>`${esc(setupName(c.k))} ${esc(String(c.from))} → <b>${esc(String(c.to))}</b>`).join(' · ')}</span></div>`).join('')}`:''}`;}
(function(){const base=lvCar;window.lvCar=lvCar=function(x){base(x);try{lvSetupPanel(x);}catch(e){console.error(e);}};})();

// game strategy data, in readable units
window.lvGame=lvGame=function(x){const {stt}=x;const Dp=(stt.Ds||[]).filter(D=>D.pit).sort((a,b)=>(b.pitAt||0)-(a.pitAt||0))[0];const g=Dp?.pit?.game||LIVE.rec?.pitRec?.game;
  if(!g||!Object.keys(g).length){$('#lvGame').innerHTML=`<div class="muted small">${tr('Appare con il bridge 1.3 quando il pilota è in pista.')}</div>`;return;}
  const v=k=>{const e=Object.entries(g).find(([kk])=>kk.toLowerCase().endsWith('.'+k.toLowerCase()));return e?e[1]:undefined;};const pct=(a,b)=>Number.isFinite(a)&&b>0?a/b*100:NaN;
  const fuel=v('currentFuel'),fmax=v('maxFuel'),ve=v('currentVirtualEnergy'),vmax=v('maxVirtualEnergy'),bat=v('currentBattery'),bmax=v('maxBattery');
  const tiles=[];if(Number.isFinite(ve)&&vmax>0)tiles.push(liveTile('Energia virtuale',fx(pct(ve,vmax),1)+' %',`${tr('del massimo consentito')}`));
  if(Number.isFinite(fuel))tiles.push(liveTile('Carburante',fx(fuel,1)+' L',fmax>0?`${tr('serbatoio')} ${fx(fmax,0)} L · ${fx(pct(fuel,fmax),0)}%`:''));
  if(Number.isFinite(bat)&&bmax>0)tiles.push(liveTile('Batteria ibrida',fx(pct(bat,bmax),1)+' %',`${fx(bat/3.6e6,2)} / ${fx(bmax/3.6e6,2)} kWh`));
  const known=['currentfuel','maxfuel','currentvirtualenergy','maxvirtualenergy','currentbattery','maxbattery'];
  const other=Object.entries(g).filter(([k])=>!known.includes(k.split('.').pop().toLowerCase()));
  const nice=k=>{const p=k.split('.').filter(z=>!/^\d+$/.test(z));const key=p[p.length-1]||k;return tr(GAME_N[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase()));};
  $('#lvGame').innerHTML=(tiles.length?`<div class="kpis">${tiles.join('')}</div>`:'')+(other.length?`<div class="grid3g" style="margin-top:10px">${other.slice(0,30).map(([k,val])=>`<div class="lvrow"><span>${esc(nice(k))}</span><b>${esc(typeof val==='number'?String(Math.round(val*100)/100):String(val))}</b></div>`).join('')}</div>`:'');};

// ---------- debrief ----------
function debriefData(){const x={sc:LIVE.sc,I:LIVE.sc?.i||{},rows:liveRows(LIVE.sc)};const me=x.rows.find(r=>r.veh===LIVE.focus);const stt=liveCarState(LIVE.focus);const L=stt.laps;const kind=sesKind(x.I);
  const out={kind,me,stt,items:[]};if(!me&&!L.length)return out;const it=(k,t,v)=>out.items.push({k,t,v});
  const clean=L.filter(l=>!l.pit&&!l.inv&&l.t>0&&l.n>1);const best=Math.min(...clean.map(l=>l.t));const pace=med_(clean.filter(l=>l.t<=best*1.05).map(l=>l.t));const sd=sd_(clean.filter(l=>l.t<=best*1.05).map(l=>l.t));
  // result
  if(me){const ch=me.qual>0?me.qual-me.pos:0;it('good',tr('Risultato'),`P${me.pic} ${tr('di classe')} (P${me.pos} ${tr('assoluto')})${ch?` · ${ch>0?tr('guadagnate'):tr('perse')} ${Math.abs(ch)} ${tr('posizioni dalla griglia')}`:''}`);}
  // pace vs class
  const cls=x.rows.filter(r=>me&&r.cls===me.cls);const paces=cls.map(r=>({r,p:carStats(r.veh,r).paceAll})).filter(o=>Number.isFinite(o.p)).sort((a,b)=>a.p-b.p);
  if(Number.isFinite(pace)){const top=paces.slice(0,3).map(o=>o.p);const d=pace-avg_(top);it(d>0.5?'bad':d>0.2?'warn':'good',tr('Passo'),`${fmtLap(pace)} (±${fx(sd,2)} s) · ${d>0?'+':''}${fx(d,2)} s ${tr('a giro dai primi 3 della classe')}${paces.length?` · ${tr('il più veloce')} ${esc(paces[0].r.drv)} ${fmtLap(paces[0].p)}`:''}`);}
  // stints & degradation
  const st=[];let cur=null;L.forEach(l=>{if(!cur||(l.pit&&cur.laps.length&&!cur.laps[cur.laps.length-1].pit)){cur={laps:[]};st.push(cur);}cur.laps.push(l);});
  st.forEach((s,i)=>{const c=s.laps.filter(l=>!l.pit&&!l.inv&&l.t>0);if(c.length<4)return;const b=Math.min(...c.map(l=>l.t));const g=c.filter(l=>l.t<=b*1.05);const xs=g.map((_,j)=>j),ys=g.map(l=>l.t);const mx=avg_(xs),my=avg_(ys);const sl=xs.reduce((a,v,j)=>a+(v-mx)*(ys[j]-my),0)/xs.reduce((a,v)=>a+(v-mx)**2,0);
    it(sl>0.08?'warn':'info',`${tr('Stint')} ${i+1}`,`${s.laps.length} ${tr('giri')} · ${tr('passo')} ${fmtLap(med_(ys))} · ${tr('degrado')} ${sl>0?'+':''}${fx(sl,3)} s/${tr('giro')}${sl>0.08?' · '+tr('le gomme calano: controlla pressioni e temperature'):''}`);});
  // pit stops vs field
  const ours=liveLapsLoss(stt);const fieldStops=Object.values(LIVE.field?.cars||{}).flatMap(c=>(c.pits||[]).filter(p=>!p.garage&&p.stop>0));
  if(ours.length&&fieldStops.length){const our=avg_(ours.map(o=>o.stop).filter(Number.isFinite));const fm=med_(fieldStops.map(p=>p.stop));if(Number.isFinite(our))it(our>fm+2?'warn':'good',tr('Soste'),`${ours.length} · ${tr('fermo in media')} ${fx(our,1)} s ${tr('contro')} ${fx(fm,1)} s ${tr('della mediana degli avversari')}`);}
  // consumption
  const fu=med_(clean.map(l=>l.fuel).filter(v=>v>0)),vv=med_(clean.map(l=>l.ve).filter(v=>v>0)),co=avg_(clean.map(l=>l.coast).filter(Number.isFinite));
  if(Number.isFinite(fu))it('info',tr('Consumi'),`${fx(fu,2)} L/${tr('giro')}${Number.isFinite(vv)?` · ${fx(vv*100,2)}% VE/${tr('giro')} · ratio ${fx(fu/(vv*100),2)}`:''}${Number.isFinite(co)?` · ${fx(co,1)} s ${tr('senza pedali a giro')}`:''}`);
  // incidents & limits
  const drvs=new Set([...(stt.Ds||[]).map(D=>D.hi?.name).filter(Boolean),me?.drv].filter(Boolean));const S=(LIVE.field?.stream||[]).filter(e=>drvs.has(e.drv)||drvs.has(e.other));
  const hits=S.filter(e=>e.tag==='Incident').length,tl=S.filter(e=>e.tag==='TrackLimits'&&/Invalid|Warning|Penalty/i.test(e.txt)).length,pen=S.filter(e=>e.tag==='Penalty'&&/received/.test(e.txt)).length,inv=L.filter(l=>l.inv).length;
  it(hits+pen>2||inv>3?'bad':hits+tl+inv?'warn':'good',tr('Pulizia'),`${hits} ${tr('contatti')} · ${inv} ${tr('giri invalidati')} · ${tl} ${tr('avvisi limiti')} · ${pen} ${tr('penalità')}`);
  // wet vs dry
  const wet=clean.filter(l=>l.rain>0.1),dry=clean.filter(l=>!(l.rain>0.1));if(wet.length>=2&&dry.length>=2)it('info',tr('Pioggia'),`${tr('passo sul bagnato')} ${fmtLap(med_(wet.map(l=>l.t)))} ${tr('contro')} ${fmtLap(med_(dry.map(l=>l.t)))} ${tr('sull\'asciutto')}`);
  out.pace=pace;out.best=best;return out;}
function openDebrief(){let m=$('#mDeb');if(!m){m=document.createElement('div');m.className='modal';m.id='mDeb';m.hidden=true;m.innerHTML=`<div class="mbox wide"><div class="panel-h"><h2>${tr('Debrief')}</h2><button class="btn primary" type="button" id="debAI">${tr('Chiedi all\'AI')}</button><button class="btn" type="button" data-close>${tr('Chiudi')}</button></div><div id="debB"></div><div id="debAns"></div></div>`;document.body.appendChild(m);}
  const D=debriefData();const k={good:'good',warn:'warn',bad:'bad',info:'info'};
  $('#debB').innerHTML=D.items.length?`<p class="muted small">${tr('Calcolato dai dati ricevuti in questa sessione')} (${esc(SESN(LIVE.sc?.i?.ses))} · ${esc(LIVE.sc?.i?.trk||'')}).</p>${D.items.map(i=>`<div class="debit ${k[i.k]}"><b>${esc(i.t)}</b><span>${i.v}</span></div>`).join('')}`:`<div class="muted">${tr('Servono dati di una sessione: apri il Muretto durante una sessione o carica una registrazione.')}</div>`;
  $('#debAns').innerHTML='';const ai=$('#debAI');ai.hidden=!SAMPLE||!D.items.length;
  ai.onclick=async()=>{ai.disabled=true;$('#debAns').innerHTML='';const txt=D.items.map(i=>`- ${i.t}: ${i.v.replace(/<[^>]+>/g,'')}`).join('\n');
    const prompt=`Sei l'ingegnere di pista di una squadra di Le Mans Ultimate. Scrivi il debrief della sessione (${SESN(LIVE.sc?.i?.ses)} a ${LIVE.sc?.i?.trk||''}) per il pilota e la squadra. Rispondi in italiano, conciso e pratico.\n\nDati:\n${txt}\n\nFormato: 3 punti su cosa è andato bene, 3 su dove si è perso tempo (con i numeri), e le 3 cose da fare nella prossima sessione (guida, setup o strategia). Niente premesse.`;
    await runAI([{role:'user',content:prompt}],$('#debAns'),'default');ai.disabled=false;};
  openModal('#mDeb');}
