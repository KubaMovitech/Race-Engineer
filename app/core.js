// ================= CORE: parsing + analysis =================
const UNIT_GUESS=[[/Speed$|Straight Speed|Corner Speed/,'km/h'],[/Pos(\sFiltered)?$|Bias|Wear|Grip Fract|Charge Level|Brake Pressure/,'%'],[/Temp/,'°C'],[/Pressure|Boost/,'kPa'],[/Height|Susp Pos|3rd Pos|Deflection/,'mm'],[/RPM/,'rpm'],[/G Force/,'G'],[/Fuel Level/,'l'],[/Load|Force|Downforce|Drag/,'N'],[/Distance|Lateral|Edge/,'m'],[/Torque/,'N·m'],[/Time|Laptime|Sector|Delta/,'s']];
function guessUnit(n){for(const [re,u] of UNIT_GUESS) if(re.test(n)) return u; return '';}
function f16(h){const s=(h&0x8000)?-1:1,e=(h>>10)&0x1f,m=h&0x3ff;if(e===0)return s*Math.pow(2,-14)*(m/1024);if(e===31)return m?NaN:s*Infinity;return s*Math.pow(2,e-15)*(1+m/1024);}

function parseLD(buf){
  const dv=new DataView(buf),u8=new Uint8Array(buf),L=buf.byteLength,dec=new TextDecoder('latin1');
  const str=(o,n)=>{if(o+n>L)return'';let e=o;while(e<o+n&&u8[e])e++;return dec.decode(u8.subarray(o,e)).trim();};
  if(L<0x200) throw new Error('File .ld troppo piccolo');
  const meta={date:str(0x5e,16),time:str(0x7e,16),driver:str(0x9e,64),car:str(0xde,64),venue:str(0x15e,64)};
  let p=dv.getUint32(8,true);const ch={};let guard=0;
  while(p&&p+124<=L&&guard++<4000){
    const next=dv.getUint32(p+4,true),dp=dv.getUint32(p+8,true),n=dv.getUint32(p+12,true);
    const dta=dv.getUint16(p+18,true),dt=dv.getUint16(p+20,true),f=dv.getUint16(p+22,true);
    const sh=dv.getInt16(p+24,true),mul=dv.getInt16(p+26,true),sc=dv.getInt16(p+28,true),dp10=dv.getInt16(p+30,true);
    const name=str(p+32,32),unit=str(p+72,12);
    const size=dt===1?1:dt===2?2:4;
    if(name&&n>0&&dp+n*size<=L){
      const k=mul/(sc||1)*Math.pow(10,-dp10);
      const decode=()=>{const v=new Float32Array(n);
        if(dta!==7&&dp%size===0){const A=size===1?new Int8Array(buf,dp,n):size===2?new Int16Array(buf,dp,n):new Int32Array(buf,dp,n);for(let i=0;i<n;i++)v[i]=A[i]*k+sh;return v;}
        for(let i=0,o=dp;i<n;i++,o+=size){if(dta===7){v[i]=size===4?dv.getFloat32(o,true):f16(dv.getUint16(o,true));}else{const r=size===1?dv.getInt8(o):size===2?dv.getInt16(o,true):dv.getInt32(o,true);v[i]=r*k+sh;}}
        return v;};
      const c={f:f||1,u:unit||guessUnit(name),n,_v:null};Object.defineProperty(c,'v',{get(){return this._v||(this._v=decode());}});
      ch[name]=c;
    }
    if(next===p)break;p=next;
  }
  if(!ch['Ground Speed']) throw new Error('Canale "Ground Speed" non trovato: il file non sembra una telemetria LMU');
  return {meta,ch};
}

function sampleAt(c,t){const x=t*c.f,v=c.v,n=v.length;if(x<=0)return v[0];if(x>=n-1)return v[n-1];const i=x|0,a=x-i;return v[i]+(v[i+1]-v[i])*a;}
function sampleStep(c,t){const n=c.v.length;let i=Math.round(t*c.f);if(i<0)i=0;if(i>n-1)i=n-1;return c.v[i];}
const STEP_CH=/Gear|Lap Number|Current Sector|In Pits|Flag|State|Compound|Activated/;

