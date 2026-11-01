#!/usr/bin/env node
// Tests of the telemetry analysis on synthetic signals whose answer is known (no real telemetry in the repository).
// They check the algorithms (decoding, units, rates, filters, events, reliability, setup kept with the session);
// they do NOT prove that a diagnosis is right on a real car: that needs real .ld + .svm pairs (see STATO_LAVORI.md).
// Run: node tools/test_analysis.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const A=path.join(__dirname,'..','app');
const mem={};
const ctx={TextDecoder,TextEncoder,console,Float32Array,Float64Array,Int8Array,Int16Array,Int32Array,Uint8Array,Uint16Array,Uint32Array,DataView,ArrayBuffer,Math,Object,Number,Error,Array,Set,Map,JSON,String,Date,isFinite,Infinity,NaN,RegExp,Boolean,Symbol,
  setTimeout:()=>0,clearTimeout:()=>0,setInterval:()=>0,requestAnimationFrame:()=>0,
  document:{head:{appendChild(){}},createElement:()=>({}),documentElement:{classList:{add(){},toggle(){}}},addEventListener(){}},
  LS:{get:(k,d)=>k in mem?JSON.parse(mem[k]):d,set:(k,v)=>{mem[k]=JSON.stringify(v);}}};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext("var tr=s=>s;var fx=(v,d=1,u='')=>Number.isFinite(v)?v.toFixed(d)+(u?' '+u:''):'—';var esc=s=>String(s);var $=()=>null;var $$=()=>[];var cfg=()=>({rh:3});",ctx);
for(const f of ['core.js','chq.js','vdyn.js','ui51.js'])vm.runInContext(fs.readFileSync(path.join(A,f),'utf8'),ctx,{filename:f});
vm.runInContext('this.ANA=ANA;this.VD_EV=VD_EV;',ctx);
const C=ctx;let fails=0,n=0;
const ok=(c,msg)=>{n++;if(!c){fails++;console.log('  ✗ '+msg);}else console.log('  ✓ '+msg);};
const near=(a,b,tol)=>Math.abs(a-b)<=tol;

// ---------- a minimal MoTeC .ld writer (the same header layout parseLD reads) ----------
// ch: {name, unit, f, v (values), int: {shift, mul, scale, dec} for int16 storage, else float32}
function ldWrite(chs,meta={}){const H=0x400,CH=124;let dataAt=H+chs.length*CH;const parts=[];
  const blocks=chs.map(c=>{const n=c.v.length;let bytes;
    if(c.int){const {shift=0,mul=1,scale=1,dec=0}=c.int;const k=mul/scale*Math.pow(10,-dec);const a=new Int16Array(n);for(let i=0;i<n;i++)a[i]=Math.round((c.v[i]-shift)/k);bytes=new Uint8Array(a.buffer);}
    else{const a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=c.v[i];bytes=new Uint8Array(a.buffer);}
    const at=dataAt;dataAt+=bytes.length;return {c,bytes,at};});
  const buf=new ArrayBuffer(dataAt);const dv=new DataView(buf),u8=new Uint8Array(buf);
  const put=(o,s,len)=>{for(let i=0;i<Math.min(len,s.length);i++)u8[o+i]=s.charCodeAt(i);};
  put(0x5e,meta.date||'18/10/2026',16);put(0x7e,meta.time||'16:10:41',16);put(0x9e,meta.driver||'Test',64);put(0xde,meta.car||'',64);put(0x15e,meta.venue||'Pista Test',64);
  dv.setUint32(8,H,true);
  blocks.forEach((b,i)=>{const p=H+i*CH;dv.setUint32(p,i?p-CH:0,true);dv.setUint32(p+4,i<blocks.length-1?p+CH:0,true);dv.setUint32(p+8,b.at,true);dv.setUint32(p+12,b.c.v.length,true);
    const I=b.c.int;dv.setUint16(p+18,I?3:7,true);dv.setUint16(p+20,I?2:4,true);dv.setUint16(p+22,b.c.f,true);dv.setInt16(p+24,I?.shift||0,true);dv.setInt16(p+26,I?.mul||1,true);dv.setInt16(p+28,I?.scale||1,true);dv.setInt16(p+30,I?.dec||0,true);
    put(p+32,b.c.name,32);put(p+72,b.c.unit||'',12);u8.set(b.bytes,b.at);});
  return buf;}
