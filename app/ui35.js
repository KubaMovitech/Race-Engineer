// ================= TELEMETRIA: the engineering workstation =================
// One screen to compare two laps: a big track map with the real track edges (from Path Lateral / Track Edge), the two
// racing lines coloured by delta, speed, inputs or gear, brake and throttle points, a ghost replay; stacked traces of any
// of the ~245 channels; an inspector with every value under the cursor; corner by corner analysis; G-G diagram.
// A = the lap you study (cyan), B = the reference (orange). Everything is on A's distance grid (1 m).

const TW={};   // selected laps, prepared data, map, traces, cursor

// ---------- channel catalogue: label, unit, decimals, conversion ----------
const R2D=180/Math.PI;
const TWC={
  'Ground Speed':['Velocità','km/h',0],'Throttle Pos':['Gas','%',0],'Brake Pos':['Freno','%',0],'Steering':['Sterzo','°',0],'Gear':['Marcia','',0],'Engine RPM':['Giri motore','rpm',0],
  'G Force Lat':['G laterale','g',2],'G Force Long':['G longitudinale','g',2],'G Force Vert':['G verticale','g',2],'Path Lateral':['Posizione dal centro','m',2],'Track Edge':['Bordo pista','m',1],
  'Steering Shaft Torque':['Coppia piantone','Nm',0],'FFB Output':['Force feedback','%',0],'Brake Bias Rear':['Ripartizione post.','%',1],'Fuel Level':['Carburante','L',2],'Battery Charge Level':['Batteria','%',1],
  'Engine Torque':['Coppia motore','Nm',0],'Motor Torque':['Coppia elettrico','Nm',0],'Motor RPM':['Giri elettrico','rpm',0],'Motor State':['Stato elettrico','',0],'Eng Water Temp':['Acqua','°C',1],'Eng Oil Temp':['Olio','°C',1],
  'Front 3rd Pos':['3° elemento ant.','mm',1],'Rear 3rd Pos':['3° elemento post.','mm',1],'Body Pitch':['Beccheggio','°',2,R2D],'Body Roll':['Rollio','°',2,R2D],'Local Rotation Y':['Imbardata','°/s',1,R2D],
  'Delta Best':['Delta best (gioco)','s',3],'Lap Distance':['Distanza giro','m',0],'Turbo Boost Pressure':['Turbo','kPa',0],
  '@delta':['Delta B − A','s',3],'@power':['Potenza totale','kW',0],'@gsum':['G combinato','g',2],'@speedD':['Velocità B − A','km/h',1]};
const TWW={'Tyre Temp # Inner':['Gomma interno','°C',0],'Tyre Temp # Centre':['Gomma centro','°C',0],'Tyre Temp # Outer':['Gomma esterno','°C',0],'Tyre Carcass Temp #':['Carcassa','°C',1],
  'Tyre Pressure #':['Pressione','kPa',1],'Tyre Load #':['Carico','kN',2,0.001],'Grip Fract #':['Aderenza usata','%',0],'Brake Temp #':['Freno','°C',0],'Brake Pressure #':['Pressione freno','bar',1],
  'Ride Height #':['Altezza','mm',1],'Susp Pos #':['Sospensione','mm',1],'Susp Force #':['Forza sosp.','kN',2,0.001],'Tyre Wear #':['Usura','%',2],'Wheel Rot Speed #':['Giri ruota','rad/s',0],
  'Lat Patch Vel #':['Scivolamento lat.','m/s',2],'Long Patch Vel #':['Scivolamento long.','m/s',2],'Camber #':['Camber','°',2,R2D],'Toe #':['Convergenza','°',2,R2D],'Lat Force #':['Forza lat.','kN',2,0.001],
  'Long Force #':['Forza long.','kN',2,0.001],'Vertical Tyre Deflection #':['Schiacciamento','mm',1],'Surface Type #':['Superficie','',0]};
const TW4=['FL','FR','RL','RR'],TW4C=['#4FC3F7','#F06292','#AED581','#FFB74D'];
function twMeta(name){if(TWC[name])return TWC[name];for(const k in TWW){const re=new RegExp('^'+k.replace('#','(FL|FR|RL|RR)')+'$');const m=re.exec(name);if(m){const w=TWW[k];return [w[0]+' '+m[1],w[1],w[2],w[3]];}}return [name,'',2];}
function twArr(g,name){const key='tw:'+name;if(g._c[key])return g._c[key];let o=null;const n=g.n;
  if(name==='@power'){const E=g.get('Engine Torque'),R=g.get('Engine RPM'),M=g.get('Motor Torque'),MR=g.get('Motor RPM');if(E&&R){o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=(E[i]*R[i]+(M&&MR?M[i]*MR[i]:0))*Math.PI/30/1000;}}
  else if(name==='@gsum'){const a=g.get('G Force Lat'),b=g.get('G Force Long');if(a&&b){o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=Math.hypot(a[i],b[i]);}}
  else{const a=g.get(name);if(a){const k=twMeta(name)[3];if(k){o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=a[i]*k;}else o=a;}}
  g._c[key]=o;return o;}
const twFmt=(v,d)=>Number.isFinite(v)?v.toFixed(d):'—';

// ---------- presets of trace panels ----------
const TW_PRE={
  pil:['@delta','Ground Speed','Throttle Pos','Brake Pos','Steering','Gear','Engine RPM','G Force Lat','G Force Long','Path Lateral'],
  gom:['@delta','Ground Speed','4:Tyre Temp # Centre','4:Tyre Pressure #','4:Grip Fract #','4:Tyre Load #','4:Lat Patch Vel #'],
  tel:['@delta','Ground Speed','4:Ride Height #','4:Susp Pos #','Front 3rd Pos','Rear 3rd Pos','Body Pitch','Body Roll','Local Rotation Y'],
  fre:['@delta','Ground Speed','Brake Pos','4:Brake Pressure #','4:Brake Temp #','4:Long Patch Vel #','G Force Long'],
  mot:['@delta','Ground Speed','Engine RPM','Gear','@power','Motor Torque','Battery Charge Level','Fuel Level','Throttle Pos']};
const TW_PREL={pil:'Pilota',gom:'Gomme',tel:'Telaio',fre:'Freni',mot:'Motore e ibrido'};

// ---------- data for the two laps ----------
function twSessions(){return lds().filter(S=>!S.sample&&S.laps.some(l=>l.complete));}
function twLapSectors(S,lap){const k='tws'+lap.i;if(S.cache.has(k))return S.cache.get(k);const c=S.ch['Current Sector'];let out=null;
  if(c){const b=[];let prev=sampleStep(c,lap.t0+0.05);for(let t=lap.t0+0.05;t<lap.t1;t+=0.01){const v=sampleStep(c,t);if(v!==prev){b.push(t-lap.t0);prev=v;}}if(b.length>=2)out=[b[0],b[1]-b[0],lap.time-b[1]];}
  S.cache.set(k,out);return out;}
function twXY(g,o){const la=g.get('GPS Latitude'),lo=g.get('GPS Longitude');if(!la||!lo)return null;const c=Math.cos(o.lat*Math.PI/180);const n=g.n,x=new Float32Array(n),y=new Float32Array(n);
  for(let i=0;i<n;i++){x[i]=(lo[i]-o.lon)*c*111320;y[i]=(la[i]-o.lat)*110574;}return {x:smooth(x,5),y:smooth(y,5)};}
function twPrep(){const SA=TW.SA,SB=TW.SB;const lA=SA.laps.find(l=>l.i===TW.a),lB=SB&&SB.laps.find(l=>l.i===TW.b);
  const gA=lapGrid(SA,lA,1),gB=lB?lapGrid(SB,lB,1,gA.len):null;const n=gA.n;
  const la=gA.get('GPS Latitude'),lo=gA.get('GPS Longitude');const o={lat:la?la[0]:0,lon:lo?lo[0]:0};
  const A=twXY(gA,o),B=gB?twXY(gB,o):null;
  // left normal of A's line, the track centre (Path Lateral > 0 = right of centre) and the two edges (Track Edge = edge on the car's side)
  let L=null,Rr=null,nx=null,ny=null;if(A){nx=new Float32Array(n);ny=new Float32Array(n);for(let i=0;i<n;i++){const j0=Math.max(0,i-4),j1=Math.min(n-1,i+4);const dx=A.x[j1]-A.x[j0],dy=A.y[j1]-A.y[j0],d=Math.hypot(dx,dy)||1;nx[i]=-dy/d;ny[i]=dx/d;}
    const PL=gA.get('Path Lateral'),TE=gA.get('Track Edge');if(PL&&TE){const w=smooth(Float32Array.from(TE,Math.abs),15);const pl=smooth(PL,9);L={x:new Float32Array(n),y:new Float32Array(n)};Rr={x:new Float32Array(n),y:new Float32Array(n)};
      for(let i=0;i<n;i++){const cx=A.x[i]+pl[i]*nx[i],cy=A.y[i]+pl[i]*ny[i];const hw=Math.max(4,w[i]);L.x[i]=cx+hw*nx[i];L.y[i]=cy+hw*ny[i];Rr.x[i]=cx-hw*nx[i];Rr.y[i]=cy-hw*ny[i];}
      L.x=smooth(L.x,9);L.y=smooth(L.y,9);Rr.x=smooth(Rr.x,9);Rr.y=smooth(Rr.y,9);}}
  const delta=gB?Float32Array.from(gA.t,(t,i)=>gB.t[i]-t):null;
  const sec=[];const cs=gA.get('Current Sector');if(cs)for(let i=30;i<n-30;i++)if(cs[i]!==cs[i-1])sec.push(i);
  const cA=detectCorners(gA),cB=gB?detectCorners(gB):[];const step=gA.d[1]-gA.d[0];
  const corners=cA.map(c=>{const b=cB.reduce((best,x)=>!best||Math.abs(x.dApex-c.dApex)<Math.abs(best.dApex-c.dApex)?x:best,null);const B=b&&Math.abs(b.dApex-c.dApex)<90?b:null;return {...c,B,dt:B&&gB?(gB.t[c.e]-gA.t[c.e])-(gB.t[c.s]-gA.t[c.s]):null};});
  // B's position at A's time (ghost) and the gap between the lines (signed: + = B to the left of A)
  let gap=null;if(A&&B){gap=new Float32Array(n);for(let i=0;i<n;i++){let bd=Infinity,bj=i;for(let j=Math.max(0,i-25);j<Math.min(n,i+26);j++){const d=(B.x[j]-A.x[i])**2+(B.y[j]-A.y[i])**2;if(d<bd){bd=d;bj=j;}}gap[i]=Math.sqrt(bd)*Math.sign((B.x[bj]-A.x[i])*nx[i]+(B.y[bj]-A.y[i])*ny[i]||1);}}
  gA._c['tw:@delta']=delta;if(gB){const sa=gA.get('Ground Speed'),sb=gB.get('Ground Speed');gA._c['tw:@speedD']=Float32Array.from(sa,(v,i)=>sb[i]-v);}
  return {gA,gB,lA,lB,n,A,B,L,R:Rr,nx,ny,delta,sec,corners,gap,step};}