function buildSession(parsed,name){
  const ch=parsed.ch,sp=ch['Ground Speed'];
  const dur=sp.v.length/sp.f;
  const S={id:'ld:'+name,kind:'ld',name,meta:parsed.meta,ch,dur,laps:[],cache:new Map()};
  const ln=ch['Lap Number'];
  const cuts=[0];const nums=[];
  if(ln){let prev=ln.v[0];nums.push(prev);for(let i=1;i<ln.v.length;i++){if(ln.v[i]!==prev){cuts.push(i/ln.f);prev=ln.v[i];nums.push(prev);}}}
  else nums.push(0);
  cuts.push(dur);
  refineCuts(ch,cuts);
  // session elapsed time offset (robust to integer-quantised channels)
  const et=ch['Session Elapsed Time'];if(et){const d=[];for(let i=0;i<et.v.length;i+=Math.max(1,et.f))d.push(et.v[i]-i/et.f);S.et0=median(d);}else S.et0=0;
  const pit=ch['In Pits'];
  // race start: first switch of Game Phase to green (5) inside the first segment
  let tGreen=null;const gp=ch['Game Phase'];if(gp){for(let i=1;i<gp.v.length;i++){if(gp.v[i]===5&&gp.v[i-1]!==5){tGreen=i/gp.f;break;}}}
  S.tGreen=tGreen;
  for(let k=0;k<nums.length;k++){
    let t0=cuts[k];const t1=cuts[k+1];const isStart=k===0&&nums.length>1&&tGreen!=null&&tGreen>t0&&tGreen<t1-20;if(isStart)t0=tGreen;if(t1-t0<5)continue;
    const complete=k>0&&k<nums.length-1;
    const pitS=pit?sampleStep(pit,t0+0.3)>0.5:false,pitE=pit?sampleStep(pit,t1-0.3)>0.5:false;
    let type=complete?'lanciato':(isStart?'partenza':'parziale');if(complete&&pitS)type='uscita box';if(complete&&pitE)type='rientro box';
    const L={i:S.laps.length,num:nums[k],t0,t1,time:t1-t0,complete,type,et:S.et0+t0,flags:[],start:isStart};
    const ll=ch['Last Laptime'];if(S._llq==null&&ll){let q=0,m=0;const v=ll.v;for(let i=0;i<v.length;i+=Math.max(1,ll.f)){if(v[i]>10){m++;if(Math.abs(v[i]*10-Math.round(v[i]*10))<1e-3)q++;}}S._llq=m>0&&q/m>0.9;}
    if(ll&&complete&&!S._llq){const v=sampleStep(ll,Math.min(dur-0.01,t1+0.6));if(Math.abs(v-L.time)<0.3){L.time=v;L.official=true;}}
    S.laps.push(L);
  }
  // distance per lap for sanity (reject laps shorter than 85% of median)
  const full=S.laps.filter(l=>l.complete);
  full.forEach(l=>{l.len=lapTrace(S,l).len;});
  const med=median(full.map(l=>l.len));
  full.forEach(l=>{if(l.len<med*0.85){l.complete=false;l.type='incompleto';}});
  S.trackLen=med||0;
  pickBest(S);
  S.cond=conditions(S);
  return S;
}
function median(a){a=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return NaN;const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function mean(a){let s=0,n=0;for(const x of a)if(Number.isFinite(x)){s+=x;n++;}return n?s/n:NaN;}
function pct(a,p){a=Array.from(a).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return NaN;const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return a[lo]+(a[hi]-a[lo])*(i-lo);}
function std(a){const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)*(x-m))));}
function has(S,n){return !!S.ch[n];}

// time-domain trace at 50 Hz, with cumulative distance
function lapTrace(S,lap){
  const key='tr'+lap.i;if(S.cache.has(key))return S.cache.get(key);
  const dt=0.02,n=Math.max(2,Math.floor(lap.time/dt)+1),sp=S.ch['Ground Speed'];
  const t=new Float32Array(n),d=new Float32Array(n),v=new Float32Array(n);
  for(let i=0;i<n;i++){t[i]=Math.min(i*dt,lap.time);v[i]=Math.max(0,sampleAt(sp,lap.t0+t[i]));if(i)d[i]=d[i-1]+(v[i]+v[i-1])/2/3.6*(t[i]-t[i-1]);}
  const tr={t,d,v,len:d[n-1]};S.cache.set(key,tr);return tr;
}
// times (s from lap start) at given own-lap distances
function timeAtDist(tr,ds){
  const out=new Float32Array(ds.length);let k=0;const d=tr.d,t=tr.t,n=d.length;
  for(let i=0;i<ds.length;i++){const x=ds[i];while(k<n-2&&d[k+1]<x)k++;const d0=d[k],d1=d[k+1];const a=d1>d0?Math.min(1,Math.max(0,(x-d0)/(d1-d0))):0;out[i]=t[k]+(t[k+1]-t[k])*a;}
  return out;
}
// lap on a distance grid; scale lets another lap map onto this grid
function lapGrid(S,lap,step=2,refLen){
  const key='g'+lap.i+'_'+step+'_'+(refLen||0);if(S.cache.has(key))return S.cache.get(key);
  const tr=lapTrace(S,lap),L=refLen||tr.len,n=Math.floor(L/step)+1;
  const d=new Float32Array(n);for(let i=0;i<n;i++)d[i]=i*step;
  const scale=tr.len/L,own=d.map(x=>Math.min(x*scale,tr.len));
  const t=timeAtDist(tr,own);
  const g={S,lap,d,t,len:L,n,_c:{}};
  g.get=name=>{if(g._c[name])return g._c[name];const c=S.ch[name];if(!c)return null;const o=new Float32Array(n),fn=STEP_CH.test(name)?sampleStep:sampleAt;for(let i=0;i<n;i++)o[i]=fn(c,lap.t0+t[i]);g._c[name]=o;return o;};
  S.cache.set(key,g);return g;
}
function smooth(a,w){const n=a.length,o=new Float32Array(n);let s=0,c=0;const h=w>>1;for(let i=0;i<n+h;i++){if(i<n){s+=a[i];c++;}if(i-w>=0){s-=a[i-w];c--;}const j=i-h;if(j>=0&&j<n)o[j]=s/c;}return o;}