const gen=(T,f,fn)=>Array.from({length:Math.round(T*f)},(_,i)=>fn(i/f));

// a synthetic session: 7 laps of 60 s (laps 1–5 complete), position as a slow sine plus an optional event
function session(o={}){const T=o.T||420,L=60,f=100;const lapNo=t=>Math.floor(t/L);
  const pos=o.pos||(t=>10+3*Math.sin(2*Math.PI*0.5*t));
  const chs=[{name:'Ground Speed',unit:'km/h',f:o.fSpeed||100,v:gen(T,o.fSpeed||100,t=>180+40*Math.sin(2*Math.PI*t/L)),int:{shift:0,mul:1,scale:1,dec:1}},
    {name:'Lap Number',unit:'',f,v:gen(T,f,lapNo),int:{}},
    {name:'Throttle Pos',unit:'%',f,v:gen(T,f,()=>100)},{name:'Brake Pos',unit:'%',f,v:gen(T,f,()=>0)},
    {name:'G Force Lat',unit:'G',f,v:gen(T,f,t=>0.1*Math.sin(t))},{name:'G Force Vert',unit:'G',f,v:gen(T,f,()=>0)},
    {name:'Track Temperature',unit:'C',f:1,v:gen(T,1,()=>30)},
    {name:'Front Downforce',unit:'N',f,v:gen(T,f,()=>0)}];
  for(const w of ['FL','FR','RL','RR']){const sg=o.sign&&o.sign[w]?o.sign[w]:1;
    chs.push({name:'Susp Pos '+w,unit:o.posUnit||'mm',f:o.fPos||100,v:gen(T,o.fPos||100,t=>sg*pos(t)*(o.posUnit==='m'?0.001:1))});
    chs.push({name:'Ride Height '+w,unit:'mm',f,v:gen(T,f,t=>60-pos(t))});
    chs.push({name:'Tyre Load '+w,unit:'N',f,v:gen(T,f,t=>o.load?o.load(t,w):4000+300*pos(t))});
    chs.push({name:'Susp Force '+w,unit:'N',f,v:gen(T,f,t=>o.force?o.force(pos(t)):2000*pos(t))});}
  (o.extra||[]).forEach(c=>chs.push(c));
  const P=C.parseLD(ldWrite(chs,o.meta));return C.buildSession(P,o.name||'synthetic.ld');}
const flying=S=>S.laps.filter(l=>l.complete&&l.type==='lanciato');

console.log('1. Decodifica e scale');
{const buf=ldWrite([{name:'Ground Speed',unit:'km/h',f:10,v:[0,100.5,250.25,320],int:{shift:641,mul:2,scale:1,dec:2}},{name:'Lap Number',f:10,v:[0,0,1,1],int:{}},{name:'Engine RPM',unit:'rpm',f:10,v:[1000.5,2000.25,3000,4000]}]);
  const P=C.parseLD(buf);const v=P.ch['Ground Speed'].v;
  ok(near(v[1],100.5,0.02)&&near(v[2],250.25,0.02)&&near(v[3],320,0.02),'int16 con shift, mul, scale e decimali: valori originali');
  ok(near(P.ch['Engine RPM'].v[1],2000.25,1e-3),'float32 letto senza scala');
  ok(P.meta.venue==='Pista Test'&&P.ch['Ground Speed'].raw.f===10,'metadati e frequenza originale conservati');}

