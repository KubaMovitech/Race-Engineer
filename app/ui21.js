// ================= GOMME / CARBURANTE / ENERGIA COME NEL GIOCO, SLICK O WET, AVVISI METEO, STINT =================

// ---------- tyres, fuel and virtual energy laid out as the game's own widgets ----------
const gwLetter=n=>{n=String(n||'').trim();if(!n)return '?';if(/wet|rain/i.test(n))return 'W';const u=n[0].toUpperCase();return COMP_COL[u]?u:'?';};
const gwWearCol=p=>p>=0.7?'var(--good)':p>=0.45?'var(--warn)':'var(--bad)';
function gwRing(p,col,inner){const r=26,C=2*Math.PI*r;const v=Number.isFinite(p)?Math.max(0,Math.min(1,p)):0;
  return `<svg class="gwring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="bg"/><circle cx="32" cy="32" r="${r}" class="fg" style="stroke:${col}" stroke-dasharray="${(v*C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/></svg>${inner}`;}
// four tyres seen from above: what is left of the tread, compound, pressure, tread and brake temperature
function gwTyres(c){if(!c?.w)return '';const K=[gwLetter(c.cf),gwLetter(c.cf),gwLetter(c.cr),gwLetter(c.cr)];
  const cell=i=>{const w=c.w[i];const p=w.wear>0?w.wear:NaN;const tread=avg_(w.s||[]);const k=K[i];
    return `<div class="gwt ${i%2?'r':'l'}${w.flat||w.det?' bad':''}" title="${esc(tr(WN[i]))}"><div class="gwr">${gwRing(p,gwWearCol(p),`<div class="gwv"><b>${Number.isFinite(p)?Math.round(p*100)+'%':'—'}</b><i style="background:${COMP_COL[k]||COMP_COL['?']};color:${COMP_INK(k)}">${esc(k)}</i></div>`)}</div>
      <div class="gwd"><span>${fx(w.p,1)} kPa</span><b style="color:${tHeat(tread)}">${fx(tread,1)} °C</b><span>${tr('freno')} ${fx(w.bt,0)} °C</span>${w.flat?`<span class="neg">${tr('FORATA')}</span>`:''}</div></div>`;};
  return `<div class="gwbox"><div class="gwh">${tr('Gomme')}<span>${esc([c.cf,c.cr].filter(Boolean).join(' / '))}</span></div><div class="gwtyres">${[0,1,2,3].map(cell).join('')}</div></div>`;}
// per-lap use → highest / average / last, with the laps and minutes left on what is in the car
function gwCons(title,level,levelTxt,use,lapT,fmtU,extra){const ok=use.filter(v=>v>0);
  const head=`<div class="gwh">${title}<span>${levelTxt}</span></div>`;
  if(!ok.length||!(level>=0))return `<div class="gwbox">${head}<div class="muted small">${tr('Servono un paio di giri completi.')}</div></div>`;
  const rows=[[tr('Consumo massimo'),Math.max(...ok)],[tr('Consumo medio'),avg_(ok)],[tr('Ultimo'),ok[ok.length-1]]];
  return `<div class="gwbox">${head}<table class="gwtab"><thead><tr><th></th><th>${tr('Giri')}</th><th>${tr('Tempo')}</th><th>${tr('Consumo')}</th></tr></thead><tbody>${rows.map(([l,u],i)=>{const laps=level/u;
    return `<tr${i===1?' class="avg"':''}><td>${l}</td><td>${fx(laps,1)}</td><td>${lapT>0?Math.floor(laps*lapT/60)+' min':'—'}</td><td>${fmtU(u)}</td></tr>`;}).join('')}</tbody></table>${extra||''}</div>`;}