// ---- corners
function detectCorners(g){
  const step=g.d[1]-g.d[0],v=smooth(g.get('Ground Speed'),Math.max(3,Math.round(24/step))),br=g.get('Brake Pos'),th=g.get('Throttle Pos'),gear=g.get('Gear'),n=g.n;
  const win=Math.round(70/step),look=Math.round(300/step);const apex=[];
  for(let i=win;i<n-win;i++){
    let isMin=true;for(let j=i-win;j<=i+win;j++){if(v[j]<v[i]){isMin=false;break;}}
    if(!isMin)continue;
    let mx=0;for(let j=Math.max(0,i-look);j<i;j++)mx=Math.max(mx,v[j]);
    let mx2=0;for(let j=i;j<Math.min(n,i+look);j++)mx2=Math.max(mx2,v[j]);
    if(mx-v[i]>=10&&mx2-v[i]>=6){if(apex.length&&i-apex[apex.length-1]<win)continue;apex.push(i);}
  }
  const segs=[];
  for(let k=0;k<apex.length;k++){
    const a=apex[k];
    const prevA=k?apex[k-1]:0,nextA=k<apex.length-1?apex[k+1]:n-1;
    let s=prevA,mx=-1;for(let j=prevA;j<a;j++)if(v[j]>mx){mx=v[j];s=j;}
    let e=a,mx3=-1;for(let j=a;j<=nextA;j++)if(v[j]>mx3){mx3=v[j];e=j;}
    if(k===0)s=Math.max(0,s);
    // braking
    let bs=-1,peak=0;
    if(br){let gap=0;const gmax=Math.round(30/step);for(let j=a;j>=Math.max(0,a-Math.round(600/step));j--){if(br[j]>8){bs=j;gap=0;if(br[j]>peak)peak=br[j];}else if(bs>=0&&br[j]<=2){if(++gap>gmax)break;}}}
    let tp=-1;if(th){for(let j=a;j<=e;j++){if(th[j]>=95){tp=j;break;}}}
    segs.push({k:k+1,apex:a,s,e,dApex:g.d[a],vMin:g.get('Ground Speed')[a],vEntry:v[s],vExit:v[e],brake:bs>=0?g.d[bs]:null,brakeV:bs>=0?g.get('Ground Speed')[bs]:null,brakePeak:peak,gear:gear?gear[a]:null,fullThr:tp>=0?g.d[tp]:null,time:g.t[e]-g.t[s]});
  }
  // stitch segment boundaries so sections tile the lap
  for(let k=0;k<segs.length;k++){if(k)segs[k].s=segs[k-1].e;}
  segs.forEach(c=>{c.time=g.t[c.e]-g.t[c.s];c.dS=g.d[c.s];c.dE=g.d[c.e];});
  return segs;
}

// ---- per-lap aggregates (stint from telemetry)
const W=['FL','FR','RL','RR'];
function lapStats(S,lap){
  const key='st'+lap.i;if(S.cache.has(key))return S.cache.get(key);
  const g=lapGrid(S,lap,4),v=g.get('Ground Speed'),n=g.n;
  const fast=i=>v[i]>50;
  const avgF=(name)=>{const a=g.get(name);if(!a)return NaN;let s=0,c=0;for(let i=0;i<n;i++)if(fast(i)){s+=a[i];c++;}return c?s/c:NaN;};
  const at=(name,t)=>S.ch[name]?sampleAt(S.ch[name],t):NaN;
  const o={lap,time:lap.time,vmax:pct(v,1)};
  o.fuel=at('Fuel Level',lap.t0+0.5)-at('Fuel Level',lap.t1-0.5);
  o.fuelEnd=at('Fuel Level',lap.t1-0.5);
  const bat=g.get('Battery Charge Level');if(bat&&pct(bat,1)>0){o.batMin=pct(bat,0);o.batMax=pct(bat,1);o.batEnd=bat[n-1];o.batStart=bat[0];}
  o.w={};
  for(const w of W){
    const x={};
    x.wear=at('Tyre Wear '+w,lap.t1-0.5)-at('Tyre Wear '+w,lap.t0+0.5);
    x.wearEnd=at('Tyre Wear '+w,lap.t1-0.5);
    x.sI=avgF(`Tyre Temp ${w} Inner`);x.sC=avgF(`Tyre Temp ${w} Centre`);x.sO=avgF(`Tyre Temp ${w} Outer`);
    // inner rubber layer is far steadier than the surface: use it for spread and level, surface as fallback
    const rI=avgF(`Tyre Rubber Temp ${w} I`),rC=avgF(`Tyre Rubber Temp ${w} C`),rO=avgF(`Tyre Rubber Temp ${w} O`);
    const hasR=[rI,rC,rO].every(v=>Number.isFinite(v)&&v>1);x.src=hasR?'gomma':'superficie';
    x.I=hasR?rI:x.sI;x.C=hasR?rC:x.sC;x.O=hasR?rO:x.sO;
    x.carc=avgF('Tyre Carcass Temp '+w);
    x.p=avgF('Tyre Pressure '+w);const pp=g.get('Tyre Pressure '+w);x.pMax=pp?pct(pp,1):NaN;
    const bt=g.get('Brake Temp '+w);x.bMax=bt?pct(bt,0.99):NaN;x.bAvg=avgF('Brake Temp '+w);
    const rh=g.get('Ride Height '+w);if(rh){const f=[];for(let i=0;i<n;i++)if(fast(i))f.push(rh[i]);x.rhMin=pct(f,0.01);x.rhMed=pct(f,0.5);x.rhLow=f.filter(y=>y<cfg().rh).length/Math.max(1,f.length);}
    const gf=g.get('Grip Fract '+w);x.grip=gf&&pct(gf,1)>0?avgF('Grip Fract '+w):NaN;
    o.w[w]=x;
  }
  S.cache.set(key,o);return o;
}

