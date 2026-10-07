// ================= MURETTO: condizioni, consumi, relativo, dati del gioco · icona, app installabile, logo squadra =================
function skyNow(I){const wx=LIVE.wx?.nodes;if(wx&&wx.length&&I.end>0&&Number.isFinite(I.et)){const k=Math.max(0,Math.min(wx.length-1,Math.floor(I.et/I.end*(wx.length-1)+1e-6)));const n=wx[k];if(n&&Number.isFinite(n.sky)&&!(I.rain>0.05&&n.sky<5))return SKY[Math.round(n.sky)];}
  const r=I.rain||0,c=I.cloud||0;if(r>0.05)return r<0.2?'nuvoloso con pioviggine':r<0.5?'coperto con pioggia leggera':r<0.8?'coperto con pioggia':'coperto con pioggia forte';
  return c<0.1?'sereno':c<0.3?'poco nuvoloso':c<0.6?'parzialmente nuvoloso':c<0.85?'molto nuvoloso':'coperto';}
const GRIP=['verde','basso','medio','alto','gommata'];
function nextForecast(I){const n=LIVE.wx?.nodes;if(!n?.length||!(I.end>0))return null;const nn=n.length;for(let i=0;i<nn;i++){const t=I.end*i/(nn-1);if(t>I.et+60)return {n:n[i],t,i};}return null;}
function rainEta(I){const n=LIVE.wx?.nodes;if(!n?.length||!(I.end>0))return null;const nn=n.length;for(let i=0;i<nn;i++){const t=I.end*i/(nn-1);const rc=n[i].rain>1?n[i].rain:n[i].rain*100;if(t>=I.et-1&&rc>=50)return {t:t-I.et,rc,sky:n[i].sky};}return null;}
function trend(H,i,mins){if(!H||H.length<3)return NaN;const last=H[H.length-1];const old=H.filter(h=>h[0]<=last[0]-mins*60).pop();return old?last[i]-old[i]:NaN;}

function lvCond(x){const {I,me,c,kind}=x;if(!LIVE.sc){$('#lvCond').innerHTML=`<div class="muted small">${tr('In attesa dei dati…')}</div>`;return;}
  const nf=nextForecast(I),re=rainEta(I);const H=LIVE.wxh;const dT=trend(H,2,10);
  $('#lvCondT').textContent=hhmm((I.tod||0)/60);
  const rows=[['Meteo',`${esc(tr(skyNow(I)))}, ${fx(I.air,1)} °C`],
    ['Previsioni',nf?`${esc(tr(SKY[Math.round(nf.n.sky)]||''))}, ${fx(nf.n.temp,1)} °C · ${tr('pioggia')} ${fx(nf.n.rain>1?nf.n.rain:nf.n.rain*100,0)}% <span class="muted">(${tr('tra')} ${Math.round((nf.t-I.et)/60)} min)</span>`:'—'],
    ['Circuito',`${tr('Grip')} ${esc(tr(GRIP[I.grip]||'—'))}, ${fx(I.tt,1)} °C${Number.isFinite(dT)&&Math.abs(dT)>=0.3?` <span class="${dT>0?'warn-t':'pos'}">${dT>0?'▲':'▼'}${fx(Math.abs(dT),1)}</span>`:''}`],
    ['Pista bagnata',`${Math.round((I.wavg||0)*100)}%${I.wmax>0?` <span class="muted">(max ${Math.round(I.wmax*100)}%)</span>`:''}`],
    ['Pioggia',I.rain>0.01?`${Math.round(I.rain*100)}%`:(re?`<span class="warn-t">${tr('prevista tra')} ${Math.max(0,Math.round(re.t/60))} min (${fx(re.rc,0)}%)</span>`:tr('no'))],
    ['Vento',`${fx(I.wind,1)} m/s`],
    ['Tagli',c&&c.tlPen?`${c.tl}/${c.tlPen}`:me&&I.tlPt?`${fx(me.tl/I.tlPt,1)}`:'—'],
    ['Penalità',(c?.pen??me?.pen)?`<span class="neg">${c?.pen??me?.pen}</span>`:'0']];
  $('#lvCond').innerHTML=rows.map(([l,v])=>`<div class="lvrow"><span>${l}</span><b>${v}</b></div>`).join('');}