// our car (full telemetry from its bridge): litres and energy per lap from our own laps
function gwOurs(c,stt){if(!c?.w)return `<div class="muted small">${tr('Nessun dato: l\'auto non è in pista.')}</div>`;
  const L=stt.laps.filter(l=>!l.pit&&l.n>1&&l.t>0).slice(-10);const cap=c.fuelCap>0?c.fuelCap:200;
  const fu=L.map(l=>l.fuel).filter(v=>v>0&&v<cap*0.3),vu=L.map(l=>l.ve).filter(v=>v>0&&v<0.3);
  const lapT=avg_(L.slice(-5).map(l=>l.t))||c.estL;const ratio=fu.length&&vu.length?avg_(fu)/(avg_(vu)*100):NaN;
  const hasVe=c.ve>=0&&(c.ve>0||vu.length);
  return `<div class="gw3">${gwTyres(c)}${gwCons(tr('Carburante'),c.fuel,fx(c.fuel,2)+' L',fu,lapT,u=>fx(u,2)+' L')}
    ${hasVe?gwCons(tr('Energia virtuale'),c.ve,Math.round(c.ve*100)+'%',vu,lapT,u=>fx(u*100,2)+'%',Number.isFinite(ratio)?`<div class="gwrow"><span>${tr('Ratio carburante/EV')}</span><b>${fx(ratio,2)}</b></div>`:''):''}</div>`;}
// any other car: only the percentages the game gives for every car (no tyre wear for cars without our bridge)
function gwOther(veh,r){const s=carStats(veh,r);const L=s.L;const fu=[],vu=[];
  for(let i=1;i<L.length;i++){const a=L[i-1],b=L[i];if(b[0]!==a[0]+1||a[3]||b[3])continue;const f=a[8]-b[8],v=a[9]-b[9];if(f>0&&f<0.3)fu.push(f);if(v>0&&v<0.3)vu.push(v);}
  if(!fu.length&&!vu.length)return '';const lapT=s.pace5||r?.estL;const pc=u=>fx(u*100,2)+'%';
  return `<div class="gw3 two">${r&&r.ve>=0?gwCons(tr('Energia virtuale'),r.ve,Math.round(r.ve*100)+'%',vu.slice(-10),lapT,pc):''}${r&&r.fuel>=0?gwCons(tr('Carburante'),r.fuel,Math.round(r.fuel*100)+'%',fu.slice(-10),lapT,pc):''}</div>`;}

(function(){const sk=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){const v=$('#v-live');const fresh=!v.dataset.ok;sk();if(!fresh)return;
    const box=(id)=>`<div class="panel"><div class="panel-h"><h3>${tr('Gomme, carburante ed energia')}</h3><span class="muted small">${tr('come nel gioco')}</span></div><div id="${id}"></div></div>`;
    const car=v.querySelector('.lvsub[data-p="car"]');if(car)car.insertAdjacentHTML('afterbegin',box('lvGwCar'));
    const ov=v.querySelector('.lvsub[data-p="ov"]');if(ov)ov.insertAdjacentHTML('afterbegin',box('lvGwOv'));
    const wx=v.querySelector('.lvsub[data-p="wx"]');if(wx)wx.insertAdjacentHTML('afterbegin',`<div class="panel"><div class="panel-h"><h3>${tr('Slick o wet?')}</h3><span class="muted small">${tr('tempi degli ultimi 4 minuti, auto della nostra classe')}</span></div><div id="lvCross"></div></div>`);
    const st=v.querySelector('.lvsub[data-p="str"]');if(st)st.insertAdjacentHTML('afterbegin',`<div class="panel"><div class="panel-h"><h3>${tr('Piloti e stint')}</h3><label class="f" style="min-width:170px">${tr('Stint massimo (min)')}<input type="number" id="lvStMax" min="0" step="5"></label></div><div id="lvStint"></div></div>`);
    const mx=$('#lvStMax');if(mx){mx.value=LS.get('live:stintMax','')||'';mx.onchange=()=>{LS.set('live:stintMax',+mx.value||'');renderLive(true);};}};
  const gw=(id,x)=>{const el=$(id);if(el)el.innerHTML=gwOurs(x.c,x.stt);};
  const oc=lvCar;window.lvCar=lvCar=function(x){oc(x);try{gw('#lvGwCar',x);}catch(e){console.error(e);}};
  const oo=lvOverview;window.lvOverview=lvOverview=function(x){oo(x);try{gw('#lvGwOv',x);}catch(e){console.error(e);}};
  const ow=lvWeather;window.lvWeather=lvWeather=function(x){ow(x);try{lvCrossPanel(x);}catch(e){console.error(e);}};
  const os=lvStrategy;window.lvStrategy=lvStrategy=function(x){os(x);try{lvStintPanel(x);}catch(e){console.error(e);}};
  const om=openCarModal;window.openCarModal=openCarModal=function(veh){om(veh);try{const r=liveRows(LIVE.sc).find(z=>z.veh===veh);const h=gwOther(veh,r);const b=$('#mCarB');
    if(h&&b)b.insertAdjacentHTML('afterbegin',`<h3>${tr('Carburante ed energia')} <span class="muted small">${tr('come nel gioco')}</span></h3>${h}`);}catch(e){console.error(e);}};})();

