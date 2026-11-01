// ================= VEHICLE DYNAMICS: dampers, suspension events, axles, packers, platform and aero =================
// Plain computation on the native samples of each channel; the pages are in ui22.js (Sospensioni) and ui51.js.
// Rules kept everywhere in this file:
//  · each lap is read on its own native samples with VD_PAD s of margin on both sides, filtered and differentiated
//    there, then trimmed to the lap: nothing is ever differentiated across two laps put one after the other;
//  · channels with a different rate are read at the times of the main one by linear interpolation, only to classify
//    the samples (phase, speed); the main channel sets the resolution and the results say which one it is;
//  · a missing value stays missing (NaN), never 0; a result that cannot be computed is null, with the reason.
// Thresholds are named constants shown on the page: they describe, they are not physical limits of the car.

const VD_W=['FL','FR','RL','RR'];
const VD_PAD=1;
// phases of the lap, in the order they are shown
const VD_PH=[['brk','Frenata'],['ent','Inserimento'],['mid','Appoggio'],['ext','Uscita'],['str','Rettilineo'],['kerb','Cordolo'],['oth','Altro']];
const VD_TH={spd:30,brk:5,lat:0.5,thr:30,str:0.3,strSpd:100,dlat:0.3};
// LMU Surface Type (rFactor 2 telemetry): 0 dry · 1 wet · 2 grass · 3 dirt · 4 gravel · 5 rumble strip (kerb) · 6 special
const VD_KERB=5;
// events: stimulus speed (mm/s), smallest oscillation amplitude (mm), slow-recovery threshold (s), unloaded wheel (fraction of the lap median)
const VD_EV={vstim:150,amin:1,devMin:3,recSlow:0.25,recMax:0.8,unload:0.10,unloadN:300,unloadS:0.03,pack:2,extreme:0.995};

