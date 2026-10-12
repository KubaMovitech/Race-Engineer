// ================= MURETTO: ARRIVO PREVISTO, TRAFFICO, DANNI E FRENI, LUCE E OROLOGIO =================

// ---------- predicted finish of our class: laps at the flag and stops still to make ----------
function pitLossVenue(I){const v=LS.get('pitloss:'+(I?.trk||''),null);return v?.loss>10?v.loss:30;}
function predictFinish(rows,me,I){const LD=I.lapDist;if(!me||!(LD>0))return null;const lapsRace=I.maxLaps>0&&I.maxLaps<99999;const T=I.rem;if(!lapsRace&&!(T>0))return null;
  const loss=pitLossVenue(I);
  const out=rows.filter(r=>r.cls===me.cls&&r.fin===0).map(r=>{const s=carStats(r.veh,r);const p=s.pace5||r.estL;if(!(p>0))return null;const prog=r.laps+(r.ld||0)/LD;
    const inTank=Math.min(r.fuel>=0&&s.fpl>0?r.fuel/s.fpl:Infinity,r.ve>=0&&s.vpl>0?r.ve/s.vpl:Infinity),full=Math.min(s.fpl>0?1/s.fpl:Infinity,s.vpl>0?1/s.vpl:Infinity);
    const toEnd=lapsRace?I.maxLaps-prog:T/p;const extra=toEnd-inTank;const stops=!Number.isFinite(inTank)?NaN:extra>0?Math.ceil(extra/(Number.isFinite(full)?full:inTank||1)):0;
    const st=Number.isFinite(stops)?stops:0;
    return {r,p,prog,inTank,stops,margin:inTank-toEnd,flag:lapsRace?NaN:prog+(T-st*loss)/p,time:lapsRace?(I.maxLaps-prog)*p+st*loss:NaN};}).filter(Boolean);
  out.sort((a,b)=>lapsRace?a.time-b.time:b.flag-a.flag);out.forEach((o,i)=>o.pred=i+1);return {list:out,lapsRace,loss};}
function lvFinishPanel(x){const el=$('#lvFin');if(!el)return;const P=predictFinish(x.rows,x.me,x.I);
  if(!P||!P.list.length){el.innerHTML=`<div class="muted small">${tr('In gara, con la classifica e qualche giro fatto da ogni auto.')}</div>`;return;}
  const rows=[...P.list].sort((a,b)=>a.pred-b.pred).map(o=>{const r=o.r,ch=r.pic-o.pred;
    return `<tr class="${r===x.me?'ours':''}" data-car="${esc(r.veh)}"><td>P${o.pred}</td><td>${ch?`<span class="${ch>0?'pos':'neg'}">${ch>0?'▲':'▼'}${Math.abs(ch)}</span>`:'—'}</td><td class="l">${esc(r.drv)}<div class="muted small">P${r.pic} ${tr('ora')}</div></td>
      <td>${P.lapsRace?hms(o.time):fx(o.flag,1)}</td><td>${fmtLap(o.p)}</td><td>${Number.isFinite(o.stops)?o.stops:'—'}</td>
      <td>${!Number.isFinite(o.margin)?'—':o.margin>=0?`<span class="pos">${tr('arriva')} +${fx(o.margin,1)} ${tr('giri')}</span>`:`${fx(o.inTank,1)} ${tr('giri nel serbatoio')}`}</td></tr>`;}).join('');
  el.innerHTML=`<div class="tw"><table class="lbt"><thead><tr><th>${tr('Previsto')}</th><th></th><th class="l">${tr('Pilota')}</th><th>${P.lapsRace?tr('Tempo alla fine'):tr('Giri alla bandiera')}</th><th>${tr('Passo')}</th><th>${tr('Soste ancora')}</th><th>${tr('Benzina / energia')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted small" style="margin:8px 0 0">${tr('Con il passo degli ultimi 5 giri, i consumi di ogni auto e')} ${fx(P.loss,0)} s ${tr('persi a sosta (dalla pista, o 30 s). Una sosta in meno di un rivale vale circa una posizione: guarda la colonna Soste ancora.')}</p>`;}

