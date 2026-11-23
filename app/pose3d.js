// ================= 3D POSE OF THE CAR (Analisi tecnica › Piattaforma e aero) =================
// The car, drawn with a few WebGL boxes, sits on the four ride heights measured in each phase of the lap (medians of
// vdPose in vdyn.js); the tyres show the inner / centre / outer temperatures. Movements can be enlarged ×5 because the
// real ones are a few millimetres; the numbers on the side are always the measured ones.
// A small WebGL renderer written for this view (no library): flat-shaded faces, depth buffer, labels on a 2D canvas.
// Without WebGL the numbers stay and the drawing is left out.
const P3={ph:'mid',E:5,view:'tq',yaw:2.35,el:0.30,cur:null,gl:null,anim:0};
const P3_VIEWS={tq:[2.35,0.30,'3/4'],side:[Math.PI/2,0.05,'Laterale'],front:[Math.PI,0.08,'Frontale'],top:[Math.PI/2,1.45,'Dall\'alto']};
const P3_PHN={str:'Rettilineo',brk:'Frenata',ent:'Inserimento',mid:'Appoggio',ext:'Uscita'};
// proportions of a closed-wheel hypercar (metres): x left(−)/right(+), y up, z rear(−)/front(+)
const P3_WB=3.15,P3_TF=1.70,P3_TR=1.66,P3_RW=0.36;
const P3_WH={FL:{x:-P3_TF/2,z:P3_WB/2,w:.31},FR:{x:P3_TF/2,z:P3_WB/2,w:.31},RL:{x:-P3_TR/2,z:-P3_WB/2,w:.34},RR:{x:P3_TR/2,z:-P3_WB/2,w:.34}};

function p3Box(x,y,z,w,h,l,c){const a=[x-w/2,y,z-l/2],b=[x+w/2,y+h,z+l/2];const P=(i,j,k)=>[[a[0],b[0]][i],[a[1],b[1]][j],[a[2],b[2]][k]];
  return [[P(0,0,0),P(1,0,0),P(1,1,0),P(0,1,0)],[P(1,0,1),P(0,0,1),P(0,1,1),P(1,1,1)],[P(0,0,1),P(0,0,0),P(0,1,0),P(0,1,1)],
          [P(1,0,0),P(1,0,1),P(1,1,1),P(1,1,0)],[P(0,1,0),P(1,1,0),P(1,1,1),P(0,1,1)],[P(0,0,1),P(1,0,1),P(1,0,0),P(0,0,0)]].map(p=>({p,c}));}
// a box whose top slopes from h0 (rear) to h1 (front)
function p3Wedge(x,y,z,w,h0,h1,l,c){const f=p3Box(x,y,z,w,1,l,c);f.forEach(q=>q.p=q.p.map(([px,py,pz])=>[px,py>y?y+(pz>z?h1:h0):py,pz]));return f;}
// the sprung body; y measured from the floor bottom. Proportions of a closed-wheel LMDh hypercar (from the user's reference
// photos): wide splitter ahead of a low nose, tall front fenders with the mirrors on top, closed cockpit with a roof scoop,
// a long dorsal fin to a high rear wing, tall rear fenders. Shape only: no livery, no logos, no brand lights.
const P3_BODY=[].concat(
  p3Box(0,0,0.05,1.94,0.04,4.50,'#2B2D32'),                                    // floor / plank
  p3Box(0,0,2.38,1.96,0.03,0.50,'#26282C'),                                    // splitter
  p3Wedge(0,0.04,1.72,1.02,0.40,0.12,1.35,'#3A3D43'),                          // nose, rising to the cockpit
  p3Wedge(-0.70,0.04,1.52,0.48,0.72,0.46,1.30,'#3A3D43'),p3Wedge(0.70,0.04,1.52,0.48,0.72,0.46,1.30,'#3A3D43'), // front fenders
  p3Box(-0.66,0.76,1.02,0.10,0.05,0.12,'#202226'),p3Box(0.66,0.76,1.02,0.10,0.05,0.12,'#202226'),               // mirrors
  p3Wedge(0,0.04,0.15,1.00,0.56,0.48,2.10,'#33363B'),                          // tub
  p3Wedge(0,0.60,0.30,0.72,0.40,0.14,1.55,'#202226'),                          // canopy
  p3Box(0,0.98,0.05,0.18,0.09,0.36,'#2B2D32'),                                 // roof scoop
  p3Wedge(-0.62,0.04,-0.30,0.40,0.32,0.30,1.40,'#33363B'),p3Wedge(0.62,0.04,-0.30,0.40,0.32,0.30,1.40,'#33363B'), // sidepods
  p3Wedge(-0.68,0.04,-1.55,0.46,0.60,0.56,1.30,'#3A3D43'),p3Wedge(0.68,0.04,-1.55,0.46,0.60,0.56,1.30,'#3A3D43'), // rear fenders
  p3Wedge(0,0.04,-1.40,1.10,0.56,0.60,1.60,'#33363B'),                         // engine cover
  p3Wedge(0,0.60,-1.30,0.04,0.48,0.30,1.75,'#2B2D32'),                         // dorsal fin
  p3Box(0,0.64,-2.20,0.04,0.38,0.26,'#26282C'),                                // wing support
  p3Box(-0.93,0.62,-2.32,0.03,0.48,0.52,'#2B2D32'),p3Box(0.93,0.62,-2.32,0.03,0.48,0.52,'#2B2D32'),               // endplates
  p3Box(0,1.02,-2.34,1.86,0.04,0.42,'#3A3D43'),                                // rear wing
  p3Box(0,0.04,-2.28,1.70,0.18,0.34,'#26282C'));                               // diffuser
