// ================= MURETTO LIVE =================
// Receives live data from the Data Engineer Bridge running on each driver's PC:
// locally (Server-Sent Events from http://localhost:8790) and/or through the team
// server (MQTT over WebSocket, payload deflate + AES-GCM with the team code key).
const LIVE={focus:LS.get('live:focus',''),cls:LS.get('live:cls',''),
  status:{local:'off',team:'off'},err:'',conns:[],dirty:true,lastRender:0,blocked:0,myId:'',
  L:{drivers:{},sc:null,scAt:0,buf:{},trail:new Map(),trailKey:'',trailSaved:0,field:{ses:'',cars:{},stream:[],streamSet:new Set()},wx:null,wxh:[],rst:null},rec:null,_w:false};
// data views: live store, or a recorded session when one is open (writes always go to the live store)
['drivers','sc','scAt','buf','trail','trailKey','trailSaved','field','wx','wxh','rst'].forEach(k=>Object.defineProperty(LIVE,k,{get(){return(!LIVE._w&&LIVE.rec)?LIVE.rec[k]:LIVE.L[k];},set(v){LIVE.L[k]=v;}}));
function fieldMerge(d,snap){const F=LIVE.L.field;if(d.ses&&d.ses!==F.ses){F.ses=d.ses;F.cars={};F.stream=[];F.streamSet=new Set();}
  const car=veh=>F.cars[veh]||(F.cars[veh]={name:'',cls:'',drivers:[],laps:new Map(),pits:[],swaps:[]});
  const addPit=(c,p)=>{if(!c.pits.some(x=>x.in===p.in))c.pits.push(p);};const addSwap=(c,w)=>{if(!c.swaps.some(x=>x.et===w.et))c.swaps.push(w);};
  if(snap){Object.entries(d.cars||{}).forEach(([veh,x])=>{const c=car(veh);if(x.name)c.name=x.name;if(x.cls)c.cls=x.cls;if(x.drivers)c.drivers=x.drivers;(x.laps||[]).forEach(l=>c.laps.set(l[0],l));(x.pits||[]).forEach(p=>addPit(c,p));(x.swaps||[]).forEach(w=>addSwap(c,w));});
    if(d.stream)streamAdd(d.stream,false);return;}
  (d.l||[]).forEach(([veh,lap])=>car(veh).laps.set(lap[0],lap));
  (d.p||[]).forEach(([veh,p])=>{const c=car(veh);const isNew=!c.pits.some(x=>x.in===p.in);addPit(c,p);if(isNew)liveNotify('pit',veh,p);});
  (d.s||[]).forEach(([veh,w])=>{const c=car(veh);const isNew=!c.swaps.some(x=>x.et===w.et);addSwap(c,w);if(w.to&&!c.drivers.includes(w.to))c.drivers.push(w.to);c.name=w.to||c.name;if(isNew)liveNotify('swap',veh,w);});}
// results stream lines (incidents, track limits, penalties, chat) for every car
const unesc=s=>s.replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function streamParse(line){const m=line.match(/^<(\w+)([^>]*)>([\s\S]*?)<\/\1>/);if(!m)return null;const at={};m[2].replace(/(\w+)="([^"]*)"/g,(_,k,v)=>{at[k]=unesc(v);});
  const e={tag:m[1],et:+at.et,txt:unesc(m[3]).trim(),drv:at.Driver||'',at};
  if(e.tag==='Incident'){const x=e.txt.match(/^(.+?)\(\d+\) reported contact \(([\d.]+)\) with (?:another vehicle (.+?)\(\d+\)|(.+))$/);if(x){e.drv=x[1].trim();e.other=x[3]?x[3].trim():null;e.wall=!x[3];e.mag=+x[2];}}
  else if(e.tag==='Penalty'&&!e.drv){const x=e.txt.match(/^(.+?) (served|received)/);if(x)e.drv=x[1];}
  else if(e.tag==='Sector'){const x=e.txt.match(/^(.+?)\(\d+\)/);if(x)e.drv=x[1];}
  return e;}
