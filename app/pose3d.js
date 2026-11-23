// ================= 3D POSE OF THE CAR (Analisi tecnica › Piattaforma e aero) =================
// The car, a smooth WebGL body (height field) with wheels and wings, sits on the four ride heights measured in each phase of the lap (medians of
// vdPose in vdyn.js); the tyres show the inner / centre / outer temperatures. Movements can be enlarged ×5 because the
// real ones are a few millimetres; the numbers on the side are always the measured ones.
// A small WebGL renderer written for this view (no library): per-pixel light, depth buffer, labels on a 2D canvas.
// Without WebGL the numbers stay and the drawing is left out.
const P3={ph:'mid',E:5,view:'tq',yaw:2.35,el:0.30,cur:null,gl:null,anim:0};
const P3_VIEWS={tq:[2.35,0.30,'3/4'],side:[Math.PI/2,0.05,'Laterale'],front:[Math.PI,0.08,'Frontale'],top:[Math.PI/2,1.45,'Dall\'alto']};
const P3_PHN={str:'Rettilineo',brk:'Frenata',ent:'Inserimento',mid:'Appoggio',ext:'Uscita'};
// proportions of a closed-wheel hypercar (metres): x left(−)/right(+), y up, z rear(−)/front(+)
const P3_WB=3.15,P3_TF=1.70,P3_TR=1.66,P3_RW=0.36;
const P3_WH={FL:{x:-P3_TF/2,z:P3_WB/2,w:.31},FR:{x:P3_TF/2,z:P3_WB/2,w:.31},RL:{x:-P3_TR/2,z:-P3_WB/2,w:.34},RR:{x:P3_TR/2,z:-P3_WB/2,w:.34}};

// ---------- shapes ----------
// Each face: points, colour [r,g,b] 0–1, s = 1 when it belongs to the sprung body (moves with the ride heights), k = shine.
const p3Hex=c=>{const n=parseInt(c.slice(1),16);return [(n>>16)/255,(n>>8&255)/255,(n&255)/255];};
const P3_COL={body:p3Hex('#575A61'),dark:p3Hex('#2A2C31'),glass:p3Hex('#121316'),wing:p3Hex('#3A3D43'),floor:p3Hex('#1E1F23'),tyre:p3Hex('#17181B'),rim:p3Hex('#2C2E33'),spoke:p3Hex('#55585E'),strut:p3Hex('#C9CACD')};
function p3Box(x,y,z,w,h,l,c,s=1,k=.2){const a=[x-w/2,y,z-l/2],b=[x+w/2,y+h,z+l/2];const P=(i,j,q)=>[[a[0],b[0]][i],[a[1],b[1]][j],[a[2],b[2]][q]];
  return [[P(0,0,0),P(1,0,0),P(1,1,0),P(0,1,0)],[P(1,0,1),P(0,0,1),P(0,1,1),P(1,1,1)],[P(0,0,1),P(0,0,0),P(0,1,0),P(0,1,1)],
          [P(1,0,0),P(1,0,1),P(1,1,1),P(1,1,0)],[P(0,1,0),P(1,1,0),P(1,1,1),P(0,1,1)],[P(0,0,1),P(1,0,1),P(1,0,0),P(0,0,0)]].map(p=>({p,c,s,k}));}
// a thin plate tilted around x (wing elements): chord along z, angle in radians (nose down = positive)
function p3Plate(x,y,z,w,t,chord,ang,c){const f=p3Box(x,y,z,w,t,chord,c,1,.35);const ca=Math.cos(ang),sa=Math.sin(ang);
  f.forEach(q=>q.p=q.p.map(([px,py,pz])=>{const dy=py-y,dz=pz-z;return [px,y+dy*ca+dz*sa,z+dz*ca-dy*sa];}));return f;}