// ---------- the map ----------
class TWMap{
  constructor(cv,{onCursor}={}){this.cv=cv;this.onCursor=onCursor;this.vz={k:1,cx:0,cy:0};this.rot=0;this.cursor=null;this.drag=null;
    cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect();this.zoomAt(e.clientX-r.left,e.clientY-r.top,e.deltaY<0?1.25:0.8);},{passive:false});
    cv.addEventListener('pointerdown',e=>{this.drag={x:e.clientX,y:e.clientY,moved:false};cv.setPointerCapture(e.pointerId);});
    cv.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
      if(this.drag&&(e.buttons&1)){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.abs(dx)+Math.abs(dy)>3)this.drag.moved=true;if(this.drag.moved){this.vz.cx-=dx/this.s();this.vz.cy+=dy/this.s();this.drag.x=e.clientX;this.drag.y=e.clientY;this.draw();}return;}
      const i=this.nearest(px,py);if(i!=null&&this.onCursor)this.onCursor(i);});
    cv.addEventListener('pointerup',e=>{const r=cv.getBoundingClientRect();if(this.drag&&!this.drag.moved){const c=this.hitCorner(e.clientX-r.left,e.clientY-r.top);if(c)this.onCorner?.(c);}this.drag=null;});
    cv.addEventListener('dblclick',()=>this.reset());new ResizeObserver(()=>this.draw()).observe(cv);}
  set(D,mode){this.D=D;this.mode=mode;if(!this.bb||this.bbKey!==D.gA.lap.i+'|'+D.n){const xs=[...(D.L?.x||D.A.x),...(D.R?.x||[])],ys=[...(D.L?.y||D.A.y),...(D.R?.y||[])];
      this.bb=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];this.bbKey=D.gA.lap.i+'|'+D.n;if(this.rotUser==null){this.vz={k:1,cx:0,cy:0};this.rot=0;const s0=this.s();this.rot=Math.PI/2;const s1=this.s();this.rot=s1>s0*1.08?Math.PI/2:0;}this.vz={k:1,cx:(this.bb[0]+this.bb[1])/2,cy:(this.bb[2]+this.bb[3])/2};}this.draw();}
  s(){const w=this.cv.clientWidth,h=this.cv.clientHeight,[x0,x1,y0,y1]=this.bb;const c=Math.cos(this.rot),sn=Math.sin(this.rot);const W=Math.abs((x1-x0)*c)+Math.abs((y1-y0)*sn),H=Math.abs((x1-x0)*sn)+Math.abs((y1-y0)*c);return Math.min((w-40)/W,(h-40)/H)*this.vz.k;}
  P(x,y){const s=this.s(),c=Math.cos(this.rot),sn=Math.sin(this.rot);const dx=x-this.vz.cx,dy=y-this.vz.cy;return [this.cv.clientWidth/2+(dx*c-dy*sn)*s,this.cv.clientHeight/2-(dx*sn+dy*c)*s];}
  unP(px,py){const s=this.s(),c=Math.cos(this.rot),sn=Math.sin(this.rot);const a=(px-this.cv.clientWidth/2)/s,b=-(py-this.cv.clientHeight/2)/s;return [this.vz.cx+a*c+b*sn,this.vz.cy-a*sn+b*c];}
  zoomAt(px,py,f){const [wx,wy]=this.unP(px,py);const k=Math.max(1,Math.min(80,this.vz.k*f));if(k===1){this.reset();return;}this.vz.k=k;const [nx,ny]=this.unP(px,py);this.vz.cx+=wx-nx;this.vz.cy+=wy-ny;this.draw();}
  reset(){this.vz={k:1,cx:(this.bb[0]+this.bb[1])/2,cy:(this.bb[2]+this.bb[3])/2};this.draw();}
  rotate(){this.rot=(this.rot+Math.PI/2)%(2*Math.PI);this.rotUser=this.rot;this.draw();}
  fitRange(i0,i1){const D=this.D;if(!D)return;i0=Math.max(0,i0);i1=Math.min(D.n-1,i1);let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;const src=[D.A,D.L,D.R].filter(Boolean);
    for(const s of src)for(let i=i0;i<=i1;i+=2){x0=Math.min(x0,s.x[i]);x1=Math.max(x1,s.x[i]);y0=Math.min(y0,s.y[i]);y1=Math.max(y1,s.y[i]);}
    this.vz={k:1,cx:(x0+x1)/2,cy:(y0+y1)/2};const s1=this.s();const w=this.cv.clientWidth,h=this.cv.clientHeight;const span=Math.max(x1-x0,y1-y0,60);this.vz.k=Math.max(1,Math.min(80,Math.min(w,h)*0.85/(span*s1)));this.draw();}
  nearest(px,py){const D=this.D;if(!D)return null;let best=null,bd=900;for(let i=0;i<D.n;i+=2){const [x,y]=this.P(D.A.x[i],D.A.y[i]);const d=(x-px)**2+(y-py)**2;if(d<bd){bd=d;best=i;}}return best;}
  hitCorner(px,py){return (this.lbl||[]).find(l=>Math.hypot(l.x-px,l.y-py)<13)?.c||null;}
  line(c,S,i0,i1,col,w,dash){c.beginPath();for(let i=i0;i<=i1;i++){const [x,y]=this.P(S.x[i],S.y[i]);i===i0?c.moveTo(x,y):c.lineTo(x,y);}c.strokeStyle=col;c.lineWidth=w;c.setLineDash(dash||[]);c.stroke();c.setLineDash([]);}
  colored(c,S,cols,w,dash){const n=cols.length;let i=0;while(i<n-1){const col=cols[i];let j=i+1;while(j<n-1&&cols[j]===col)j++;this.line(c,S,i,j,col,w,dash);i=j;}}
  draw(){const cv=this.cv,D=this.D;if(!D||!this.bb)return;const dpr=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;cv.width=w*dpr;cv.height=h*dpr;const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    const k=this.vz.k,lw=Math.max(1.6,Math.min(5,1.2*Math.sqrt(k)));const n=D.n;
    // grid with a 100 m scale
    const s=this.s();let gs=100;while(gs*s<60)gs*=2;while(gs*s>220&&gs>10)gs/=2;c.strokeStyle='rgba(255,255,255,.035)';c.lineWidth=1;const [ox,oy]=this.unP(0,0);
    if(this.rot===0){for(let x=Math.floor(ox/gs)*gs;;x+=gs){const [px]=this.P(x,0);if(px>w)break;c.beginPath();c.moveTo(px,0);c.lineTo(px,h);c.stroke();}for(let y=Math.ceil(oy/gs)*gs;;y-=gs){const [,py]=this.P(0,y);if(py>h)break;c.beginPath();c.moveTo(0,py);c.lineTo(w,py);c.stroke();}}
    // the track: surface between the edges, then the edges
    const twPx=14*s;this.line(c,D.A,0,n-1,'#19202A',Math.max(9,twPx+4));
    if(D.L&&D.R&&twPx>10){c.beginPath();for(let i=0;i<n;i+=2){const [x,y]=this.P(D.L.x[i],D.L.y[i]);i?c.lineTo(x,y):c.moveTo(x,y);}for(let i=n-1;i>=0;i-=2){const [x,y]=this.P(D.R.x[i],D.R.y[i]);c.lineTo(x,y);}c.closePath();c.fillStyle='#141922';c.fill('evenodd');
      this.line(c,D.L,0,n-1,'rgba(200,210,225,.35)',1);this.line(c,D.R,0,n-1,'rgba(200,210,225,.35)',1);
}
    // start / finish and sector lines across the track
    if(D.L&&D.R){const across=(i,col,lab)=>{const [a,b]=this.P(D.L.x[i],D.L.y[i]),[e,f]=this.P(D.R.x[i],D.R.y[i]);const mx=(a+e)/2,my=(b+f)/2,dx=(e-a),dy=(f-b),l=Math.hypot(dx,dy)||1,hl=Math.max(l/2,9);
        c.strokeStyle=col;c.lineWidth=3;c.setLineDash([3,3]);c.beginPath();c.moveTo(mx-dx/l*hl,my-dy/l*hl);c.lineTo(mx+dx/l*hl,my+dy/l*hl);c.stroke();c.setLineDash([]);
        if(lab){c.fillStyle=col;c.font='700 11px "Barlow Condensed",sans-serif';c.fillText(lab,mx+dx/l*hl+4,my+dy/l*hl+4);}};
      across(0,'#fff','START');D.sec.forEach((i,k)=>across(i,'#FFD400','S'+(k+2)));}
    // the racing lines
    const tA=tok('lapA'),tB=tok('lapB');const m=this.mode;
    const cols=(g,kind)=>{if(kind==='speed'){const v=g.get('Ground Speed');let lo=Infinity,hi=-Infinity;for(const x of v){lo=Math.min(lo,x);hi=Math.max(hi,x);}return Array.from(v,x=>TWSPD[Math.min(9,Math.floor((x-lo)/(hi-lo+1e-6)*10))]);}
      if(kind==='inputs'){const th=g.get('Throttle Pos'),br=g.get('Brake Pos');return Array.from(th,(t,i)=>br[i]>5?(br[i]>60?'#FF2D55':'#FF8A9B'):t>95?'#22E58B':t>30?'#9BE8B9':'#8A93A3');}
      if(kind==='gear'){const ge=g.get('Gear');return Array.from(ge,x=>TWGEAR[Math.max(0,Math.min(8,Math.round(x)))]);}
      if(kind==='delta'){const d=D.delta;const out=new Array(D.n);const W=12;for(let i=0;i<D.n;i++){const a=d[Math.max(0,i-W)],b=d[Math.min(D.n-1,i+W)];const r=(b-a)/(2*W*D.step)*1000;out[i]=r>0.15?'#22E58B':r<-0.15?'#FF2D55':r>0.04?'#7FD8A6':r<-0.04?'#E88A9A':'#6B7585';}return out;}return null;};
    if(D.B){const cb=m==='inputs'?cols(D.gB,'inputs'):null;if(cb)this.colored(c,D.B,cb,lw*0.75,[6,4]);else this.line(c,D.B,0,n-1,tB,lw*0.8,m==='delta'||m==='speed'||m==='gear'?[6,4]:null);}
    const ca=m==='line'?null:cols(D.gA,m);if(ca)this.colored(c,D.A,ca,lw);else this.line(c,D.A,0,n-1,tA,lw);
    // brake and throttle points of each corner
    this.lbl=[];const dot=(S,i,col,shape,lab)=>{if(i==null||i<0)return;const [x,y]=this.P(S.x[i],S.y[i]);c.fillStyle=col;c.strokeStyle='#05070A';c.lineWidth=1.5;c.beginPath();
      if(shape==='tri'){c.moveTo(x,y-6);c.lineTo(x+5.5,y+4);c.lineTo(x-5.5,y+4);c.closePath();}else c.arc(x,y,4.5,0,7);c.fill();c.stroke();
      if(lab&&k>=3){c.font='600 10px "JetBrains Mono",monospace';c.fillStyle=col;c.fillText(lab,x+8,y+3);}};
    const idx=d=>d==null?null:Math.round(d/D.step);
    D.corners.forEach(cn=>{dot(D.A,idx(cn.brake),tA,'dot',k>=3?'▼ '+Math.round(cn.brake)+' m':'');dot(D.A,idx(cn.fullThr),tA,'tri','');
      if(cn.B&&D.B){dot(D.B,idx(cn.B.brake),tB,'dot',k>=3&&cn.brake!=null&&cn.B.brake!=null?`${cn.B.brake-cn.brake>0?'+':''}${Math.round(cn.B.brake-cn.brake)} m`:'');dot(D.B,idx(cn.B.fullThr),tB,'tri','');}
      // corner number outside the corner
      const i=cn.apex;const pl=D.gA.get('Path Lateral');const side=pl?Math.sign(pl[i])||1:1;const off=(D.R?Math.abs(pl[i])+Math.abs(D.gA.get('Track Edge')[i])+14:18);
      const [x,y]=this.P(D.A.x[i]+side*off*D.nx[i],D.A.y[i]+side*off*D.ny[i]);c.fillStyle='rgba(8,10,14,.9)';c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1;c.beginPath();c.arc(x,y,11,0,7);c.fill();c.stroke();
      c.fillStyle='#fff';c.font='700 11px "Barlow Condensed",sans-serif';c.textAlign='center';c.fillText('T'+cn.k,x,y+4);c.textAlign='left';this.lbl.push({x,y,c:cn});});
    // cursor: A at the cursor, B where it is at the same distance and the ghost (B at A's time)
    const i=this.cursor;if(i!=null&&i<n){const [ax,ay]=this.P(D.A.x[i],D.A.y[i]);
      if(D.B){const [bx,by]=this.P(D.B.x[i],D.B.y[i]);c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=1;c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.stroke();
        c.fillStyle=tB;c.beginPath();c.arc(bx,by,5.5,0,7);c.fill();
        if(this.ghost!=null){const [gx,gy]=this.P(D.B.x[this.ghost],D.B.y[this.ghost]);c.strokeStyle=tB;c.lineWidth=2;c.beginPath();c.arc(gx,gy,8,0,7);c.stroke();c.fillStyle=tB;c.font='700 10px "Barlow Condensed"';c.fillText('B',gx+10,gy-8);}}
      c.fillStyle=tA;c.shadowColor=tA;c.shadowBlur=12;c.beginPath();c.arc(ax,ay,6.5,0,7);c.fill();c.shadowBlur=0;c.strokeStyle='#05070A';c.lineWidth=2;c.stroke();}
    // scale bar
    c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=2;c.beginPath();c.moveTo(14,h-14);c.lineTo(14+gs*s,h-14);c.stroke();c.fillStyle='rgba(255,255,255,.7)';c.font='10px "JetBrains Mono",monospace';c.fillText(gs+' m',14,h-20);}
}
const TWSPD=['#3B4CC0','#4F6FD6','#64A6E8','#5CC8C0','#59D98B','#A6E05A','#E8D84A','#F5A63B','#F26B38','#E0303A'];
const TWGEAR=['#888','#E0303A','#F26B38','#F5A63B','#E8D84A','#59D98B','#5CC8C0','#64A6E8','#B06BFF'];