function streamAdd(lines,notify){const F=LIVE.L.field;F.stream=F.stream||[];F.streamSet=F.streamSet||new Set();
  lines.forEach(l=>{if(F.streamSet.has(l))return;F.streamSet.add(l);const e=streamParse(l);if(!e)return;
    if(e.tag==='Incident'&&e.other){const dup=F.stream.find(x=>x.tag==='Incident'&&Math.abs(x.et-e.et)<0.6&&x.drv===e.other&&x.other===e.drv);if(dup){dup.mag=Math.max(dup.mag,e.mag);return;}}
    F.stream.push(e);if(notify&&e.tag==='Penalty'&&/received/.test(e.txt))liveNotify('pen',null,e);});
  if(F.stream.length>3000)F.stream.splice(0,F.stream.length-3000);}
const BROKERS=[['EMQX (pubblico, gratis)','broker.emqx.io',8084,8883],['HiveMQ (pubblico, gratis)','broker.hivemq.com',8884,8883]];
const b64u={enc:b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
  dec:s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0))};
function teamParse(code){try{code=(code||'').trim();if(!code.startsWith('DE1-'))return null;const t=JSON.parse(new TextDecoder().decode(b64u.dec(code.slice(4))));if(!t.h||!t.t||!t.k||b64u.dec(t.k).length!==32)return null;return t;}catch(e){return null;}}
function teamMake({name,host,wp,tp,user,pass,tls}){const r=n=>crypto.getRandomValues(new Uint8Array(n));const t={h:host,wp:+wp,tp:+tp||8883,t:b64u.enc(r(9)),k:b64u.enc(r(32))};if(name)t.n=name;if(user)t.u=user;if(pass)t.p=pass;if(tls===false)t.s=false;
  return 'DE1-'+b64u.enc(new TextEncoder().encode(JSON.stringify(t)));}

// ---- tiny MQTT 3.1.1 client over WebSocket (subscribe only) ----
function mqttWS(url,{user,pass,subs,onMsg,onState}){
  const te=new TextEncoder(),td=new TextDecoder();let ws,ping,closed=false,retry=1500,opened=false;
  const len=n=>{const o=[];do{let d=n%128;n=Math.floor(n/128);if(n>0)d|=128;o.push(d);}while(n>0);return o;};
  const str=s=>{const b=te.encode(s);return [b.length>>8,b.length&255,...b];};
  const pkt=(h,body)=>new Uint8Array([h,...len(body.length),...body]);
  function connect(){
    opened=false;onState('connecting');
    try{ws=new WebSocket(url,['mqtt']);}catch(e){onState('blocked');return;}
    ws.binaryType='arraybuffer';let buf=new Uint8Array(0);
    ws.onopen=()=>{opened=true;let fl=2;const pl=[...str('dev-'+Math.random().toString(36).slice(2,10))];if(user){fl|=128;pl.push(...str(user));if(pass){fl|=64;pl.push(...str(pass));}}
      ws.send(pkt(0x10,[...str('MQTT'),4,fl,0,60,...pl]));};
    ws.onmessage=e=>{const d=new Uint8Array(e.data),nb=new Uint8Array(buf.length+d.length);nb.set(buf);nb.set(d,buf.length);buf=nb;
      for(;;){if(buf.length<2)break;let i=1,n=0,m=1,b;do{if(i>=buf.length)return;b=buf[i++];n+=(b&127)*m;m*=128;}while(b&128);
        if(buf.length<i+n)break;const h=buf[0],body=buf.subarray(i,i+n);buf=buf.slice(i+n);const ty=h>>4;
        if(ty===2){if(body[1]!==0){onState('refused');ws.close();return;}retry=1500;
          ws.send(pkt(0x82,[0,1,...subs.flatMap(s=>[...str(s),0])]));clearInterval(ping);ping=setInterval(()=>{try{ws.send(new Uint8Array([0xC0,0]));}catch(e){}},25000);onState('on');}
        else if(ty===3){const tl=(body[0]<<8)|body[1];const topic=td.decode(body.subarray(2,2+tl));let off=2+tl;if((h>>1)&3)off+=2;onMsg(topic,body.slice(off),(h&1)===1);}}};
    ws.onclose=()=>{clearInterval(ping);if(closed)return;onState(opened?'off':'blocked');setTimeout(connect,retry);retry=Math.min(retry*2,8000);};
    ws.onerror=()=>{};
  }
  connect();
  return {close(){closed=true;clearInterval(ping);try{ws.close();}catch(e){}},
    pub(topic,bytes,retain){try{if(!ws||ws.readyState!==1)return false;ws.send(pkt(0x30|(retain?1:0),[...str(topic),...bytes]));return true;}catch(e){return false;}}};
}