// the body as a height field over the floor: smooth shapes joined with a soft maximum (proportions of an LMDh hypercar
// taken from the reference photos: wide splitter, low nose, bubble cockpit with a roof scoop, tall bulging fenders over
// open wheel arches, sidepods, engine cover). Shape only: no livery, no logos, no brand lights.
const p3Smax=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.max(a,b)+h*h*k*0.25;};
const p3Lerp1=(xs,ys,x)=>{if(x<=xs[0])return ys[0];for(let i=1;i<xs.length;i++)if(x<=xs[i]){const f=(x-xs[i-1])/(xs[i]-xs[i-1]);return ys[i-1]+(ys[i]-ys[i-1])*f;}return ys[ys.length-1];};
function p3Pod(x,z,cx,cz,ax,az,h,p=4,q=0.5){const v=Math.pow(Math.abs(x-cx)/ax,p)+Math.pow(Math.abs(z-cz)/az,p);return v<1?h*Math.pow(1-v,q):0;}
const P3_HULL={z:[-2.35,-2.05,-1.3,-0.5,0.4,1.1,1.75,2.25,2.56],w:[.80,.82,.62,.58,.58,.55,.50,.45,.36],h:[.42,.52,.60,.62,.60,.50,.36,.24,.12]};
function p3Height(x,z){const ax=Math.abs(x);let h=0,id='body';
  if(ax<0.97&&z>-2.30&&z<2.32)h=0.05;
  if(z>=-2.35&&z<=2.56){const w=p3Lerp1(P3_HULL.z,P3_HULL.w,z),hh=p3Lerp1(P3_HULL.z,P3_HULL.h,z);const v=Math.pow(ax/w,3);if(v<1)h=p3Smax(h,hh*Math.pow(1-v,0.5),0.04);}
  // fenders, sidepods, engine cover
  const fF=p3Pod(ax,z,0.73,1.56,0.28,0.80,0.80),fR=p3Pod(ax,z,0.70,-1.55,0.29,0.78,0.84),sp=p3Pod(ax,z,0.70,-0.02,0.27,0.72,0.40,4,0.55),ec=p3Pod(ax,z,0,-1.45,0.55,0.95,0.70,3,0.5);
  h=p3Smax(h,fF,0.06);h=p3Smax(h,fR,0.06);h=p3Smax(h,sp,0.08);h=p3Smax(h,ec,0.06);
  // bubble cockpit: long sloping windscreen in front, shorter behind
  const cz=0.30,az=z>cz?1.20:0.80;const v=Math.pow(ax/0.40,2)+Math.pow((z-cz)/az,2);const cp=v<1?1.04*Math.pow(1-v,0.5):0;
  if(cp>h-0.005&&cp>0.66&&!(ax<0.07&&z<0.6))id='glass';h=p3Smax(h,cp,0.05);
  // roof scoop
  const sc=p3Pod(ax,z,0,0.18,0.10,0.22,1.11,6,0.3);if(sc>h){h=sc;id='body';}
  return {h,id};}
// open wheel arches: over the outer part of each wheel the body stops at the arch line (a smooth curve over the tyre)
function p3ArchY(x,z){for(const k of VD_W){const w=P3_WH[k];const dz=z-w.z,R=P3_RW+0.07;if(Math.abs(dz)>=R)continue;
  if(Math.sign(x)!==Math.sign(w.x)||Math.abs(x)<Math.abs(w.x)-w.w/2-0.04)continue;return P3_RW+Math.sqrt(R*R-dz*dz);}return null;}
function p3BodyMesh(){const NX=128,NZ=260,X0=-1.0,X1=1.0,Z0=-2.45,Z1=2.66;
  // vertices: g = ground (outside the body), a = lifted to the arch line, otherwise on the body surface
  const V=[];for(let j=0;j<=NZ;j++){const z=Z0+(Z1-Z0)*j/NZ;for(let i=0;i<=NX;i++){const x=X0+(X1-X0)*i/NX;const H=p3Height(x,z);let y=H.h,t=y<0.001?'g':'b';
    if(t==='b'){const ay=p3ArchY(x,z);if(ay!=null&&y<ay+0.02){y=ay;t='a';}else if(ay!=null&&y>=ay+0.02){}}V.push({x,z,y,t,id:H.id});}}
  const at=(i,j)=>V[j*(NX+1)+i];const T=[];
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const q=[at(i,j),at(i+1,j),at(i+1,j+1),at(i,j+1)];
    // split each cell along the diagonal with the smaller height jump: steep walls stay even
    const tris=Math.abs(q[0].y-q[2].y)<=Math.abs(q[1].y-q[3].y)?[[0,1,2],[0,2,3]]:[[0,1,3],[1,2,3]];
    for(const t of tris){const v=t.map(k=>q[k]);if(v.every(x=>x.t==='g'))continue;if(v.some(x=>x.t==='a')&&v.some(x=>x.t==='g'))continue;T.push(v);}}
  // normals from the shape itself (central differences of the height function), so steep walls shade evenly
  const e=0.012;V.forEach(v=>{if(v.t!=='b'){v.n=[0,1,0];return;}const gx=(p3Height(v.x+e,v.z).h-p3Height(v.x-e,v.z).h)/(2*e),gz=(p3Height(v.x,v.z+e).h-p3Height(v.x,v.z-e).h)/(2*e);v.n=[-gx,1,-gz];});
  const P=[],N=[],C=[],S=[],K=[];
  T.forEach(tri=>tri.forEach(v=>{P.push(v.x,v.y,v.z);N.push(...(v.t==='a'?[0,-1,0]:p3Nrm(v.n)));
    // a little darker towards the floor, as a real car is in its own shadow
    const ao=0.28+0.72*Math.min(1,Math.max(0,(v.y-0.05)/0.30));const c0=v.t==='a'?P3_COL.dark:v.y<0.06?P3_COL.floor:v.id==='glass'?P3_COL.glass:P3_COL.body;C.push(...c0.map(x=>x*ao));S.push(1);K.push(v.id==='glass'?0.9:0.3);}));
  return {P,N,C,S,K};}