// tyre temperature scale, the same steps as the rest of the app (cold blue → ok green → hot red)
const P3_STOPS=[[60,[91,141,239]],[75,[79,179,200]],[87,[76,195,138]],[100,[242,194,48]],[110,[229,72,77]]];
function p3Heat(t){if(!Number.isFinite(t))return [0.17,0.18,0.2];if(t<=P3_STOPS[0][0])return P3_STOPS[0][1].map(v=>v/255);
  for(let i=1;i<P3_STOPS.length;i++)if(t<=P3_STOPS[i][0]){const [t0,c0]=P3_STOPS[i-1],[t1,c1]=P3_STOPS[i];const f=(t-t0)/(t1-t0);return c0.map((v,j)=>(v+(c1[j]-v)*f)/255);}
  return P3_STOPS[P3_STOPS.length-1][1].map(v=>v/255);}
const p3Css=t=>Number.isFinite(t)?'rgb('+p3Heat(t).map(v=>Math.round(v*255)).join(',')+')':'var(--panel2)';
function p3Wheel(k,temps){const w=P3_WH[k],N=20,out=[];const left=w.x<0;
  // across the tread from −x to +x: a left wheel goes outer → inner, a right wheel inner → outer
  const [I,C,E]=temps||[NaN,NaN,NaN];const band=left?[E,C,I]:[I,C,E];
  for(let s=0;s<N;s++){const a0=s/N*2*Math.PI,a1=(s+1)/N*2*Math.PI;const y0=P3_RW+P3_RW*Math.sin(a0),z0=w.z+P3_RW*Math.cos(a0),y1=P3_RW+P3_RW*Math.sin(a1),z1=w.z+P3_RW*Math.cos(a1);
    for(let i=0;i<3;i++){const x0=w.x-w.w/2+i*w.w/3,x1=x0+w.w/3;out.push({p:[[x0,y0,z0],[x1,y0,z0],[x1,y1,z1],[x0,y1,z1]],rgb:p3Heat(band[i]),tread:1});}}
  [w.x-w.w/2,w.x+w.w/2].forEach(x=>{const disc=r=>{const p=[];for(let s=0;s<N;s++){const a=s/N*2*Math.PI;p.push([x,P3_RW+r*Math.sin(a),w.z+r*Math.cos(a)]);}return p;};
    out.push({p:disc(P3_RW),c:'#141518'});out.push({p:disc(P3_RW*.55).map(([x_,y,z])=>[x_+(x<w.x?-0.002:0.002),y,z]),c:'#2B2D32'});});
  return out;}

// ---------- pose: floor height at (x,z) from the four ride heights (bilinear), movements ×E ----------
function p3State(ph){const r=ph?.rh||{};const fb=Number.isFinite(ph?.rhF)&&Number.isFinite(ph?.rhR)?null:30;
  const v=w=>Number.isFinite(r[w])?r[w]:Number.isFinite(w[0]==='F'?ph?.rhF:ph?.rhR)?(w[0]==='F'?ph.rhF:ph.rhR):(fb??30);
  return {rh:{FL:v('FL'),FR:v('FR'),RL:v('RL'),RR:v('RR')},t:Object.fromEntries(VD_W.map(w=>[w,(ph?.t?.[w]||[NaN,NaN,NaN]).slice()]))};}