// ---------- slick or wet: lap times of the cars of our class, grouped by the tyres they have on now ----------
const isWetTyre=r=>r.comp?[...r.comp].every(k=>k==='W'):/wet|rain/i.test(r.cf||'');
function wetCross(rows,me,I){if(!me||!Number.isFinite(I?.et))return null;const G={wet:[],slick:[]},cars={wet:new Set(),slick:new Set()};
  rows.forEach(r=>{if(r.cls!==me.cls||(!r.comp&&!r.cf))return;const s=carStats(r.veh,r);const since=s.lastPit?(s.lastPit.out||s.lastPit.in||0):0;const g=isWetTyre(r)?'wet':'slick';
    s.L.forEach(l=>{if(l[2]<I.et-240||l[2]<since+1||l[3]||!(l[1]>0)||l[0]<2)return;G[g].push(l[1]);cars[g].add(r.veh);});});
  const out={wet:med_(G.wet),slick:med_(G.slick),nw:G.wet.length,ns:G.slick.length,cw:cars.wet.size,cs:cars.slick.size,ours:isWetTyre(me)?'wet':'slick'};
  out.ok=out.nw>=2&&out.ns>=2;out.d=out.ok?out.slick-out.wet:NaN; // + = wet faster
  out.better=!out.ok||Math.abs(out.d)<0.3?'':out.d>0?'wet':'slick';return out;}
function lvCrossPanel(x){const el=$('#lvCross');if(!el)return;const W=wetCross(x.rows,x.me,x.I);
  if(!W){el.innerHTML=`<div class="muted small">${tr('In attesa dei dati…')}</div>`;return;}
  const g=(n,t,laps,cars)=>`<div class="kpi"><div class="l">${n}</div><div class="v">${fmtLap(t)}</div><div class="s">${laps} ${tr('giri')} · ${cars} ${tr('auto')}</div></div>`;
  let msg;if(!W.ok)msg=tr('Per il confronto servono almeno 2 giri recenti con le slick e 2 con le wet nella nostra classe.');
  else if(!W.better)msg=tr('Slick e wet vanno quasi uguali: è il momento del cambio.');
  else msg=`${tr(W.better==='wet'?'Le wet sono più veloci di':'Le slick sono più veloci di')} <b>${fx(Math.abs(W.d),1)} s</b> ${tr('al giro')}.`+(W.better!==W.ours?` <b class="neg">${tr(W.better==='wet'?'Conviene montare le wet.':'Conviene montare le slick.')}</b>`:` <span class="pos">${tr('Abbiamo le gomme giuste.')}</span>`);
  el.innerHTML=`<div class="kpis">${g(tr('Con le slick'),W.slick,W.ns,W.cs)}${g(tr('Con le wet'),W.wet,W.nw,W.cw)}</div><p class="small" style="margin:8px 0 0">${msg}</p>`;}