// consumption block in the spirit of the in-game fuel widget
function lvCons(x){const {stt,c,S2,me}=x;const L=stt.laps.filter(l=>!l.pit&&l.n>1&&l.t>0);const ve=c&&c.ve>0;const unit=ve?'%':'L';
  $('#lvConsT').textContent=tr(ve?'Energia virtuale':'Carburante');
  if(!c){$('#lvCons').innerHTML=`<div class="muted small">${tr('Serve la nostra auto in pista con il bridge acceso.')}</div>`;return;}
  const per=L.map(l=>ve?l.ve*100:l.fuel).filter(v=>v>0);const amount=ve?c.ve*100:c.fuel;const pace=S2?.lt||med_(L.filter(l=>!l.inv).map(l=>l.t))||c.estL;
  const last=per[per.length-1],avg5=avg_(per.slice(-5)),mx=per.length?Math.max(...per.slice(-10)):NaN,mn=per.length?Math.min(...per.slice(-10)):NaN;
  const row=(lbl,u)=>{const laps=u>0?amount/u:NaN;return `<tr><td class="l">${lbl}</td><td>${fx(laps,1)}</td><td>${Number.isFinite(laps)&&pace?Math.round(laps*pace/60)+' min':'—'}</td><td>${fx(u,2)} ${unit}</td></tr>`;};
  const fl=L.slice(-5).map(l=>l.fuel).filter(v=>v>0),vl=L.slice(-5).map(l=>l.ve).filter(v=>v>0);const ratio=fl.length&&vl.length?avg_(fl)/(avg_(vl)*100):NaN;
  const coast=L.length?L[L.length-1].coast:NaN;
  $('#lvCons').innerHTML=`<div class="lvbig"><b>${fx(amount,ve?1:1)}${ve?' %':' L'}</b><span>${tr('a bordo')}${ve&&c.fuel>0?` · ${fx(c.fuel,1)} L`:''}</span></div>
    <table class="lvmini"><thead><tr><th class="l"></th><th>${tr('Giri')}</th><th>${tr('Tempo')}</th><th>${tr('Per giro')}</th></tr></thead><tbody>
    ${per.length?row(tr('Ultimo giro'),last)+row(tr('Media ultimi 5'),avg5)+row(tr('Consumo massimo'),mx)+row(tr('Consumo minimo'),mn):`<tr><td class="l muted" colspan="4">${tr('Serve almeno un giro completo senza soste.')}</td></tr>`}</tbody></table>
    <div class="lvrow"><span>${tr('Ratio carburante/EV')}</span><b>${fx(ratio,2)}</b></div>${Number.isFinite(coast)?`<div class="lvrow"><span>${tr('Senza pedali nell\'ultimo giro')}</span><b>${fx(coast,1)} s</b></div>`:''}`;}