async function liveKey(t){if(!t._k)t._k=await crypto.subtle.importKey('raw',b64u.dec(t.k),'AES-GCM',false,['decrypt']);return t._k;}
// ---- Data Engineer relay (our own server on Cloudflare): WebSocket, same topics and payloads as MQTT ----
function relayWS(base,{room,sub,onMsg,onState}){const te=new TextEncoder(),td=new TextDecoder();let ws,closed=false,retry=1000,opened=false,ping,last=0;
  const url=base.replace(/\/+$/,'').replace(/^http/,'ws')+'/ws?room='+encodeURIComponent(room)+'&sub='+(sub||'all')+'&v=1';
  const rec=(type,flags,topic,payload)=>{const t=te.encode(topic);const b=new Uint8Array(8+t.length+payload.length),dv=new DataView(b.buffer);b[0]=type;b[1]=flags;dv.setUint16(2,t.length);dv.setUint32(4,payload.length);b.set(t,8);b.set(payload,8+t.length);return b;};
  function connect(){opened=false;onState('connecting');try{ws=new WebSocket(url);}catch(e){onState('blocked');return;}ws.binaryType='arraybuffer';
    ws.onopen=()=>{opened=true;retry=1000;last=Date.now();onState('on');clearInterval(ping);ping=setInterval(()=>{try{ws.send('ping');}catch(e){}if(Date.now()-last>50e3){try{ws.close();}catch(e){}}},20e3);};
    ws.onmessage=e=>{last=Date.now();if(typeof e.data==='string')return;const b=new Uint8Array(e.data),dv=new DataView(e.data);let o=0;
      while(o+8<=b.length){const ty=b[o],fl=b[o+1],tl=dv.getUint16(o+2),pl=dv.getUint32(o+4);o+=8;if(o+tl+pl>b.length)break;const topic=td.decode(b.subarray(o,o+tl));const p=b.slice(o+tl,o+tl+pl);o+=tl+pl;if(ty===2)onMsg(topic,p,(fl&1)===1);}};
    ws.onclose=()=>{clearInterval(ping);if(closed)return;onState(opened?'off':'blocked');setTimeout(connect,retry);retry=Math.min(retry*2,8000);};ws.onerror=()=>{};}
  connect();
  return {close(){closed=true;clearInterval(ping);try{ws.close();}catch(e){}},pub(topic,bytes,retain){try{if(!ws||ws.readyState!==1)return false;ws.send(rec(1,retain?1:0,topic,bytes));return true;}catch(e){return false;}}};}
async function liveSeal(t,obj){if(!t._ke)t._ke=await crypto.subtle.importKey('raw',b64u.dec(t.k),'AES-GCM',false,['encrypt']);
  const z=new Blob([new TextEncoder().encode(JSON.stringify(obj))]).stream().pipeThrough(new CompressionStream('deflate-raw'));const pt=new Uint8Array(await new Response(z).arrayBuffer());
  const iv=crypto.getRandomValues(new Uint8Array(12));const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},t._ke,pt));const out=new Uint8Array(12+ct.length);out.set(iv);out.set(ct,12);return out;}
async function liveOpen(t,bytes){const k=await liveKey(t);const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},k,bytes.slice(12));
  const s=new Blob([pt]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return JSON.parse(await new Response(s).text());}