console.log('2. Unità e conversioni');
{const T=10,f=10;const P=C.parseLD(ldWrite([{name:'Ground Speed',unit:'km/h',f,v:gen(T,f,()=>100)},{name:'Camber FL',unit:'rad',f,v:gen(T,f,()=>-0.05)},{name:'Body Pitch',unit:'',f,v:gen(T,f,()=>0.01)},
  {name:'Susp Pos FL',unit:'m',f,v:gen(T,f,()=>0.012)},{name:'Ride Height FL',unit:'furlong',f,v:gen(T,f,()=>40)},{name:'Tyre Carcass Temp FL',unit:'C',f,v:gen(T,f,t=>t<1?-273.15:85)}]));
  const ch=P.ch;
  ok(near(ch['Camber FL'].v[0],-0.05*180/Math.PI,1e-4)&&ch['Camber FL'].u==='°'&&ch['Camber FL'].conv[0].cert==='certa','radianti → gradi dall\'unità del file (certa)');
  ok(near(ch['Body Pitch'].v[0],0.01*180/Math.PI,1e-4)&&ch['Body Pitch'].conv[0].cert==='convenzione','angolo senza unità: convenzione LMU dichiarata');
  ok(near(ch['Susp Pos FL'].v[0],12,1e-3)&&ch['Susp Pos FL'].u==='mm','metri → mm');
  ok(ch['Ride Height FL'].conv.some(c=>c.bad)&&near(ch['Ride Height FL'].v[0],40,1e-6),'unità sconosciuta: segnalata e valori lasciati come sono');
  ok(Number.isNaN(ch['Tyre Carcass Temp FL'].v[0])&&near(ch['Tyre Carcass Temp FL'].v[50],85,1e-4),'−273 °C = dato mancante (NaN), non una temperatura');}

console.log('3. Nomi alternativi');
{const T=10,f=10;const P=C.parseLD(ldWrite([{name:'Ground Speed',unit:'km/h',f,v:gen(T,f,()=>100)},{name:'Damper Pos FL',unit:'mm',f,v:gen(T,f,()=>5)}]));
  ok(P.ch['Susp Pos FL']&&P.ch['Susp Pos FL'].alias==='Damper Pos FL','Damper Pos FL riconosciuto come Susp Pos FL');
  ok(!Object.keys(P.ch).includes('Susp Pos FL'),'il nome alternativo non compare due volte negli elenchi');}

console.log('4. Frequenze diverse, canali mancanti o piatti');
{const S=session({fSpeed:20});const laps=flying(S);
  ok(laps.length===5,'5 giri completi ricavati dal numero di giro');
  ok(S.deadCh['Front Downforce']&&!S.ch['Front Downforce'],'canale costante (0 N) trattato come mancante, non come zero');
  ok(C.chqChannel(S,'Front Downforce').st==='piatto'&&C.chqChannel(S,'Steering').st==='mancante','stato «piatto» e «mancante» distinti');
  ok(C.chqAnalysis(S,C.ANA.find(a=>a.id==='bal')).st==='no','analisi senza canali necessari: non utilizzabile');
  const L=C.vdLap(S,laps[1],'FL',1);ok(L.f===100,'la posizione resta a 100 Hz anche con la velocità a 20 Hz');
  const slow=session({fPos:20});const a=C.chqAnalysis(slow,C.ANA.find(a=>a.id==='damp'));ok(a.st==='no','posizione a 20 Hz: velocità ammortizzatore non ricavabile (non sembra ad alta risoluzione)');}

console.log('5. Velocità dalla posizione (segnale noto)');
{const S=session();const laps=flying(S);const L=C.vdLap(S,laps[2],'FL',1);
  let mx=0;for(let i=0;i<L.n;i++)if(Math.abs(L.vel[i])>mx)mx=Math.abs(L.vel[i]);const exp=3*2*Math.PI*0.5;
  ok(near(mx,exp,exp*0.01),`sinusoide 3 mm a 0,5 Hz: velocità massima ${mx.toFixed(2)} mm/s (attesa ${exp.toFixed(2)})`);
  ok(L.velSrc==='derivato'&&L.filt.ms===70,'velocità marcata come derivata, con la finestra del filtro');
  const S2=session({posUnit:'m'});const L2=C.vdLap(S2,flying(S2)[2],'FL',1);let m2=0;for(let i=0;i<L2.n;i++)m2=Math.max(m2,Math.abs(L2.vel[i]));ok(near(m2,exp,exp*0.01),'stesso risultato con la posizione in metri');}

