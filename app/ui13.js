// ================= MURETTO: piano squadra, sosta, meteo, rivali, passo, registrazioni =================
const SKY=['sereno','poco nuvoloso','parzialmente nuvoloso','molto nuvoloso','coperto','nuvoloso con pioviggine','nuvoloso con pioggia leggera','coperto con pioggia leggera','coperto con pioggia','coperto con pioggia forte','temporale'];
const SKYI=['☀','🌤','⛅','🌥','☁','🌦','🌦','🌧','🌧','🌧','⛈'];
const EST_N={total:'Totale da fermo',fuel:'Rifornimento',ve:'Energia',virtualEnergy:'Energia',tires:'Gomme',tyres:'Gomme',damage:'Riparazioni',repair:'Riparazioni',driverSwap:'Cambio pilota',penalty:'Penalità',penalties:'Penalità'};
function liveRivals(){return LS.get('live:rivals',[]);}
const med_=a=>{const s=a.filter(Number.isFinite).sort((x,y)=>x-y);return s.length?s[s.length>>1]:NaN;};
const avg_=a=>{a=a.filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;};
const sd_=a=>{a=a.filter(Number.isFinite);if(a.length<2)return NaN;const m=avg_(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1));};

// plan stints (same rules as the Team tab)
function tmStints(P){const R=P.race;const T=R.hours*3600;const ds=P.drivers.map((d,i)=>({...d,i,col:DRV_COL[i%6],lapS:parseLapT(d.lap),mul:+d.veMul||1})).filter(d=>d.lapS>0);
  if(!ds.length||!(R.ve>0)||!(T>0))return null;const order=[...ds].sort((a,b)=>(+a.order||a.i+1)-(+b.order||b.i+1));
  const fixed=order.some(d=>+d.stints>0);const queue=[];if(fixed)order.forEach(d=>{for(let k=0;k<(+d.stints||0);k++)queue.push(d);});
  const startMin=(()=>{const m=String(R.start||'0:0').match(/(\d+):(\d+)/);return m?+m[1]*60+ +m[2]:0;})();
  let t=0,k=0,stints=[],tyreCount=0,prev=null,cum=0;
  while(t<T&&k<200){const d=fixed?(queue[k]||order[k%order.length]):order[k%order.length];
    const veLap=R.ve*d.mul;let maxL=Math.floor(R.veCap/veLap-(R.res||0));if(R.maxStint>0)maxL=Math.min(maxL,Math.floor(R.maxStint*60/d.lapS));if(maxL<1)maxL=1;
    let stop=0,tyres=false,swap=false;if(k>0){stop=R.pit;swap=prev&&prev!==d;if(swap)stop+=R.swap;tyreCount++;tyres=R.tyreEvery>0&&tyreCount%R.tyreEvery===0;if(tyres)stop+=R.tyre;}
    t+=stop;const remain=T-t;let laps=Math.min(maxL,Math.max(1,Math.ceil(remain/d.lapS)));const last=laps*d.lapS>=remain;if(last)laps=Math.ceil(remain/d.lapS);
    stints.push({d,start:t,laps,dur:laps*d.lapS,stop,tyres,swap,last,lap0:cum});cum+=laps;t+=laps*d.lapS;prev=d;k++;if(last)break;}
  return {stints,startMin,T,R};}
function planTimeAt(PS,n){for(const s of PS.stints){if(n<=s.lap0+s.laps)return s.start+(n-s.lap0)*s.d.lapS;}const s=PS.stints[PS.stints.length-1];return s?s.start+s.dur:NaN;}

// field helpers
function fCar(veh){return LIVE.field?.cars?.[veh];}
function fLaps(veh){const mk='fl|'+veh;if(LIVE.memo&&LIVE.memo.has(mk))return LIVE.memo.get(mk);const c=fCar(veh);let L=c?[...c.laps.values()].sort((a,b)=>a[0]-b[0]):[];
  // never show laps the car cannot have done (online counters can glitch)
  const row=(LIVE.sc?.v||[]).find(r=>r[2]===veh);const maxN=row?row[5]+1:(LIVE.sc?.i?.et>0?LIVE.sc.i.et/10+5:Infinity);L=L.filter(l=>l[0]>=1&&l[0]<=maxN&&!(l[1]>3600));
  if(LIVE.memo)LIVE.memo.set(mk,L);return L;}