// parts that overhang (not a height field): splitter, dive planes, fin, wing, endplates, swan necks, mirrors, diffuser
function p3Parts(){const D=P3_COL.dark,W=P3_COL.wing;return [].concat(
  p3Box(0,0.005,2.40,1.98,0.03,0.52,D),
  p3Plate(-0.88,0.30,2.30,0.16,0.012,0.22,-0.15,D),p3Plate(0.88,0.30,2.30,0.16,0.012,0.22,-0.15,D),
  p3Box(0,0.60,-1.30,0.035,0.44,1.80,D).map(q=>({...q,p:q.p.map(([x,y,z])=>[x,y>0.61?0.60+0.44-(z<-1.3?0:(z+1.3)*0.20):y,z])})),
  p3Box(-0.94,0.60,-2.33,0.025,0.50,0.56,D),p3Box(0.94,0.60,-2.33,0.025,0.50,0.56,D),
  p3Plate(0,1.00,-2.30,1.86,0.03,0.40,0.10,W),p3Plate(0,1.07,-2.47,1.86,0.02,0.20,0.45,W),
  p3Box(-0.18,0.66,-2.22,0.025,0.36,0.10,D),p3Box(0.18,0.66,-2.22,0.025,0.36,0.10,D),
  p3Box(-0.63,0.82,1.02,0.11,0.06,0.14,D),p3Box(0.63,0.82,1.02,0.11,0.06,0.14,D),p3Box(-0.6,0.76,1.02,0.02,0.07,0.03,D),p3Box(0.6,0.76,1.02,0.02,0.07,0.03,D),
  p3Box(0,0.02,-2.30,1.72,0.20,0.30,D));}

// tyre temperature scale, the same steps as the rest of the app (cold blue → ok green → hot red)
const P3_STOPS=[[60,[91,141,239]],[75,[79,179,200]],[87,[76,195,138]],[100,[242,194,48]],[110,[229,72,77]]];
function p3Heat(t){if(!Number.isFinite(t))return [0.17,0.18,0.2];if(t<=P3_STOPS[0][0])return P3_STOPS[0][1].map(v=>v/255);
  for(let i=1;i<P3_STOPS.length;i++)if(t<=P3_STOPS[i][0]){const [t0,c0]=P3_STOPS[i-1],[t1,c1]=P3_STOPS[i];const f=(t-t0)/(t1-t0);return c0.map((v,j)=>(v+(c1[j]-v)*f)/255);}
  return P3_STOPS[P3_STOPS.length-1][1].map(v=>v/255);}
const p3Css=t=>Number.isFinite(t)?'rgb('+p3Heat(t).map(v=>Math.round(v*255)).join(',')+')':'var(--panel2)';
// a wheel: rounded tyre (shoulders) with the three tread bands in the temperature colours, dark rim with spokes and a hub
function p3Wheel(k,temps){const w=P3_WH[k],N=28,out=[];const left=w.x<0,o=left?-1:1;const R=P3_RW;
  const [I,C,E]=temps||[NaN,NaN,NaN];const band=left?[E,C,I]:[I,C,E];
  const prof=[[-0.5,0.86],[-0.47,0.95],[-0.42,1],[-0.14,1],[0.14,1],[0.42,1],[0.47,0.95],[0.5,0.86]]; // across the tyre: x / half width, radius / R
  const colOf=i=>i<1||i>5?P3_COL.tyre:p3Heat(band[i<3?0:i<4?1:2]);
  for(let s=0;s<N;s++){const a0=s/N*2*Math.PI,a1=(s+1)/N*2*Math.PI;
    for(let i=0;i<prof.length-1;i++){const [x0,r0]=prof[i],[x1,r1]=prof[i+1];const X0=w.x+x0*w.w,X1=w.x+x1*w.w;
      const pt=(X,r,a)=>[X,R+R*r*Math.sin(a),w.z+R*r*Math.cos(a)];out.push({p:[pt(X0,r0,a0),pt(X1,r1,a0),pt(X1,r1,a1),pt(X0,r0,a1)],c:colOf(i),s:0,k:i>=1&&i<=5?0.15:0.1});}}
  // outer face: sidewall ring, rim, spokes, hub
  const xo=w.x+o*w.w*0.5,ring=(r0,r1,x,c,k)=>{for(let s=0;s<N;s++){const a0=s/N*2*Math.PI,a1=(s+1)/N*2*Math.PI;const pt=(r,a)=>[x,R+r*Math.sin(a),w.z+r*Math.cos(a)];out.push({p:[pt(r0,a0),pt(r1,a0),pt(r1,a1),pt(r0,a1)],c,s:0,k});}};
  ring(R*0.86,R*0.64,xo,P3_COL.tyre,0.1);ring(R*0.64,R*0.18,xo-o*0.03,P3_COL.rim,0.3);ring(R*0.86,R*0.64,w.x-o*w.w*0.5,P3_COL.tyre,0.1);ring(R*0.64,0,w.x-o*w.w*0.5,P3_COL.rim,0.2);
  for(let s=0;s<10;s++){const a=s/10*2*Math.PI,da=0.07;const pt=(r,b)=>[xo-o*0.02,R+r*Math.sin(b),w.z+r*Math.cos(b)];out.push({p:[pt(R*0.17,a-da),pt(R*0.62,a-da*0.5),pt(R*0.62,a+da*0.5),pt(R*0.17,a+da)],c:P3_COL.spoke,s:0,k:0.5});}
  ring(R*0.17,0,xo-o*0.01,P3_COL.spoke,0.6);
  return out;}