// cars nearest on track (TinyPedal-style relative)
function lvRel(x){const {rows,me,I}=x;const LD=I.lapDist;if(!me||!(LD>0)){$('#lvRel').innerHTML=`<div class="muted small">${tr('Servono la classifica e la nostra auto in pista.')}</div>`;return;}
  const lt=carStats(me.veh,me).pace5||me.estL||100;const myP=me.laps+me.ld/LD;
  const rel=rows.filter(r=>r!==me&&!r.gar&&r.fin===0).map(r=>{let d=((r.ld-me.ld)%LD+LD*1.5)%LD-LD/2;const prog=r.laps+r.ld/LD;const lapd=Math.round(prog-myP-d/LD);return {r,d,t:d/LD*lt,lapd};}).sort((a,b)=>b.d-a.d);
  const ahead=rel.filter(o=>o.d>0).slice(-4),behind=rel.filter(o=>o.d<=0).slice(0,4);const list=[...ahead,{me:true},...behind];
  $('#lvRel').innerHTML=`<table><tbody>${list.map(o=>{if(o.me)return `<tr class="ours"><td></td><td class="l"><b>${esc(me.drv)}</b></td><td>P${me.pic}</td><td>—</td><td></td></tr>`;const r=o.r;
    const lc=o.lapd>0?'lap-up':o.lapd<0?'lap-dn':'';return `<tr class="${lc}" data-car="${esc(r.veh)}"><td><span class="clsdot" style="background:${LV_CLS(r.cls)}"></span></td><td class="l">${esc(r.drv)}${r.inPit?' <span class="tag warn">BOX</span>':''}</td><td>P${r.pic}</td><td>${o.t>0?'+':''}${fx(o.t,1)}</td><td>${o.lapd?`<span class="tag ${o.lapd>0?'bad':'info'}">${o.lapd>0?'+':''}${o.lapd}G</span>`:''}</td></tr>`;}).join('')}</tbody></table>
    <p class="muted small" style="margin:6px 0 0">${tr('Sopra: davanti sul tracciato · sotto: dietro. Rosso = ha un giro in più di noi, grigio = doppiato da noi.')}</p>`;}

function lvNow(x){const {I}=x;if(!LIVE.sc){$('#lvNow').innerHTML='';return;}const H=LIVE.wxh;const re=rainEta(I);const hum=humNow(I);
  $('#lvNowT').textContent=`${tr('ora in pista')} ${hhmm((I.tod||0)/60)}`;
  const t=(l,v,s)=>liveTile(l,v,s);
  $('#lvNow').innerHTML=`<div class="kpis">${[t('Cielo',`<span class="vtxt">${esc(tr(skyNow(I)))}</span>`,`${tr('nuvole')} ${Math.round((I.cloud||0)*100)}%`),t('Aria',fx(I.air,1)+' °C',sgnT(trend(H,1,10))),t('Asfalto',fx(I.tt,1)+' °C',sgnT(trend(H,2,10))),
    t('Pioggia',`${Math.round((I.rain||0)*100)}% <span class="vtxt small">${esc(tr(rainLabel(I.rain)))}</span>`,[re&&I.rain<0.05?`${tr('prevista tra')} ${Math.max(0,Math.round(re.t/60))} min`:'',pctT(trend(H,3,5),5)].filter(Boolean).join(' · ')),
    t('Pista bagnata',Math.round((I.wavg||0)*100)+'%',`min ${Math.round((I.wmin||0)*100)}% · max ${Math.round((I.wmax||0)*100)}%`+(wetEta(H,I)?'<br>'+wetEta(H,I):'')),
    t('Grip',`<span class="vtxt">${esc(tr(GRIP[I.grip]||'—'))}</span>`,''),t('Vento',fx(I.wind,1)+' m/s',fx((I.wind||0)*3.6,0)+' km/h'),
    ...(Number.isFinite(hum)?[t('Umidità',fx(hum,0)+'%',tr('dalle previsioni'))]:[])].join('')}</div>`;}
// rain intensity as the game gives it (0–1): the game has no millimetres, these words are indicative
function rainLabel(r){r=r||0;return r<0.01?'nessuna':r<0.1?'pioviggine':r<0.3?'leggera':r<0.6?'moderata':r<0.85?'forte':'molto forte';}
function pctT(d,mins){return Number.isFinite(d)&&Math.abs(d)>=0.005?`${d>0?'▲':'▼'} ${Math.round(Math.abs(d)*100)}% ${tr('in')} ${mins} min`:'';}
// is the track drying or getting wetter, and when is it dry (straight line on the last 10 minutes)
function wetEta(H,I){const d=trend(H,4,10);if(!Number.isFinite(d)||Math.abs(d)<0.01)return '';const w=I.wavg||0;
  if(d<0){const m=w/(-d/10);return `▼ ${tr('si asciuga')}${w>0.02&&m<240?` · ${tr('asciutta tra')} ≈ ${Math.round(m)} min`:''}`;}
  return `▲ ${tr('si bagna')}: +${Math.round(d*100)}% ${tr('in')} 10 min`;}