// ---- balance (understeer/oversteer) indicators
function balance(S,laps){
  const res={phases:{},counter:[],hasGrip:false,samples:0};
  const ph={entrata:{f:[],r:[],k:[]},centro:{f:[],r:[],k:[]},uscita:{f:[],r:[],k:[]}};
  const spd={lente:{f:[],r:[]},veloci:{f:[],r:[]}};
  let sgn=0;
  for(const lap of laps){
    const g=lapGrid(S,lap,2),v=g.get('Ground Speed'),br=g.get('Brake Pos'),th=g.get('Throttle Pos'),st=g.get('Steering'),gl=g.get('G Force Lat'),yaw=g.get('Local Rotation Y');
    const gff=['FL','FR'].map(w=>g.get('Grip Fract '+w)),gfr=['RL','RR'].map(w=>g.get('Grip Fract '+w));
    const hasGrip=gff[0]&&pct(gff[0],0.99)>0;res.hasGrip=res.hasGrip||hasGrip;
    if(!st||!gl)continue;
    if(yaw&&!sgn){let c=0;for(let i=0;i<g.n;i++)c+=st[i]*yaw[i];sgn=c>=0?1:-1;}
    const corners=detectCorners(g);
    for(let i=0;i<g.n;i++){
      if(v[i]<45||Math.abs(gl[i])<0.5)continue;
      const phase=br&&br[i]>5?'entrata':(th&&th[i]>=40?'uscita':'centro');
      const vv=v[i]/3.6,ay=Math.abs(gl[i])*9.81,k=Math.abs(st[i])/(ay/(vv*vv)); // steering per neutral-steer demand
      ph[phase].k.push(k);
      if(hasGrip){const f=(gff[0][i]+gff[1][i])/2,r=(gfr[0][i]+gfr[1][i])/2;ph[phase].f.push(f);ph[phase].r.push(r);const b=v[i]<140?'lente':'veloci';spd[b].f.push(f);spd[b].r.push(r);}
      res.samples++;
    }
    // countersteer events
    if(yaw&&sgn){
      let inEv=false,start=0;
      for(let i=0;i<g.n;i++){
        const cs=v[i]>40&&Math.abs(yaw[i])>0.12&&Math.abs(st[i])>1.5&&Math.sign(st[i])*sgn!==Math.sign(yaw[i]);
        if(cs&&!inEv){inEv=true;start=i;}
        if(!cs&&inEv){inEv=false;if((i-start)*2>=6){const d=g.d[start];const c=corners.find(c=>d>=c.dS&&d<=c.dE);res.counter.push({lap:lap.num,d,corner:c?c.k:null,phase:br&&br[start]>5?'entrata':(th&&th[start]>=40?'uscita':'centro'),v:v[start]});}}
      }
    }
  }
  const allK=[...ph.entrata.k,...ph.centro.k,...ph.uscita.k],kMed=median(allK);
  for(const [p,x] of Object.entries(ph)){res.phases[p]={n:x.k.length,steerIdx:x.k.length?median(x.k)/kMed:NaN,front:mean(x.f),rear:mean(x.r)};}
  res.speed={};for(const [b,x] of Object.entries(spd))res.speed[b]={front:mean(x.f),rear:mean(x.r),n:x.f.length};
  return res;
}