// ---------- pose: floor height at (x,z) from the four ride heights (bilinear), movements ×E ----------
function p3State(ph){const r=ph?.rh||{};
  const v=w=>Number.isFinite(r[w])?r[w]:Number.isFinite(w[0]==='F'?ph?.rhF:ph?.rhR)?(w[0]==='F'?ph.rhF:ph.rhR):30;
  return {rh:{FL:v('FL'),FR:v('FR'),RL:v('RL'),RR:v('RR')},t:Object.fromEntries(VD_W.map(w=>[w,(ph?.t?.[w]||[NaN,NaN,NaN]).slice()]))};}
function p3Lerp(a,b,f){const L=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?x+(y-x)*f:y;
  return {rh:Object.fromEntries(VD_W.map(w=>[w,L(a.rh[w],b.rh[w])])),t:Object.fromEntries(VD_W.map(w=>[w,b.t[w].map((v,i)=>L(a.t[w][i],v))]))};}
function p3Floor(st,x,z){const u=(x+P3_TF/2)/P3_TF,v=(z+P3_WB/2)/P3_WB;const r=st.rh;
  const h=(r.RL*(1-u)+r.RR*u)*(1-v)+(r.FL*(1-u)+r.FR*u)*v;return h/1000*P3.E;}

// ---------- WebGL: smooth body uploaded once, the pose applied in the vertex shader ----------
const p3Sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],p3Dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],p3Crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],p3Nrm=a=>{const m=Math.hypot(...a)||1;return a.map(x=>x/m);};
const P3_LIGHT=p3Nrm([-0.45,0.85,0.35]),P3_TARGET=[0,0.18,0.2];
const P3_VS=`attribute vec3 p;attribute vec3 n;attribute vec3 c;attribute float s;attribute float k;
uniform mat4 m;uniform vec4 rh;uniform vec2 dim;varying vec3 vp;varying vec3 vn;varying vec3 vc;varying float vk;
void main(){float u=clamp((p.x+dim.x*0.5)/dim.x,-0.5,1.5),v=(p.z+dim.y*0.5)/dim.y;float y=mix(mix(rh.x,rh.y,u),mix(rh.z,rh.w,u),v);
vec3 q=p+vec3(0.0,s*y,0.0);vp=q;vn=n;vc=c;vk=k;gl_Position=m*vec4(q,1.0);}`;
const P3_FS=`precision mediump float;uniform vec3 eye;uniform vec3 L;varying vec3 vp;varying vec3 vn;varying vec3 vc;varying float vk;
void main(){vec3 N=normalize(vn);vec3 V=normalize(eye-vp);if(dot(N,V)<0.0)N=-N;float lam=max(dot(N,L),0.0);float hemi=0.42+0.18*N.y;
float sp=pow(max(dot(N,normalize(L+V)),0.0),36.0)*vk;float rim=pow(1.0-max(dot(N,V),0.0),4.0)*0.04;
gl_FragColor=vec4(vc*(hemi+0.62*lam)+vec3(sp*0.55+rim),1.0);}`;
function p3GL(cv){const gl=cv.getContext('webgl',{antialias:true,alpha:true});if(!gl)return null;
  const sh=(t,src)=>{const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);return o;};
  const prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,P3_VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,P3_FS));gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return null;gl.useProgram(prog);gl.enable(gl.DEPTH_TEST);
  const o={gl,prog,a:{},u:{}};['p','n','c','s','k'].forEach(x=>{o.a[x]=gl.getAttribLocation(prog,x);gl.enableVertexAttribArray(o.a[x]);});['m','rh','dim','eye','L'].forEach(x=>o.u[x]=gl.getUniformLocation(prog,x));
  // the static part: body height field and the overhanging parts, uploaded once
  const B=p3BodyMesh();const add=(M,list)=>list.forEach(q=>p3Face(M,q.p,q.c,q.s,q.k));p3Parts&&add(B,p3Parts());
  o.st=p3Upload(gl,B);o.dyn=null;return o;}