// humidity of the forecast node of now
function humNow(I){const n=LIVE.wx?.nodes;if(!n?.length||!(I.end>0))return NaN;const i=Math.max(0,Math.min(n.length-1,Math.round((I.et||0)/I.end*(n.length-1))));const h=+n[i].hum;return h>0&&h<=100?h:NaN;}
function sgnT(d){return Number.isFinite(d)?`${d>0?'▲':d<0?'▼':''} ${fx(Math.abs(d),1)} °C ${tr('in 10 min')}`:'';}

const GAME_N={currentFuel:'Carburante attuale',maxFuel:'Serbatoio',fuelCapacity:'Serbatoio',currentVirtualEnergy:'Energia attuale',maxVirtualEnergy:'Energia massima',fuelRatio:'Ratio carburante/EV',fuelPerLap:'Carburante per giro',energyPerLap:'Energia per giro',lapsRemaining:'Giri rimanenti'};
function lvGame(x){const {stt}=x;const Dp=(stt.Ds||[]).filter(D=>D.pit).sort((a,b)=>(b.pitAt||0)-(a.pitAt||0))[0];const g=Dp?.pit?.game||LIVE.rec?.pitRec?.game;
  if(!g||!Object.keys(g).length){$('#lvGame').innerHTML=`<div class="muted small">${tr('Appare con il bridge 1.3 quando il pilota è in pista.')}</div>`;return;}
  const nice=k=>{const last=k.split('.').slice(-2).filter(p=>!/^\d+$/.test(p));const key=last[last.length-1]||k;return tr(GAME_N[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase()));};
  const groups={};Object.entries(g).forEach(([k,v])=>{const grp=k.split('.')[0];(groups[grp]=groups[grp]||[]).push([nice(k),v]);});
  const GN={fuelInfo:'Carburante ed energia',pitRecommendations:'Consigli per la sosta',pitStopLength:'Durata della sosta'};
  $('#lvGame').innerHTML=`<div class="grid3g">${Object.entries(groups).map(([k,rows])=>`<div><h4>${esc(tr(GN[k]||k))}</h4>${rows.slice(0,20).map(([l,v])=>`<div class="lvrow"><span>${esc(l)}</span><b>${esc(typeof v==='number'?String(Math.round(v*1000)/1000):String(v))}</b></div>`).join('')}</div>`).join('')}</div>`;}

// tyre life in the Auto tab
(function(){const base=lvCar;window.lvCar=lvCar=function(x){base(x);const {c,stt}=x;if(!c||!c.w)return;const L=stt.laps.filter(l=>!l.pit&&l.wear&&l.n>1&&l.wear.every(v=>v>=0)).slice(-5);if(!L.length)return;
  const lim=+(LS.get('strategy',{}).wearMax)||35;const per=[0,1,2,3].map(i=>avg_(L.map(l=>l.wear[i]).filter(v=>v>0&&v<10)));if(!per.some(v=>v>0))return;
  const html=`<div class="lvlife">${[0,1,2,3].map(i=>{const used=(1-c.w[i].wear)*100;const left=per[i]>0?(lim-used)/per[i]:NaN;return `<div><span>${tr(WN[i])}</span><b class="${left<5?'neg':''}">${fx(per[i],2)}%/${tr('giro')}</b><small>${Number.isFinite(left)?`≈ ${Math.max(0,Math.floor(left))} ${tr('giri al')} ${lim}%`:''}</small></div>`;}).join('')}</div>`;
  $('#lvTyres').insertAdjacentHTML('beforeend',html);};})();