// ---------- drivers and stints of our car: time at the wheel, when to change, who is next ----------
function stintData(x){const {rows,me,I}=x;if(!me||!Number.isFinite(I?.et))return null;const c=fCar(me.veh);const sw=[...(c?.swaps||[])].filter(w=>w.et<=I.et).sort((a,b)=>a.et-b.et);
  const seg=[];let t0=0,d=sw[0]?.from||me.drv;sw.forEach(w=>{seg.push({d,t0,t1:w.et});t0=w.et;d=w.to;});seg.push({d:me.drv||d,t0,t1:I.et,cur:true});
  const tot={};seg.forEach(s=>{const k=s.d||'?';(tot[k]=tot[k]||{t:0,n:0}).t+=Math.max(0,s.t1-s.t0);tot[k].n++;});
  const T=tmPlans();const P=T.plans?.find(p=>p.id===T.cur)||T.plans?.[0];const maxMin=+LS.get('live:stintMax','')||+P?.race?.maxStint||0;
  const cur=seg[seg.length-1];const inCar=I.et-cur.t0;const left=maxMin>0?maxMin*60-inCar:NaN;
  // next driver: the one after ours in the team plan, else the team-mate with the least time at the wheel
  const same=(a,b)=>String(a||'').toLowerCase().trim()===String(b||'').toLowerCase().trim()||String(a||'').toLowerCase().includes(String(b||'').toLowerCase().split(' ')[0]);
  let next='';const order=P?[...P.drivers].sort((a,b)=>(+a.order||0)-(+b.order||0)).map(d=>d.name).filter(Boolean):[];
  const i=order.findIndex(n=>same(cur.d,n)||same(n,cur.d));if(order.length>1&&i>=0)next=order[(i+1)%order.length];
  if(!next){const others=Object.entries(tot).filter(([k])=>k!==cur.d).sort((a,b)=>a[1].t-b[1].t);next=others[0]?.[0]||(c?.drivers||[]).find(n=>n!==cur.d)||'';}
  return {cur:cur.d,inCar,left,maxMin,next,tot,swaps:sw.length};}
function lvStintPanel(x){const el=$('#lvStint');if(!el)return;const S=stintData(x);if(!S){el.innerHTML=`<div class="muted small">${tr('In attesa dei dati…')}</div>`;return;}
  const mm=s=>Number.isFinite(s)?`${s<0?'−':''}${Math.floor(Math.abs(s)/60)}:${String(Math.floor(Math.abs(s)%60)).padStart(2,'0')}`:'—';
  const k=[liveTile('Alla guida',`<span class="vtxt">${esc(S.cur||'—')}</span>`,`${tr('da')} ${mm(S.inCar)}`),
    liveTile('Cambio tra',S.maxMin?mm(S.left):'—',S.maxMin?`${tr('stint massimo')} ${S.maxMin} min`:tr('imposta lo stint massimo'),S.maxMin&&S.left<300?'inv':''),
    liveTile('Prossimo pilota',`<span class="vtxt">${esc(S.next||'—')}</span>`,'')];
  const rows=Object.entries(S.tot).sort((a,b)=>b[1].t-a[1].t).map(([d,v])=>`<tr class="${d===S.cur?'ours':''}"><td class="l">${esc(d)}</td><td>${hms(v.t)}</td><td>${v.n}</td></tr>`).join('');
  el.innerHTML=`<div class="kpis">${k.join('')}</div><table class="lbt" style="margin-top:8px"><thead><tr><th class="l">${tr('Pilota')}</th><th>${tr('Tempo alla guida')}</th><th>Stint</th></tr></thead><tbody>${rows}</tbody></table>`;}