function p3Face(M,pts,c,s,k){const n=p3Nrm(p3Crs(p3Sub(pts[1],pts[0]),p3Sub(pts[2],pts[0])));for(let i=1;i<pts.length-1;i++)for(const p of [pts[0],pts[i],pts[i+1]]){M.P.push(...p);M.N.push(...n);M.C.push(...c);M.S.push(s);M.K.push(k);}}
function p3Upload(gl,M,old){const b=old||{P:gl.createBuffer(),N:gl.createBuffer(),C:gl.createBuffer(),S:gl.createBuffer(),K:gl.createBuffer()};
  for(const x of ['P','N','C','S','K']){gl.bindBuffer(gl.ARRAY_BUFFER,b[x]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(M[x]),old?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);}b.n=M.P.length/3;return b;}
function p3Bind(o,b){const gl=o.gl;[['P','p',3],['N','n',3],['C','c',3],['S','s',1],['K','k',1]].forEach(([B,a,sz])=>{gl.bindBuffer(gl.ARRAY_BUFFER,b[B]);gl.vertexAttribPointer(o.a[a],sz,gl.FLOAT,false,0,0);});gl.drawArrays(gl.TRIANGLES,0,b.n);}
function p3Eye(){const D=8.2*Math.max(1,1.9/(P3.aspect||3));return [P3_TARGET[0]+D*Math.cos(P3.el)*Math.sin(P3.yaw),P3_TARGET[1]+D*Math.sin(P3.el),P3_TARGET[2]-D*Math.cos(P3.el)*Math.cos(P3.yaw)];}
function p3Matrix(w,h){const e=p3Eye(),zf=p3Nrm(p3Sub(e,P3_TARGET)),xr=p3Nrm(p3Crs([0,1,0],zf)),yu=p3Crs(zf,xr);
  const V=[xr[0],yu[0],zf[0],0, xr[1],yu[1],zf[1],0, xr[2],yu[2],zf[2],0, -p3Dot(xr,e),-p3Dot(yu,e),-p3Dot(zf,e),1];
  const f=1/Math.tan(0.21),a=w/h,n=0.5,fa=40;const P=[f/a,0,0,0, 0,f,0,0, 0,0,(fa+n)/(n-fa),-1, 0,0,2*fa*n/(n-fa),0];
  const M=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)M[j*4+i]+=P[k*4+i]*V[j*4+k];return M;}