// ---------- the stacked traces ----------
class TWTraces{
  constructor(cv,ov,{onCursor,onRange}){this.cv=cv;this.ov=ov;this.onCursor=onCursor;this.onRange=onRange;this.cursor=null;this.range=null;this.sel=null;this.padL=64;this.padR=14;
    cv.addEventListener('pointerdown',e=>{const x=e.offsetX;this.sel={x0:x,x1:x};cv.setPointerCapture(e.pointerId);});
    cv.addEventListener('pointermove',e=>{const x=e.offsetX;if(this.sel&&(e.buttons&1)){this.sel.x1=x;this.draw();return;}this.setCursor(this.idx(this.pxX(x)),true);});
    cv.addEventListener('pointerup',()=>{const s=this.sel;this.sel=null;if(s&&Math.abs(s.x1-s.x0)>8){this.setRange(this.pxX(Math.min(s.x0,s.x1)),this.pxX(Math.max(s.x0,s.x1)),true);}else this.draw();});
    cv.addEventListener('wheel',e=>{e.preventDefault();const c=this.pxX(e.offsetX);const [lo,hi]=this.lohi();const f=e.deltaY<0?0.7:1.4;this.setRange(c-(c-lo)*f,c+(hi-c)*f,true);},{passive:false});
    cv.addEventListener('dblclick',()=>this.setRange(null,null,true));
    ov.addEventListener('pointerdown',e=>{ov.setPointerCapture(e.pointerId);this.ovMove(e.offsetX);});ov.addEventListener('pointermove',e=>{if(e.buttons&1)this.ovMove(e.offsetX);});
    new ResizeObserver(()=>this.draw()).observe(cv);}
  set(D,panels,keep){this.D=D;this.panels=panels;if(!keep)this.range=null;this.draw();}
  lohi(){const x=this.D.gA.d;return this.range||[x[0],x[x.length-1]];}
  pxX(px){const [lo,hi]=this.lohi(),W=this.cv.clientWidth;return lo+(Math.max(this.padL,Math.min(W-this.padR,px))-this.padL)/(W-this.padL-this.padR)*(hi-lo);}
  xPx(x){const [lo,hi]=this.lohi(),W=this.cv.clientWidth;return this.padL+(x-lo)/(hi-lo)*(W-this.padL-this.padR);}
  idx(d){return Math.max(0,Math.min(this.D.n-1,Math.round(d/this.D.step)));}
  setRange(a,b,emit){const x=this.D.gA.d,L=x[x.length-1];if(a==null){this.range=null;}else{let s=Math.max(30,b-a);a=Math.max(0,a);if(a+s>L)a=Math.max(0,L-s);this.range=s>=L-1?null:[a,a+s];}this.draw();if(emit)this.onRange?.(this.range);}
  ovMove(px){if(!this.range)return;const L=this.D.gA.d[this.D.n-1],W=this.ov.clientWidth;const c=px/W*L,s=this.range[1]-this.range[0];this.setRange(c-s/2,c+s/2,true);}
  setCursor(i,emit){this.cursor=i;this.draw();if(emit)this.onCursor?.(i);}
  draw(){const cv=this.cv,D=this.D;if(!D)return;const dpr=window.devicePixelRatio||1,W=cv.clientWidth;const P=this.panels;const H=P.reduce((s,p)=>s+p.h,0)+22;cv.style.height=H+'px';cv.width=W*dpr;cv.height=H*dpr;
    const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);const [lo,hi]=this.lohi();const L=this.padL,R=W-this.padR;const i0=Math.max(0,this.idx(lo)-1),i1=Math.min(D.n-1,this.idx(hi)+1);const x=D.gA.d;
    const mono='10px "JetBrains Mono",monospace';let y=4;const cur=this.cursor;
    // sectors and corners as vertical guides
    const guides=()=>{c.strokeStyle='rgba(255,212,0,.25)';c.setLineDash([3,4]);D.sec.forEach(i=>{if(x[i]<lo||x[i]>hi)return;const px=this.xPx(x[i]);c.beginPath();c.moveTo(px,4);c.lineTo(px,H-20);c.stroke();});c.setLineDash([]);};
    guides();
    for(const p of P){const top=y,h=p.h,bot=top+h-6;let mn=Infinity,mx=-Infinity;for(const s of p.series)for(let i=i0;i<=i1;i++){const v=s.a[i];if(Number.isFinite(v)){if(v<mn)mn=v;if(v>mx)mx=v;}}
      if(p.zero){const m=Math.max(Math.abs(mn),Math.abs(mx),p.minSpan||0.05);mn=-m;mx=m;}if(p.fix){mn=p.fix[0];mx=p.fix[1];}if(!(mx>mn)){mn-=1;mx+=1;}const pad=(mx-mn)*0.08;mn-=pad;mx+=pad;
      const Y=v=>bot-(v-mn)/(mx-mn)*(h-14);
      c.fillStyle='rgba(255,255,255,.018)';c.fillRect(L,top+8,R-L,h-14);c.strokeStyle='rgba(255,255,255,.06)';c.beginPath();c.moveTo(L,bot+.5);c.lineTo(R,bot+.5);c.stroke();
      if(p.zero){c.strokeStyle='rgba(255,255,255,.25)';c.beginPath();c.moveTo(L,Y(0));c.lineTo(R,Y(0));c.stroke();}
      c.fillStyle='#69737F';c.font=mono;c.textAlign='right';c.fillText(twFmt(mx-pad,p.dec),L-6,top+16);c.fillText(twFmt(mn+pad,p.dec),L-6,bot);c.textAlign='left';
      c.save();c.beginPath();c.rect(L,top,R-L,h);c.clip();
      if(p.fill){const a=p.series[0].a;c.beginPath();c.moveTo(this.xPx(x[i0]),Y(0));for(let i=i0;i<=i1;i++)c.lineTo(this.xPx(x[i]),Y(a[i]));c.lineTo(this.xPx(x[i1]),Y(0));c.closePath();
        const gr=c.createLinearGradient(0,Y(mx),0,Y(mn));gr.addColorStop(0,'rgba(255,45,85,.35)');gr.addColorStop(0.5,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(34,229,139,.35)');c.fillStyle=gr;c.fill();}
      for(const s of p.series){c.beginPath();let st=false;c._py=undefined;for(let i=i0;i<=i1;i++){const v=s.a[i];if(!Number.isFinite(v)){st=false;continue;}const px=this.xPx(x[i]),py=Y(v);if(!st){c.moveTo(px,py);st=true;}else if(p.step){c.lineTo(px,c._py??py);c.lineTo(px,py);}else c.lineTo(px,py);c._py=py;}
        c.strokeStyle=s.col;c.lineWidth=s.w||1.5;c.setLineDash(s.dash||[]);c.stroke();c.setLineDash([]);}
      c.restore();
      // label and the values under the cursor
      c.font='600 10px "Barlow Condensed",sans-serif';c.fillStyle='#AEB6C0';const lab=(p.label+(p.unit?' ['+p.unit+']':'')).toUpperCase();c.fillText(lab,L+6,top+18);
      if(cur!=null){let xx=L+12+c.measureText(lab).width;c.font='600 11px "JetBrains Mono",monospace';for(const s of p.series){const t=(s.tag?s.tag+' ':'')+twFmt(s.a[cur],p.dec);c.fillStyle=s.col;c.fillText(t,xx,top+18);xx+=c.measureText(t).width+12;}}
      y+=h;}
    // distance axis
    c.fillStyle='#69737F';c.font=mono;const span=hi-lo;let st=100;while(span/st>12)st*=2;for(let v=Math.ceil(lo/st)*st;v<=hi;v+=st){const px=this.xPx(v);c.fillText(v+' m',px-12,H-6);}
    D.corners.forEach(cn=>{if(cn.dApex<lo||cn.dApex>hi)return;const px=this.xPx(cn.dApex);c.fillStyle='rgba(255,255,255,.75)';c.font='700 10px "Barlow Condensed"';c.fillText('T'+cn.k,px-6,H-6);});
    if(cur!=null&&x[cur]>=lo&&x[cur]<=hi){const px=this.xPx(x[cur]);c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=1;c.beginPath();c.moveTo(px,4);c.lineTo(px,H-18);c.stroke();}
    if(this.sel){const a=Math.min(this.sel.x0,this.sel.x1),b=Math.max(this.sel.x0,this.sel.x1);c.fillStyle='rgba(0,200,255,.12)';c.fillRect(a,4,b-a,H-24);}
    this.drawOv();}
  drawOv(){const cv=this.ov,D=this.D,dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight||26;cv.width=W*dpr;cv.height=H*dpr;const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
    const v=D.gA.get('Ground Speed'),L=D.gA.d[D.n-1];c.beginPath();for(let i=0;i<D.n;i+=4){const px=D.gA.d[i]/L*W,py=H-2-v[i]/340*(H-4);i?c.lineTo(px,py):c.moveTo(px,py);}c.strokeStyle='rgba(0,200,255,.6)';c.lineWidth=1;c.stroke();
    if(this.range){const a=this.range[0]/L*W,b=this.range[1]/L*W;c.fillStyle='rgba(255,255,255,.12)';c.fillRect(a,0,b-a,H);c.strokeStyle='rgba(255,255,255,.6)';c.strokeRect(a+.5,.5,b-a-1,H-1);}
    if(this.cursor!=null){const px=D.gA.d[this.cursor]/L*W;c.fillStyle='#fff';c.fillRect(px,0,1,H);}}
}

// ---------- panels from the chosen channels ----------
function twPanels(D,list){const tA=tok('lapA'),tB=tok('lapB');const out=[];
  for(const id of list){if(id==='@delta'){if(D.delta)out.push({label:tr('Delta B − A'),unit:'s',dec:3,h:96,zero:true,fill:true,minSpan:0.1,series:[{a:D.delta,col:'#fff',w:1.6}]});continue;}
    if(id.startsWith('4:')){const k=id.slice(2);const m=TWW[k];const ss=TW4.map((w,j)=>({a:twArr(D.gA,k.replace('#',w)),col:TW4C[j],tag:w,w:1.3})).filter(s=>s.a);if(ss.length)out.push({label:tr(m[0])+' · A',unit:m[1],dec:m[2],h:104,series:ss});continue;}
    const m=twMeta(id);const a=twArr(D.gA,id);if(!a)continue;const b=D.gB?twArr(D.gB,id):null;const step=STEP_CH.test(id);
    out.push({label:tr(m[0]),unit:m[1],dec:m[2],h:id==='Ground Speed'?130:id==='Gear'?60:84,step,zero:id==='Path Lateral'||id==='Steering'||/G Force (Lat|Long)/.test(id),fix:/Throttle|Brake Pos/.test(id)?[0,100]:null,
      series:[...(b?[{a:b,col:tB,w:1.3,tag:'B'}]:[]),{a,col:tA,w:1.7,tag:'A'}]});}
  return out;}

// ---------- inspector: every value under the cursor ----------
const TW_INS=[['Pilota',['Ground Speed','Throttle Pos','Brake Pos','Steering','Gear','Engine RPM','Steering Shaft Torque','FFB Output']],
  ['Dinamica',['G Force Lat','G Force Long','@gsum','Local Rotation Y','Body Pitch','Body Roll','Path Lateral']],
  ['Motore e ibrido',['@power','Engine Torque','Motor Torque','Battery Charge Level','Fuel Level','Eng Water Temp','Eng Oil Temp']],
  ['Telaio',['Front 3rd Pos','Rear 3rd Pos','Brake Bias Rear']]];
function twInspect(D,i){if(i==null)return `<div class="muted small">${tr('Passa sopra la mappa o i grafici.')}</div>`;const gA=D.gA,gB=D.gB;
  const row=n=>{const m=twMeta(n);const a=twArr(gA,n),b=gB?twArr(gB,n):null;if(!a)return '';const va=a[i],vb=b?b[i]:NaN;const d=vb-va;
    return `<tr><td>${tr(m[0])}</td><td class="a">${twFmt(va,m[2])}</td><td class="b">${b?twFmt(vb,m[2]):''}</td><td class="${d>0?'up':d<0?'dn':''}">${b&&Number.isFinite(d)&&Math.abs(d)>=Math.pow(10,-m[2])/2?(d>0?'+':'')+d.toFixed(m[2]):''}</td><td class="u">${m[1]}</td></tr>`;};
  const head=`<div class="twih"><div><span>${tr('Distanza')}</span><b>${Math.round(gA.d[i])} m</b></div><div><span>${tr('Tempo')} A</span><b>${gA.t[i].toFixed(2)} s</b></div>${D.delta?`<div><span>Delta</span><b class="${D.delta[i]>0?'up':'dn'}">${D.delta[i]>0?'+':''}${D.delta[i].toFixed(3)} s</b></div>`:''}${D.gap?`<div><span>${tr('Linea B')}</span><b>${Math.abs(D.gap[i]).toFixed(1)} m ${D.gap[i]>0?tr('a sinistra'):tr('a destra')}</b></div>`:''}</div>`;
  return head+TW_INS.map(([g,L])=>`<table class="twit"><thead><tr><th>${tr(g)}</th><th class="a">A</th><th class="b">${gB?'B':''}</th><th>${gB?'Δ':''}</th><th></th></tr></thead><tbody>${L.map(row).join('')}</tbody></table>`).join('');}
// the four tyres of A (or B) under the cursor
function twWheels(D,i,useB){const g=useB&&D.gB?D.gB:D.gA;if(i==null)return '';const v=n=>{const a=twArr(g,n);return a?a[i]:NaN;};
  const tcol=t=>!Number.isFinite(t)?'#333':t<70?'#3B6FD6':t<80?'#38B6C9':t<95?'#35C46A':t<105?'#E8B23A':'#E0403A';
  const tyre=w=>{const I=v(`Tyre Temp ${w} Inner`),C=v(`Tyre Temp ${w} Centre`),O=v(`Tyre Temp ${w} Outer`);const left=w.endsWith('L');const order=left?[O,C,I]:[I,C,O];const grip=v('Grip Fract '+w);
    return `<div class="twty"><div class="tt"><b>${w}</b><span>${twFmt(v('Tyre Pressure '+w),1)} kPa</span></div><div class="bars">${order.map(t=>`<i style="background:${tcol(t)}" title="${twFmt(t,0)} °C">${twFmt(t,0)}</i>`).join('')}</div>
      <div class="kv"><span>${tr('Carico')}</span><b>${twFmt(v('Tyre Load '+w)/1000,1)} kN</b></div><div class="kv"><span>${tr('Aderenza')}</span><b>${twFmt(grip,0)}%</b></div><div class="gb"><i style="width:${Math.max(0,Math.min(100,grip||0))}%"></i></div>
      <div class="kv"><span>${tr('Freno')}</span><b>${twFmt(v('Brake Temp '+w),0)} °C</b></div><div class="kv"><span>${tr('Altezza')}</span><b>${twFmt(v('Ride Height '+w),1)} mm</b></div><div class="kv"><span>${tr('Scivol.')}</span><b>${twFmt(Math.hypot(v('Lat Patch Vel '+w),v('Long Patch Vel '+w)),2)} m/s</b></div></div>`;};
  return `<div class="twcar">${tyre('FL')}${tyre('FR')}<div class="body"></div>${tyre('RL')}${tyre('RR')}</div>`;}

// ---------- corner by corner ----------
function twCornerHint(c){const b=c.B;if(!b)return '';const out=[];const dt=c.dt;
  if(c.brake!=null&&b.brake!=null&&Math.abs(b.brake-c.brake)>=4)out.push(`${tr('B frena')} ${Math.abs(Math.round(b.brake-c.brake))} m ${b.brake>c.brake?tr('dopo'):tr('prima')}`);
  if(Math.abs(b.vMin-c.vMin)>=2)out.push(`${tr('in centro curva')} ${b.vMin>c.vMin?'+':''}${Math.round(b.vMin-c.vMin)} km/h`);
  if(c.fullThr!=null&&b.fullThr!=null&&Math.abs(b.fullThr-c.fullThr)>=5)out.push(`${tr('gas pieno')} ${Math.abs(Math.round(b.fullThr-c.fullThr))} m ${b.fullThr<c.fullThr?tr('prima'):tr('dopo')}`);
  if(Math.abs(b.vExit-c.vExit)>=2)out.push(`${tr('uscita')} ${b.vExit>c.vExit?'+':''}${Math.round(b.vExit-c.vExit)} km/h`);
  return out.length?`${out.join(' · ')} → B ${dt<0?tr('guadagna'):tr('perde')} ${Math.abs(dt).toFixed(2)} s`:'';}
function twCornersHTML(D){const hasB=!!D.gB;const f=(v,d=0)=>v==null||!Number.isFinite(v)?'—':v.toFixed(d);const df=(a,b,d=0,inv)=>a==null||b==null?'':`<small class="${(b-a)*(inv?-1:1)>0?'up':'dn'}">${b-a>0?'+':''}${(b-a).toFixed(d)}</small>`;
  return `<table class="twct"><thead><tr><th>${tr('Curva')}</th><th>${tr('Frenata')} m</th><th>${tr('Vel. frenata')}</th><th>${tr('Freno max')}</th><th>${tr('Vel. min')}</th><th>${tr('Marcia')}</th><th>${tr('Gas pieno')} m</th><th>${tr('Uscita')}</th><th>${tr('Tempo')}</th>${hasB?`<th>Δ B</th><th class="l">${tr('Cosa cambia')}</th>`:''}</tr></thead><tbody>${D.corners.map(c=>{const b=c.B||{};const dt=c.dt;
    return `<tr data-c="${c.k}"><td><b>T${c.k}</b><div class="muted small">${Math.round(c.dApex)} m</div></td><td>${f(c.brake)}${hasB?df(c.brake,b.brake):''}</td><td>${f(c.brakeV)}${hasB?df(c.brakeV,b.brakeV):''}</td><td>${f(c.brakePeak)}%</td><td><b>${f(c.vMin)}</b>${hasB?df(c.vMin,b.vMin):''}</td><td>${f(c.gear)}</td><td>${f(c.fullThr)}${hasB?df(c.fullThr,b.fullThr,0,true):''}</td><td>${f(c.vExit)}${hasB?df(c.vExit,b.vExit):''}</td><td>${f(c.time,2)}</td>
      ${hasB?`<td><b class="${dt>0?'up':'dn'}">${dt==null?'—':(dt>0?'+':'')+dt.toFixed(3)}</b></td><td class="l small">${esc(twCornerHint(c))}</td>`:''}</tr>`;}).join('')}</tbody></table>`;}

// ---------- lap summary ----------
function twSummary(g){const v=g.get('Ground Speed'),th=g.get('Throttle Pos'),br=g.get('Brake Pos'),ge=g.get('Gear'),gl=g.get('G Force Lat'),gx=g.get('G Force Long');const n=g.n;let full=0,brk=0,coast=0,sh=0,vs=0;
  for(let i=0;i<n;i++){if(th[i]>=98)full++;else if(br[i]>3)brk++;else if(th[i]<5)coast++;vs+=v[i];if(i&&ge&&ge[i]!==ge[i-1])sh++;}
  const mx=a=>a?a.reduce((m,x)=>Math.max(m,x),-Infinity):NaN,mn=a=>a?a.reduce((m,x)=>Math.min(m,x),Infinity):NaN;const pw=twArr(g,'@power');const S=g.S,l=g.lap;const fuel=S.ch['Fuel Level']?sampleAt(S.ch['Fuel Level'],l.t0+0.3)-sampleAt(S.ch['Fuel Level'],l.t1-0.3):NaN;
  const bat=g.get('Battery Charge Level');
  return {time:l.time,vmax:mx(v),vavg:vs/n,vmin:mn(v),full:full/n*100,brk:brk/n*100,coast:coast/n*100,sh,glat:Math.max(mx(gl),-mn(gl)),gbrk:gx?Math.max(-mn(gx),mx(gx)):NaN,pw:mx(pw),fuel,bat:bat?bat[n-1]-bat[0]:NaN};}
function twSummaryHTML(D){const a=twSummary(D.gA),b=D.gB?twSummary(D.gB):null;const rows=[['Tempo','time',3,'s',-1],['Velocità max','vmax',1,'km/h',1],['Velocità media','vavg',1,'km/h',1],['Velocità min','vmin',1,'km/h',1],['Gas pieno','full',1,'%',1],['In frenata','brk',1,'%',-1],['Senza pedali','coast',1,'%',-1],['Cambiate','sh',0,'',0],['G laterale max','glat',2,'g',1],['G frenata max','gbrk',2,'g',1],['Potenza max','pw',0,'kW',1],['Carburante','fuel',2,'L',-1],['Batteria','bat',1,'%',1]];
  return `<div class="twsum">${rows.map(([l,k,d,u,good])=>{const va=a[k],vb=b?b[k]:NaN;const dd=vb-va;return `<div><span>${tr(l)}</span><b class="a">${k==='time'?fmtLap(va):twFmt(va,d)}<small>${u}</small></b>${b?`<b class="b">${k==='time'?fmtLap(vb):twFmt(vb,d)}</b><em class="${good===0||!Number.isFinite(dd)?'':dd*good>0?'up':'dn'}">${Number.isFinite(dd)?(dd>0?'+':'')+dd.toFixed(d):''}</em>`:''}</div>`;}).join('')}</div>`;}

// ---------- G-G diagram of the zoomed range ----------
function twGG(cv,D,range){const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
  const cx=W/2,cy=H/2,r=Math.min(W,H)/2-14,G=4;c.strokeStyle='rgba(255,255,255,.12)';for(let g=1;g<=G;g++){c.beginPath();c.arc(cx,cy,r*g/G,0,7);c.stroke();}c.beginPath();c.moveTo(cx-r,cy);c.lineTo(cx+r,cy);c.moveTo(cx,cy-r);c.lineTo(cx,cy+r);c.stroke();
  c.fillStyle='#69737F';c.font='10px "JetBrains Mono"';for(let g=1;g<=G;g++)c.fillText(g+'g',cx+r*g/G-14,cy-3);
  const i0=range?Math.round(range[0]/D.step):0,i1=range?Math.round(range[1]/D.step):D.n-1;
  const pts=(g,col)=>{const la=g.get('G Force Lat'),lo=g.get('G Force Long');if(!la||!lo)return;c.fillStyle=col;for(let i=i0;i<=i1;i+=2)c.fillRect(cx+la[i]/G*r-1,cy-lo[i]/G*r-1,2,2);};
  c.globalAlpha=.55;if(D.gB)pts(D.gB,tok('lapB'));c.globalAlpha=.8;pts(D.gA,tok('lapA'));c.globalAlpha=1;
  c.fillStyle='#AEB6C0';c.font='600 10px "Barlow Condensed"';c.fillText(tr('FRENATA'),cx-20,cy-r+10);c.fillText(tr('TRAZIONE'),cx-22,cy+r-2);}

// ---------- the view ----------
function twLapBtns(S,which){const best=S.best;const secs=S.laps.filter(l=>l.complete).map(l=>twLapSectors(S,l)).filter(Boolean);const bs=[0,1,2].map(k=>Math.min(...secs.map(s=>s[k])));
  return S.laps.filter(l=>l.complete).map(l=>{const s=twLapSectors(S,l);const on=which==='A'?(TW.SA===S&&TW.a===l.i):(TW.SB===S&&TW.b===l.i);
    return `<button type="button" class="twlap ${on?'on':''} ${l.invalid?'inv':''}" data-s="${esc(S.id)}" data-l="${l.i}" data-w="${which}"><span class="n">${tr('G')}${l.num}${l===best?' ★':''}</span><b>${fmtLap(l.time)}</b>${s?`<span class="ss">${s.map((x,k)=>`<i class="${Math.abs(x-bs[k])<0.0005?'p':''}">${x.toFixed(2)}</i>`).join('')}</span>`:''}</button>`;}).join('');}
RENDER.tele=()=>{const el=$('#twBody');const SS=twSessions();
  if(!SS.length){el.innerHTML=`<div class="panel"><div class="empty">${tr('Carica una telemetria MoTeC (.ld) con almeno un giro completo.')}</div></div>`;return;}
  const act=active()?.S;if(!TW.SA||!SS.includes(TW.SA)){TW.SA=SS.includes(act)?act:SS[SS.length-1];TW.a=TW.SA.best?.i??TW.SA.laps.find(l=>l.complete).i;TW.SB=null;TW.b=null;}
  if(TW.SB===undefined||(TW.SB&&!SS.includes(TW.SB))){TW.SB=null;}
  if(TW.SB===null&&TW.auto!==false){const other=TW.SA.laps.filter(l=>l.complete&&l.i!==TW.a).sort((x,y)=>x.time-y.time)[0];if(other){TW.SB=TW.SA;TW.b=other.i;}}
  const sameVenue=SS.filter(S=>S.meta?.venue===TW.SA.meta?.venue);const secsA=TW.SA.laps.filter(l=>l.complete).map(l=>twLapSectors(TW.SA,l)).filter(Boolean);
  const theo=secsA.length?[0,1,2].reduce((s,k)=>s+Math.min(...secsA.map(x=>x[k])),0):null;
  const mode=LS.get('tw:mode','line'),pre=LS.get('tw:pre','pil'),list=LS.get('tw:list',null)||TW_PRE[pre];
  el.innerHTML=`<div class="tw2">
   <div class="panel twhead"><div class="twtitle"><div><div class="ey">${tr('Telemetria')} · ${esc(TW.SA.meta?.venue||'')}</div><h2>${esc(TW.SA.meta?.driver||'')}<span> · ${esc(TW.SA.meta?.date||'')} ${esc(TW.SA.meta?.time||'')}</span></h2></div>
     <div class="twbest">${theo?`<span>${tr('Giro ideale')}</span><b>${fmtLap(theo)}</b><small>${tr('somma dei migliori settori')} · ${(TW.SA.best.time-theo>0?'−':'')}${Math.abs(TW.SA.best.time-theo).toFixed(3)} s</small>`:''}</div></div>
     <div class="twlaps"><div class="tag a">A</div><label class="f">${tr('Sessione')}<select id="twSA">${SS.map(S=>`<option value="${esc(S.id)}"${S===TW.SA?' selected':''}>${esc(S.label)}</option>`).join('')}</select></label><div class="twlaprow">${twLapBtns(TW.SA,'A')}</div></div>
     <div class="twlaps"><div class="tag b">B</div><label class="f">${tr('Confronta con')}<select id="twSB"><option value="">${tr('— nessun confronto —')}</option>${sameVenue.map(S=>`<option value="${esc(S.id)}"${S===TW.SB?' selected':''}>${esc(S.label)}</option>`).join('')}</select></label><div class="twlaprow">${TW.SB?twLapBtns(TW.SB,'B'):''}</div></div></div>
   <div class="twmain"><div class="panel twmapp"><div class="twbar"><span class="seg" id="twMode">${[['line','Traiettoria'],['inputs','Comandi'],['delta','Delta'],['speed','Velocità'],['gear','Marce']].map(([k,l])=>`<button type="button" data-m="${k}" aria-pressed="${k===mode}">${tr(l)}</button>`).join('')}</span><span class="sp"></span>
       <button class="btn icon" type="button" id="twPlay" title="${esc(tr('Replay: A e il fantasma di B nello stesso istante'))}">▶</button><select id="twSpd" title="${esc(tr('Velocità del replay'))}"><option value="1">×1</option><option value="2">×2</option><option value="4" selected>×4</option><option value="8">×8</option></select>
       <button class="btn icon" type="button" id="twRot" title="${esc(tr('Ruota'))}">⟳</button><button class="btn icon" type="button" id="twFit" title="${esc(tr('Tutta la pista'))}">⛶</button><label class="chk small"><input type="checkbox" id="twFollow"${LS.get('tw:follow',true)?' checked':''}> ${tr('segui lo zoom')}</label></div>
     <div class="twmapw"><canvas id="twMap"></canvas></div><div class="twfoot"><div id="twHud" class="twhud"></div><div class="twleg" id="twLeg"></div></div></div>
     <div class="panel twins"><div class="panel-h"><h3>${tr('Al cursore')}</h3><span class="seg" id="twWh"><button type="button" data-w="A" aria-pressed="true">A</button>${TW.SB?'<button type="button" data-w="B" aria-pressed="false">B</button>':''}</span></div><div id="twWheels"></div><div id="twIns"></div></div></div>
   <div class="panel twtr"><div class="twbar"><span class="seg" id="twPre">${Object.entries(TW_PREL).map(([k,l])=>`<button type="button" data-p="${k}" aria-pressed="${k===pre&&!LS.get('tw:list',null)}">${tr(l)}</button>`).join('')}</span>
       <details class="menu twadd"><summary class="btn">＋ ${tr('Canali')}</summary><div class="menu-list"><input type="text" id="twQ" placeholder="${esc(tr('Cerca tra i canali…'))}"><div id="twChList"></div></div></details><span class="sp"></span>
       <span class="muted small">${tr('trascina = zoom · rotellina · doppio clic = tutto il giro')}</span><button class="btn icon" type="button" id="twZin">＋</button><button class="btn icon" type="button" id="twZout">－</button></div>
     <canvas id="twTr"></canvas><canvas id="twOv" class="twov"></canvas></div>
   <div class="twlow"><div class="panel"><div class="panel-h"><h3>${tr('Curva per curva')}</h3><span class="muted small">${tr('clic su una curva per zoomare mappa e grafici')}</span></div><div class="tw">${'<div id="twCor"></div>'}</div></div>
     <div class="twside"><div class="panel"><div class="panel-h"><h3>${tr('Riepilogo giro')}</h3></div><div id="twSum"></div></div><div class="panel"><div class="panel-h"><h3>${tr('Diagramma G-G')}</h3><span class="muted small" id="twGGt"></span></div><canvas id="twGG"></canvas></div></div></div></div>`;
  const D=twPrep();TW.D=D;
  const map=new TWMap($('#twMap'),{onCursor:i=>twCursor(i,'map')});map.onCorner=c=>twZoomCorner(c);TW.map=map;
  const trc=new TWTraces($('#twTr'),$('#twOv'),{onCursor:i=>twCursor(i,'tr'),onRange:r=>{TW.range=r;if($('#twFollow').checked){if(r)map.fitRange(Math.round(r[0]/D.step),Math.round(r[1]/D.step));else map.reset();}twGG($('#twGG'),D,r);$('#twGGt').textContent=r?`${Math.round(r[0])}–${Math.round(r[1])} m`:tr('tutto il giro');}});TW.tr=trc;
  if(!D.A){$('.twmapp').innerHTML=`<div class="empty">${tr('Questa telemetria non ha la posizione GPS: la mappa non è disponibile.')}</div>`;}else map.set(D,mode);
  trc.set(D,twPanels(D,list));$('#twCor').innerHTML=twCornersHTML(D);$('#twSum').innerHTML=twSummaryHTML(D);twGG($('#twGG'),D,null);$('#twGGt').textContent=tr('tutto il giro');
  $('#twLeg').innerHTML=twLegend(mode,!!D.gB);twCursor(TW.cur!=null&&TW.cur<D.n?TW.cur:D.corners[0]?.apex??0,'init');
  // wiring
  $$('.twlap').forEach(b=>b.onclick=()=>{const S=SS.find(x=>x.id===b.dataset.s);if(b.dataset.w==='A'){TW.SA=S;TW.a=+b.dataset.l;}else{TW.SB=S;TW.b=+b.dataset.l;}TW.auto=false;RENDER.tele();});
  $('#twSA').onchange=e=>{TW.SA=SS.find(x=>x.id===e.target.value);TW.a=TW.SA.best?.i??TW.SA.laps.find(l=>l.complete).i;TW.SB=null;TW.auto=true;RENDER.tele();};
  $('#twSB').onchange=e=>{const S=SS.find(x=>x.id===e.target.value);TW.auto=false;if(!S){TW.SB=null;TW.b=null;}else{TW.SB=S;const L=S.laps.filter(l=>l.complete&&!(S===TW.SA&&l.i===TW.a)).sort((x,y)=>x.time-y.time);TW.b=(L[0]||S.laps.find(l=>l.complete)).i;}RENDER.tele();};
  $$('#twMode button').forEach(b=>b.onclick=()=>{LS.set('tw:mode',b.dataset.m);$$('#twMode button').forEach(x=>x.setAttribute('aria-pressed',x===b));map.mode=b.dataset.m;map.draw();$('#twLeg').innerHTML=twLegend(b.dataset.m,!!D.gB);});
  $$('#twPre button').forEach(b=>b.onclick=()=>{LS.set('tw:pre',b.dataset.p);LS.set('tw:list',null);$$('#twPre button').forEach(x=>x.setAttribute('aria-pressed',x===b));trc.set(D,twPanels(D,TW_PRE[b.dataset.p]),true);});
  $$('#twWh button').forEach(b=>b.onclick=()=>{TW.whB=b.dataset.w==='B';$$('#twWh button').forEach(x=>x.setAttribute('aria-pressed',x===b));twCursor(TW.cur,'wh');});
  $('#twRot').onclick=()=>map.rotate();$('#twFit').onclick=()=>map.reset();$('#twFollow').onchange=e=>LS.set('tw:follow',e.target.checked);
  $('#twZin').onclick=()=>{const [lo,hi]=trc.lohi();const c=TW.cur!=null?D.gA.d[TW.cur]:(lo+hi)/2;trc.setRange(c-(c-lo)*0.6,c+(hi-c)*0.6,true);};$('#twZout').onclick=()=>{const [lo,hi]=trc.lohi();const c=(lo+hi)/2;trc.setRange(c-(c-lo)*1.6,c+(hi-c)*1.6,true);};
  $$('#twCor tr[data-c]').forEach(r=>r.onclick=()=>twZoomCorner(D.corners.find(c=>c.k===+r.dataset.c)));
  twChannelPicker(D,list);
  let play=null;$('#twPlay').onclick=()=>{if(play){cancelAnimationFrame(play);play=null;$('#twPlay').textContent='▶';map.ghost=null;map.draw();return;}$('#twPlay').textContent='⏸';
    let t=D.gA.t[TW.cur||0],last=performance.now();const tick=now=>{t+=(now-last)/1000*+$('#twSpd').value;last=now;let i=TW.cur||0;while(i<D.n-1&&D.gA.t[i]<t)i++;if(i>=D.n-1){t=0;i=0;}
      if(D.gB){let j=0;const tb=D.gB.t;let lo=0,hi=D.n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(tb[m]<t)lo=m;else hi=m;}j=lo;map.ghost=j;}twCursor(i,'play');play=requestAnimationFrame(tick);};play=requestAnimationFrame(tick);};
};
function twLegend(m,hasB){const A=`<span><i style="background:var(--lapA)"></i>A</span>`,B=hasB?`<span><i style="background:var(--lapB)"></i>B</span>`:'';
  const pts=`<span>● ${tr('frenata')}</span><span>▲ ${tr('gas pieno')}</span>`;
  if(m==='inputs')return `<span><i style="background:#FF2D55"></i>${tr('freno')}</span><span><i style="background:#22E58B"></i>${tr('gas pieno')}</span><span><i style="background:#9BE8B9"></i>${tr('gas parziale')}</span><span><i style="background:#8A93A3"></i>${tr('senza pedali')}</span>${hasB?`<span>- - B</span>`:''}`;
  if(m==='delta')return hasB?`<span><i style="background:#22E58B"></i>${tr('A guadagna')}</span><span><i style="background:#FF2D55"></i>${tr('A perde')}</span>${B}`:`<span>${tr('Scegli un giro B per il delta.')}</span>`;
  if(m==='speed')return `<span><i style="background:linear-gradient(90deg,${TWSPD.join(',')})"></i>${tr('lento → veloce')}</span>${B}`;
  if(m==='gear')return TWGEAR.slice(1,8).map((c,i)=>`<span><i style="background:${c}"></i>${i+1}ª</span>`).join('');
  return A+B+pts;}