// ---------- traffic: faster classes closing from behind, slower ones ahead ----------
const CLS_RANK=c=>/hyper|lmh|lmdh/i.test(c)?5:/lmp2/i.test(c)?4:/lmp3/i.test(c)?3:/gte/i.test(c)?2:/gt3/i.test(c)?1:0;
function trafficList(rows,me,I){const LD=I.lapDist;if(!me||!(LD>0))return null;const lt=carStats(me.veh,me).pace5||me.estL||100;const mr=CLS_RANK(me.cls);const now=Date.now();const P=LIVE.trafPrev||(LIVE.trafPrev={});
  const L=rows.filter(r=>r!==me&&!r.gar&&!r.inPit&&r.fin===0&&CLS_RANK(r.cls)!==mr).map(r=>{const d=((r.ld-me.ld)%LD+LD*1.5)%LD-LD/2;const t=d/LD*lt;
    const pv=P[r.veh];let rate=NaN;if(pv&&now-pv.at>1500&&now-pv.at<10000)rate=(Math.abs(pv.t)-Math.abs(t))/((now-pv.at)/1000);if(!pv||now-pv.at>=1500)P[r.veh]={t,at:now};
    return {r,t,faster:CLS_RANK(r.cls)>mr,rate};}).filter(o=>o.faster?o.t<0&&o.t>-15:o.t>0&&o.t<15);
  return {behind:L.filter(o=>o.faster).sort((a,b)=>b.t-a.t),ahead:L.filter(o=>!o.faster).sort((a,b)=>a.t-b.t)};}
function lvTrafficPanel(x){const el=$('#lvTraf');if(!el)return;const T=trafficList(x.rows,x.me,x.I);if(!T){el.innerHTML=`<div class="muted small">${tr('Servono la classifica e la nostra auto in pista.')}</div>`;return;}
  const row=o=>{const eta=o.rate>0.05?Math.abs(o.t)/o.rate:NaN;return `<div class="lvrow" data-car="${esc(o.r.veh)}"><span><span class="clsdot" style="background:${LV_CLS(o.r.cls)}"></span> ${esc(o.r.drv)} <span class="muted small">${esc(o.r.cls)}</span></span><b class="${Math.abs(o.t)<3?'neg':''}">${fx(Math.abs(o.t),1)} s${Number.isFinite(eta)&&eta<60?` <small class="muted">· ${tr('tra')} ${Math.round(eta)} s</small>`:''}</b></div>`;};
  el.innerHTML=`<div class="grid2" style="gap:14px"><div><h4>${tr('Più veloci dietro di noi')}</h4>${T.behind.map(row).join('')||`<div class="muted small">${tr('Nessuno entro 15 s.')}</div>`}</div>
    <div><h4>${tr('Più lenti davanti a noi')}</h4>${T.ahead.map(row).join('')||`<div class="muted small">${tr('Nessuno entro 15 s.')}</div>`}</div></div>`;}

// ---------- damage and brakes (from the game's pit menu data): integrity and laps the brakes still last ----------
function brakeLife(c,w){const me=LIVE.focus;const H=LIVE.brkH&&LIVE.brkH.car===me?LIVE.brkH:(LIVE.brkH={car:me,l:[]});const n=c?.lap;
  if(w?.brakes&&Number.isFinite(n)&&(!H.l.length||H.l[H.l.length-1].n!==n)){const prev=H.l[H.l.length-1];if(prev&&w.brakes.some((b,i)=>b<prev.b[i]-0.02))H.l.length=0;H.l.push({n,b:[...w.brakes]});if(H.l.length>30)H.l.shift();}
  if(H.l.length<3)return null;const a=H.l[0],z=H.l[H.l.length-1];const dl=z.n-a.n;if(dl<2)return null;
  return w.brakes.map((b,i)=>{const r=(z.b[i]-a.b[i])/dl;return {used:b,rate:r,laps:r>0?(0.9-b)/r:Infinity};});}
function gwDamage(stt,c){const Dp=(stt.Ds||[]).filter(D=>D.pit).sort((a,b)=>(b.pitAt||0)-(a.pitAt||0))[0];const p=Dp?.pit;const w=p?.wear;if(!w)return '';
  const B=brakeLife(c,w);const pc=v=>Number.isFinite(v)?Math.round(v*100)+'%':'—';const col=v=>v>0.5?'neg':v>0.2?'warn':'';
  const rep=p?.est?.damage;
  return `<div class="gwbox"><div class="gwh">${tr('Danni e freni')}<span>${rep>0?`${tr('riparazione')} ${fx(rep,1)} s`:''}</span></div>
    ${Number.isFinite(w.aero)?`<div class="gwrow"><span>${tr('Aerodinamica')}</span><b class="${w.aero>0.02?'neg':''}">${w.aero>0.005?tr('danno')+' '+pc(w.aero):tr('integra')}</b></div>`:''}
    ${w.suspension?`<div class="gwrow"><span>${tr('Sospensioni')}</span><b>${w.suspension.map((v,i)=>`<span class="${v>0.02?'neg':''}" title="${esc(tr(WN[i]))}">${pc(v)}</span>`).join(' · ')}</b></div>`:''}
    ${w.brakes?`<table class="gwtab"><thead><tr><th>${tr('Freni')}</th><th>${tr('Usati')}</th><th>${tr('Per giro')}</th><th>${tr('Giri al 90%')}</th></tr></thead><tbody>${w.brakes.map((b,i)=>`<tr><td>${tr(WN[i])}</td><td class="${col(b)}">${pc(b)}</td><td>${B&&B[i].rate>0?fx(B[i].rate*100,2)+'%':'—'}</td><td class="${B&&B[i].laps<20?'neg':''}">${B&&B[i].rate>0?Math.max(0,Math.floor(B[i].laps)):'—'}</td></tr>`).join('')}</tbody></table>`:''}
    ${B?'':`<p class="muted small" style="margin:6px 0 0">${tr('I giri che durano i freni compaiono dopo 3 giri.')}</p>`}</div>`;}