function liveIn(id,kind,d,ret){LIVE._w=true;try{liveIn_(id,kind,d,ret);}finally{LIVE._w=false;}}
// Old data must not come back as if it were live (a closed bridge, a finished session).
// From the team server: the server marks the "retained" copies it replays on connect.
// Those wait until the same bridge sends something live; then they are the latest state.
// No clock comparison between PCs (their clocks can differ by minutes).
// From the bridge on this PC (same clock): the age of the data decides.
const LIVE_STALE={setup:100e3,sc:30e3,field:100e3,laps:100e3,ev:100e3,pit:100e3,wx:100e3,car:30e3,fl:100e3,stl:100e3,rst:100e3};
const LIVE_GATED=new Set(Object.keys(LIVE_STALE));
function liveRegate(){Object.values(LIVE.gate||{}).forEach(g=>{g.live=false;g.pend=[];});}
function liveIn_(id,kind,d,ret){
  if(kind==='id'){LIVE.myId=d;return;}
  const G=LIVE.gate||(LIVE.gate={});const g=G[id]||(G[id]={live:false,pend:[],lastLive:0});
  if(ret===undefined){ // local bridge (Server-Sent Events): same PC, same clock
    if(LIVE_STALE[kind]&&d&&typeof d==='object'){if(d.t){if(Date.now()-d.t>LIVE_STALE[kind])return;}else if(Date.now()-(LIVE.subAt||0)<4000)return;}
    if(kind==='hi'){const was=g.live;g.live=d.on!==false&&!!d.lmu;g.lastLive=Date.now();if(g.live&&!was){const P=g.pend;g.pend=[];P.forEach(([k,x])=>liveIn_(id,k,x));}if(!g.live)g.pend=[];}
  }else if(ret){ // replayed by the server: hold until the bridge shows it is live now
    if(!g.live||Date.now()-g.lastLive>60e3){if(LIVE_GATED.has(kind)||kind==='hi'){g.pend=g.pend.filter(x=>x[0]!==kind);g.pend.push([kind,d]);}return;}
  }else{ // live message
    g.lastLive=Date.now();const on=kind==='hi'?(d.on!==false&&!!d.lmu):true;
    if(kind==='hi'&&d.on===false){g.live=false;g.pend=[];}
    else if(on&&!g.live){g.live=true;const P=g.pend;g.pend=[];P.forEach(([k,x])=>{if(k!==kind)liveIn_(id,k,x,false);});}
    else if(!on){g.live=false;g.pend=[];}
  }
  if(LIVE_GATED.has(kind)&&ret===undefined&&!g.live&&id!==''){g.pend=g.pend.filter(x=>x[0]!==kind);g.pend.push([kind,d]);return;}
  if(kind==='field'||kind==='fl'){fieldMerge(d,kind==='field');LIVE.dirty=true;return;}
  if(kind==='wx'){LIVE.wx=d;LIVE.dirty=true;return;}
  if(kind==='stl'){if(d.ses&&LIVE.L.field.ses&&d.ses!==LIVE.L.field.ses)return;streamAdd(d.l||[],true);LIVE.dirty=true;return;}
  if(kind==='rst'){LIVE.L.rst={at:Date.now(),l:d.l||[]};LIVE.dirty=true;return;}
  const D=LIVE.drivers[id]||(LIVE.drivers[id]={id,hi:null,car:null,carAt:0,laps:null,ev:null,seen:0});D.seen=Date.now();
  if(kind==='hi')D.hi=d;
  else if(kind==='car'){D.car=d;D.carAt=Date.now();const k=d.car||id;const B=LIVE.buf[k]||(LIVE.buf[k]=[]);(d.smp||[]).forEach(s=>{if(!B.length||s[0]>B[B.length-1][0])B.push(s);else if(s[0]<B[B.length-1][0]-5)B.length=0,B.push(s);});
    while(B.length&&B[B.length-1][0]-B[0][0]>90)B.shift();
    if(LIVE.trailKey&&(d.x||d.z)&&!d.pit){const x=Math.round(d.x/4)*4,z=Math.round(d.z/4)*4,k=x+','+z;if(!LIVE.trail.has(k)&&LIVE.trail.size<6000)LIVE.trail.set(k,[x,z]);}}
  else if(kind==='sc'){if(!LIVE.sc||Date.now()-LIVE.scAt>1500||d.i?.et>=(LIVE.sc.i?.et||0)||d.i?.trk!==LIVE.sc.i?.trk){LIVE.sc=d;LIVE.scAt=Date.now();liveTrail(d);
    const H=LIVE.L.wxh||(LIVE.L.wxh=[]);const I=d.i||{};if(!H.length||I.et<H[H.length-1][0]||I.et-H[H.length-1][0]>=30)H.push([I.et,I.air,I.tt,I.rain,I.wavg]);if(H.length&&I.et<H[0][0]-1)LIVE.L.wxh=[[I.et,I.air,I.tt,I.rain,I.wavg]];if(H.length>2000)H.shift();}}
  else if(kind==='laps')D.laps=d;
  else if(kind==='ev')D.ev=d;
  else if(kind==='pit'){D.pit=d;D.pitAt=Date.now();}
  else if(kind==='setup'){const prev=D.setup?.v;D.setup=d;D.setupAt=Date.now();if(prev&&d.v)setupDiff(id,prev,d);}
  LIVE.dirty=true;
}
function liveTrail(sc){const key=sc.i?.trk||'';if(key!==LIVE.trailKey){LIVE.trailKey=key;LIVE.trail=new Map((LS.get('live:trk:'+key,[])||[]).map(p=>[p[0]+','+p[1],p]));LIVE.trailSaved=Date.now();}
  if(!LIVE.L.trail.set)return;
  sc.v.forEach(r=>{if(r[15]||r[30])return;const x=Math.round(r[21]/4)*4,z=Math.round(r[22]/4)*4;if(!x&&!z)return;const k=x+','+z;if(!LIVE.trail.has(k)&&LIVE.trail.size<6000)LIVE.trail.set(k,[x,z]);});
  if(Date.now()-LIVE.trailSaved>30000){LIVE.trailSaved=Date.now();LS.set('live:trk:'+key,[...LIVE.trail.values()]);}}