console.log('6. Nessun picco artificiale tra giri');
{// a slow drift: lap 1 and lap 3 do not join. The old way (giri messi in fila e poi derivati) made a jump there.
  const S=session({pos:t=>5+t*0.02+2*Math.sin(2*Math.PI*0.5*t)});const laps=flying(S);const pick=[laps[0],laps[2]];
  const R=C.vdSusp(S,pick,{knee:50,range:250,bin:10});const x=R.w.FL;const tot=x.hist.n;
  const maxV=2*2*Math.PI*0.5+0.02;const beyond=x.hist.h.reduce((s,c,i)=>s+(Math.abs(-250+i*10+5)>maxV+10?c:0),0)+x.hist.lo+x.hist.hi;
  ok(beyond===0,`nessun campione oltre la velocità reale (${maxV.toFixed(1)} mm/s) su ${tot}`);
  // the naive way, for comparison: concatenate, then differentiate
  const cat=[];pick.forEach(l=>{const s=C.vdSeg(S.ch['Susp Pos FL'],l.t0,l.t1,0);for(let i=s.a;i<s.b;i++)cat.push(s.v[i]);});const d=C.vdDeriv(Float32Array.from(cat),100,3);let mx=0;for(const v of d)if(Number.isFinite(v))mx=Math.max(mx,Math.abs(v));
  ok(mx>maxV*3,`(controllo) derivando giri messi in fila compare un picco finto: ${mx.toFixed(0)} mm/s`);}

console.log('7. Segno compressione / estensione');
{const S=session();const l=flying(S);ok(C.vdSign(S,l,'FL').sign===1&&C.vdSign(S,l,'FL').cert==='verificato','posizione che cresce con il carico e cala con l\'altezza: verificato');
  const S2=session({sign:{FR:-1}});const s2=C.vdSign(S2,flying(S2),'FR');ok(s2.sign===-1&&s2.cert==='verificato','canale con segno opposto: riconosciuto');
  const S3=session({load:()=>4000,force:()=>1000});// ride height still correlates: one evidence only
  const s3=C.vdSign(S3,flying(S3),'FL');ok(s3.cert==='probabile','una sola evidenza: «probabile», non «verificato»');}

console.log('8. Oscillazioni e scarico della ruota');
{// at 35 s of each lap: a hit followed by a damped 6 Hz oscillation; and the load dropping to 0 for 0.2 s at 20 s
  const hit=t=>{const u=t%60-35;return u>0&&u<1?8*Math.exp(-u*1.5)*Math.sin(2*Math.PI*6*u):0;};
  const S=session({pos:t=>10+hit(t),load:(t,w)=>{const u=t%60-20;return w==='FL'&&u>0&&u<0.2?0:4000;}});const R=C.vdSusp(S,flying(S),{});
  const osc=R.groups.find(g=>g.k==='osc'&&g.w==='FL');ok(osc&&osc.rep&&near(C.vdMed(osc.ev.map(e=>e.hz)),6,0.6),`oscillazione trovata, ripetibile, a ${osc?C.vdMed(osc.ev.map(e=>e.hz)).toFixed(1):'—'} Hz (attesa 6)`);
  const un=R.groups.find(g=>g.k==='unload'&&g.w==='FL');ok(un&&un.rep&&near(C.vdMed(un.ev.map(e=>e.dur)),0.2,0.03),'ruota scarica per 0,2 s trovata in ogni giro');
  ok(!R.groups.some(g=>g.k==='unload'&&g.w==='FR'),'nessuno scarico dove il carico non cala');}

console.log('9. Massima corsa osservata ≠ fine corsa');
{const S=session();const X=C.vdAxles(S,flying(S));ok(X.stops.FL.st!=='stimato'&&Number.isFinite(X.stops.FL.obsMax),`molla lineare: nessun tampone (${X.stops.FL.st}), anche se esiste una corsa massima osservata`);
  const S2=session({force:x=>x<11.5?1000*x:11500+4000*(x-11.5),pos:t=>10+3*Math.sin(2*Math.PI*0.1*t)});const s2=C.vdAxles(S2,flying(S2)).stops.FL;
  ok(s2.st==='stimato'&&near(s2.at,11.5,1.5),`rigidezza ×4 oltre 11,5 mm: contatto stimato a ${fx_(s2.at)} mm`);}