function cleanLaps(L){const v=L.filter(l=>l[0]>1&&!l[3]&&!l[7]&&l[1]>0);const b=Math.min(...v.map(l=>l[1]));return v.filter(l=>l[1]<=b*1.07);}
function stintInfo(L){const pitL=L.filter(l=>l[3]).map(l=>l[0]);const runs=[];let prev=0;pitL.forEach(n=>{if(n-prev>2)runs.push(n-prev);prev=n;});
  const last=L.length?L[L.length-1][0]:0;return {pits:pitL,since:last-(pitL.length?pitL[pitL.length-1]:0),avgStint:med_(runs),lastPit:pitL.length?pitL[pitL.length-1]:null};}
function gapSeries(us,rv){const A=new Map(fLaps(us).map(l=>[l[0],l[2]]));return fLaps(rv).filter(l=>A.has(l[0])).map(l=>[l[0],A.get(l[0])-l[2]]);} // + = rival ahead

function liveLapsLoss(stt){ // measured pit losses for our car: pit laps − pace, and time stationary
  const L=stt.laps,pace=med_(L.filter(l=>!l.pit&&!l.inv&&l.n>1).map(l=>l.t));const outs=stt.evs.filter(e=>e.k==='pit_out').sort((a,b)=>a.et-b.et);const res=[];if(!Number.isFinite(pace))return res;
  for(let i=0;i<L.length;i++){if(!L[i].pit||(L[i-1]&&L[i-1].pit))continue;let j=i;while(L[j+1]&&L[j+1].pit&&j-i<2)j++;const g=L.slice(i,j+1);if(g.some(l=>!(l.t>0)))continue;
    const loss=g.reduce((a,l)=>a+l.t,0)-g.length*pace;const ev=outs.find(e=>e.et>=L[i].et-L[i].t-5&&e.et<=L[j].et+5);if(L[i].n>1&&loss>5&&loss<400)res.push({loss,stop:ev?.stop,lap:L[i].n});}
  return res;}

function drawGap(series){const cv=$('#lvGap');if(!cv)return;const r=cv.getBoundingClientRect(),dpr=devicePixelRatio||1;if(!r.width)return;cv.width=r.width*dpr;cv.height=r.height*dpr;const c=cv.getContext('2d');c.scale(dpr,dpr);
  const S=series.map(s=>({...s,gs:s.gs.slice(-40)})).filter(s=>s.gs.length>1);c.font='11px "JetBrains Mono",monospace';
  if(!S.length){c.fillStyle=tok('muted');c.fillText(tr('Il grafico dei distacchi compare dopo qualche giro.'),8,18);return;}
  const xs=S.flatMap(s=>s.gs.map(g=>g[0])),ys=S.flatMap(s=>s.gs.map(g=>g[1]));const x0=Math.min(...xs),x1=Math.max(...xs);let y0=Math.min(0,...ys),y1=Math.max(0,...ys);const pad=(y1-y0)*0.1||1;y0-=pad;y1+=pad;
  const L=44,R=10,T=10,B=22,W=r.width-L-R,H=r.height-T-B;const X=x=>L+(x-x0)/((x1-x0)||1)*W,Y=y=>T+(1-(y-y0)/(y1-y0))*H;
  c.strokeStyle=tok('grid');c.fillStyle=tok('faint');c.textAlign='right';niceTicks(y0,y1,4).forEach(t=>{const y=Y(t);c.beginPath();c.moveTo(L,y);c.lineTo(L+W,y);c.stroke();c.fillText((t>0?'+':'')+t,L-5,y+3);});
  c.strokeStyle=tok('muted');c.setLineDash([4,4]);c.beginPath();c.moveTo(L,Y(0));c.lineTo(L+W,Y(0));c.stroke();c.setLineDash([]);
  c.textAlign='center';niceTicks(x0,x1,6).forEach(t=>{if(t>=x0&&t<=x1)c.fillText('G'+t,X(t),r.height-6);});
  S.forEach(s=>{c.strokeStyle=s.col;c.lineWidth=2;c.beginPath();s.gs.forEach((g,i)=>i?c.lineTo(X(g[0]),Y(g[1])):c.moveTo(X(g[0]),Y(g[1])));c.stroke();});
  c.textAlign='left';c.fillStyle=tok('muted');c.fillText(tr('sopra lo 0 = rivale davanti (s)'),L+4,T+10);}