function liveStart(){
  LIVE.conns.forEach(c=>c.close());LIVE.conns=[];LIVE.status={local:'off',team:'off'};
  const local=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&location.port;
  if(local&&window.EventSource){const es=new EventSource('/live');LIVE.status.local='connecting';
    es.onopen=()=>{LIVE.status.local='on';LIVE.subAt=Date.now();LIVE.dirty=true;};es.onerror=()=>{LIVE.status.local='off';LIVE.dirty=true;};
    es.onmessage=e=>{try{const m=JSON.parse(e.data);liveIn(m.k==='id'?'':LIVE.myId||'local',m.k,m.d);}catch(x){}};
    LIVE.conns.push({close:()=>es.close()});}
  const t=teamParse(LS.get('live:team',''));
  const relay=t&&(t.r||LS.get('relay:url',''));LIVE.via=t?(relay?'relay':'mqtt'):'';
  const onState=s=>{LIVE.status.team=s;if(s==='on'){LIVE.subAt=Date.now();liveRegate();}if(s==='blocked')LIVE.blocked++;else if(s==='on')LIVE.blocked=0;LIVE.dirty=true;};
  const onMsg=async(topic,bytes,ret)=>{const p=topic.split('/');if(p.length!==4||!bytes.length)return;try{liveIn(p[2],p[3],await liveOpen(t,bytes),ret);}catch(e){LIVE.err='Dati non leggibili: il codice squadra è diverso da quello dei piloti.';LIVE.dirty=true;}};
  if(t&&relay){LIVE.conns.push(LIVE.mq=relayWS(relay,{room:t.t,sub:'all',onState,onMsg}));}
  else if(t){const url=(t.s===false?'ws://':'wss://')+t.h+':'+t.wp+'/mqtt';
    LIVE.conns.push(LIVE.mq=mqttWS(url,{user:t.u,pass:t.p,subs:['de/'+t.t+'/+/+'],
      onState,onMsg}));}
  LIVE.dirty=true;
}