// laps table: add lift-and-coast column
(function(){const base=lvCar;window.lvCar=lvCar=function(x){base(x);const L=x.stt.laps;if(!L.length||!L.some(l=>Number.isFinite(l.coast)))return;const tb=$('#lvLaps table');if(!tb)return;
  const h=tb.querySelector('thead tr');h.insertAdjacentHTML('beforeend',`<th title="${esc(tr('secondi senza gas né freno sopra i 60 km/h'))}">${tr('Senza pedali s')}</th>`);
  const rev=[...L].reverse().slice(0,120);tb.querySelectorAll('tbody tr').forEach((tr_,i)=>tr_.insertAdjacentHTML('beforeend',`<td>${fx(rev[i]?.coast,1)}</td>`));};})();

// ---------- app icon, installable app, team logo ----------
const LOGO_SVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E10600"/><stop offset="1" stop-color="#7A0300"/></linearGradient></defs><rect x="2" y="2" width="44" height="44" rx="11" fill="url(#g)"/><path d="M9 31 L15 31 L18 21 L22 35 L26 15 L30 29 L33 25 L39 25" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><g fill="#fff" opacity=".9"><rect x="31" y="8" width="3.5" height="3.5"/><rect x="34.5" y="11.5" width="3.5" height="3.5"/></g></svg>`;
(function(){const head=document.head||document.body;
  const ic=document.createElement('link');ic.rel='icon';ic.type='image/svg+xml';ic.href='data:image/svg+xml,'+encodeURIComponent(LOGO_SVG);head.appendChild(ic);
  const tc=document.createElement('meta');tc.name='theme-color';tc.content='#08090B';head.appendChild(tc);
  if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&location.port){const m=document.createElement('link');m.rel='manifest';m.href='/manifest.json';head.appendChild(m);
    try{navigator.serviceWorker&&navigator.serviceWorker.register('/sw.js');}catch(e){}
    addEventListener('beforeinstallprompt',e=>{e.preventDefault();const b=document.createElement('button');b.className='btn dark';b.type='button';b.textContent=tr('Installa app');b.title=tr('Aggiunge Data Engineer al PC con la sua icona');b.onclick=async()=>{e.prompt();await e.userChoice;b.remove();};$('.hdr-tools')?.prepend(b);});}
  applyTeamLogo();
  // settings: team logo
  const box=$('#mSettings .mbox');if(box&&!$('#tlBox')){box.insertAdjacentHTML('beforeend',`<h3 style="margin-top:16px">Logo della squadra</h3><div class="row" id="tlBox"><span id="tlPrev" class="tlprev"></span><button class="btn" type="button" id="tlPick">Scegli immagine…</button><button class="btn" type="button" id="tlDel">Togli</button></div><p class="muted small">Compare accanto al nome dell'app. Resta salvato in questo browser.</p>`);
    $('#tlPick').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=()=>{const f=i.files[0];if(!f)return;const img=new Image();img.onload=()=>{const s=Math.min(1,128/Math.max(img.width,img.height));const cv=document.createElement('canvas');cv.width=Math.round(img.width*s);cv.height=Math.round(img.height*s);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);LS.set('teamLogo',cv.toDataURL('image/png'));applyTeamLogo();URL.revokeObjectURL(img.src);};img.src=URL.createObjectURL(f);};i.click();};
    $('#tlDel').onclick=()=>{LS.set('teamLogo','');applyTeamLogo();};}})();
function applyTeamLogo(){const u=LS.get('teamLogo','');let el=$('#teamLogo');const brand=$('.brand');if(!brand)return;
  if(!u){el&&el.remove();}else{if(!el){el=document.createElement('img');el.id='teamLogo';el.alt='';el.className='teamlogo';brand.appendChild(el);}el.src=u;}
  const p=$('#tlPrev');if(p)p.innerHTML=u?`<img src="${u}" alt="">`:'';}