function twZoomCorner(c){if(!c)return;const D=TW.D;const st=Math.min(c.brake??c.dApex-150,c.B?.brake??Infinity,c.dApex-120);const a=Math.max(0,st-60),b=Math.min(D.gA.d[D.n-1],Math.max(c.fullThr??0,c.dApex+120)+90);TW.tr.setRange(a,b,true);TW.map.fitRange(Math.round(a/D.step),Math.round(b/D.step));twCursor(c.apex,'corner');}
function twCursor(i,src){const D=TW.D;if(!D||i==null)return;TW.cur=i;if(src!=='map'||true)TW.map.cursor=i;if(src!=='play')TW.map.ghost=null;TW.map.draw();if(src!=='tr')TW.tr.setCursor(i,false);
  $('#twIns').innerHTML=twInspect(D,i);$('#twWheels').innerHTML=twWheels(D,i,TW.whB);
  const g=D.gA,v=n=>g.get(n)?.[i];const vb=n=>D.gB?.get(n)?.[i];const bar=(x,col)=>`<div class="hb"><i style="width:${Math.max(0,Math.min(100,x||0))}%;background:${col}"></i></div>`;
  $('#twHud').innerHTML=`<div class="r"><b>${Math.round(g.d[i])} m</b>${D.delta?`<b class="${D.delta[i]>0?'up':'dn'}">${D.delta[i]>0?'+':''}${D.delta[i].toFixed(3)}</b>`:''}</div>
    <div class="r a"><span>A</span><b>${twFmt(v('Ground Speed'),0)}</b><small>km/h</small><b>${twFmt(v('Gear'),0)}ª</b>${bar(v('Throttle Pos'),'#22E58B')}${bar(v('Brake Pos'),'#FF2D55')}</div>
    ${D.gB?`<div class="r b"><span>B</span><b>${twFmt(vb('Ground Speed'),0)}</b><small>km/h</small><b>${twFmt(vb('Gear'),0)}ª</b>${bar(vb('Throttle Pos'),'#22E58B')}${bar(vb('Brake Pos'),'#FF2D55')}</div>`:''}
    ${D.gap?`<div class="r"><span>${tr('linea B')}</span><b>${Math.abs(D.gap[i]).toFixed(1)} m ${D.gap[i]>0?'◀':'▶'}</b></div>`:''}`;}