// ---- results XML
function parseResultsXML(text,name){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('XML non valido');
  const rr=doc.querySelector('RaceResults');if(!rr)throw new Error('Non è un file risultati di LMU');
  const tx=(el,s)=>el.querySelector(s)?.textContent?.trim()??'';
  const R={id:'xml:'+name,kind:'xml',name,venue:tx(rr,'TrackVenue'),event:tx(rr,'TrackEvent'),trackLen:+tx(rr,'TrackLength')||null,time:tx(rr,'TimeString'),sessions:[]};
  for(const s of rr.children){
    const drivers=[...s.children].filter(c=>c.tagName==='Driver');if(!drivers.length)continue;const nDrivers=drivers.length;
    const stream=s.querySelector('Stream');
    const streamEv=stream?[...stream.children].map(e=>({tag:e.tagName,et:+e.getAttribute('et'),txt:(e.textContent||'').trim(),drv:e.getAttribute('Driver'),lap:e.getAttribute('Lap')!=null?+e.getAttribute('Lap'):null,pts:e.getAttribute('CurrentPoints')})):null;
    const sess={name:s.tagName,drivers:[]};
    for(const d of drivers){
      const dn=tx(d,'Name');
      const laps=[...d.querySelectorAll('Lap')].map(l=>{const a=k=>l.getAttribute(k);const num=x=>x==null||x===''?NaN:+x;const t=l.textContent.trim();
        return {num:+a('num'),pos:+a('p'),et:num(a('et')),s1:num(a('s1')),s2:num(a('s2')),s3:num(a('s3')),top:num(a('topspeed')),fuel:num(a('fuel')),fuelUsed:num(a('fuelUsed')),ve:num(a('ve')),veUsed:num(a('veUsed')),tw:{FL:num(a('twfl')),FR:num(a('twfr')),RL:num(a('twrl')),RR:num(a('twrr'))},fc:(a('fcompound')||'').split(',').pop(),rc:(a('rcompound')||'').split(',').pop(),pit:a('pit')==='1',time:/^\d/.test(t)?+t:NaN,flags:[],ev:[]};});
      if(streamEv){
        const mine=e=>e.drv===dn||e.txt.startsWith(dn+'(')||e.txt.startsWith(dn+' ');
        const byLap=e=>{if(e.lap!=null){const L=laps.find(l=>l.num===e.lap+1);if(L)return L;}return lapAtEt(laps,e.et);};
        const seen=new Set();
        for(const e of streamEv){
          if(e.tag==='TrackLimits'&&e.drv===dn){const key=e.et+'|'+e.txt+'|'+e.lap;if(seen.has(key))continue;seen.add(key);const L=byLap(e);if(!L)continue;
            const k=/Invalid/i.test(e.txt)?'inv':/Penalty/i.test(e.txt)?'pen':/Warning/i.test(e.txt)?'warn':'nfa';
            L.ev.push({k,txt:k==='nfa'?'fuori pista, nessuna conseguenza':e.txt,pts:e.pts,et:e.et});if(k==='inv')L.invalid=true;if(k!=='nfa')L.flags.push(e.txt);continue;}
          if(e.tag==='Penalty'&&(e.drv===dn||e.txt.startsWith(dn))){const L=lapAtEt(laps,e.et);if(L){L.ev.push({k:'pen',txt:e.txt.replace(dn,'').trim()});L.flags.push('penalità');}continue;}
          if(e.tag==='Incident'){
            const m=e.txt.match(/^(.+?)\(\d+\) reported contact \(([\d.]+)\) with (another vehicle (.+?)\(\d+\)|Immovable|Wheel|.+)$/);if(!m)continue;
            const a1=m[1].trim(),other=m[4]?m[4].trim():null,mag=+m[2];let with_=null;
            if(a1===dn)with_=other||(/Immovable/.test(m[3])?'muro':m[3]);else if(other===dn)with_=a1;else continue;
            const L=lapAtEt(laps,e.et);if(!L)continue;L.incident=true;
            const ex=L.ev.find(x=>x.k==='hit'&&x.with===with_);if(ex){ex.mag=Math.max(ex.mag,mag);ex.n++;}else L.ev.push({k:'hit',with:with_,mag,n:1,wall:with_==='muro',et:e.et});continue;}
          if(e.tag==='Sector'&&mine(e)){const L=lapAtEt(laps,e.et);if(!L)continue;
            if(/damage/i.test(e.txt)){if(!L.ev.some(x=>x.k==='dmg'))L.ev.push({k:'dmg',txt:'danni alle sospensioni'});L.incident=true;}
            else{const sm=e.txt.match(/sector (\d)/i);if(sm)L.ev.push({k:'sec',n:+sm[1]});}continue;}
          if(e.tag==='ChatMessage'){const ini=dn.split(/\s+/);const short=(ini[0]||'')[0]+' '+(ini.slice(1).join(' ')||'');if(e.txt.startsWith(short.trim()+':')){const L=lapAtEt(laps,e.et);if(L)L.ev.push({k:'chat',txt:e.txt.slice(short.trim().length+1).trim()});}}
        }
      }
      // lap kinds: start, pit in/out, garage return, position change
      const isRace=/race/i.test(s.tagName);const tBest=Math.min(...laps.map(l=>l.time).filter(Number.isFinite));
      laps.forEach((l,i)=>{const pv=laps[i-1],nx=laps[i+1];l.kind='lanciato';
        if(i===0)l.kind=isRace?'partenza':'uscita box';
        if(pv&&pv.pit)l.kind='uscita box';
        if(l.pit)l.kind='entrata box';
        if(!Number.isFinite(l.time)&&!l.pit&&nx&&Number.isFinite(l.et)&&Number.isFinite(nx.et)&&Number.isFinite(tBest)&&nx.et-l.et>tBest*1.5){l.kind='rientro garage';if(nx&&!nx.pit)nx._afterGarage=true;}
        if(l._afterGarage&&l.kind==='lanciato')l.kind='uscita garage';
        if(pv&&Number.isFinite(pv.pos)&&Number.isFinite(l.pos)&&isRace)l.dpos=pv.pos-l.pos;
        if(i===0&&isRace&&Number.isFinite(l.pos)){const g=+tx(d,'GridPos');if(g)l.dpos=g-l.pos;}
        if(l.pos>nDrivers)l.pos=NaN;
        const ch=pv&&(l.fc!==pv.fc);if(ch&&l.fc)l.ev.push({k:'tyre',txt:'gomme '+l.fc});});
      sess.drivers.push({name:dn,car:tx(d,'CarType')||tx(d,'VehName'),cls:tx(d,'CarClass'),isPlayer:tx(d,'isPlayer')==='1',best:+tx(d,'BestLapTime')||NaN,laps,aids:tx(d,'ControlAndAids'),pos:+tx(d,'Position')||NaN,cpos:+tx(d,'ClassPosition')||NaN,grid:+tx(d,'GridPos')||NaN,cgrid:+tx(d,'ClassGridPos')||NaN,finish:+tx(d,'FinishTime')||NaN,nlaps:+tx(d,'Laps')||0,stops:+tx(d,'Pitstops')||0,status:tx(d,'FinishStatus'),team:tx(d,'TeamName'),num:tx(d,'CarNumber')});
    }
    R.sessions.push(sess);
  }
  if(!R.sessions.length)throw new Error('Nessun pilota trovato nel file risultati');
  return R;
}
function lapAtEt(laps,et){let best=null;for(const l of laps){if(Number.isFinite(l.et)&&l.et<=et)best=l;}return best||laps[0];}