function p3Screen(M,p,w,h){const x=M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12],y=M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13],q=M[3]*p[0]+M[7]*p[1]+M[11]*p[2]+M[15];return [(x/q*0.5+0.5)*w,(1-(y/q*0.5+0.5))*h];}
function p3Draw(){const cv=$('#p3cv'),ov=$('#p3ov');if(!cv||!ov||!P3.gl||!P3.cur)return;const r=cv.getBoundingClientRect();if(!r.width)return;
  const dpr=devicePixelRatio||1,w=r.width,h=r.height;P3.aspect=w/h;const o=P3.gl,gl=o.gl;
  cv.width=ov.width=Math.round(w*dpr);cv.height=ov.height=Math.round(h*dpr);gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const st=P3.cur,M=p3Matrix(w,h),e=P3.E/1000;
  gl.uniformMatrix4fv(o.u.m,false,new Float32Array(M));gl.uniform4f(o.u.rh,st.rh.RL*e,st.rh.RR*e,st.rh.FL*e,st.rh.FR*e);gl.uniform2f(o.u.dim,P3_TF,P3_WB);gl.uniform3fv(o.u.eye,p3Eye());gl.uniform3fv(o.u.L,P3_LIGHT);
  // the parts that change with the phase: ground, wheels (temperatures), suspension struts (hub to body)
  const D={P:[],N:[],C:[],S:[],K:[]};
  p3Face(D,[[-3.2,-0.004,-3.6],[3.2,-0.004,-3.6],[3.2,-0.004,3.6],[-3.2,-0.004,3.6]],p3Hex('#141518'),0,0);
  VD_W.forEach(k=>p3Wheel(k,st.t[k]).forEach(q=>p3Face(D,q.p,q.c,q.s,q.k)));
  VD_W.forEach(k=>{const wh=P3_WH[k];const x=wh.x+(wh.x<0?0.26:-0.26),y1=0.42+p3Floor(st,x,wh.z);p3Box(x,P3_RW,wh.z,0.03,Math.max(0.02,y1-P3_RW),0.03,P3_COL.strut,0,0.4).forEach(q=>p3Face(D,q.p,q.c,q.s,q.k));});
  o.dyn=p3Upload(gl,D,o.dyn);p3Bind(o,o.st);p3Bind(o,o.dyn);
  // overlay: ground grid, the floor line (rake) in flame, ride height at the axles with the measured value
  const ctx=ov.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.05)';
  for(let i=-6;i<=6;i++)[[[i*0.5,0,-3.6],[i*0.5,0,3.6]],[[-3,0,i*0.6],[3,0,i*0.6]]].forEach(([a,b])=>{const A=p3Screen(M,a,w,h),B=p3Screen(M,b,w,h);ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);ctx.stroke();});
  const fx=Math.sin(P3.yaw)>=0?0.99:-0.99;const fl=[[fx,p3Floor(st,fx,-2.2),-2.2],[fx,p3Floor(st,fx,2.4),2.4]].map(p=>p3Screen(M,p,w,h));
  if(Math.hypot(fl[0][0]-fl[1][0],fl[0][1]-fl[1][1])>140){ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--pacc').trim()||'#FF5A1F';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(fl[0][0],fl[0][1]);ctx.lineTo(fl[1][0],fl[1][1]);ctx.stroke();}
  const sx=fx*1.14,ga=p3Screen(M,[sx,0,P3_WB/2],w,h),gr=p3Screen(M,[sx,0,-P3_WB/2],w,h);
  const A=P3.data?.ph?.[P3.ph];
  if(A&&Math.abs(ga[0]-gr[0])>90)[['ant.',P3_WB/2,A.rhF,ga,gr],['post.',-P3_WB/2,A.rhR,gr,ga]].forEach(([n,z,v,g,o_])=>{const t=p3Screen(M,[sx,p3Floor(st,sx,z),z],w,h);
    ctx.setLineDash([3,3]);ctx.strokeStyle='#73767C';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(g[0],g[1]);ctx.lineTo(t[0],t[1]);ctx.stroke();ctx.setLineDash([]);
    const t1=Number.isFinite(v)?fx_(v)+' mm':'—',t2=tr('altezza')+' '+n;ctx.font='400 12px "Titillium Web",sans-serif';const tw=Math.max(ctx.measureText(t2).width,40);
    // labels stay inside the canvas: flip to the other side of the line when they would run off the edge
    let right=g[0]>=o_[0];if(right&&g[0]+10+tw>w-4)right=false;if(!right&&g[0]-10-tw<4)right=true;const lx=g[0]+(right?10:-10);ctx.textAlign=right?'left':'right';
    ctx.font='500 15px "Barlow Condensed",sans-serif';ctx.fillStyle='#F2F2F0';ctx.fillText(t1,lx,g[1]+16);
    ctx.font='400 12px "Titillium Web",sans-serif';ctx.fillStyle='#A6A8AD';ctx.fillText(t2,lx,g[1]+30);});}
const fx_=v=>(Math.round(v*10)/10).toFixed(1);

// ---------- page ----------
function p3HTML(S,X){let D;try{D=vdPose(S,X.laps);}catch(e){console.error(e);return '';}if(!D||D.none||!D.have.rh)return '';
  const phs=VD_POSE_PH.filter(k=>D.ph[k]);if(!phs.length)return '';if(!D.ph[P3.ph])P3.ph=phs.includes('mid')?'mid':phs[0];
  return `<section class="p3" aria-label="${esc(tr('Assetto in pista in 3D'))}">
    <div class="p3h"><h4>${tr('Assetto in pista')}</h4><span class="muted small">${tr('mediane per fase dei giri scelti')}</span>
      <div class="seg" id="p3ph" role="group" aria-label="${esc(tr('Fase del giro'))}">${VD_POSE_PH.map(k=>`<button type="button" data-ph="${k}" aria-pressed="${k===P3.ph}"${D.ph[k]?'':' disabled'}>${tr(P3_PHN[k])}</button>`).join('')}</div>
      <button type="button" class="btn" id="p3ex" aria-pressed="${P3.E===5}" title="${esc(tr('Le altezze vere sono di pochi millimetri: ingrandisce solo i movimenti, i numeri restano quelli misurati'))}">${P3.E===5?tr('Movimenti ×5'):tr('Movimenti reali')}</button></div>
    <div class="p3g"><div class="p3s" id="p3s"><canvas id="p3cv" aria-label="${esc(tr('Auto in 3D: trascina per ruotare'))}"></canvas><canvas id="p3ov" aria-hidden="true"></canvas>
      <div class="p3v" role="group" aria-label="${esc(tr('Vista'))}">${Object.entries(P3_VIEWS).map(([k,v])=>`<button type="button" class="btn" data-v="${k}" aria-pressed="${P3.view===k}">${tr(v[2])}</button>`).join('')}</div></div>
      <aside class="p3side" id="p3side" aria-live="polite"></aside></div>
    <p class="muted small p3note">${tr('Sagoma semplificata di una hypercar a ruote coperte, uguale per tutte le auto. Le altezze sono quelle delle quattro ruote; le gomme mostrano esterno, centro e interno del battistrada (da 60 a 110 °C); le aste chiare sono le sospensioni.')}</p></section>`;}