function twChannelPicker(D,list){const all=Object.keys(D.gA.S.ch).filter(n=>!/Dent|Detached|Flag|Light|Impact|Headlights|Ignition|Anti Stall|Finish|Driver Type|Server|Game Phase|Place|Behind|Num |Best |Last |Cur Sector|Marker|Beacon|GPS|Session Elapsed|Lap Start/.test(n));
  const derived=['@power','@gsum','@speedD'];const box=$('#twChList');const draw=q=>{const qq=(q||'').toLowerCase();const items=[...derived,...all].filter(n=>!qq||n.toLowerCase().includes(qq)||tr(twMeta(n)[0]).toLowerCase().includes(qq)).slice(0,80);
    box.innerHTML=items.map(n=>`<label class="chk"><input type="checkbox" data-ch="${esc(n)}"${list.includes(n)?' checked':''}> ${esc(tr(twMeta(n)[0]))} <span class="muted small">${esc(n.startsWith('@')?tr('calcolato'):n)}</span></label>`).join('');
    $$('#twChList [data-ch]').forEach(c=>c.onchange=()=>{const L=[...(LS.get('tw:list',null)||TW_PRE[LS.get('tw:pre','pil')])];const n=c.dataset.ch;const k=L.indexOf(n);if(c.checked&&k<0)L.push(n);if(!c.checked&&k>=0)L.splice(k,1);LS.set('tw:list',L);$$('#twPre button').forEach(x=>x.setAttribute('aria-pressed','false'));TW.tr.set(D,twPanels(D,L),true);});};
  draw('');$('#twQ').oninput=e=>draw(e.target.value);}