function stintAnalysis(laps){
  // split in stints on refuel / new tyres / pit
  const stints=[];let cur=null,prev=null;
  for(const l of laps){
    const reset=!prev||l.fuelUsed<0||l.veUsed<0||prev.pit||prev.kind==='rientro garage'||W.some(w=>l.tw[w]>prev.tw[w]+0.004);
    if(reset){cur={laps:[]};stints.push(cur);l.out=true;}
    cur.laps.push(l);prev=l;
  }
  // lap time for laps without official time (invalid): from lap start times
  const off=laps.filter(l=>Number.isFinite(l.time)).map(l=>l.time),bst=off.length?Math.min(...off):NaN;
  // laps saved as "--.----": reconstruct from the start of the next lap and record why the time is missing
  laps.forEach((l,i)=>{if(Number.isFinite(l.time))return;const nx=laps[i+1],pv=laps[i-1];let t=NaN;
    if(nx&&Number.isFinite(l.et)&&Number.isFinite(nx.et))t=nx.et-l.et;
    if(l.invalid){l.noTime='giro invalidato (taglio pista): il gioco non salva il tempo';if(t>bst*0.9&&t<bst*1.5)l.estTime=t;return;}
    if(i===0||l.out){l.noTime='giro di uscita';return;}
    if(l.pit||(pv&&pv.pit)){l.noTime='giro con passaggio ai box';return;}
    if(l.fuelUsed<0){l.noTime='reset / rientro in garage durante il giro';return;}
    if(!nx){l.noTime='sessione finita durante il giro';return;}
    if(Number.isFinite(t)&&t>bst*1.5){l.noTime='giro interrotto (rientro ai box o in garage)';return;}
    if(Number.isFinite(t)&&t>bst*0.9){l.estTime=t;l.noTime='tempo non registrato dal gioco (senza segnalazione di taglio)';return;}
    l.noTime='tempo non registrato dal gioco';});
  const timed=laps.filter(l=>Number.isFinite(l.time)&&!l.invalid);
  const best=timed.length?Math.min(...timed.map(l=>l.time)):NaN;
  for(const l of laps){l.best=l.time===best;l.pace=Number.isFinite(l.time)&&!l.invalid&&!l.out&&!l.incident&&l.time<=best*1.07;}
  const cons=laps.filter(l=>!l.out&&l.fuelUsed>0);
  const res={stints,best,paceLaps:laps.filter(l=>l.pace)};
  res.avg=mean(res.paceLaps.map(l=>l.time));res.sd=std(res.paceLaps.map(l=>l.time));
  res.fuelPerLap=mean(cons.map(l=>l.fuelUsed));
  const veCons=laps.filter(l=>!l.out&&l.veUsed>0);res.vePerLap=mean(veCons.map(l=>l.veUsed));
  // tyre wear: regression over each stint, averaged
  res.wear={};
  for(const w of W){const slopes=[];for(const s of stints){const ls=s.laps.filter(l=>Number.isFinite(l.tw[w]));if(ls.length>=3){slopes.push(-slope(ls.map((l,i)=>i),ls.map(l=>l.tw[w])));}}res.wear[w]=mean(slopes);}
  // degradation: slope of pace laps within stints
  const deg=[];for(const s of stints){const ls=s.laps.filter(l=>l.pace);if(ls.length>=3)deg.push(slope(ls.map(l=>l.num),ls.map(l=>l.time)));}
  res.deg=mean(deg);
  return res;
}
function slope(x,y){const mx=mean(x),my=mean(y);let a=0,b=0;for(let i=0;i<x.length;i++){a+=(x[i]-mx)*(y[i]-my);b+=(x[i]-mx)**2;}return b?a/b:NaN;}

// ---- setup .svm
const SETUP_LABELS={
  FuelSetting:'Carburante',FuelCapacitySetting:'Serbatoio',VirtualEnergySetting:'Energia virtuale',NumPitstopsSetting:'Pit stop',FWSetting:'Ala anteriore',RWSetting:'Ala posteriore',
  WaterRadiatorSetting:'Radiatore acqua',OilRadiatorSetting:'Radiatore olio',BrakeDuctSetting:'Prese freni ant.',BrakeDuctRearSetting:'Prese freni post.',
  FrontAntiSwaySetting:'Barra antirollio ant.',RearAntiSwaySetting:'Barra antirollio post.',FrontToeInSetting:'Convergenza ant.',RearToeInSetting:'Convergenza post.',
  Front3rdPackerSetting:'3° elemento ant. · packer',Front3rdSpringSetting:'3° elemento ant. · molla',Front3rdSlowBumpSetting:'3° ant. · bump lento',Front3rdFastBumpSetting:'3° ant. · bump veloce',Front3rdSlowReboundSetting:'3° ant. · rebound lento',Front3rdFastReboundSetting:'3° ant. · rebound veloce',
  Rear3rdPackerSetting:'3° elemento post. · packer',Rear3rdSpringSetting:'3° elemento post. · molla',Rear3rdSlowBumpSetting:'3° post. · bump lento',Rear3rdFastBumpSetting:'3° post. · bump veloce',Rear3rdSlowReboundSetting:'3° post. · rebound lento',Rear3rdFastReboundSetting:'3° post. · rebound veloce',
  SteerLockSetting:'Angolo sterzo',RearBrakeSetting:'Ripartizione frenata',BrakeMigrationSetting:'Migrazione freno',BrakePressureSetting:'Pressione freni',TCSetting:'Controllo trazione',ABSSetting:'ABS',TractionControlMapSetting:'TC mappa',TCPowerCutMapSetting:'TC taglio potenza',TCSlipAngleMapSetting:'TC slip',AntilockBrakeSystemMapSetting:'ABS mappa',
  RevLimitSetting:'Limitatore giri',EngineBoostSetting:'Mappa motore',RegenerationMapSetting:'Rigenerazione',ElectricMotorMapSetting:'Motore elettrico',EngineMixtureSetting:'Miscela',EngineBrakingMapSetting:'Freno motore',
  FinalDriveSetting:'Rapporto finale',RatioSetSetting:'Set rapporti',DiffPowerSetting:'Differenziale · trazione',DiffCoastSetting:'Differenziale · rilascio',DiffPreloadSetting:'Differenziale · precarico',
  CamberSetting:'Campanatura',PressureSetting:'Pressione a freddo',PackerSetting:'Packer',SpringSetting:'Molla',RideHeightSetting:'Altezza da terra',SlowBumpSetting:'Bump lento',FastBumpSetting:'Bump veloce',SlowReboundSetting:'Rebound lento',FastReboundSetting:'Rebound veloce',BrakeDiscSetting:'Disco freno',BrakePadSetting:'Pastiglie',CompoundSetting:'Mescola',TenderSpringSetting:'Molla tender',TenderTravelSetting:'Corsa tender'
};
const SETUP_GROUPS={GENERAL:'Generale',FRONTWING:'Aerodinamica',REARWING:'Aerodinamica',BODYAERO:'Raffreddamento',SUSPENSION:'Sospensioni',CONTROLS:'Freni ed elettronica',ENGINE:'Motore e ibrido',DRIVELINE:'Trasmissione'};
function parseSVM(text,name){
  const out={id:'svm:'+name,kind:'svm',name,head:{},sec:{}};let cur=null;
  for(let line of text.split(/\r?\n/)){
    line=line.trim();if(!line)continue;
    const m=line.match(/^\[(.+)\]$/);if(m){cur=m[1];out.sec[cur]=[];continue;}
    if(line.startsWith('//')){const mm=line.match(/^\/\/(\w[\w ]*)=(.*)$/);if(mm&&!cur)out.head[mm[1]]=mm[2];continue;}
    const kv=line.match(/^([^=]+)=([^/]*)(?:\/\/(.*))?$/);if(!kv)continue;
    const key=kv[1].trim(),raw=kv[2].trim().replace(/^"|"$/g,''),disp=(kv[3]||'').trim();
    if(!cur){out.head[key]=raw;continue;}
    out.sec[cur].push({key,raw,disp,label:SETUP_LABELS[key]||key.replace(/Setting$/,'').replace(/([a-z])([A-Z])/g,'$1 $2')});
  }
  if(!Object.keys(out.sec).length)throw new Error('File setup non riconosciuto');
  out.car=(out.head.VehicleClassSetting||'').replace(/"/g,'');
  return out;
}
function setupText(su){
  const lines=[`Auto: ${su.car}`,su.head.Notes?`Note: ${su.head.Notes}`:''];
  for(const [s,items] of Object.entries(su.sec)){const it=items.filter(x=>x.disp&&!/N\/A|Non-adjustable|Detached/.test(x.disp));if(!it.length)continue;lines.push(`[${s}]`);it.forEach(x=>lines.push(`${x.key} = ${x.disp} (indice ${x.raw})`));}
  return lines.filter(Boolean).join('\n');
}

function pickBest(S){const fl=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid);S.best=fl.length?fl.reduce((a,b)=>a.time<b.time?a:b):null;}