// ---------- small numeric helpers ----------
const vdFin=a=>{const o=[];for(const x of a)if(Number.isFinite(x))o.push(x);return o;};
function vdSorted(a){const s=new Float64Array(a.length);let n=0;for(let i=0;i<a.length;i++){const x=a[i];if(x===x&&x!==Infinity&&x!==-Infinity)s[n++]=x;}return s.subarray(0,n).sort();}
const vdQs=(s,p)=>{if(!s.length)return NaN;const i=(s.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return s[lo]+(s[hi]-s[lo])*(i-lo);};
function vdQ(a,p){return vdQs(vdSorted(a),p);}
function vdMed(a){return vdQ(a,0.5);}
function vdMean(a){let s=0,n=0;for(const x of a)if(Number.isFinite(x)){s+=x;n++;}return n?s/n:NaN;}
function vdSd(a){const v=vdFin(a);if(v.length<2)return NaN;const m=vdMean(v);let s=0;for(const x of v)s+=(x-m)*(x-m);return Math.sqrt(s/(v.length-1));}
// Pearson correlation over the samples that pass the mask (both finite)
function vdCorr(a,b,mask){let n=0,sa=0,sb=0,saa=0,sbb=0,sab=0;for(let i=0;i<a.length;i++){const x=a[i],y=b[i];if(!Number.isFinite(x)||!Number.isFinite(y)||(mask&&!mask(i)))continue;n++;sa+=x;sb+=y;saa+=x*x;sbb+=y*y;sab+=x*y;}
  const d=Math.sqrt((n*saa-sa*sa)*(n*sbb-sb*sb));return n>30&&d>0?(n*sab-sa*sb)/d:NaN;}
// least squares y = a + b·x with r²
function vdFit(x,y){let n=0,sx=0,sy=0,sxx=0,sxy=0,syy=0;for(let i=0;i<x.length;i++){const X=x[i],Y=y[i];if(!Number.isFinite(X)||!Number.isFinite(Y))continue;n++;sx+=X;sy+=Y;sxx+=X*X;sxy+=X*Y;syy+=Y*Y;}
  const d=n*sxx-sx*sx;if(n<3||!d)return null;const b=(n*sxy-sx*sy)/d,a=(sy-b*sx)/n;const r=(n*sxy-sx*sy)/Math.sqrt(d*(n*syy-sy*sy)||1);return {a,b,r2:r*r,n};}
// centred moving average over w samples (shorter at the ends)
function vdMA(v,w){const n=v.length,o=new Float32Array(n),h=w>>1;const S=new Float64Array(n+1),C=new Uint32Array(n+1);
  for(let i=0;i<n;i++){const x=v[i],ok=x===x&&Math.abs(x)!==Infinity;S[i+1]=S[i]+(ok?x:0);C[i+1]=C[i]+(ok?1:0);}
  for(let i=0;i<n;i++){const a=Math.max(0,i-h),b=Math.min(n,i+h+1);const c=C[b]-C[a];o[i]=c?(S[b]-S[a])/c:NaN;}return o;}

// ---------- reading a lap ----------
// native samples of channel c from t0 to t1 (s) with margin: v[a..b) is the lap, ts the time of v[0]
function vdSeg(c,t0,t1,pad=VD_PAD){const f=c.f,n=c.v.length;const i0=Math.max(0,Math.floor((t0-pad)*f)),i1=Math.min(n,Math.ceil((t1+pad)*f)+1);
  const a=Math.max(0,Math.ceil(t0*f)-i0),b=Math.max(0,Math.min(i1-i0,Math.floor(t1*f)-i0+1));return {f,ts:i0/f,v:c.v.subarray(i0,i1),a,b};}
// first derivative by Savitzky–Golay (least-squares line over 2m+1 samples): smoothing and d/dt in one step.
// Near the ends of the segment the window shrinks; with no neighbour on one side the value is NaN (no invented edge).
function vdDeriv(v,f,m){const n=v.length,o=new Float32Array(n);
  for(let i=0;i<n;i++){const h=Math.min(m,i,n-1-i);if(h<1){o[i]=NaN;continue;}let s=0,q=0,bad=false;for(let k=-h;k<=h;k++){const x=v[i+k];if(!Number.isFinite(x)){bad=true;break;}s+=k*x;q+=k*k;}o[i]=bad?NaN:s/q*f;}return o;}
const vdSGm=f=>Math.max(1,Math.round(0.03*f));          // ≈ 60–70 ms window whatever the rate
// another channel at the given times (interpolated; step channels by nearest sample)
function vdAt(c,ts,f,n,step){const o=new Float32Array(n);if(!c){o.fill(NaN);return o;}const fn=step?sampleStep:sampleAt;for(let i=0;i<n;i++)o[i]=fn(c,ts+i/f);return o;}
// distance from the lap start at a time from the lap start (lapTrace is at 50 Hz)
function vdDist(tr,tt){const k=tt/0.02;if(!(k>0))return 0;const i=Math.floor(k);if(i>=tr.d.length-1)return tr.d[tr.d.length-1];return tr.d[i]+(tr.d[i+1]-tr.d[i])*(k-i);}
// phase of one sample
function vdPhase(spd,brk,thr,lat,dlat){if(!(spd>=VD_TH.spd))return 'oth';const L=Math.abs(lat);const B=brk>VD_TH.brk;
  if(B)return L<VD_TH.lat?'brk':'ent';
  if(L>=VD_TH.lat){if(thr>=VD_TH.thr)return 'ext';return dlat>VD_TH.dlat?'ent':'mid';}
  if(L<VD_TH.str&&spd>VD_TH.strSpd)return 'str';return 'oth';}
const vdChan=(S,n)=>S.ch[n]||null;

// compression sign of one wheel: +1 = the position channel grows when the suspension compresses.
// Evidence: correlation with the ride height of that corner (expected negative), with the tyre load and with the
// suspension force (expected positive). |r| ≥ 0.5 counts. Two agreeing and none against = verified.
function vdSign(S,laps,w){const key='vdsign:'+w+':'+laps.map(l=>l.i).join(',');if(S.cache.has(key))return S.cache.get(key);
  const P=vdChan(S,'Susp Pos '+w);if(!P){const r={sign:0,cert:'non determinabile',ev:[],why:'posizione sospensione mancante'};S.cache.set(key,r);return r;}
  const sp=vdChan(S,'Ground Speed');const ev=[];
  for(const [n,exp,lab] of [['Ride Height '+w,-1,'altezza da terra'],['Tyre Load '+w,1,'carico gomma'],['Susp Force '+w,1,'forza sospensione']]){const c=vdChan(S,n);if(!c)continue;
    const A=[],B=[];for(const l of laps){const s=vdSeg(P,l.t0,l.t1,0);for(let i=s.a;i<s.b;i+=2){const t=s.ts+i/s.f;if(sp&&sampleAt(sp,t)<60)continue;A.push(s.v[i]);B.push(sampleAt(c,t));}}
    const r=vdCorr(A,B);if(!Number.isFinite(r))continue;ev.push({lab,r,vote:Math.abs(r)>=0.5?Math.sign(r)*exp:0});}
  const pos=ev.filter(e=>e.vote>0).length,neg=ev.filter(e=>e.vote<0).length;let sign=0,cert='non determinabile';
  if(pos&&!neg){sign=1;cert=pos>=2?'verificato':'probabile';}else if(neg&&!pos){sign=-1;cert=neg>=2?'verificato':'probabile';}
  const r={sign,cert,ev,why:sign?'':(pos&&neg?'evidenze in contrasto':'nessuna evidenza abbastanza forte')};S.cache.set(key,r);return r;}

// one lap of one wheel on the native samples of its position: everything the analyses need
function vdLap(S,lap,w,sgn){const key='vdlap:'+lap.i+':'+w;if(S.cache.has(key))return S.cache.get(key);
  const P=vdChan(S,'Susp Pos '+w),V=vdChan(S,'Damper Vel '+w);const main=P||V;if(!main){S.cache.set(key,null);return null;}
  const sg=P?P:V;const seg=vdSeg(sg,lap.t0,lap.t1);const f=seg.f,N=seg.v.length;
  let vel,velSrc;
  if(V){const s=vdSeg(V,lap.t0,lap.t1);vel=V===sg?Float32Array.from(s.v):vdAt(V,seg.ts,f,N);velSrc='misurato';
    // a measured velocity can use the opposite sign of the position: align it to the position's derivative
    if(P){const dp=vdDeriv(seg.v,f,vdSGm(f));if(vdCorr(dp,vel)<0)for(let i=0;i<N;i++)vel[i]=-vel[i];}}
  else{vel=vdDeriv(seg.v,f,vdSGm(f));velSrc='derivato';}
  const sp=vdAt(vdChan(S,'Ground Speed'),seg.ts,f,N),br=vdAt(vdChan(S,'Brake Pos'),seg.ts,f,N),th=vdAt(vdChan(S,'Throttle Pos'),seg.ts,f,N),la=vdAt(vdChan(S,'G Force Lat'),seg.ts,f,N);
  const ld=vdAt(vdChan(S,'Tyre Load '+w),seg.ts,f,N),gv=vdAt(vdChan(S,'G Force Vert'),seg.ts,f,N),su=vdChan(S,'Surface Type '+w)?vdAt(vdChan(S,'Surface Type '+w),seg.ts,f,N,true):null;
  const dla=vdDeriv(Float32Array.from(la,Math.abs),f,Math.max(2,Math.round(0.1*f)));
  // trimmed to the lap
  const a=seg.a,b=seg.b,n=Math.max(0,b-a);const cut=x=>x?x.subarray(a,b):null;
  const pos=P?seg.v.subarray(a,b):null;const s=sgn||1;
  // compression-positive views (when the sign is unknown, s = 1 and the page says «direzione non determinata»)
  const cv=new Float32Array(n);for(let i=0;i<n;i++)cv[i]=vel[a+i]*s;
  const ph=new Array(n);for(let i=0;i<n;i++){ph[i]=su&&su[a+i]===VD_KERB&&sp[a+i]>=VD_TH.spd?'kerb':vdPhase(sp[a+i],br[a+i],th[a+i],la[a+i],dla[a+i]);}
  const tr=lapTrace(S,lap);const t0=seg.ts+a/f-lap.t0;const d=new Float32Array(n);for(let i=0;i<n;i++)d[i]=vdDist(tr,t0+i/f);
  const o={lap,w,f,n,t0,d,pos,comp:pos?Float32Array.from(pos,x=>x*s):null,vel:cut(vel),cv,velSrc,sp:cut(sp),br:cut(br),th:cut(th),la:cut(la),ld:cut(ld),gv:cut(gv),su:cut(su),ph,
    filt:velSrc==='derivato'?{m:vdSGm(f),ms:Math.round((2*vdSGm(f)+1)/f*1000)}:null};
  S.cache.set(key,o);return o;}

// ---------- damper speed histogram ----------
// bins of `bin` mm/s from −range to +range; values beyond are counted apart (lo / hi), never folded into the last bin
function vdHist(vals,range=250,bin=10){const nb=Math.round(2*range/bin),h=new Array(nb).fill(0);let lo=0,hi=0,n=0;
  for(const x of vals){if(!Number.isFinite(x))continue;n++;if(x<-range){lo++;continue;}if(x>=range){hi++;continue;}h[Math.min(nb-1,Math.floor((x+range)/bin))]++;}
  return {h,lo,hi,n,range,bin};}
// share of samples in the four zones (slow/fast × compression/extension) around the knee
function vdZones(vals,knee){let sb=0,sr=0,fb=0,fr=0,n=0;for(const x of vals){if(!Number.isFinite(x))continue;n++;if(x>=0){if(x<knee)sb++;else fb++;}else{if(-x<knee)sr++;else fr++;}}
  const p=x=>n?x/n*100:NaN;return {sb:p(sb),sr:p(sr),fb:p(fb),fr:p(fr),n};}

// selection: {lap: lap index or null (all), d0, d1 (m) or null, ph: phase id or 'all'}
function vdPick(L,i,sel){if(!(L.sp[i]>=VD_TH.spd))return false;if(!sel)return true;if(sel.ph&&sel.ph!=='all'&&L.ph[i]!==sel.ph)return false;if(sel.d0!=null&&(L.d[i]<sel.d0||L.d[i]>sel.d1))return false;return true;}

// ---------- the suspension analysis: per wheel, per phase, per lap ----------
function vdSusp(S,laps,opt={}){const knee=opt.knee||50,range=opt.range||250,bin=opt.bin||10,sel=opt.sel||null;
  const use=sel&&sel.lap!=null?laps.filter(l=>l.i===sel.lap):laps;const R={knee,range,bin,sel,laps:use,w:{},ev:[],resHz:null};
  for(const w of VD_W){const sg=vdSign(S,laps,w);const Ls=use.map(l=>vdLap(S,l,w,sg.sign||1)).filter(Boolean);if(!Ls.length)continue;
    const cv=[],pos=[],byPh={};const perLap={travel:[],bump95:[],reb95:[]};
    for(const L of Ls){const lp=[],lv=[];for(let i=0;i<L.n;i++){if(!vdPick(L,i,sel))continue;const v=L.cv[i];cv.push(v);lv.push(v);if(L.comp){pos.push(L.comp[i]);lp.push(L.comp[i]);}
        const P=byPh[L.ph[i]]||(byPh[L.ph[i]]={v:[],p:[]});P.v.push(v);if(L.comp)P.p.push(L.comp[i]);}
      perLap.travel.push(lp.length?vdQ(lp,0.99)-vdQ(lp,0.01):NaN);perLap.bump95.push(vdQ(lv.filter(x=>x>0),0.95));perLap.reb95.push(-vdQ(lv.filter(x=>x<0).map(x=>-x),0.95));}
    const f=Ls[0].f;R.resHz=R.resHz?Math.min(R.resHz,f):f;
    const ph={};for(const [k] of VD_PH){const P=byPh[k];if(!P||P.v.length<f*0.5)continue;
      const sp=vdSorted(P.p);ph[k]={n:P.v.length,s:P.v.length/f,bump95:vdQ(P.v.filter(x=>x>0),0.95),reb95:-vdQ(P.v.filter(x=>x<0).map(x=>-x),0.95),p1:vdQs(sp,0.01),p50:vdQs(sp,0.5),p99:vdQs(sp,0.99),z:vdZones(P.v,knee)};}
    R.w[w]={sign:sg,velSrc:Ls[0].velSrc,filt:Ls[0].filt,f,hist:vdHist(cv,range,bin),z:vdZones(cv,knee),n:cv.length,s:cv.length/f,
      bump95:vdQ(cv.filter(x=>x>0),0.95),reb95:-vdQ(cv.filter(x=>x<0).map(x=>-x),0.95),
      travel:pos.length?(sp=>({p1:vdQs(sp,0.01),p50:vdQs(sp,0.5),p99:vdQs(sp,0.99),min:vdQs(sp,0),max:vdQs(sp,1)}))(vdSorted(pos)):null,ph,perLap};
    // events always on all the chosen laps: the page filters them by lap and place
    R.ev.push(...vdEvents(S,laps.map(l=>vdLap(S,l,w,sg.sign||1)).filter(Boolean),w,sg));}
  R.groups=vdGroup(R.ev,laps.length);return R;}

// ---------- events of one wheel ----------
// unloaded wheel (and how long the load takes to come back), oscillation after a hit, slow recovery after a hit,
// compression building up over successive hits, travel close to the maximum observed (NOT a physical end of travel)
function vdEvents(S,Ls,w,sg){const E=[];const all=[];Ls.forEach(L=>{if(L.comp)for(let i=0;i<L.n;i++)all.push(L.comp[i]);});
  const pMax=all.length?vdQ(all,VD_EV.extreme):NaN;
  for(const L of Ls){const f=L.f,n=L.n;const at=i=>({lap:L.lap.num,li:L.lap.i,w,t:L.t0+i/f,d:L.d[i],ph:L.ph[i],kerb:!!(L.su&&L.su[i]===VD_KERB)});
    // 1. unloaded wheel: load under 10% of this lap's median at speed (or under 300 N) for ≥ 30 ms
    if(L.ld&&vdFin(L.ld).length){const fast=[];for(let i=0;i<n;i++)if(L.sp[i]>60&&Number.isFinite(L.ld[i]))fast.push(L.ld[i]);const med=vdMed(fast);const lim=Math.max(VD_EV.unloadN,med*VD_EV.unload);
      for(let i=1;i<n;i++){if(!(L.sp[i]>60&&L.ld[i]<lim&&!(L.ld[i-1]<lim)))continue;let j=i;let mn=L.ld[i];const gap=Math.round(0.1*f);for(;;){while(j<n-1&&L.ld[j+1]<lim){j++;if(L.ld[j]<mn)mn=L.ld[j];}let k=j+1;while(k<Math.min(n,j+gap)&&!(L.ld[k]<lim))k++;if(k<Math.min(n,j+gap)&&L.ld[k]<lim){j=k;continue;}break;} // gaps under 0.1 s join the same event
        const dur=(j-i+1)/f;if(dur<VD_EV.unloadS){i=j;continue;}const pre=vdMed(L.ld.subarray(Math.max(0,i-Math.round(0.4*f)),Math.max(0,i-Math.round(0.1*f))));
        let rec=NaN;for(let k=j;k<Math.min(n,j+Math.round(1*f));k++)if(L.ld[k]>=0.8*pre){rec=(k-i)/f;break;}
        let gv=NaN;if(L.gv)for(let k=Math.max(0,i-Math.round(0.1*f));k<=Math.min(n-1,j+Math.round(0.1*f));k++)if(!(Math.abs(L.gv[k])<=gv))gv=Math.abs(L.gv[k]);
        let kerb=false;if(L.su)for(let k=Math.max(0,i-Math.round(0.15*f));k<=j;k++)if(L.su[k]===VD_KERB)kerb=true;
        E.push({...at(i),kerb,k:'unload',dur,min:mn,pre,rec,gv,lim});i=j;}}
    if(!L.comp)continue;
    // high-passed position: what is left after the slow load transfers (0.4 s moving average)
    const base=vdMA(L.comp,Math.round(0.4*f)),hp=new Float32Array(n);for(let i=0;i<n;i++)hp[i]=L.comp[i]-base[i];
    // stimuli: local peaks of |velocity| over the stimulus speed, at least 0.3 s apart
    const stim=[];for(let i=1;i<n-1;i++){const a=Math.abs(L.vel[i]);if(a>VD_EV.vstim&&a>=Math.abs(L.vel[i-1])&&a>=Math.abs(L.vel[i+1])&&L.sp[i]>VD_TH.spd){if(stim.length&&i-stim[stim.length-1]<0.3*f)continue;stim.push(i);}}
    for(const i of stim){
      // 2. oscillation: alternating extremes of the high-passed position, each over the amplitude, within 0.6 s
      const ext=[];for(let j=i+1;j<Math.min(n-1,i+Math.round(0.6*f));j++){const a=hp[j]-hp[j-1],b=hp[j+1]-hp[j];if(a*b<0&&Math.abs(hp[j])>VD_EV.amin){if(ext.length&&Math.sign(hp[ext[ext.length-1]])===Math.sign(hp[j])){if(Math.abs(hp[j])>Math.abs(hp[ext[ext.length-1]]))ext[ext.length-1]=j;continue;}ext.push(j);}}
      if(ext.length>=4){const T=2*(ext[ext.length-1]-ext[0])/(ext.length-1)/f;E.push({...at(i),k:'osc',cycles:(ext.length-1)/2,hz:T>0?1/T:NaN,amp:Math.abs(hp[ext[0]]),decay:Math.abs(hp[ext[ext.length-1]])/Math.abs(hp[ext[0]])});}
      // 3. recovery: deviation from the position before the hit, and the time to come back within 25% of it.
      // Only when pedals and lateral g are steady around it: otherwise the "base" itself moves and nothing can be said.
      const q0=Math.max(0,i-Math.round(0.35*f)),q1=Math.max(0,i-Math.round(0.1*f));if(q1-q0<3)continue;
      const b0=vdMed(L.comp.subarray(q0,q1));let pk=i,dev=0;for(let j=i;j<Math.min(n,i+Math.round(0.15*f));j++){const x=Math.abs(L.comp[j]-b0);if(x>dev){dev=x;pk=j;}}
      if(dev<VD_EV.devMin)continue;const e1=Math.min(n-1,pk+Math.round(VD_EV.recMax*f));
      const steady=Math.abs(vdMean(L.th.subarray(q0,q1))-vdMean(L.th.subarray(pk,e1)))<20&&Math.abs(vdMean(L.br.subarray(q0,q1))-vdMean(L.br.subarray(pk,e1)))<10&&Math.abs(vdMean(L.la.subarray(q0,q1))-vdMean(L.la.subarray(pk,e1)))<0.4;
      if(!steady)continue;let rec=NaN;for(let j=pk;j<=e1;j++)if(Math.abs(L.comp[j]-b0)<0.25*dev){rec=(j-pk)/f;break;}
      E.push({...at(i),k:'rec',dev,rec,slow:!Number.isFinite(rec)||rec>VD_EV.recSlow,dir:L.comp[pk]>b0?'compressione':'estensione'});}
    // 4. compression building up: ≥ 3 hits less than 0.5 s apart, and the position between them rising each time (needs the sign)
    if(sg.sign){let run=[];const flush=()=>{if(run.length>=3){const m=[];for(let k=1;k<run.length;k++){let mn=Infinity;for(let j=run[k-1];j<run[k];j++)if(L.comp[j]<mn)mn=L.comp[j];m.push(mn);}
          let up=true;for(let k=1;k<m.length;k++)if(!(m[k]>m[k-1]))up=false;const rise=m[m.length-1]-m[0];if(up&&m.length>=2&&rise>VD_EV.pack)E.push({...at(run[0]),k:'pack',hits:run.length,rise,dur:(run[run.length-1]-run[0])/f});}run=[];};
      for(const i of stim){if(L.vel[i]*(sg.sign)<=0)continue;if(run.length&&i-run[run.length-1]>0.5*f)flush();run.push(i);}flush();}
    // 5. close to the maximum travel observed in these laps (top 0.5%): it is NOT the physical end of travel
    if(Number.isFinite(pMax))for(let i=1;i<n;i++){if(L.comp[i]>=pMax&&!(L.comp[i-1]>=pMax)){let j=i,pk=i;while(j<n-1&&L.comp[j+1]>=pMax){j++;if(L.comp[j]>L.comp[pk])pk=j;}E.push({...at(pk),k:'max',val:L.comp[pk],thr:pMax,dur:(j-i+1)/f});i=j;}}}
  return E;}
const VD_EVN={unload:'Ruota scarica',osc:'Oscillazioni ripetute',rec:'Recupero dopo una sollecitazione',pack:'Compressione che si accumula',max:'Vicino alla corsa massima osservata'};

// the same event on different laps at the same place (± 40 m): repeatable when it is there on ≥ 60% of the laps (at least 2)
function vdGroup(E,nLaps){const G=[];for(const e of E.filter(e=>e.k!=='rec'||e.slow)){let g=G.find(g=>g.k===e.k&&g.w===e.w&&Math.abs(g.d-e.d)<40);if(!g){g={k:e.k,w:e.w,d:e.d,ev:[],laps:new Set()};G.push(g);}g.ev.push(e);g.laps.add(e.lap);g.d=vdMean(g.ev.map(x=>x.d));}
  G.forEach(g=>{g.n=g.laps.size;g.rep=g.n>=Math.max(2,Math.ceil(0.6*nLaps));g.kerb=g.ev.filter(e=>e.kerb).length/g.ev.length;g.ph=vdMode(g.ev.map(e=>e.ph));});
  return G.sort((a,b)=>(b.rep-a.rep)||(b.n-a.n)||(a.d-b.d));}
function vdMode(a){const c={};a.forEach(x=>c[x]=(c[x]||0)+1);return Object.entries(c).sort((x,y)=>y[1]-x[1])[0]?.[0]||null;}

// ---------- axles: common and differential movement, pitch and roll ----------
// From the four suspension positions (compression positive): heave = mean of the two wheels of an axle (common movement),
// roll = left − right (differential), pitch index = front heave − rear heave. These are indicators from wheel movement,
// not the travel of the third spring nor body angles; Body Pitch / Body Roll and the 3rd Pos channels are measured.
function vdAxles(S,laps){const key='vdax:'+laps.map(l=>l.i).join(',');if(S.cache.has(key))return S.cache.get(key);
  const sg={};VD_W.forEach(w=>sg[w]=vdSign(S,laps,w));const have=VD_W.every(w=>vdChan(S,'Susp Pos '+w));
  const ch=n=>vdChan(S,n);const R={sg,have,ph:{},speed:null,brake:null,roll:null,third:{},perLap:[]};
  const acc={};const push=(ph,k,v)=>{if(!Number.isFinite(v))return;((acc[ph]??={})[k]??=[]).push(v);};
  const sv=[],sx={};const addS=(k,v)=>{(sx[k]??=[]).push(v);};
  const rollPts={F:[[],[]],R:[[],[]],B:[[],[]]};const pair={F:[[],[]],R:[[],[]]};const brk={x:[],F:[],R:[],P:[]};
  for(const lap of laps){const Ls={};VD_W.forEach(w=>{Ls[w]=vdLap(S,lap,w,sg[w].sign||1);});const L0=Ls.FL||Ls.RL;if(!L0)continue;const n=L0.n,f=L0.f,ts=lap.t0+L0.t0;
    const g=k=>{const c=ch(k);return c?vdAt(c,ts,f,n):null;};const t3F=g('Front 3rd Pos'),t3R=g('Rear 3rd Pos'),pi=g('Body Pitch'),ro=g('Body Roll'),gl=g('G Force Long');
    const rh={};VD_W.forEach(w=>rh[w]=g('Ride Height '+w));const ld={};VD_W.forEach(w=>ld[w]=g('Tyre Load '+w));
    const pl={heaveF:[],heaveR:[]};
    for(let i=0;i<n;i++){const ph=L0.ph[i];const v=L0.sp[i];if(!(v>=VD_TH.spd))continue;
      const c=w=>Ls[w]?.comp?.[i];const hF=(c('FL')+c('FR'))/2,hR=(c('RL')+c('RR'))/2;const rF=c('FL')-c('FR'),rR=c('RL')-c('RR');
      const rf=rh.FL&&rh.FR?(rh.FL[i]+rh.FR[i])/2:NaN,rr=rh.RL&&rh.RR?(rh.RL[i]+rh.RR[i])/2:NaN;
      const vals={heaveF:hF,heaveR:hR,pitchI:hF-hR,rollF:rF,rollR:rR,rhF:rf,rhR:rr,rake:rr-rf,t3F:t3F?.[i],t3R:t3R?.[i],pitch:pi?.[i],roll:ro?.[i]};
      for(const [k,x] of Object.entries(vals))push(ph,k,x);
      if(i%3===0){if(t3F){pair.F[0].push(t3F[i]);pair.F[1].push(hF);}if(t3R){pair.R[0].push(t3R[i]);pair.R[1].push(hR);}}
      if(ph==='str'){sv.push(v);for(const [k,x] of Object.entries(vals))addS(k,x);addS('ldF',ld.FL&&ld.FR?ld.FL[i]+ld.FR[i]:NaN);addS('ldR',ld.RL&&ld.RR?ld.RL[i]+ld.RR[i]:NaN);}
      if(ph==='mid'||ph==='ent'||ph==='ext'){const la=L0.la[i];rollPts.F[0].push(la);rollPts.F[1].push(rF);rollPts.R[0].push(la);rollPts.R[1].push(rR);rollPts.B[0].push(la);rollPts.B[1].push(ro?.[i]);}
      if(ph==='brk'||ph==='str'){brk.x.push(ph==='brk'?L0.br[i]:0);brk.F.push(hF);brk.R.push(hR);brk.P.push(gl?.[i]);}
      if(ph==='str'&&v>150){pl.heaveF.push(hF);pl.heaveR.push(hR);}}
    R.perLap.push({lap:lap.num,heaveF:vdMed(pl.heaveF),heaveR:vdMed(pl.heaveR)});}
  for(const [ph,o] of Object.entries(acc)){R.ph[ph]={};for(const [k,a] of Object.entries(o))R.ph[ph][k]={p1:vdQ(a,0.01),p50:vdQ(a,0.5),p99:vdQ(a,0.99),n:a.length};}
  // against speed on the straights: medians by 20 km/h and a line against (v/100)², the shape of aerodynamic load
  if(sv.length>200){const bins={};sv.forEach((v,i)=>{const b=Math.floor(v/20)*20;(bins[b]??=[]).push(i);});const rows=Object.keys(bins).map(Number).sort((a,b)=>a-b).filter(b=>bins[b].length>=30);
    const med=k=>rows.map(b=>vdMed(bins[b].map(i=>sx[k]?.[i])));const keys=Object.keys(sx);const curve={};keys.forEach(k=>curve[k]=med(k));
    const v2=sv.map(v=>(v/100)**2);const fit={};keys.forEach(k=>{const y=sx[k];const xs=[],ys=[];for(let i=0;i<y.length;i++)if(sv[i]>100){xs.push(v2[i]);ys.push(y[i]);}fit[k]=vdFit(xs,ys);});
    R.speed={rows,curve,fit,n:sv.length};}
  // braking: how far the axles move per % of brake (straight-line braking), and the dive
  if(brk.x.length>200){R.brake={F:vdFit(brk.x,brk.F),R:vdFit(brk.x,brk.R)};const hi=brk.x.map((x,i)=>x>60?i:-1).filter(i=>i>=0),lo=brk.x.map((x,i)=>x===0?i:-1).filter(i=>i>=0);
    if(hi.length>50&&lo.length>50){R.brake.diveF=vdMed(hi.map(i=>brk.F[i]))-vdMed(lo.map(i=>brk.F[i]));R.brake.diveR=vdMed(hi.map(i=>brk.R[i]))-vdMed(lo.map(i=>brk.R[i]));R.brake.n=hi.length;}}
  // roll: differential movement per g of lateral force, front and rear (indicator; the body angle per g when measured)
  {const fF=vdFit(rollPts.F[0],rollPts.F[1]),fR=vdFit(rollPts.R[0],rollPts.R[1]),fB=vdFit(rollPts.B[0],rollPts.B[1]);if(fF||fR)R.roll={F:fF,R:fR,body:fB,n:rollPts.F[0].length};}
  R.third=vdThird(S,R,{F:vdCorr(pair.F[0],pair.F[1]),R:vdCorr(pair.R[0],pair.R[1])});R.stops=vdStops(S,laps,sg);
  S.cache.set(key,R);return R;}

// two straight-line slopes of y against (v/100)², below and above the middle of the speed range seen on the straights
function vdBands(R,k){const sp=R.speed;if(!sp)return null;const rows=sp.rows,y=sp.curve[k];if(!y)return null;const pts=rows.map((b,i)=>[(b+10)/100,y[i]]).filter(p=>p[0]*100>=100&&Number.isFinite(p[1]));if(pts.length<5)return null;
  const m=Math.floor(pts.length/2);const lo=vdFit(pts.slice(0,m+1).map(p=>p[0]**2),pts.slice(0,m+1).map(p=>p[1])),hi=vdFit(pts.slice(m).map(p=>p[0]**2),pts.slice(m).map(p=>p[1]));
  return lo&&hi?{lo:lo.b,hi:hi.b,vSplit:pts[m][0]*100,vMax:pts[pts.length-1][0]*100,ratio:Math.abs(lo.b)>1e-6?hi.b/lo.b:NaN,at:pts[m][1],top:pts[pts.length-1][1]}:null;}

// third element: the measured channel, what it adds to the wheels (it can be just their mean), and a plateau with speed
function vdThird(S,R,same0={}){const out={};for(const [ax,k,hk,lk] of [['F','t3F','heaveF','ldF'],['R','t3R','heaveR','ldR']]){const a=R.ph.str?.[k];if(!a){out[ax]=null;continue;}
    const same=same0[ax];  // correlation with the mean of the two wheels: 1.00 = the channel adds nothing to them
    const B=vdBands(R,k),Bl=vdBands(R,lk);
    // plateau: the third element almost stops moving with speed (slope above < 30% of the slope below) while the axle load keeps rising
    let pk={st:'non determinabile',ev:[],why:''};
    if(B&&Number.isFinite(B.ratio)&&B.lo>0){const flat=B.ratio<0.3;const loadUp=Bl&&Bl.lo>0?Bl.ratio>0.6:null;
      if(flat&&loadUp){pk={st:'stimato',at:B.at,ev:[`${tr('3° elemento quasi fermo sopra')} ${Math.round(B.vSplit)} km/h (${tr('pendenza')} ${fx(B.ratio*100,0)}% ${tr('di quella sotto')})`,`${tr('carico gomme dell\'asse che continua a crescere')} (${fx(Bl.ratio*100,0)}%)`],why:tr('due evidenze concordi: il 3° elemento smette di comprimersi mentre il carico aumenta')};}
      else if(flat){pk={st:'possibile',at:B.at,ev:[`${tr('3° elemento quasi fermo sopra')} ${Math.round(B.vSplit)} km/h`],why:loadUp===false?tr('anche il carico smette di crescere: può essere il carico aerodinamico e non un contatto'):tr('manca il carico gomme per confermare')};}
      else pk={st:'non rilevato',ev:[`${tr('il 3° elemento continua a comprimersi fino a')} ${Math.round(B.vMax)} km/h`],why:''};}
    else pk.why=tr('pochi dati in rettilineo per vedere l\'andamento con la velocità');
    out[ax]={p1:a.p1,p50:a.p50,p99:a.p99,same,bands:B,packer:pk};}
  return out;}

// contact with bump rubber / packer at each corner: from the suspension force against position at low damper speed.
// Measured only with a dedicated channel (none in LMU files today); estimated when the stiffness rises sharply near the top;
// otherwise not determinable. The maximum travel observed is never taken for the end of travel.
function vdStops(S,laps,sg){const out={};for(const w of VD_W){const F=vdChan(S,'Susp Force '+w);const Ls=laps.map(l=>vdLap(S,l,w,sg[w].sign||1)).filter(L=>L&&L.comp);
    if(!Ls.length){out[w]=null;continue;}const all=[];Ls.forEach(L=>{for(let i=0;i<L.n;i++)if(L.sp[i]>=VD_TH.spd)all.push(L.comp[i]);});
    const r={obsMax:vdQ(all,0.995),obsP99:vdQ(all,0.99),st:'non determinabile',ev:[],why:''};out[w]=r;
    const meas=vdChan(S,'Bump Stop '+w)||vdChan(S,'Packer Contact '+w);if(meas){r.st='misurato';r.why=tr('canale dedicato nel file');continue;}
    if(!F){r.why=tr('serve la forza della sospensione (Susp Force) per stimarlo');continue;}
    const bins={};for(const L of Ls){const ff=vdAt(F,L.lap.t0+L.t0,L.f,L.n);for(let i=0;i<L.n;i++){if(!(L.sp[i]>=VD_TH.spd)||!(Math.abs(L.cv[i])<20))continue;const b=Math.floor(L.comp[i]);(bins[b]??=[]).push(ff[i]);}}
    let rows=Object.keys(bins).map(Number).sort((a,b)=>a-b).filter(b=>bins[b].length>=30).map(b=>[b+0.5,vdMed(bins[b])]);
    if(rows.length<6){r.why=tr('pochi punti a bassa velocità dell\'ammortizzatore');continue;}
    const m=Math.floor(rows.length*0.6);let base=vdFit(rows.slice(0,m).map(x=>x[0]),rows.slice(0,m).map(x=>x[1]));
    if(base&&base.b<0){rows=rows.map(x=>[x[0],-x[1]]);base={...base,b:-base.b};}  // force written with the opposite sign
    const top=vdFit(rows.slice(-3).map(x=>x[0]),rows.slice(-3).map(x=>x[1]));
    if(!base||!top||!(base.b>1e-3)){r.why=tr('relazione forza/posizione non leggibile');continue;}
    const ratio=top.b/base.b;r.rate={base:base.b,top:top.b,ratio,rows};
    if(ratio>=1.8){let knee=rows[rows.length-3][0];for(let k=m;k<rows.length-1;k++){const s=(rows[k+1][1]-rows[k][1])/(rows[k+1][0]-rows[k][0]);if(s>1.5*base.b){knee=rows[k][0];break;}}
      r.st='stimato';r.at=knee;r.ev=[`${tr('rigidezza')} ${fx(base.b/1000,2)} → ${fx(top.b/1000,2)} kN/mm ${tr('oltre')} ≈${fx(knee,0)} mm`];r.why=tr('la rigidezza sale di colpo vicino alla massima compressione: compatibile con tampone o packer (incertezza ± 1 mm)');}
    else if(ratio<0.7){r.why=tr('rigidezza che cala vicino alla massima corsa: relazione forza/posizione non leggibile');}
    else if(ratio<1.3){r.st='non rilevato';r.why=tr('rigidezza costante fino alla corsa massima osservata: nessun segno di contatto (non esclude un contatto oltre quella corsa)');}
    else r.why=tr('aumento di rigidezza piccolo: non basta per dire che c\'è un contatto');}
  return out;}

// ---------- platform and aerodynamics ----------
// ride heights against speed (straights), rake as the rear − front difference in mm (not an angle: the wheelbase is not
// in the file), oscillations of the platform at speed, very low ride heights, comparison by phase.
function vdPlatform(S,laps,opt={}){const key='vdpl:'+laps.map(l=>l.i).join(',')+':'+(opt.rhMin??'');if(S.cache.has(key))return S.cache.get(key);
  const ch=n=>vdChan(S,n);const base=ch('Ride Height FL')||ch('Ride Height RL');if(!base){const r={none:true};S.cache.set(key,r);return r;}
  const rhMin=opt.rhMin??3;const R={ph:{},osc:{F:[],R:[]},low:[],aero:null,f:base.f,rhMin};const acc={};const sv=[],sx={F:[],R:[],rake:[],df:[],dr:[],drag:[]};
  const dF=ch('Front Downforce'),dR=ch('Rear Downforce'),dg=ch('Drag');
  for(const lap of laps){const seg=vdSeg(base,lap.t0,lap.t1,0);const f=seg.f,n=seg.b-seg.a,ts=seg.ts+seg.a/f;if(n<10)continue;
    const g=k=>{const c=ch(k);return c?vdAt(c,ts,f,n):null;};const rh={};VD_W.forEach(w=>rh[w]=g('Ride Height '+w));
    const sp=g('Ground Speed'),br=g('Brake Pos'),th=g('Throttle Pos'),la=g('G Force Lat'),gv=g('G Force Vert');const su={};VD_W.forEach(w=>su[w]=ch('Surface Type '+w)?vdAt(ch('Surface Type '+w),ts,f,n,true):null);
    const dla=la?vdDeriv(Float32Array.from(la,Math.abs),f,Math.max(2,Math.round(0.1*f))):null;const tr=lapTrace(S,lap);
    const F=new Float32Array(n),Rr=new Float32Array(n);for(let i=0;i<n;i++){F[i]=rh.FL&&rh.FR?(rh.FL[i]+rh.FR[i])/2:NaN;Rr[i]=rh.RL&&rh.RR?(rh.RL[i]+rh.RR[i])/2:NaN;}
    const ph=new Array(n);for(let i=0;i<n;i++){const kerb=VD_W.some(w=>su[w]&&su[w][i]===VD_KERB);let p=kerb&&sp[i]>=VD_TH.spd?'kerb':vdPhase(sp[i],br?.[i],th?.[i],la?.[i]??0,dla?.[i]??0);
      if((p==='mid'||p==='ent'||p==='ext')&&sp[i]>180&&Math.abs(la[i])>1)p='fast';ph[i]=p;}
    for(let i=0;i<n;i++){const p=ph[i];if(!(sp[i]>=VD_TH.spd))continue;const o=acc[p]??={F:[],R:[],rake:[],v:[]};o.F.push(F[i]);o.R.push(Rr[i]);o.rake.push(Rr[i]-F[i]);o.v.push(sp[i]);
      if(p==='str'){sv.push(sp[i]);sx.F.push(F[i]);sx.R.push(Rr[i]);sx.rake.push(Rr[i]-F[i]);sx.df.push(dF?sampleAt(dF,ts+i/f):NaN);sx.dr.push(dR?sampleAt(dR,ts+i/f):NaN);sx.drag.push(dg?sampleAt(dg,ts+i/f):NaN);}}
    // oscillation of the platform on the straights over 150 km/h: what is left after a 0.5 s moving average
    for(const [ax,A] of [['F',F],['R',Rr]]){const m=vdMA(A,Math.round(0.5*f));let run=[];const flush=()=>{if(run.length>=f){const res=run.map(i=>A[i]-m[i]);let zc=0;for(let k=1;k<res.length;k++)if(res[k-1]*res[k]<0)zc++;
          R.osc[ax].push({lap:lap.num,rms:Math.sqrt(vdMean(res.map(x=>x*x))),hz:zc/2/(res.length/f),s:res.length/f,d:vdDist(tr,(run[0])/f+seg.ts+seg.a/f-lap.t0)});}run=[];};
      for(let i=0;i<n;i++){if(ph[i]==='str'&&sp[i]>150&&Number.isFinite(A[i]))run.push(i);else flush();}flush();}
    // very low ride height: under the threshold set in the options; «possible ground contact» when the vertical g jumps there too
    for(const w of VD_W){const a=rh[w];if(!a)continue;for(let i=1;i<n;i++){if(!(a[i]<rhMin&&!(a[i-1]<rhMin)&&sp[i]>=VD_TH.spd))continue;let j=i,mn=a[i],pk=i;while(j<n-1&&a[j+1]<rhMin){j++;if(a[j]<mn){mn=a[j];pk=j;}}
      let g2=NaN;if(gv)for(let k=Math.max(0,i-3);k<=Math.min(n-1,j+3);k++)if(!(Math.abs(gv[k])<=g2))g2=Math.abs(gv[k]);
      R.low.push({lap:lap.num,li:lap.i,w,t:(ts+pk/f)-lap.t0,d:vdDist(tr,(ts+pk/f)-lap.t0),min:mn,dur:(j-i+1)/f,ph:ph[pk],kerb:!!(su[w]&&su[w][pk]===VD_KERB),gv:g2});i=j;}}}
  for(const [p,o] of Object.entries(acc))R.ph[p]={F:vdMed(o.F),R:vdMed(o.R),rake:vdMed(o.rake),Fmin:vdQ(o.F,0.01),Rmin:vdQ(o.R,0.01),v:vdMed(o.v),n:o.F.length,s:o.F.length/R.f};
  if(sv.length>200){const bins={};sv.forEach((v,i)=>{const b=Math.floor(v/20)*20;(bins[b]??=[]).push(i);});const rows=Object.keys(bins).map(Number).sort((a,b)=>a-b).filter(b=>bins[b].length>=30);
    const med=k=>rows.map(b=>vdMed(bins[b].map(i=>sx[k][i])));R.speed={rows,F:med('F'),R:med('R'),rake:med('rake'),n:sv.length};
    const xs=[],yF=[],yR=[];sv.forEach((v,i)=>{if(v>100){xs.push((v/100)**2);yF.push(sx.F[i]);yR.push(sx.R[i]);}});R.speed.fitF=vdFit(xs,yF);R.speed.fitR=vdFit(xs,yR);
    // aerodynamic load only when the game exports it (channels Front / Rear Downforce): balance = front share
    if(dF&&dR){const bal=rows.map(b=>{const F_=vdMed(bins[b].map(i=>sx.df[i])),R_=vdMed(bins[b].map(i=>sx.dr[i]));return F_+R_>0?F_/(F_+R_)*100:NaN;});
      R.aero={rows,bal,front:med('df'),rear:med('dr'),drag:dg?med('drag'):null,src:tr('valori calcolati dal gioco (canali Front/Rear Downforce)')};}}
  const om=ax=>R.osc[ax].length?{rms:vdMed(R.osc[ax].map(o=>o.rms)),hz:vdMed(R.osc[ax].map(o=>o.hz)),perLap:R.osc[ax]}:null;R.oscF=om('F');R.oscR=om('R');
  R.lowG=vdGroup(R.low.map(e=>({...e,k:'low'})),laps.length);
  S.cache.set(key,R);return R;}

// ---------- comparisons: before / after, A / B ----------
// a, b: one value per lap. better: −1 if lower is better, +1 if higher is better, 0 when only the change matters.
// The difference counts only when it is larger than twice its standard error AND than `minDiff`; otherwise «inconcludente».
function vdCompare(a,b,{better=-1,minDiff=0,minN=3}={}){const A=vdFin(a),B=vdFin(b);const r={nA:A.length,nB:B.length,mA:vdMean(A),mB:vdMean(B),sA:vdSd(A),sB:vdSd(B)};
  r.diff=r.mB-r.mA;if(A.length<minN||B.length<minN){r.verdict='inconcludente';r.why=`${tr('servono almeno')} ${minN} ${tr('giri per parte')} (${A.length} / ${B.length})`;return r;}
  r.se=Math.sqrt(r.sA*r.sA/A.length+r.sB*r.sB/B.length);
  if(Math.abs(r.diff)<=2*r.se||Math.abs(r.diff)<minDiff){r.verdict='inconcludente';r.why=tr('differenza più piccola della variabilità tra i giri');return r;}
  r.verdict=!better?'cambiato':r.diff*better>0?'migliorato':'peggiorato';r.why='';return r;}

// what can make two sets of laps differ apart from the setup
function vdConditions(S,laps,su){const at=(n,t)=>S.ch[n]?sampleAt(S.ch[n],t):NaN;const L=laps.length?laps:[];
  const c=L.map(l=>lapConditions(S,l));const val=(k)=>vdMed(c.map(x=>x[k]));
  const comp=S.ch['Front Tyre Compound']?vdMode(L.map(l=>String(sampleStep(S.ch['Front Tyre Compound'],l.t0+1)))):null;
  const sv=k=>su&&typeof setupVal==='function'?setupVal(su,k):null;
  return {track:val('track'),air:val('air'),wet:Math.max(val('rain')||0,val('wet')||0)>0.05,fuel:vdMed(L.map(l=>at('Fuel Level',l.t0+0.5))),comp,compSu:su?(typeof suFind==='function'?suFind(su,'FRONTLEFT',/^CompoundSetting/):null):null,
    power:su?[sv('EngineBoostSetting'),sv('ElectricMotorMapSetting'),sv('RegenerationMapSetting')].filter(Boolean).join(' · '):null,n:L.length,car:S.meta?.car||''};}
function vdCondDiffs(a,b){const D=[];if(Number.isFinite(a.track)&&Number.isFinite(b.track)&&Math.abs(a.track-b.track)>3)D.push(`${tr('pista')} ${fx(a.track,0)} → ${fx(b.track,0)} °C`);
  if(Number.isFinite(a.fuel)&&Number.isFinite(b.fuel)&&Math.abs(a.fuel-b.fuel)>5)D.push(`${tr('carburante')} ${fx(a.fuel,0)} → ${fx(b.fuel,0)} L`);
  if(a.wet!==b.wet)D.push(tr('asciutto / bagnato'));if(a.comp&&b.comp&&a.comp!==b.comp)D.push(tr('mescola diversa'));if(a.compSu&&b.compSu&&a.compSu!==b.compSu)D.push(`${tr('mescola')} ${a.compSu} → ${b.compSu}`);
  if(a.power&&b.power&&a.power!==b.power)D.push(`${tr('motore/ibrido')} ${a.power} → ${b.power}`);if(a.car&&b.car&&a.car!==b.car)D.push(tr('auto diversa'));return D;}