function p3Lerp(a,b,f){const L=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?x+(y-x)*f:y;
  return {rh:Object.fromEntries(VD_W.map(w=>[w,L(a.rh[w],b.rh[w])])),t:Object.fromEntries(VD_W.map(w=>[w,b.t[w].map((v,i)=>L(a.t[w][i],v))]))};}
function p3Floor(st,x,z){const u=(x+P3_TF/2)/P3_TF,v=(z+P3_WB/2)/P3_WB;const r=st.rh;
  const h=(r.RL*(1-u)+r.RR*u)*(1-v)+(r.FL*(1-u)+r.FR*u)*v;return h/1000*P3.E;}

// ---------- WebGL ----------
const p3Sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],p3Dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],p3Crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],p3Nrm=a=>{const m=Math.hypot(...a)||1;return a.map(x=>x/m);};
const P3_LIGHT=p3Nrm([-0.45,0.85,0.35]),P3_TARGET=[0,0.18,0.2];
function p3Rgb(c){const n=parseInt(c.slice(1),16);return [(n>>16)/255,(n>>8&255)/255,(n&255)/255];}
function p3GL(cv){const gl=cv.getContext('webgl',{antialias:true,alpha:true});if(!gl)return null;
  const sh=(t,src)=>{const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);return o;};
  const prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec3 c;uniform mat4 m;varying vec3 vc;void main(){vc=c;gl_Position=m*vec4(p,1.0);}'));
  gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 vc;void main(){gl_FragColor=vec4(vc,1.0);}'));gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return null;gl.useProgram(prog);gl.enable(gl.DEPTH_TEST);
  const o={gl,bP:gl.createBuffer(),bC:gl.createBuffer(),aP:gl.getAttribLocation(prog,'p'),aC:gl.getAttribLocation(prog,'c'),uM:gl.getUniformLocation(prog,'m')};
  gl.enableVertexAttribArray(o.aP);gl.enableVertexAttribArray(o.aC);return o;}
function p3Eye(){const D=8.2*Math.max(1,1.9/(P3.aspect||3));return [P3_TARGET[0]+D*Math.cos(P3.el)*Math.sin(P3.yaw),P3_TARGET[1]+D*Math.sin(P3.el),P3_TARGET[2]-D*Math.cos(P3.el)*Math.cos(P3.yaw)];}
function p3Matrix(w,h){const e=p3Eye(),zf=p3Nrm(p3Sub(e,P3_TARGET)),xr=p3Nrm(p3Crs([0,1,0],zf)),yu=p3Crs(zf,xr);
  const V=[xr[0],yu[0],zf[0],0, xr[1],yu[1],zf[1],0, xr[2],yu[2],zf[2],0, -p3Dot(xr,e),-p3Dot(yu,e),-p3Dot(zf,e),1];
  const f=1/Math.tan(0.21),a=w/h,n=0.5,fa=40;const P=[f/a,0,0,0, 0,f,0,0, 0,0,(fa+n)/(n-fa),-1, 0,0,2*fa*n/(n-fa),0];
  const M=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)M[j*4+i]+=P[k*4+i]*V[j*4+k];return M;}