// ---------- alerts: weather, slick/wet, driver change (once each, also when another tab of the Muretto is open) ----------
function lvAlert(key,k,t,s){if(LS.get('live:notif','class')==='off'||LIVE.rec)return;if(NOTIF_SEEN.has(key))return;NOTIF_SEEN.set(key,Date.now());
  NOTIF.unshift({k,t,s,at:Date.now()});if(NOTIF.length>30)NOTIF.pop();
  let box=$('#lvToasts');if(!box){box=document.createElement('div');box.id='lvToasts';document.body.appendChild(box);}
  const el=document.createElement('div');el.className='lvtoast '+k;el.innerHTML=`<b>${t}</b><div>${s}</div>`;box.prepend(el);
  while(box.children.length>4)box.lastChild.remove();setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400);},12000);}
function liveWatch(){const sc=LIVE.sc;if(!sc||LIVE.rec||Date.now()-LIVE.scAt>15000)return;const I=sc.i||{};const ses=liveSes(sc);const A=LIVE.wxA&&LIVE.wxA.ses===ses?LIVE.wxA:(LIVE.wxA={ses,rain:I.rain||0,wet:I.wavg||0});
  const k=s=>ses+'|'+s;
  // rain starts / stops
  if((I.rain||0)>=0.05&&A.rain<0.02)lvAlert(k('rain+'+Math.floor(I.et/300)),'warn',tr('Inizia a piovere'),`${tr('intensità')} ${Math.round(I.rain*100)}% (${tr(rainLabel(I.rain))})`);
  if((I.rain||0)<0.02&&A.rain>=0.05)lvAlert(k('rain-'+Math.floor(I.et/300)),'info',tr('Ha smesso di piovere'),`${tr('pista bagnata')} ${Math.round((I.wavg||0)*100)}%`);
  if((I.rain||0)>=0.05||(I.rain||0)<0.02)A.rain=I.rain||0;
  // track wetness crossing 10 / 30 / 60 %
  [0.1,0.3,0.6].forEach(th=>{const w=I.wavg||0;if(w>=th&&A.wet<th)lvAlert(k('wet+'+th+'|'+Math.floor(I.et/600)),'warn',tr('Pista sempre più bagnata'),`${tr('pista bagnata')} ${Math.round(w*100)}%`);
    if(w<th&&A.wet>=th&&th===0.1)lvAlert(k('wet-'+Math.floor(I.et/600)),'info',tr('Pista quasi asciutta'),`${tr('pista bagnata')} ${Math.round(w*100)}%`);});A.wet=I.wavg||0;
  // rain in the forecast within 10 minutes
  const re=rainEta(I);if(re&&(I.rain||0)<0.05&&re.t>0&&re.t<=600)lvAlert(k('eta|'+Math.round(I.end>0?re.t+I.et:0)),'warn',tr('Pioggia in arrivo'),`${tr('prevista tra')} ${Math.max(1,Math.round(re.t/60))} min (${Math.round(re.rc)}%)`);
  const rows=liveRows(sc),me=rows.find(r=>r.veh===LIVE.focus);if(!me)return;
  // slick / wet: the other tyres became faster
  const W=wetCross(rows,me,I);if(W?.better&&W.better!==W.ours&&Math.abs(W.d)>=0.5)lvAlert(k('cross|'+W.better+'|'+Math.floor(I.et/600)),'bad',tr(W.better==='wet'?'Conviene montare le wet':'Conviene montare le slick'),`${tr(W.better==='wet'?'Le wet sono più veloci di':'Le slick sono più veloci di')} ${fx(Math.abs(W.d),1)} s ${tr('al giro')}`);
  // driver change coming
  const S=stintData({rows,me,I});if(S&&S.maxMin>0)[[300,'5'],[60,'1']].forEach(([s,m])=>{if(S.left<=s&&S.left>s-120)lvAlert(k('stint|'+S.cur+'|'+S.swaps+'|'+s),s<=60?'bad':'warn',`${tr('Cambio pilota tra')} ${m} min`,`${esc(S.cur)} → <b>${esc(S.next||'—')}</b>`);});}
setInterval(()=>{try{liveWatch();}catch(e){console.error(e);}},2000);