function fx_(v){return Number.isFinite(v)?v.toFixed(1):'—';}

console.log('10. Affidabilità');
{const S=session();const l=flying(S);
  ok(C.chqReliability(S,l.slice(0,3),'susp',{perLap:[1,1,1],tol:0.5}).label!=='alta','3 giri: mai «alta»');
  ok(C.chqReliability(S,l,'susp',{perLap:[1,1,1,1,1],tol:0.5}).label==='alta','5 giri confrontabili e ripetibili: «alta»');
  ok(C.chqReliability(S,l,'susp',{}).label!=='alta','senza verifica di ripetibilità: non «alta»');
  ok(C.chqReliability(S,l,'susp',{perLap:[1,3,0,4,1],tol:0.5}).label==='bassa','poco ripetibile: «bassa»');
  ok(C.chqReliability(S,[],'susp',{}).label==='non analizzabile','nessun giro: non analizzabile');
  ok(C.chqReliability(S,l,'bal',{}).label==='non analizzabile','canali mancanti: non analizzabile');}

console.log('11. Confronti prima / dopo');
{const a=[0.20,0.22,0.19,0.21,0.20],b=[0.21,0.19,0.22,0.20,0.21],c=[0.10,0.11,0.09,0.10,0.12];
  ok(C.vdCompare(a,b,{better:-1}).verdict==='inconcludente','differenza dentro la variabilità: inconcludente');
  ok(C.vdCompare(a,c,{better:-1}).verdict==='migliorato'&&C.vdCompare(c,a,{better:-1}).verdict==='peggiorato','differenza netta: migliorato / peggiorato');
  ok(C.vdCompare([0.2,0.1],[0.1,0.05],{better:-1}).verdict==='inconcludente','troppo pochi giri: inconcludente');
  const S=session(),S2=session({meta:{venue:'Pista Test'}});const ca={...C.vdConditions(S,flying(S),null),fuel:30},cb={...C.vdConditions(S2,flying(S2),null),track:40,fuel:50};
  ok(C.vdCondDiffs(ca,cb).length===2,'condizioni diverse (pista, carburante) segnalate');}

console.log('12. Setup associato alla sessione');
{const S=session({meta:{venue:'Monza',date:'18/10/2026',time:'16:10:41',driver:'Test'}});const su=C.parseSVM('[GENERAL]\nFuelSetting=10//40 L\n[FRONTLEFT]\nCamberSetting=5//-2.5 deg\n','A.svm');
  ok(!C.sesSetupGet(S),'senza abbinamento: setup mancante');C.sesSetupSuggest(S,su);ok(C.sesSetupGet(S).st==='suggerito','aperto insieme alla telemetria: solo «suggerito»');
  C.sesSetupSet(S,su,'confermato');const kept=C.sesSetupGet(S);ok(kept.st==='confermato'&&kept.text.includes('CamberSetting=5'),'confermato con la copia del contenuto');
  const su2=C.parseSVM('[GENERAL]\nFuelSetting=12//48 L\n[FRONTLEFT]\nCamberSetting=7//-2.1 deg\n','A.svm');C.sesSetupSuggest(S,su2);
  ok(C.sesSetupGet(S).text.includes('CamberSetting=5')&&C.svmHash(su2.text)!==kept.hash,'file cambiato dopo: resta la copia storica, il cambio si riconosce');
  ok(C.suCarMatch({meta:{car:'BMW M Hybrid V8'}},{car:'Porsche_963 Hypercar'})===false&&C.suCarMatch({meta:{car:'BMW M Hybrid V8'}},{car:'BMW_M_Hybrid Hypercar WEC2026'})!==false,'auto diversa riconosciuta');}

console.log(`\n${n-fails}/${n} controlli superati`);process.exit(fails?1:0);