// ---- track conditions from telemetry
const FRAC=/Raining|Wetness|Cloud/;
function chFrac(S,n){const c=S.ch[n];if(!c)return null;const v=c.v;if(!FRAC.test(n))return v;let mx=0;for(let i=0;i<v.length;i+=Math.max(1,c.f))mx=Math.max(mx,v[i]);if(mx<=1.0001)return v;return v.map(x=>x/100);}
function conditions(S){
  const g=n=>chFrac(S,n),r=a=>a?{min:pct(a,0),max:pct(a,1),avg:mean(a),start:a[0],end:a[a.length-1]}:null;
  const c={air:r(g('Ambient Temperature')),track:r(g('Track Temperature')),rain:r(g('Raining')),wet:r(g('Min Path Wetness')),wetOff:r(g('Off Path Wetness')),cloud:r(g('Cloud Darkness')),wind:r(g('Wind Speed')),windDir:r(g('Wind Heading'))};
  const rain=c.rain?c.rain.max:0,wet=c.wet?c.wet.max:0;
  c.label=rain>0.01?(rain>0.3?'Pioggia':'Pioggia leggera'):wet>0.01?(wet>0.3?'Pista bagnata':'Pista umida'):'Asciutto';
  if(c.rain&&c.rain.start<0.01&&rain>0.01)c.label='Asciutto → '+c.label.toLowerCase();
  c.state=rain>0.01||wet>0.01?'wet':'dry';
  return c;
}
function lapConditions(S,lap){const a=(n)=>{const c=S.ch[n];if(!c)return NaN;return (sampleAt(c,lap.t0)+sampleAt(c,lap.t1))/2;};const mx=(n)=>{const c=S.ch[n];if(!c)return NaN;const v=chFrac(S,n);let m=0;for(let i=Math.floor(lap.t0*c.f);i<=Math.min(v.length-1,Math.ceil(lap.t1*c.f));i++)m=Math.max(m,v[i]);return m;};return {track:a('Track Temperature'),air:a('Ambient Temperature'),rain:mx('Raining'),wet:mx('Min Path Wetness'),wetOff:mx('Off Path Wetness')};}