// ---- recorded sessions ----
function liveRecStore(j){const field={ses:j.field?.ses||'',cars:{},stream:[],streamSet:new Set()};Object.entries(j.field?.cars||{}).forEach(([v,c])=>{field.cars[v]={name:c.name,cls:c.cls,drivers:c.drivers||[],laps:new Map((c.laps||[]).map(l=>[l[0],l])),pits:c.pits||[],swaps:c.swaps||[]};});
  (j.stream||[]).forEach(l=>{const e=streamParse(l);if(e)field.stream.push(e);});
  const trk=j.sc?.i?.trk||'';
  return {drivers:{rec:{id:'rec',hi:{name:(j.drivers||[]).join(', '),car:j.car,cls:j.cls,on:false},car:null,carAt:0,laps:{car:j.car,cls:j.cls,ses:j.ses,laps:j.laps||[]},ev:{car:j.car,list:j.events||[]},seen:0}},
    sc:j.sc,scAt:Date.now()+1e12,buf:{},trail:new Map((LS.get('live:trk:'+trk,[])||[]).map(p=>[p[0]+','+p[1],p])),trailKey:trk,trailSaved:Date.now(),field,wx:j.forecast,wxh:j.wx||[],rst:null,pitRec:j.pit,j};}
function liveRecs(){return store.items.filter(x=>x.kind==='live');}
let LOCAL_RECS=[],LOCAL_RECS_AT=0;
function liveSrcSel(){const sel=$('#lvSrc');if(!sel)return;const local=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&location.port;
  if(local&&Date.now()-LOCAL_RECS_AT>60000){LOCAL_RECS_AT=Date.now();fetch('/sessions').then(r=>r.json()).then(l=>{LOCAL_RECS=l||[];LIVE.dirty=true;}).catch(()=>{});}
  const cur=LIVE.rec?LIVE.recId:'';const items=liveRecs();
  const o=`<option value="">${esc(tr('● In diretta'))}</option>`+items.map(it=>`<option value="${esc(it.id)}"${it.id===cur?' selected':''}>${esc(it.label)}</option>`).join('')+
    LOCAL_RECS.filter(x=>!items.some(it=>it.file===x.name)).map(x=>`<option value="bridge:${esc(x.name)}">${esc(recLabelName(x.name))} · ${esc(tr('su questo PC'))}</option>`).join('');
  if(sel.dataset.o!==o){sel.innerHTML=o;sel.dataset.o=o;}sel.value=cur;
  sel.onchange=async()=>{const v=sel.value;if(!v){LIVE.rec=null;LIVE.recId='';renderLive(true);return;}
    if(v.startsWith('bridge:')){try{const name=v.slice(7);const buf=await (await fetch('/sessions?name='+encodeURIComponent(name))).arrayBuffer();const it=await addFile(name,buf,{persist:true});liveHistory(it);LIVE.recId=it.id;LIVE.rec=liveRecStore(it.data);}catch(e){toast(tr('Registrazione non leggibile'));}}
    else{const it=liveRecs().find(x=>x.id===v);if(it){LIVE.recId=it.id;LIVE.rec=liveRecStore(it.data);}}
    LIVE.focus=LIVE.rec?.j?.car||LIVE.focus;renderLive(true);};}