// a new file loaded: start again from its best lap
(function(){const r=window.refreshAll;if(typeof r==='function')window.refreshAll=refreshAll=function(){TW.SA=null;TW.auto=true;r();};})();
// arrows move the cursor (shift = 50 m)
document.addEventListener('keydown',e=>{const D=TW.D;if(!D||curView()!=='tele'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();twCursor(Math.max(0,Math.min(D.n-1,(TW.cur||0)+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?50:5))),'key');}});

(function(){const st=document.createElement('style');st.textContent=`
.tw2{display:flex;flex-direction:column;gap:12px}
.twhead{padding:14px 16px}.twtitle{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:10px}.twtitle .ey{font:600 .72rem var(--f-mono);letter-spacing:.2em;color:var(--lapA);text-transform:uppercase}
.twtitle h2{margin:2px 0 0;font:700 1.7rem var(--f-display);letter-spacing:.03em;text-transform:uppercase}.twtitle h2 span{font:400 .9rem var(--f-mono);color:var(--muted);text-transform:none;letter-spacing:0}
.twbest{margin-left:auto;text-align:right}.twbest span{display:block;font:600 .7rem var(--f-display);letter-spacing:.18em;color:var(--muted);text-transform:uppercase}.twbest b{font:600 1.6rem var(--f-mono);color:var(--best)}.twbest small{display:block;font:.72rem var(--f-mono);color:var(--muted)}
.twlaps{display:flex;align-items:flex-end;gap:10px;margin-top:8px;flex-wrap:wrap}.twlaps .tag{width:26px;height:26px;display:grid;place-items:center;font:700 1rem var(--f-display);color:#05070A;border-radius:3px;align-self:center}.twlaps .tag.a{background:var(--lapA)}.twlaps .tag.b{background:var(--lapB)}
.twlaps .f{min-width:230px;max-width:320px}.twlaprow{display:flex;gap:6px;flex-wrap:wrap;flex:1;min-width:0}
.twlap{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:5px 9px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);cursor:pointer;border-radius:3px;min-width:104px;font:inherit}
.twlap:hover{border-color:#4A525C}.twlap .n{font:600 .66rem var(--f-display);letter-spacing:.14em;color:var(--muted)}.twlap b{font:600 .95rem var(--f-mono)}.twlap .ss{display:flex;gap:5px;font:.62rem var(--f-mono);color:var(--muted)}.twlap .ss i{font-style:normal}.twlap .ss i.p{color:var(--best)}
.twlap.inv b{color:var(--bad)}.twlaps:nth-child(2) .twlap.on{border-color:var(--lapA);box-shadow:inset 0 0 0 1px var(--lapA),0 0 14px -4px var(--lapA)}.twlaps:nth-child(3) .twlap.on{border-color:var(--lapB);box-shadow:inset 0 0 0 1px var(--lapB),0 0 14px -4px var(--lapB)}
.twmain{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(320px,1fr);gap:12px}
.twmapp{padding:0;display:flex;flex-direction:column;min-height:620px}.twbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid var(--line)}.twbar .sp{flex:1}.twbar select{width:auto}
.twmapw{position:relative;flex:1;min-height:600px;background:radial-gradient(800px 500px at 50% 40%,rgba(0,200,255,.05),transparent 70%),#0A0D12}
#twMap{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none}
.twfoot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;padding:8px 12px;border-top:1px solid var(--line);background:rgba(6,8,12,.6)}
.twhud{display:flex;flex-wrap:wrap;gap:4px 18px;font:12px var(--f-mono);flex:1;min-width:0}
.twhud .r{display:flex;align-items:center;gap:8px;margin:0}.twhud .r span{font:700 .78rem var(--f-display);width:16px}.twhud .r.a span{color:var(--lapA)}.twhud .r.b span{color:var(--lapB)}.twhud b{font-weight:600}.twhud small{color:var(--muted);margin-left:-4px}
.twhud .hb{width:42px;height:6px;background:rgba(255,255,255,.08)}.twhud .hb i{display:block;height:100%}.twhud .up,.twih .up,.twit .up,.twsum .up{color:var(--bad)}.twhud .dn,.twih .dn,.twit .dn,.twsum .dn{color:var(--good)}
.twleg{display:flex;flex-wrap:wrap;gap:10px;font:.72rem var(--f-mono);color:#C9D1DA}.twleg i{display:inline-block;width:14px;height:4px;margin-right:5px;vertical-align:middle}
.twins{max-height:680px;overflow:auto}.twih{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}.twih div{background:var(--panel2);padding:6px 8px;border:1px solid var(--line)}.twih span{display:block;font:600 .64rem var(--f-display);letter-spacing:.14em;color:var(--muted);text-transform:uppercase}.twih b{font:600 1rem var(--f-mono)}
table.twit{width:100%;margin-bottom:8px;font:12px var(--f-mono)}table.twit th{font-size:.64rem;text-align:right;padding:4px 6px}table.twit th:first-child{text-align:left}table.twit td{padding:3px 6px;text-align:right;white-space:nowrap}table.twit td:first-child{text-align:left;font-family:var(--f-ui,inherit);color:#C9D1DA;white-space:normal}
table.twit .a{color:var(--lapA)}table.twit .b{color:var(--lapB)}table.twit .u{color:var(--muted);font-size:.68rem;text-align:left}
.twcar{display:grid;grid-template-columns:1fr 34px 1fr;grid-template-rows:auto auto;gap:6px;margin-bottom:10px}.twcar .body{grid-row:1/3;grid-column:2;background:linear-gradient(180deg,#1E2530,#12161C);border:1px solid var(--line);border-radius:14px 14px 8px 8px}
.twcar>.twty:nth-child(1){grid-column:1;grid-row:1}.twcar>.twty:nth-child(2){grid-column:3;grid-row:1}.twcar>.twty:nth-child(4){grid-column:1;grid-row:2}.twcar>.twty:nth-child(5){grid-column:3;grid-row:2}
.twty{background:var(--panel2);border:1px solid var(--line);padding:6px 7px;font:11px var(--f-mono)}.twty .tt{display:flex;justify-content:space-between;margin-bottom:4px}.twty .tt b{font:700 .85rem var(--f-display)}.twty .tt span{color:var(--muted)}
.twty .bars{display:flex;gap:2px;margin-bottom:4px}.twty .bars i{flex:1;font-style:normal;text-align:center;color:#05070A;font-weight:700;padding:3px 0;font-size:11px}.twty .kv{display:flex;justify-content:space-between;line-height:1.5}.twty .kv span{color:var(--muted)}
.twty .gb{height:4px;background:rgba(255,255,255,.08);margin:2px 0 3px}.twty .gb i{display:block;height:100%;background:linear-gradient(90deg,#35C46A,#E8B23A 80%,#E0403A)}
.twtr{padding:0}#twTr{display:block;width:100%;cursor:crosshair;touch-action:none}.twov{display:block;width:100%;height:26px;border-top:1px solid var(--line);cursor:ew-resize}
.twadd .menu-list{width:340px;max-height:420px;overflow:auto;padding:8px}.twadd .menu-list input[type=text]{width:100%;margin-bottom:6px}.twadd .chk{display:block;padding:3px 0;font-size:.82rem}
.twlow{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(320px,1fr);gap:12px}.twside{display:flex;flex-direction:column;gap:12px}#twGG{width:100%;height:300px;display:block}
table.twct{width:100%;font:12px var(--f-mono)}table.twct td,table.twct th{padding:5px 7px;text-align:right;white-space:nowrap}table.twct td:first-child,table.twct th:first-child,table.twct .l{text-align:left}table.twct td.l{white-space:normal;min-width:220px;color:#C9D1DA}
table.twct small{margin-left:4px;font-size:.7rem}table.twct small.up,table.twct b.dn{color:var(--good)}table.twct small.dn,table.twct b.up{color:var(--bad)}table.twct tr[data-c]{cursor:pointer}
.twsum{display:grid;grid-template-columns:1fr;gap:0}.twsum div{display:grid;grid-template-columns:1fr auto auto 64px;gap:10px;align-items:baseline;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);font:12px var(--f-mono)}.twsum span{font-family:inherit;color:#C9D1DA}
.twsum b.a{color:var(--lapA);font-weight:600}.twsum b.b{color:var(--lapB);font-weight:600}.twsum small{color:var(--muted);margin-left:3px;font-size:.66rem}.twsum em{font-style:normal;text-align:right}
@media (max-width:1100px){.twmain,.twlow{grid-template-columns:1fr}.twins{max-height:none}}
@media (max-width:760px){.twmapp{min-height:420px}.twmapw{min-height:380px}.twhud{font-size:11px}.twlaps .f{min-width:0;max-width:none;width:100%}.twtitle h2{font-size:1.3rem}.twbest{margin-left:0;text-align:left}}`;document.head.appendChild(st);})();