function p3Screen(M,p,w,h){const x=M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12],y=M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13],q=M[3]*p[0]+M[7]*p[1]+M[11]*p[2]+M[15];return [(x/q*0.5+0.5)*w,(1-(y/q*0.5+0.5))*h];}
function p3Draw(){const cv=$('#p3cv'),ov=$('#p3ov');if(!cv||!ov||!P3.gl||!P3.cur)return;const r=cv.getBoundingClientRect();if(!r.width)return;
  const dpr=devicePixelRatio||1,w=r.width,h=r.height;P3.aspect=w/h;const {gl,bP,bC,aP,aC,uM}=P3.gl;
  cv.width=ov.width=Math.round(w*dpr);cv.height=ov.height=Math.round(h*dpr);gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const st=P3.cur,eye=p3Eye(),M=p3Matrix(w,h),Pv=[],Cv=[];
  const face=(pts,col,k0,k1)=>{let n=p3Nrm(p3Crs(p3Sub(pts[1],pts[0]),p3Sub(pts[2],pts[0])));const cen=pts.reduce((s,p)=>[s[0]+p[0]/pts.length,s[1]+p[1]/pts.length,s[2]+p[2]/pts.length],[0,0,0]);
    if(p3Dot(n,p3Sub(eye,cen))<0)n=n.map(x=>-x);const k=k0+k1*Math.max(0,p3Dot(n,P3_LIGHT));const c=col.map(v=>Math.min(1,v*k));
    for(let i=1;i<pts.length-1;i++){Pv.push(...pts[0],...pts[i],...pts[i+1]);Cv.push(...c,...c,...c);}};
  face([[-3.2,-0.002,-3.6],[3.2,-0.002,-3.6],[3.2,-0.002,3.6],[-3.2,-0.002,3.6]],p3Rgb('#16171A'),1,0);
  P3_BODY.forEach(q=>face(q.p.map(([x,y,z])=>[x,y+p3Floor(st,x,z),z]),p3Rgb(q.c),0.55,0.8));
  VD_W.forEach(k=>p3Wheel(k,st.t[k]).forEach(q=>face(q.p,q.rgb||p3Rgb(q.c),q.tread?0.7:0.6,q.tread?0.4:0.6)));
  // suspension struts: hub (unsprung) to the body above it (sprung)
  VD_W.forEach(k=>{const wh=P3_WH[k];const x=wh.x+(wh.x<0?0.24:-0.24),y1=0.40+p3Floor(st,x,wh.z);p3Box(x,P3_RW,wh.z,0.035,Math.max(0.02,y1-P3_RW),0.035,'#C9CACD').forEach(q=>face(q.p,p3Rgb(q.c),0.8,0.3));});
  gl.bindBuffer(gl.ARRAY_BUFFER,bP);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(Pv),gl.DYNAMIC_DRAW);gl.vertexAttribPointer(aP,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,bC);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(Cv),gl.DYNAMIC_DRAW);gl.vertexAttribPointer(aC,3,gl.FLOAT,false,0,0);
  gl.uniformMatrix4fv(uM,false,new Float32Array(M));gl.drawArrays(gl.TRIANGLES,0,Pv.length/3);
  // overlay: ground grid, the floor line (rake) in flame, ride height at the axles with the measured value
  const ctx=ov.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.05)';
  for(let i=-6;i<=6;i++)[[[i*0.5,0,-3.6],[i*0.5,0,3.6]],[[-3,0,i*0.6],[3,0,i*0.6]]].forEach(([a,b])=>{const A=p3Screen(M,a,w,h),B=p3Screen(M,b,w,h);ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);ctx.stroke();});
  const fx=Math.sin(P3.yaw)>=0?0.97:-0.97;const fl=[[fx,p3Floor(st,fx,-2.15),-2.15],[fx,p3Floor(st,fx,2.3),2.3]].map(p=>p3Screen(M,p,w,h));
  if(Math.hypot(fl[0][0]-fl[1][0],fl[0][1]-fl[1][1])>140){ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--pacc').trim()||'#FF5A1F';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(fl[0][0],fl[0][1]);ctx.lineTo(fl[1][0],fl[1][1]);ctx.stroke();}
  const sx=fx*1.12,ga=p3Screen(M,[sx,0,P3_WB/2],w,h),gr=p3Screen(M,[sx,0,-P3_WB/2],w,h);
  const A=P3.data?.ph?.[P3.ph];
  if(A&&Math.abs(ga[0]-gr[0])>90)[['ant.',P3_WB/2,A.rhF,ga,gr],['post.',-P3_WB/2,A.rhR,gr,ga]].forEach(([n,z,v,g,o])=>{const t=p3Screen(M,[sx,p3Floor(st,sx,z),z],w,h);
    ctx.setLineDash([3,3]);ctx.strokeStyle='#73767C';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(g[0],g[1]);ctx.lineTo(t[0],t[1]);ctx.stroke();ctx.setLineDash([]);
    const t1=Number.isFinite(v)?fx_(v)+' mm':'—',t2=tr('altezza')+' '+n;ctx.font='400 12px "Titillium Web",sans-serif';const tw=Math.max(ctx.measureText(t2).width,40);
    // labels stay inside the canvas: flip to the other side of the line when they would run off the edge
    let right=g[0]>=o[0];if(right&&g[0]+10+tw>w-4)right=false;if(!right&&g[0]-10-tw<4)right=true;const lx=g[0]+(right?10:-10);ctx.textAlign=right?'left':'right';
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