function p3Side(D){const A=D.ph[P3.ph];if(!A)return '';const f=(v,d=0)=>Number.isFinite(v)?fx(v,d):'—';const sg=v=>Number.isFinite(v)?(v>0?'+':v<0?'−':'')+fx(Math.abs(v),1):'—';
  const rakeDeg=Number.isFinite(A.rake)?Math.atan(A.rake/1000/P3_WB)*180/Math.PI:NaN;
  const roll=Number.isFinite(A.roll)?`<b>${f(Math.abs(A.roll),1)}<small>°</small></b><span>${tr('rollio')}${A.roll>0.05?' '+tr('a sinistra'):A.roll<-0.05?' '+tr('a destra'):''}</span>`
    :`<b>${f(Math.abs(A.side),1)}<small>mm</small></b><span>${!Number.isFinite(A.side)?tr('differenza tra i lati'):Math.abs(A.side)<0.5?tr('i due lati alla stessa altezza'):tr('lato')+' '+(A.side>0?tr('sinistro'):tr('destro'))+' '+tr('più basso')}</span>`;
  const wheel=w=>{const t=A.t[w]||[];const order=w.endsWith('L')?[2,1,0]:[0,1,2];const nm=['interno','centro','esterno'];
    return `<div class="p3w"><div class="p3wt"><span>${w}</span><b>${f(A.rh[w],1)}<small>mm</small></b></div><div class="p3wb">${order.map(j=>`<i style="background:${p3Css(t[j])}" title="${esc(tr(nm[j]))}">${f(t[j])}</i>`).join('')}</div>
      <div class="p3ws">${tr('sosp.')} ${D.have.susp?sg(A.comp[w])+' mm':'—'}</div></div>`;};
  return `<div class="muted small">${tr(P3_PHN[P3.ph])} · ${f(A.v)} km/h ${tr('mediana')}</div>
    <div class="p3big"><div><b>${f(A.rhF,1)}<small>mm</small></b><span>${tr('altezza ant.')}</span></div><div><b>${f(A.rhR,1)}<small>mm</small></b><span>${tr('altezza post.')}</span></div></div>
    <div class="p3row"><div class="p3rake"><b>${f(A.rake,1)}<small>mm</small></b><span>rake${Number.isFinite(rakeDeg)?' · '+fx(rakeDeg,2)+'° '+tr('con passo di 3,15 m'):''}</span></div><div>${roll}</div></div>
    <div><div class="muted small" style="margin-bottom:6px">${tr('Altezza, gomme (est · centro · int dal bordo) e sospensione rispetto alla mediana del giro (+ = più compressa)')}</div><div class="p3ws4">${['FL','FR','RL','RR'].map(wheel).join('')}</div></div>
    ${D.have.susp?'':`<div class="muted small">${tr('Sospensioni: segno di compressione non verificato su tutte le ruote, valori non mostrati')}</div>`}`;}