// ---- merge official results (.xml) into a telemetry session
function mergeResults(S,xmls){
  S.merged=null;S.laps.forEach(l=>{delete l.x;});
  for(const R of xmls){
    if(norm(R.venue)!==norm(S.meta.venue))continue;
    for(const sess of R.sessions)for(const d of sess.drivers){
      if(S.meta.driver&&norm(d.name)!==norm(S.meta.driver))continue;
      let hits=0;
      for(const l of S.laps){const x=d.laps.find(q=>Number.isFinite(q.et)&&Math.abs(q.et-l.et)<2.5);if(x){l.x=x;hits++;}}
      if(hits){S.merged={R,sess,d,hits};
        stintAnalysis(d.laps);
        for(const l of S.laps){const x=l.x;if(!x)continue;
          if(Number.isFinite(x.time)){l.time=x.time;l.official=true;}
          else if(l.complete&&Number.isFinite(x.estTime))l.time=l.complete?l.time:x.estTime;
          l.invalid=!!x.invalid;l.s=[x.s1,x.s2,x.s3];l.ve=x.ve;l.veUsed=x.veUsed;l.incident=x.incident;l.flags=x.flags.filter(f=>!/No Further/.test(f));}
        pickBest(S);return S.merged;}
      S.laps.forEach(l=>{delete l.x;});
    }
  }
  pickBest(S);return null;
}
function norm(s){return String(s||'').toLowerCase().replace(/#\d+$/,'').replace(/\s+/g,' ').trim();}

// ---- automatic setup checks from telemetry (+ setup values when available)
function wheelRadius(g,w){const sp=g.get('Ground Speed'),ws=g.get('Wheel Rot Speed '+w),th=g.get('Throttle Pos'),br=g.get('Brake Pos');if(!ws)return NaN;const r=[];for(let i=0;i<g.n;i++){if(sp[i]>110&&(th?th[i]<5:true)&&(br?br[i]<2:true)&&Math.abs(ws[i])>1)r.push(sp[i]/3.6/Math.abs(ws[i]));}
  if(r.length<20){for(let i=0;i<g.n;i++){if(sp[i]>80&&th&&th[i]>99&&Math.abs(ws[i])>1)r.push(sp[i]/3.6/Math.abs(ws[i]));}}return median(r);}
function slipEvents(S,laps){
  const out={lockF:0,lockR:0,spin:0,time:0,where:{},radius:{}};
  for(const lap of laps){
    const g=lapGrid(S,lap,2),sp=g.get('Ground Speed'),th=g.get('Throttle Pos'),br=g.get('Brake Pos');if(!g.get('Wheel Rot Speed FL')||!br)return null;
    const corners=detectCorners(g);const R={};for(const w of W){R[w]=wheelRadius(g,w);out.radius[w]=R[w];}
    const dt=[];for(let i=1;i<g.n;i++)dt.push(g.t[i]-g.t[i-1]);
    out.time+=lap.time;
    for(let i=1;i<g.n;i++){
      const v=sp[i]/3.6;if(v<8)continue;const d=dt[i-1];
      const sl={};for(const w of W){sl[w]=(Math.abs(g.get('Wheel Rot Speed '+w)[i])*R[w]-v)/v;}
      const c=corners.find(c=>g.d[i]>=c.dS&&g.d[i]<=c.dE);const key=c?'T'+c.k:'rettilineo';
      if(br[i]>15){if(Math.min(sl.FL,sl.FR)<-0.15){out.lockF+=d;(out.where[key]??={lf:0,lr:0,sp:0}).lf+=d;}if(Math.min(sl.RL,sl.RR)<-0.15){out.lockR+=d;(out.where[key]??={lf:0,lr:0,sp:0}).lr+=d;}}
      if(th&&th[i]>30&&Math.max(sl.RL,sl.RR)>0.12){out.spin+=d;(out.where[key]??={lf:0,lr:0,sp:0}).sp+=d;}
    }
  }
  const n=laps.length||1;out.lockF/=n;out.lockR/=n;out.spin/=n;for(const k in out.where){out.where[k].lf/=n;out.where[k].lr/=n;out.where[k].sp/=n;}
  return out;
}
function gearingCheck(S,laps){
  const lim=S.ch['Engine Max RPM']?pct(S.ch['Engine Max RPM'].v,0.5):NaN;
  let limT=0,T=0,topGear=0;const straights=[];
  for(const lap of laps){const g=lapGrid(S,lap,2),rpm=g.get('Engine RPM'),ge=g.get('Gear'),th=g.get('Throttle Pos'),br=g.get('Brake Pos'),sp=g.get('Ground Speed');if(!rpm||!ge)return null;
    T+=lap.time;for(let i=1;i<g.n;i++){topGear=Math.max(topGear,ge[i]);if(Number.isFinite(lim)&&rpm[i]>=lim*0.985&&th&&th[i]>95)limT+=g.t[i]-g.t[i-1];}
    // end of each straight: last point before braking where speed is a local max
    const corners=detectCorners(g);for(const c of corners){if(c.brake==null)continue;const j=Math.max(0,Math.round(c.brake/2)-1);if(sp[j]>150)straights.push({lap:lap.num,corner:c.k,v:sp[j],rpm:rpm[j],gear:ge[j]});}
  }
  const n=laps.length||1;return {lim,limPerLap:limT/n,topGear,straights};
}
function steerCheck(S,laps){let mx=0,where=null;for(const lap of laps){const g=lapGrid(S,lap,2),st=g.get('Steering');if(!st)return null;const cr=detectCorners(g);for(let i=0;i<g.n;i++)if(Math.abs(st[i])>mx){mx=Math.abs(st[i]);const c=cr.find(c=>g.d[i]>=c.dS&&g.d[i]<=c.dE);where=c?'T'+c.k:null;}}return {max:mx,where};}
function engineCheck(S){const g=n=>S.ch[n]?pct(S.ch[n].v,0.995):NaN;const oh=S.ch['Overheating State']?pct(S.ch['Overheating State'].v,1):0;return {water:g('Eng Water Temp'),oil:g('Eng Oil Temp'),overheat:oh>0};}
function setupVal(su,key,sec){if(!su)return null;for(const [s,items] of Object.entries(su.sec)){if(sec&&s!==sec)continue;const x=items.find(i=>i.key===key);if(x&&x.disp&&!/N\/A|Non-adjustable/.test(x.disp))return x.disp;}return null;}

// Lap-counter channels update at scoring rate (~0.1 s). Refine each start/finish crossing with the GPS trace:
// average line position + direction, then find where the car crosses that plane (linear interpolation, 10 ms search).
function refineCuts(ch,cuts){
  const la=ch['GPS Latitude'],lo=ch['GPS Longitude'];if(!la||!lo||cuts.length<4)return;
  const P=t=>[sampleAt(lo,t)*111320,sampleAt(la,t)*110540];
  const inner=cuts.slice(1,-1);if(inner.length<2)return;
  const pts=inner.map(P),C=[mean(pts.map(p=>p[0])),mean(pts.map(p=>p[1]))];
  let tx=0,ty=0;inner.forEach(t=>{const a=P(t-0.1),b=P(t+0.1);const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy)||1;tx+=dx/n;ty+=dy/n;});const tn=Math.hypot(tx,ty)||1;tx/=tn;ty/=tn;
  // all crossings must be near the averaged point
  if(pts.some(p=>Math.hypot(p[0]-C[0],p[1]-C[1])>60))return;
  const f=t=>{const p=P(t);return (p[0]-C[0])*tx+(p[1]-C[1])*ty;};
  for(let k=1;k<cuts.length-1;k++){const tc=cuts[k];let prev=f(tc-0.5),found=null;
    for(let t=tc-0.49;t<=tc+0.5;t+=0.01){const cur=f(t);if(prev<0&&cur>=0){found=t-0.01+0.01*(-prev)/((cur-prev)||1);break;}prev=cur;}
    if(found!=null)cuts[k]=found;}
}