function recLabelName(n){const m=n.match(/^(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)_(.+?)_([A-Za-z]+)\.de\.json$/);return m?`${m[6].replace(/-/g,' ')} · ${tr(m[7])} · ${m[3]}/${m[2]} ${m[4]}:${m[5]}`:n;}
function liveRecHead(stt,sc){const j=LIVE.rec.j;const L=stt.laps.filter(l=>!l.pit&&!l.inv&&l.t>0);const best=Math.min(...L.map(l=>l.t));const pace=med_(L.filter(l=>l.t<=best*1.05).map(l=>l.t));
  const row=(sc?.v||[]).find(r=>r[2]===j.car);const pic=row?(sc.v.filter(r=>r[3]===row[3]&&r[4]<=row[4]).length):null;
  $('#lvHead').innerHTML=`<div class="lvhead"><span class="clsdot" style="background:${LV_CLS(j.cls)}"></span><div><div class="ey">${esc(tr('Sessione registrata'))} · ${esc(j.cls||'')} · ${esc(j.car||'')}</div><h2 style="margin:0">${esc((j.drivers||[]).join(', ')||'—')}</h2></div><span class="pill">${esc(new Date(j.started).toLocaleString())}</span></div>`;
  $('#lvKpi').innerHTML=`<div class="kpis">${[liveTile('Posizione finale',row?'P'+row[4]:'—',pic?`P${pic} di classe`:''),liveTile('Giri',stt.laps.length,''),liveTile('Miglior giro',fmtLap(best),'','hl'),liveTile('Passo',fmtLap(pace),'mediana dei giri entro il 105%'),
    liveTile('Carburante / giro',fx(med_(L.map(l=>l.fuel).filter(v=>v>0)),2)+' L',''),liveTile('Energia / giro',fx(med_(L.map(l=>l.ve).filter(v=>v>0))*100,2)+' %',''),liveTile('Soste',row?row[13]:'—','')].join('')}</div>`;}
function liveHistory(it){try{const j=it.data;const L=(j.laps||[]).filter(l=>!l.pit&&!l.inv&&l.t>0&&l.n>1);if(!L.length)return;const best=Math.min(...L.map(l=>l.t));
  const trk=j.sc?.i?.trk||(j.ses||'').split('|')[0];const car=(j.car||'auto').replace(/\s*#\d+$/,'');const d=new Date(j.started);
  const H=LS.get('hist',{});H['live|'+it.file]={key:`${trk}|${car}`,date:d.getTime(),label:`${d.toLocaleDateString()} ${d.toTimeString().slice(0,5)} · live`,file:it.file,driver:(j.drivers||[]).join(', '),best,pace:med_(L.filter(l=>l.t<=best*1.05).map(l=>l.t)),n:L.length,track:avg_((j.wx||[]).map(w=>w[2])),cond:(j.wx||[]).some(w=>w[3]>0.05)?'pioggia':'asciutto',segs:[]};LS.set('hist',H);}catch(e){}}

// file loading: .de.json recordings from the bridge
(function(){
  const _ext=extOf;window.extOf=extOf=n=>/\.de\.json$/i.test(n)?'live':_ext(n);
  const _add=addFile;window.addFile=addFile=async function(name,buf,opts={}){
    if(/\.de\.json$/i.test(name)){const j=JSON.parse(new TextDecoder().decode(buf));if(j.de!=='live')throw new Error(tr('non è una registrazione del bridge'));
      const trk=j.sc?.i?.trk||(j.ses||'').split('|')[0];const it={kind:'live',id:'live:'+name,data:j,file:name,label:`${trk} · ${tr(sesName_(j.ses))} · ${new Date(j.started).toLocaleDateString()} ${new Date(j.started).toTimeString().slice(0,5)}`,sample:false};
      const old=store.items.findIndex(x=>x.id===it.id);if(old>=0)store.items.splice(old,1,it);else store.items.push(it);if(opts.persist)IDB.put({name,buf,added:Date.now()});liveHistory(it);return it;}
    return _add(name,buf,opts);};
  const fi=$('#fileIn');if(fi)fi.accept+=',.de.json';
})();
function sesName_(k){const s=+String(k||'').split('|')[1];return !Number.isFinite(s)?'Sessione':s===0?'Test':s<=4?'Prove':s<=8?'Qualifica':s===9?'Warmup':'Gara';}