// ---- helpers ----
const LV_CLS=c=>/hyper|lmh|lmdh/i.test(c)?'#FF3B3B':/lmp2/i.test(c)?'#1E6BFF':/lmp3/i.test(c)?'#9B30FF':/gt3/i.test(c)?'#19D26B':/gte/i.test(c)?'#F5C518':'#8B96A5';
const hms=s=>{if(!Number.isFinite(s)||s<0)return '—';s=Math.floor(s);return `${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
const SESN=s=>s===0?'Test':s<=4?'Prove '+s:s<=8?'Qualifica':s===9?'Warmup':'Gara';
const FCY=['','in arrivo','box chiusi','box aperti ai doppiati','box aperti','ultimo giro di SC','ripartenza','gara sospesa'];
const ZONES=['anteriore','anteriore sx','fianco sx','fianco dx','posteriore sx','posteriore dx','posteriore','anteriore dx'];
const WN=['Ant. sx','Ant. dx','Post. sx','Post. dx'];
function liveCars(){const g={};Object.values(LIVE.drivers).forEach(D=>{const car=D.car?.car||D.hi?.car||D.laps?.car;if(!car)return;(g[car]=g[car]||[]).push(D);});return g;}
function liveCarState(car){const Ds=liveCars()[car]||[];const act=Ds.filter(D=>D.car&&Date.now()-D.carAt<8000).sort((a,b)=>b.carAt-a.carAt)[0];
  const lapsM=new Map();let ses='';Ds.forEach(D=>{if(D.laps?.ses&&(!ses||D===act))ses=D.laps.ses;});
  Ds.filter(D=>D.laps&&(!ses||D.laps.ses===ses)).forEach(D=>(D.laps.laps||[]).forEach(l=>lapsM.set(l.n,l)));
  const evs=new Map();Ds.forEach(D=>(D.ev?.list||[]).forEach(e=>evs.set(e.k+'|'+e.et+'|'+(e.drv||''),e)));
  const last=Ds.filter(D=>D.car).sort((a,b)=>b.carAt-a.carAt)[0];
  return {Ds,act,c:(act||last)?.car||null,live:!!act,laps:[...lapsM.values()].sort((a,b)=>a.n-b.n),evs:[...evs.values()].sort((a,b)=>b.et-a.et)};}
function liveStrat(st,sc){const c=st.c;if(!c)return null;const g=st.laps.filter(l=>!l.pit&&l.n>1&&l.fuel>0&&l.t>0).slice(-5);
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[s.length>>1]:NaN;};
  const fpl=avg(g.map(l=>l.fuel)),vpl=avg(g.filter(l=>l.ve>0).map(l=>l.ve)),lt=med(g.filter(l=>!l.inv).map(l=>l.t))||c.estL||NaN;
  const lf=c.fuel/fpl,lv=c.ve>0&&vpl>0?c.ve/vpl:NaN;const left=Math.min(lf,Number.isFinite(lv)?lv:Infinity);
  const I=sc?.i||{};let toGo=NaN;if(I.maxLaps>0&&I.maxLaps<99999)toGo=I.maxLaps-(c.lap-1);else if(I.rem>0&&lt>0)toGo=Math.ceil(I.rem/lt+(1-((c.til||0)/lt)))+0;
  const stint=Math.min(c.fuelCap>0&&fpl>0?c.fuelCap/fpl:Infinity,vpl>0?1/vpl:Infinity);
  const stops=Number.isFinite(toGo)&&Number.isFinite(left)?(left>=toGo?0:Math.ceil((toGo-left)/stint)):NaN;
  return {fpl,vpl,lt,lf,lv,left,lim:Number.isFinite(lv)&&lv<lf?'ve':'fuel',toGo,stint,stops,lastLap:Number.isFinite(left)?c.lap-1+Math.floor(left):NaN,need:Number.isFinite(toGo)&&fpl>0?Math.max(0,toGo*fpl-c.fuel):NaN,n:g.length};}
function evText(e){const w=n=>tr(WN[n]||'');
  switch(e.k){case 'pit_in':return `Entra ai box · carburante ${fx(e.fuel,1)} L`;case 'pit_out':return `Esce dai box · ${e.add>0.5?'+'+fx(e.add,1)+' L':'senza rifornimento'}${e.tyres?' · '+e.tyres+' gomme'+(e.cf?' '+e.cf:''):''}`;
    case 'hit':return `Contatto / urto (forza ${fx(e.mag,0)})`;case 'dent':return `Danni: ${ZONES[e.z]||'carrozzeria'} (${e.lvl>=2?'gravi':'lievi'})`;case 'flat':return `Foratura: ${w(e.w)}`;
    case 'ovh':return `Motore in surriscaldamento (acqua ${fx(e.water,0)} °C, olio ${fx(e.oil,0)} °C)`;case 'pen':return `Penalità da scontare: ${e.n}`;case 'blue':return 'Bandiera blu';
    case 'fcy':return e.s>0?`Neutralizzazione: ${FCY[e.s]||e.s}`:'Fine neutralizzazione';case 'inv':return 'Giro invalidato';case 'drv_on':return `${e.drv||'Pilota'} in auto`;case 'drv_off':return `${e.drv||'Pilota'} esce dall'auto`;case 'ses':return 'Nuova sessione';default:return e.k;}}
const EVC={pit_in:'info',pit_out:'info',hit:'bad',dent:'bad',flat:'bad',ovh:'bad',pen:'bad',blue:'warn',fcy:'warn',inv:'bad',drv_on:'good',drv_off:'info',ses:'info'};

// ---- view: see ui14.js ----
function liveNewTeam(){openModal('#mLive');const sel=$('#lvBroker');sel.innerHTML=BROKERS.map((b,i)=>`<option value="${i}">${esc(b[0])}</option>`).join('')+`<option value="c">${esc(tr('Server mio (es. HiveMQ Cloud gratuito)'))}</option>`;
  const upd=()=>{$('#lvCustom').hidden=sel.value!=='c';};sel.onchange=upd;upd();
  $('#lvMake').onclick=()=>{const name=$('#lvTName').value.trim();let o;if(sel.value==='c'){o={host:$('#lvH').value.trim(),wp:$('#lvWP').value||8884,tp:$('#lvTP').value||8883,user:$('#lvU').value.trim(),pass:$('#lvP').value};if(!o.host){toast(tr('Inserisci l\'indirizzo del server'));return;}}
    else{const b=BROKERS[+sel.value];o={host:b[1],wp:b[2],tp:b[3]};}
    const code=teamMake({name,...o});LS.set('live:team',code);$('#mLive').hidden=true;liveStart();
    openCode({title:tr('Codice squadra'),help:tr('Squadra creata. Manda questo codice ai piloti: lo incollano nel bridge alla prima apertura. Chi ha il codice vede i dati: non pubblicarlo.'),text:code});};}

function liveTile(l,v,s,cls=''){return `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${v}</div>${s?`<div class="s">${s}</div>`:''}</div>`;}
function drawLiveMap(sc,ours){const cv=$('#lvMap');if(!cv)return;const r=cv.getBoundingClientRect(),dpr=devicePixelRatio||1;if(!r.width)return;cv.width=r.width*dpr;cv.height=r.height*dpr;const c=cv.getContext('2d');c.scale(dpr,dpr);
  const pts=[...LIVE.trail.values()];const cars=(sc?.v||[]).filter(v=>!v[30]&&(v[21]||v[22]));const all=pts.length>30?pts:cars.map(v=>[v[21],v[22]]);
  if(!all.length){c.fillStyle=tok('muted');c.font='12px "Titillium Web",sans-serif';c.fillText(tr('La pista si disegna dai dati dopo qualche giro.'),10,20);return;}
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;all.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  const pad=16,s=Math.min((r.width-2*pad)/((x1-x0)||1),(r.height-2*pad)/((z1-z0)||1));const ox=(r.width-(x1-x0)*s)/2,oz=(r.height-(z1-z0)*s)/2;
  const T=(x,z)=>[ox+(x-x0)*s,r.height-(oz+(z-z0)*s)];
  c.fillStyle=tok('trackbed');pts.forEach(([x,z])=>{const [a,b]=T(x,z);c.fillRect(a-1.5,b-1.5,3,3);});
  const focus=LIVE.focus;cars.sort((a,b)=>(ours.includes(a[2])?1:0)-(ours.includes(b[2])?1:0));
  cars.forEach(v=>{const [a,b]=T(v[21],v[22]);const mine=ours.includes(v[2]);c.beginPath();c.arc(a,b,mine?7:4.5,0,7);c.fillStyle=LV_CLS(v[3]);c.fill();
    if(mine){c.lineWidth=2.5;c.strokeStyle=v[2]===focus?tok('accent')||'#fff':'#fff';c.stroke();c.fillStyle=tok('ink');c.font='600 11px "Titillium Web",sans-serif';c.fillText((v[1]||'').split(' ').pop()+' P'+v[4],a+10,b+4);}});
  $('#lvMapNote').textContent=pts.length<200?tr('pista in costruzione…'):'';}
function drawLiveInputs(B){const cv=$('#lvIn');if(!cv)return;const r=cv.getBoundingClientRect(),dpr=devicePixelRatio||1;if(!r.width)return;cv.width=r.width*dpr;cv.height=r.height*dpr;const c=cv.getContext('2d');c.scale(dpr,dpr);
  if(B.length<2){c.fillStyle=tok('muted');c.font='12px "Titillium Web",sans-serif';c.fillText(tr('Nessun dato: l\'auto non è in pista.'),10,20);return;}
  const t1=B[B.length-1][0],t0=t1-60,L=34,W=r.width-L-6,H=r.height;const X=t=>L+(t-t0)/60*W;const h1=H*0.58,h2=H-h1-14;
  c.strokeStyle=tok('grid');c.fillStyle=tok('faint');c.font='10px "JetBrains Mono",monospace';c.textAlign='right';
  [0,100,200,300].forEach(v=>{const y=h1-(v/340)*h1+4;c.beginPath();c.moveTo(L,y);c.lineTo(L+W,y);c.stroke();c.fillText(v,L-4,y+3);});
  const line=(i,y0,hh,max,col)=>{c.beginPath();c.strokeStyle=col;c.lineWidth=1.6;let st=false;B.forEach(s=>{if(s[0]<t0)return;const x=X(s[0]),y=y0+hh-(s[i]/max)*hh;st?c.lineTo(x,y):(c.moveTo(x,y),st=true);});c.stroke();};
  line(1,4,h1-4,340,tok('lapA'));const y2=h1+12;c.fillText('100%',L-4,y2+6);c.fillText('0',L-4,y2+h2);
  line(2,y2,h2,1,tok('good'));line(3,y2,h2,1,tok('bad'));}

// ---- wiring ----
(function(){
  const tabs=$('.tabs');if(tabs&&!$('#t-live')){const b=document.createElement('button');b.className='tab';b.setAttribute('role','tab');b.id='t-live';b.dataset.view='live';b.setAttribute('aria-selected','false');b.innerHTML='<span class="livedot"></span>Muretto';tabs.appendChild(b);b.onclick=()=>showView('live');}
  if(!$('#v-live')){const s=document.createElement('section');s.className='view';s.id='v-live';s.hidden=true;$('#v-team').after(s);}
  RENDER.live=()=>renderLive(true);
  const os=showView;window.showView=showView=function(v){$('#hero').hidden=v==='live';os(v);};
  setInterval(()=>{renderLive(false);const on=LIVE.status.local==='on'||LIVE.status.team==='on';document.body.classList.toggle('live-on',on&&Object.values(LIVE.drivers).some(D=>Date.now()-D.carAt<8000));},400);
  addEventListener('resize',()=>{if(curView()==='live')renderLive(true);});
  if(LS.get('live:team','')||/^(localhost|127\.0\.0\.1)$/.test(location.hostname))liveStart();
})();