function p3Mount(S,X){const host=$('#p3s');if(!host)return;let D;try{D=vdPose(S,X.laps);}catch(e){return;}P3.data=D;
  const side=$('#p3side');const paint=()=>{if(side)side.innerHTML=p3Side(D);};paint();
  // one WebGL context at a time: free the previous one before taking a new canvas
  try{P3.gl?.gl.getExtension('WEBGL_lose_context')?.loseContext();}catch(e){}P3.gl=null;
  const cv=$('#p3cv');P3.gl=cv?p3GL(cv):null;if(!P3.gl){host.classList.add('nogl');host.innerHTML=`<p class="muted small">${tr('La vista 3D richiede WebGL, non disponibile in questo browser: restano i valori misurati a destra')}</p>`;return;}
  P3.cur=p3State(D.ph[P3.ph]);p3Draw();if(document.fonts)document.fonts.ready.then(p3Draw);
  const RM=()=>!(typeof MOTION_OK==='function'?MOTION_OK():true);
  const go=k=>{if(k===P3.ph||!D.ph[k])return;const from=P3.cur,to=p3State(D.ph[k]);P3.ph=k;$$('#p3ph button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ph===k));paint();
    cancelAnimationFrame(P3.anim);if(RM()){P3.cur=to;p3Draw();return;}
    // the car moves to the next phase: 320 ms, strong ease-out; a new click starts from where it is
    const t0=performance.now(),dur=320,ease=t=>1-Math.pow(1-t,4);const step=now=>{const k_=Math.min(1,(now-t0)/dur);P3.cur=p3Lerp(from,to,ease(k_));p3Draw();if(k_<1)P3.anim=requestAnimationFrame(step);};P3.anim=requestAnimationFrame(step);};
  $$('#p3ph button').forEach(b=>b.onclick=()=>go(b.dataset.ph));
  $('#p3ex').onclick=()=>{P3.E=P3.E===5?1:5;const b=$('#p3ex');b.setAttribute('aria-pressed',P3.E===5);b.textContent=P3.E===5?tr('Movimenti ×5'):tr('Movimenti reali');p3Draw();};
  $$('#p3s .p3v button').forEach(b=>b.onclick=()=>{P3.view=b.dataset.v;[P3.yaw,P3.el]=P3_VIEWS[P3.view];$$('#p3s .p3v button').forEach(x=>x.setAttribute('aria-pressed',x===b));p3Draw();});
  // drag to orbit: follows the pointer 1:1, no inertia
  let drag=null;host.onpointerdown=e=>{if(e.target.closest('button'))return;drag={x:e.clientX,y:e.clientY,yaw:P3.yaw,el:P3.el};host.setPointerCapture(e.pointerId);};
  host.onpointermove=e=>{if(!drag)return;P3.yaw=drag.yaw-(e.clientX-drag.x)*0.008;P3.el=Math.max(0.02,Math.min(1.5,drag.el+(e.clientY-drag.y)*0.006));P3.view='';$$('#p3s .p3v button').forEach(x=>x.setAttribute('aria-pressed','false'));p3Draw();};
  host.onpointerup=host.onpointercancel=()=>drag=null;
  if(window.ResizeObserver){P3.ro?.disconnect();P3.ro=new ResizeObserver(()=>p3Draw());P3.ro.observe(host);}}

(function(){const st=document.createElement('style');st.textContent=`
.p3{margin:4px 0 20px;border:1px solid var(--line);border-radius:4px;background:var(--panel)}
.p3h{display:flex;align-items:center;gap:12px 16px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--line)}
.p3h h4{margin:0}.p3h .seg{margin-left:auto}
.p3g{display:grid;grid-template-columns:minmax(0,1fr) 320px}
.p3s{position:relative;min-height:400px;border-right:1px solid var(--line);touch-action:none;cursor:grab}.p3s:active{cursor:grabbing}
.p3s canvas{display:block;width:100%;height:400px}.p3s #p3ov{position:absolute;left:0;top:0;pointer-events:none}
.p3s.nogl{min-height:0;cursor:default;padding:16px}
.p3v{position:absolute;left:12px;bottom:12px;display:flex;gap:4px;flex-wrap:wrap}.p3v .btn{height:30px;padding:0 10px}
.p3v .btn[aria-pressed="true"],#p3ex[aria-pressed="true"]{background:var(--panel2);color:var(--ink)}
.p3side{padding:14px 16px;display:flex;flex-direction:column;gap:16px}
.p3big{display:flex;gap:28px}.p3big b,.p3row b{display:block;font:500 2.2rem/1 var(--f-timing,var(--f-mono));font-variant-numeric:tabular-nums}
.p3row{display:flex;gap:24px}.p3row b{font-size:1.5rem;line-height:1.1}.p3rake b{color:var(--pacc)}
.p3big small,.p3row small{font-size:.5em;color:var(--muted);margin-left:3px}.p3big span,.p3row span{color:var(--muted);font-size:.82rem}
.p3ws4{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.p3w{background:var(--panel2);border-radius:4px;padding:8px 10px}
.p3wt{display:flex;justify-content:space-between;align-items:baseline}.p3wt span{font-weight:600;font-size:.86rem}
.p3wt b{font:500 1.15rem var(--f-timing,var(--f-mono));font-variant-numeric:tabular-nums}.p3wt small{font-size:.75em;color:var(--muted);margin-left:2px}
.p3wb{display:flex;gap:2px;margin-top:6px}.p3wb i{flex:1;height:18px;border-radius:2px;font:400 11px/18px var(--f-mono);font-style:normal;text-align:center;color:#0C0D0F}
.p3ws{margin-top:4px;font-size:.78rem;color:var(--muted);font-variant-numeric:tabular-nums}
.p3note{margin:0;padding:10px 16px;border-top:1px solid var(--line)}
@media (max-width:900px){.p3h .seg{flex-wrap:wrap}.p3g{grid-template-columns:1fr}.p3s{border-right:0;border-bottom:1px solid var(--line);min-height:300px}.p3s canvas{height:300px}.p3h .seg{margin-left:0}}`;document.head.appendChild(st);})();