// ---------- track clock: in-game time, time scale, sunset / sunrise ----------
// typical event date and place for the LMU tracks (sun times are an estimate from date and coordinates)
const TRACK_SUN=[[/sarthe|le ?mans/i,47.95,0.22,2,165],[/spa/i,50.44,5.97,2,130],[/monza/i,45.62,9.28,2,194],[/imola|enzo/i,44.34,11.71,2,110],[/fuji/i,35.37,138.93,9,271],[/bahrain|sakhir/i,26.03,50.51,3,306],
  [/sebring/i,27.45,-81.35,-4,74],[/portim|algarve/i,37.23,-8.63,1,103],[/americas|cota|austin/i,30.13,-97.64,-5,244],[/interlagos|paulo|pace/i,-23.70,-46.70,-3,194],[/qatar|lusail|losail/i,25.49,51.45,3,59],[/silverstone/i,52.07,-1.02,1,190],[/ricard|castellet/i,43.25,5.79,2,100]];
function sunTimes(lat,lon,tz,doy){const r=Math.PI/180,g=2*Math.PI/365*(doy-1);const eqt=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const ha=Math.acos(Math.cos(90.833*r)/(Math.cos(lat*r)*Math.cos(dec))-Math.tan(lat*r)*Math.tan(dec))/r;
  const m=v=>((v+tz*60)%1440+1440)%1440;return {rise:m(720-4*(lon+ha)-eqt),set:m(720-4*(lon-ha)-eqt)};}
// how fast the in-game clock runs: in-game seconds per real second, from the time of day against the session time
function timeScale(I){const H=LIVE.todH||(LIVE.todH=[]);if(Number.isFinite(I.tod)&&Number.isFinite(I.et)){const l=H[H.length-1];if(!l||I.et-l.et>=5||I.et<l.et){if(l&&I.et<l.et)H.length=0;H.push({et:I.et,tod:I.tod});if(H.length>40)H.shift();}}
  if(H.length<3)return NaN;const a=H[0],z=H[H.length-1];let d=z.tod-a.tod;if(d<0)d+=86400;const e=z.et-a.et;return e>20?Math.round(d/e*2)/2:NaN;}
function lightInfo(I){const tod=I.tod;if(!Number.isFinite(tod))return null;const k=TRACK_SUN.find(t=>t[0].test(I.trk||''));const sc=timeScale(I);const out={tod,sc,known:!!k};
  if(k){const s=sunTimes(k[1],k[2],k[3],k[4]);const m=tod/60;out.rise=s.rise;out.set=s.set;const day=m>=s.rise&&m<s.set;out.day=day;
    let next=day?s.set:s.rise;let dm=next-m;if(dm<0)dm+=1440;out.next=day?'set':'rise';out.inGame=dm*60;out.real=sc>0?dm*60/sc:NaN;}
  if(sc>0&&I.rem>0)out.endTod=(tod+I.rem*sc)%86400;return out;}
const hhmm2=s=>`${String(Math.floor(s/3600)%24).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}`;
function lvLightPanel(x){const el=$('#lvLight');if(!el)return;const L=lightInfo(x.I);if(!L){el.innerHTML=`<div class="muted small">${tr('In attesa dei dati…')}</div>`;return;}
  const dur=s=>!Number.isFinite(s)?'—':s>=3600?`${Math.floor(s/3600)} h ${Math.floor(s%3600/60)} min`:`${Math.max(0,Math.round(s/60))} min`;
  const k=[liveTile('Ora in pista',hhmm2(L.tod),Number.isFinite(L.sc)?(L.sc===1?tr('tempo reale'):`${tr('tempo')} ×${L.sc}`):tr('misuro la velocità del tempo…'))];
  if(L.known){k.push(liveTile(L.next==='set'?'Tramonto':'Alba',hhmm2((L.next==='set'?L.set:L.rise)*60),`${tr('tra')} ${dur(L.real)} ${tr('reali')}${Number.isFinite(L.sc)&&L.sc!==1?` (${dur(L.inGame)} ${tr('di gioco')})`:''}`,Number.isFinite(L.real)&&L.real<900?'inv':''));
    k.push(liveTile(L.next==='set'?'Alba':'Tramonto',hhmm2((L.next==='set'?L.rise:L.set)*60),''));}
  if(Number.isFinite(L.endTod))k.push(liveTile('Ora in pista alla fine',hhmm2(L.endTod),Number.isFinite(L.sc)?'':''));
  el.innerHTML=`<div class="kpis">${k.join('')}</div><p class="muted small" style="margin:8px 0 0">${L.known?tr('Alba e tramonto sono una stima dalla posizione della pista e dalla data tipica della gara: il gioco non li comunica.'):tr('Pista non in elenco: niente alba e tramonto, solo l\'orario.')}</p>`;}

// ---------- panels and alerts ----------
(function(){const sk=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){const v=$('#v-live');const fresh=!v.dataset.ok;sk();if(!fresh)return;
    const P=(id,t,sub)=>`<div class="panel"><div class="panel-h"><h3>${tr(t)}</h3>${sub?`<span class="muted small">${tr(sub)}</span>`:''}</div><div id="${id}"></div></div>`;
    const ov=v.querySelector('.lvsub[data-p="ov"]');const gwp=$('#lvGwOv')?.closest('.panel');if(gwp)gwp.insertAdjacentHTML('afterend',P('lvTraf','Traffico','classi diverse dalla nostra entro 15 s'));else if(ov)ov.insertAdjacentHTML('afterbegin',P('lvTraf','Traffico',''));
    const stp=$('#lvStint')?.closest('.panel');if(stp)stp.insertAdjacentHTML('afterend',P('lvFin','Arrivo previsto','nostra classe, alla bandiera'));
    const cr=$('#lvCross')?.closest('.panel');if(cr)cr.insertAdjacentHTML('afterend',P('lvLight','Luce e orario',''));};
  const oo=lvOverview;window.lvOverview=lvOverview=function(x){oo(x);try{lvTrafficPanel(x);}catch(e){console.error(e);}};
  const os=lvStrategy;window.lvStrategy=lvStrategy=function(x){os(x);try{lvFinishPanel(x);}catch(e){console.error(e);}};
  const ow=lvWeather;window.lvWeather=lvWeather=function(x){ow(x);try{lvLightPanel(x);}catch(e){console.error(e);}};
  const og=gwOurs;window.gwOurs=gwOurs=function(c,stt,x){const h=og(c,stt,x);try{const d=gwDamage(stt,c);if(d&&h.endsWith('</div>'))return h.slice(0,-6)+d+'</div>';}catch(e){console.error(e);}return h;};})();
setInterval(()=>{try{const sc=LIVE.sc;if(!sc||LIVE.rec||Date.now()-LIVE.scAt>15000)return;const I=sc.i||{};const rows=liveRows(sc),me=rows.find(r=>r.veh===LIVE.focus);if(!me)return;const ses=liveSes(sc);
  const T=trafficList(rows,me,I);if(T){T.behind.filter(o=>o.t>-3).forEach(o=>lvAlert(ses+'|trf|'+o.r.veh+'|'+me.laps,'warn',`${esc(o.r.cls)} ${tr('in arrivo')}`,`${esc(o.r.drv)} ${tr('a')} ${fx(-o.t,1)} s ${tr('dietro')}`));
    T.ahead.filter(o=>o.t<3).forEach(o=>lvAlert(ses+'|trs|'+o.r.veh+'|'+me.laps,'info',`${esc(o.r.cls)} ${tr('davanti')}`,`${esc(o.r.drv)} ${tr('a')} ${fx(o.t,1)} s`));}
  const L=lightInfo(I);if(L?.known&&Number.isFinite(L.real)&&L.real<=600&&L.real>0)lvAlert(ses+'|sun|'+L.next+'|'+Math.round((L.next==='set'?L.set:L.rise)),'info',tr(L.next==='set'?'Tramonto tra poco':'Alba tra poco'),`${tr('tra')} ${Math.max(1,Math.round(L.real/60))} min ${tr('reali')}${L.next==='set'?' · '+tr('luci accese'):''}`);
  }catch(e){console.error(e);}},3000);
