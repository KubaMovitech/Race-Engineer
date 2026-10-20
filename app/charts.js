// ================= CHARTS =================
// the workstation skin draws clean lines, the Muretto keeps the glow
function GL(){return document.documentElement.dataset.skin==='ws'?0:1;}
function tok(n){return getComputedStyle(document.documentElement).getPropertyValue('--'+n).trim()||'#888';}
function fitCanvas(cv,h){const dpr=window.devicePixelRatio||1,w=cv.clientWidth||cv.parentElement.clientWidth;if(h)cv.style.height=h+'px';const hh=cv.clientHeight||h;cv.width=Math.round(w*dpr);cv.height=Math.round(hh*dpr);const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return {c,w,h:hh};}
function niceTicks(lo,hi,n=4){const r=hi-lo||1,raw=r/n,p=Math.pow(10,Math.floor(Math.log10(raw))),m=raw/p,st=(m<1.5?1:m<3?2:m<7?5:10)*p;const out=[];for(let v=Math.ceil(lo/st)*st;v<=hi+1e-9;v+=st)out.push(+v.toFixed(6));return out;}

// Stacked panels sharing a distance axis — zoom (drag, wheel, buttons), pan (overview strip, shift-drag, touch), synced cursor
class Stack{
  constructor(cv,{onCursor,onZoom}={}){
    this.cv=cv;this.panels=[];this.x=null;this.range=null;this.cursor=null;this.onCursor=onCursor;this.onZoom=onZoom;this.marks=[];this.scale=1;this.ovH=38;
    const pos=e=>{const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
    let drag=null;
    cv.addEventListener('pointerdown',e=>{if(!this.x)return;const p=pos(e);cv.setPointerCapture(e.pointerId);
      if(p.y>this.plotH){drag={mode:'ov'};this.ovTo(p.x);return;}
      if(e.pointerType==='touch'||e.shiftKey||e.button===1){drag={mode:'pan',x:p.x,lo:this.lo,hi:this.hi};return;}
      drag={mode:'sel',x0:p.x,x1:p.x};});
    cv.addEventListener('pointermove',e=>{if(!this.x)return;const p=pos(e);
      if(drag?.mode==='ov'){this.ovTo(p.x);return;}
      if(drag?.mode==='pan'){const span=drag.hi-drag.lo,dx=(p.x-drag.x)/(this.w-this.padL-this.padR)*span;this.setRange(drag.lo-dx,drag.hi-dx);this.setCursorPx(p.x,true);return;}
      if(drag?.mode==='sel'){drag.x1=p.x;this.sel=drag;}
      if(p.y<=this.plotH)this.setCursorPx(p.x,true);});
    cv.addEventListener('pointerup',()=>{if(drag?.mode==='sel'&&Math.abs(drag.x1-drag.x0)>8){this.setRange(this.pxToX(Math.min(drag.x0,drag.x1)),this.pxToX(Math.max(drag.x0,drag.x1)));}drag=null;this.sel=null;this.draw();});
    cv.addEventListener('dblclick',()=>this.reset());
    cv.addEventListener('wheel',e=>{if(!this.x)return;e.preventDefault();const p=pos(e);
      if(Math.abs(e.deltaX)>Math.abs(e.deltaY)||e.shiftKey){const span=this.hi-this.lo,d=(e.shiftKey?e.deltaY:e.deltaX)/(this.w)*span;this.setRange(this.lo+d,this.hi+d);return;}
      this.zoomAt(this.pxToX(p.x),e.deltaY>0?1.25:0.8);},{passive:false});
    cv.addEventListener('pointerleave',()=>{if(!drag){this.cursor=null;this.draw();this.onCursor&&this.onCursor(null);}});
    new ResizeObserver(()=>this.draw()).observe(cv);
  }
  get full(){return [this.x[0],this.x[this.x.length-1]];}
  set(x,panels,marks=[],keepRange){this.x=x;this.panels=panels;this.marks=marks;if(!keepRange)this.range=null;this.cursor=null;this.draw();}
  setRange(a,b){const [f0,f1]=this.full;let span=Math.max(40,b-a);span=Math.min(span,f1-f0);if(a<f0){a=f0;}if(a+span>f1){a=f1-span;}this.range=span>=f1-f0-1?null:[a,a+span];this.draw();this.onZoom&&this.onZoom(this.range);}
  zoomAt(c,k){const lo=this.lo,hi=this.hi;this.setRange(c-(c-lo)*k,c+(hi-c)*k);}
  zoomIn(){this.zoomAt(this.cursor!=null?this.x[this.cursor]:(this.lo+this.hi)/2,0.6);} zoomOut(){this.zoomAt((this.lo+this.hi)/2,1.6);}
  pan(f){const s=this.hi-this.lo;this.setRange(this.lo+s*f,this.hi+s*f);}
  reset(){this.range=null;this.onZoom&&this.onZoom(null);this.draw();}
  ovTo(px){const [f0,f1]=this.full,L=this.padL,R=this.w-this.padR,c=f0+(Math.min(R,Math.max(L,px))-L)/(R-L)*(f1-f0),s=this.hi-this.lo;if(!this.range)return;this.setRange(c-s/2,c+s/2);}
  get lo(){return this.range?this.range[0]:this.x[0];} get hi(){return this.range?this.range[1]:this.x[this.x.length-1];}
  pxToX(px){const L=this.padL,R=this.w-this.padR;return this.lo+(Math.min(R,Math.max(L,px))-L)/(R-L)*(this.hi-this.lo);}
  xToPx(x){const L=this.padL,R=this.w-this.padR;return L+(x-this.lo)/(this.hi-this.lo)*(R-L);}
  idxOf(x){const a=this.x;let lo=0,hi=a.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(a[m]<x)lo=m;else hi=m;}return x-a[lo]<a[hi]-x?lo:hi;}
  setCursorPx(px,emit){if(!this.x)return;this.cursor=this.idxOf(this.pxToX(px));this.draw();if(emit&&this.onCursor)this.onCursor(this.cursor);}
  setCursorIdx(i){this.cursor=i;if(i!=null&&this.range&&(this.x[i]<this.lo||this.x[i]>this.hi)){const s=this.hi-this.lo;this.setRange(this.x[i]-s/2,this.x[i]+s/2);}else this.draw();}
  draw(){
    if(!this.x||!this.panels.length){return;}
    const hs=this.panels.map(p=>Math.round((p.h||110)*this.scale)),plotH=hs.reduce((a,b)=>a+b,0)+20,H=plotH+this.ovH+6;this.plotH=plotH;
    const {c,w,h}=fitCanvas(this.cv,H);this.w=w;this.padL=48;this.padR=12;
    const ink=tok('ink'),muted=tok('muted'),line=tok('line'),faint=tok('faint'),grid=tok('grid');
    c.clearRect(0,0,w,h);c.font='11px "JetBrains Mono",monospace';
    const i0=Math.max(0,this.idxOf(this.lo)-1),i1=Math.min(this.x.length-1,this.idxOf(this.hi)+1);
    let y=0;
    this.panels.forEach((p,pi)=>{
      const ph=hs[pi],top=y+8,bot=y+ph-4;
      let lo=Infinity,hi=-Infinity;
      if(p.min!=null&&p.max!=null){lo=p.min;hi=p.max;}
      else{for(const s of p.series){if(!s.data)continue;for(let i=i0;i<=i1;i++){const v=s.data[i];if(Number.isFinite(v)){if(v<lo)lo=v;if(v>hi)hi=v;}}}
        if(p.zero){lo=Math.min(lo,0);hi=Math.max(hi,0);if(p.sym){const m=Math.max(Math.abs(lo),Math.abs(hi));lo=-m;hi=m;}}
        const pad=(hi-lo)*0.08||1;lo-=pad;hi+=pad;}
      if(!Number.isFinite(lo)){lo=0;hi=1;}
      const Y=v=>bot-(v-lo)/(hi-lo)*(bot-top);
      if(pi%2===1){c.fillStyle=tok('band');c.fillRect(this.padL,y+2,w-this.padL-this.padR,ph-2);}
      c.strokeStyle=grid;c.lineWidth=1;c.fillStyle=faint;c.textAlign='right';c.textBaseline='middle';
      niceTicks(lo,hi,Math.max(2,Math.round(ph/45))).forEach(t=>{const yy=Math.round(Y(t))+0.5;if(yy<top||yy>bot)return;c.beginPath();c.moveTo(this.padL,yy);c.lineTo(w-this.padR,yy);c.stroke();c.fillText(t,this.padL-6,yy);});
      if(p.zero){c.strokeStyle=faint;c.beginPath();c.moveTo(this.padL,Math.round(Y(0))+.5);c.lineTo(w-this.padR,Math.round(Y(0))+.5);c.stroke();}
      c.save();c.beginPath();c.rect(this.padL,top-4,w-this.padL-this.padR,bot-top+6);c.clip();
      this.marks.forEach(m=>{if(m.x<this.lo||m.x>this.hi)return;const xx=Math.round(this.xToPx(m.x))+.5;c.strokeStyle=line;c.setLineDash([2,4]);c.beginPath();c.moveTo(xx,top);c.lineTo(xx,bot);c.stroke();c.setLineDash([]);});
      p.series.forEach(s=>{if(!s.data)return;c.strokeStyle=s.color;c.lineWidth=s.w||1.6;c.globalAlpha=s.alpha||1;c.shadowColor=s.color;c.shadowBlur=(s.alpha||1)>=.9?6*GL():0;c.beginPath();let started=false,prevY=null;
        const stepN=Math.max(1,Math.floor((i1-i0)/(w*1.5)));
        for(let i=i0;i<=i1;i+=stepN){const v=s.data[i];if(!Number.isFinite(v)){started=false;continue;}const xx=this.xToPx(this.x[i]),yy=Y(v);
          if(!started){c.moveTo(xx,yy);started=true;}else{if(s.step&&prevY!=null)c.lineTo(xx,prevY);c.lineTo(xx,yy);}prevY=yy;}
        c.stroke();
        if(s.fill){const z=Y(Math.min(hi,Math.max(lo,0)));c.lineTo(this.xToPx(this.x[i1]),z);c.lineTo(this.xToPx(this.x[i0]),z);c.closePath();c.globalAlpha=0.14;c.fillStyle=s.color;c.fill();}
        c.globalAlpha=1;c.shadowBlur=0;
        if(this.cursor!=null&&this.cursor>=i0&&this.cursor<=i1&&Number.isFinite(s.data[this.cursor])){const xx=this.xToPx(this.x[this.cursor]),yy=Y(s.data[this.cursor]);c.fillStyle=s.color;c.strokeStyle='#05070A';c.lineWidth=1.5;c.beginPath();c.arc(xx,yy,3.5,0,7);c.fill();c.stroke();}});
      c.restore();
      c.textAlign='left';c.textBaseline='top';c.font='600 11.5px "Barlow Condensed",sans-serif';const lab=p.label.toUpperCase();
      const lw=c.measureText(lab).width;c.fillStyle=tok('panel');c.globalAlpha=.85;c.fillRect(this.padL+2,top-5,lw+8,15);c.globalAlpha=1;c.fillStyle=muted;c.fillText(lab,this.padL+6,top-3);c.font='11px "JetBrains Mono",monospace';
      if(this.cursor!=null){let xx=this.padL+6+lw+16;p.series.forEach(s=>{if(!s.data)return;const v=s.data[this.cursor];const txt=(s.name?s.name+' ':'')+(Number.isFinite(v)?(p.fmt?p.fmt(v):v.toFixed(p.dp??0)):'—');const tw=c.measureText(txt).width;c.fillStyle=tok('panel');c.globalAlpha=.85;c.fillRect(xx-3,top-5,tw+6,15);c.globalAlpha=1;c.fillStyle=s.color;c.fillText(txt,xx,top-3);xx+=tw+14;});}
      y+=ph;
    });
    // mark labels on top
    c.font='600 10.5px "Barlow Condensed",sans-serif';c.textAlign='center';c.textBaseline='top';
    this.marks.forEach(m=>{if(!m.label||m.x<this.lo||m.x>this.hi)return;const xx=this.xToPx(m.x);c.fillStyle=faint;c.fillText(m.label,xx,y+2);});
    // x axis ticks
    c.font='11px "JetBrains Mono",monospace';c.fillStyle=faint;c.textBaseline='top';
    niceTicks(this.lo,this.hi,Math.max(3,Math.round(w/150))).forEach(t=>{const xx=this.xToPx(t);if(xx<this.padL+20||xx>w-this.padR-10)return;c.textAlign='center';c.fillText(t+' m',xx,y+2+(this.marks.some(m=>m.label)?0:0));});
    // overview strip
    const oy=plotH+4,oh=this.ovH-6,[f0,f1]=this.full,OX=v=>this.padL+(v-f0)/(f1-f0)*(w-this.padL-this.padR);
    c.fillStyle=tok('panel2');c.fillRect(this.padL,oy,w-this.padL-this.padR,oh);
    const ov=this.panels.find(p=>p.overview)||this.panels[0];const sd=ov.series.find(s=>s.data);
    if(sd){let lo=Infinity,hi=-Infinity;for(const v of sd.data)if(Number.isFinite(v)){lo=Math.min(lo,v);hi=Math.max(hi,v);}c.strokeStyle=faint;c.lineWidth=1;c.beginPath();const st=Math.max(1,Math.floor(this.x.length/w));for(let i=0;i<this.x.length;i+=st){const xx=OX(this.x[i]),yy=oy+oh-2-(sd.data[i]-lo)/((hi-lo)||1)*(oh-4);i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.stroke();}
    if(this.range){const a=OX(this.lo),b=OX(this.hi);c.fillStyle=tok('accent');c.globalAlpha=.18;c.fillRect(a,oy,b-a,oh);c.globalAlpha=1;c.strokeStyle=tok('accent');c.lineWidth=1.5;c.strokeRect(a+.5,oy+.5,b-a-1,oh-1);}
    c.fillStyle=faint;c.textAlign='right';c.textBaseline='middle';c.font='600 10px "Barlow Condensed",sans-serif';
    if(this.cursor!=null){const xx=Math.round(this.xToPx(this.x[this.cursor]))+.5;c.strokeStyle=ink;c.globalAlpha=.6;c.lineWidth=1;c.beginPath();c.moveTo(xx,0);c.lineTo(xx,y);c.stroke();c.globalAlpha=1;
      const ox=OX(this.x[this.cursor]);c.strokeStyle=tok('accent');c.beginPath();c.moveTo(ox,oy);c.lineTo(ox,oy+oh);c.stroke();}
    if(this.sel){c.fillStyle=tok('accent');c.globalAlpha=.15;c.fillRect(Math.min(this.sel.x0,this.sel.x1),0,Math.abs(this.sel.x1-this.sel.x0),y);c.globalAlpha=1;}
  }
}

// Track map from GPS
const MAPVIEW={};
function mapKey(venue){return 'map:'+venue;}
function getMapView(venue){if(MAPVIEW[venue])return MAPVIEW[venue];let v={rot:0,flip:false};try{const s=localStorage.getItem(mapKey(venue));if(s)v=JSON.parse(s);}catch(e){}MAPVIEW[venue]=v;return v;}
function saveMapView(venue){try{localStorage.setItem(mapKey(venue),JSON.stringify(MAPVIEW[venue]));}catch(e){}}
class TrackMap{
  // GPS map: free zoom and pan (wheel, drag, double click = whole track), corner numbers that zoom on the corner,
  // a second line (reference lap) and the distance between the two lines at the cursor
  constructor(cv,{onCursor}={}){
    this.cv=cv;this.onCursor=onCursor;this.cursor=null;this.zoomFit=false;this.vz=null;
    const pos=e=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};let drag=null;
    cv.addEventListener('pointerdown',e=>{if(!this.P)return;const [x,y]=pos(e);const hit=this.hitCorner(x,y);if(hit){this.zoomTo(hit.i,7);return;}drag={x,y,v:this.vz?{...this.vz}:{k:1,dx:0,dy:0},moved:false};cv.setPointerCapture(e.pointerId);});
    cv.addEventListener('pointermove',e=>{if(!this.P)return;const [x,y]=pos(e);
      if(drag){const ddx=x-drag.x,ddy=y-drag.y;if(Math.abs(ddx)+Math.abs(ddy)>3)drag.moved=true;if(drag.moved){this.vz={k:drag.v.k,dx:drag.v.dx+ddx,dy:drag.v.dy+ddy};this.draw();return;}}
      cv.style.cursor=this.hitCorner(x,y)?'pointer':(drag?'grabbing':'crosshair');
      let bi=-1,bd=900;const [i0,i1]=this.fitWin||[0,this.P.length-1];for(let i=i0;i<=i1;i++){const dx=this.P[i][0]-x,dy=this.P[i][1]-y,d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i;}}
      if(bi>=0){this.cursor=bi;this.draw();this.onCursor&&this.onCursor(bi);}});
    cv.addEventListener('pointerup',()=>{drag=null;});
    cv.addEventListener('pointerleave',()=>{if(drag)return;this.cursor=null;this.draw();this.onCursor&&this.onCursor(null);});
    cv.addEventListener('wheel',e=>{if(!this.P)return;e.preventDefault();const [x,y]=pos(e);this.zoomAround(x,y,e.deltaY>0?1/1.3:1.3);},{passive:false});
    cv.addEventListener('dblclick',()=>{this.vz=null;this.draw();});
    new ResizeObserver(()=>this.draw()).observe(cv);
    // small zoom buttons over the map
    const host=cv.parentElement;if(host&&!host.querySelector('.mapzoom')){if(getComputedStyle(host).position==='static')host.style.position='relative';
      const z=document.createElement('div');z.className='mapzoom';z.innerHTML='<button type="button" data-z="in" title="Zoom +">+</button><button type="button" data-z="out" title="Zoom −">−</button><button type="button" data-z="fit" title="Pista intera">⤢</button><button type="button" data-z="big" title="Mappa grande">⛶</button>';
      host.appendChild(z);this.zbox=z;z.querySelectorAll('button').forEach(b=>b.onclick=()=>{const r=cv.getBoundingClientRect();if(b.dataset.z==='big'){const pn=cv.closest('.panel');if(pn){pn.classList.toggle('mapfull');document.body.classList.toggle('hasmapfull',pn.classList.contains('mapfull'));this.vz=null;setTimeout(()=>this.draw(),30);}return;}if(b.dataset.z==='fit'){this.vz=null;this.draw();}else this.zoomAround(r.width/2,r.height/2,b.dataset.z==='in'?1.6:1/1.6);});}
  }
  set(lat,lon,colors,venue,extra,overlay){const same=this.venue===venue&&this.lat&&this.lat.length===lat?.length;this.lat=lat;this.lon=lon;this.colors=colors;this.venue=venue;this.extra=extra||[];this.overlay=overlay||null;if(!same)this.vz=null;this.draw();}
  setOverlay(o){this.overlay=o||null;this.draw();}
  setCursorIdx(i){this.cursor=i;this.draw();}
  setWindow(w){this.win=w;this.draw();}
  zoomAround(x,y,f){const v=this.vz||{k:1,dx:0,dy:0};const k=Math.max(1,Math.min(60,v.k*f));const r=k/v.k;this.vz={k,dx:x-(x-v.dx)*r,dy:y-(y-v.dy)*r};if(k<=1.001)this.vz=null;this.draw();}
  zoomTo(i,k){if(!this.B||!this.B[i])return;const v={k:1,dx:0,dy:0};const [bx,by]=this.B[i];const w=this.cv.clientWidth,h=this.cv.clientHeight;this.vz={k,dx:w/2-bx*k,dy:h/2-by*k};this.draw();}
  hitCorner(x,y){if(!this.P)return null;for(const m of this.extra){const p=this.P[m.i];if(p&&Math.abs(p[0]-x)<10&&Math.abs(p[1]-y)<10)return m;}return null;}
  // metres between the two lines at index i, + when B runs to the left of A
  lineGap(i){const o=this.overlay;if(!o||!this.M||!this.M2)return null;const A=this.M,Bm=this.M2;if(!A[i])return null;let bj=-1,bd=Infinity;const j0=Math.max(0,i-60),j1=Math.min(Bm.length-1,i+60);
    for(let j=j0;j<=j1;j++){const q=Bm[j];if(!q)continue;const d=(q[0]-A[i][0])**2+(q[1]-A[i][1])**2;if(d<bd){bd=d;bj=j;}}if(bj<0)return null;
    const a0=A[Math.max(0,i-2)],a1=A[Math.min(A.length-1,i+2)];if(!a0||!a1)return null;const tx=a1[0]-a0[0],ty=a1[1]-a0[1];const q=Bm[bj];const cr=tx*(q[1]-A[i][1])-ty*(q[0]-A[i][0]);
    // which way the corner turns here: inside / outside reads better than left / right
    const b0=A[Math.max(0,i-12)],b1=A[Math.min(A.length-1,i+12)];let turn=0;if(b0&&b1){const h0=Math.atan2(A[i][1]-b0[1],A[i][0]-b0[0]),h1=Math.atan2(b1[1]-A[i][1],b1[0]-A[i][0]);let d=h1-h0;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;turn=Math.abs(d)>0.12?(d<0?1:-1):0;}
    return {m:Math.sqrt(bd),left:cr<0,inside:turn?((cr<0)===(turn>0)):null};}
  draw(){
    if(!this.lat)return;const {c,w,h}=fitCanvas(this.cv);const n=this.lat.length,view=getMapView(this.venue);
    if(this.zbox){this.zbox.style.top=(this.cv.offsetTop+8)+'px';this.zbox.style.left=(this.cv.offsetLeft+this.cv.offsetWidth-38)+'px';}
    const ang=view.rot*Math.PI/2,ca=Math.cos(ang),sa=Math.sin(ang);
    let lat0=0,k0=0;for(let i=0;i<n;i+=10)if(Number.isFinite(this.lat[i])){lat0+=this.lat[i];k0++;}lat0=k0?lat0/k0:0;const kx=Math.cos(lat0*Math.PI/180)*111320,ky=111320;
    // metres, rotated as the user saved the view
    const proj=(la,lo)=>{const out=new Array(la.length);for(let i=0;i<la.length;i++){if(!Number.isFinite(la[i])||!Number.isFinite(lo[i])||(la[i]===0&&lo[i]===0)){out[i]=null;continue;}let x=lo[i]*kx,y=-la[i]*ky;if(view.flip)x=-x;out[i]=[x*ca-y*sa,x*sa+y*ca];}return out;};
    // GPS in the .ld is float32 (steps of 0.2–0.7 m): a short moving average makes the line smooth without moving it
    const smooth=(Q,k=3)=>Q.map((p,i)=>{if(!p)return null;let sx=0,sy=0,m=0;for(let j=i-k;j<=i+k;j++){const q=Q[j];if(q){sx+=q[0];sy+=q[1];m++;}}return [sx/m,sy/m];});
    const raw=smooth(proj(this.lat,this.lon)),raw2=this.overlay?smooth(proj(this.overlay.lat,this.overlay.lon)):null;this.M=raw;this.M2=raw2;
    const zoom=this.zoomFit&&this.win;this.fitWin=zoom?[Math.max(0,this.win[0]),Math.min(n-1,this.win[1])]:null;
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;const acc=p=>{if(!p)return;if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];};
    const [a0,a1]=this.fitWin||[0,n-1];for(let i=a0;i<=a1;i++){acc(raw[i]);if(raw2&&zoom)acc(raw2[i]);}
    if(!Number.isFinite(x0))return;
    if(zoom){const cx=(x0+x1)/2,cy=(y0+y1)/2,half=Math.max(x1-x0,y1-y0)/2*1.15||5;x0=cx-half;x1=cx+half;y0=cy-half;y1=cy+half;}
    const pad=22,s0=Math.min((w-2*pad)/(x1-x0||1),(h-2*pad)/(y1-y0||1)),ox=(w-(x1-x0)*s0)/2,oy=(h-(y1-y0)*s0)/2;
    const base=p=>p?[ox+(p[0]-x0)*s0,oy+(p[1]-y0)*s0]:null;this.B=raw.map(base);
    const v=this.vz||{k:1,dx:0,dy:0};const T=p=>p?[p[0]*v.k+v.dx,p[1]*v.k+v.dy]:null;
    const P=this.B.map(T);this.P=P.map(p=>p||[NaN,NaN]);const P2=raw2?raw2.map(p=>T(base(p))):null;
    const scale=s0*v.k;// px per metre
    c.clearRect(0,0,w,h);c.lineCap='round';c.lineJoin='round';
    // measuring grid every 50/100/250 m
    const gm=scale>3?25:scale>1.2?50:scale>.5?100:250;const gp=gm*scale;if(gp>14){c.strokeStyle='rgba(255,255,255,.035)';c.lineWidth=1;const offx=((v.dx+ox-x0*s0*v.k)%gp+gp)%gp,offy=((v.dy+oy-y0*s0*v.k)%gp+gp)%gp;c.beginPath();for(let x=offx;x<w;x+=gp){c.moveTo(Math.round(x)+.5,0);c.lineTo(Math.round(x)+.5,h);}for(let y=offy;y<h;y+=gp){c.moveTo(0,Math.round(y)+.5);c.lineTo(w,Math.round(y)+.5);}c.stroke();}
    const path=(Q,lw,col,alpha=1)=>{c.globalAlpha=alpha;c.strokeStyle=col;c.lineWidth=lw;c.beginPath();let st=false;Q.forEach(p=>{if(!p||!Number.isFinite(p[0])){st=false;return;}st?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);st=true;});c.stroke();c.globalAlpha=1;};
    // the track: a real width (about 13 m) when zoomed in, a bed when far
    const bed=Math.max(zoom?26:12,13*scale);path(P,bed+4,'rgba(255,255,255,.06)');path(P,bed,tok('trackbed'));
    const lines=P2&&(zoom||v.k>=2.5||scale>1.5);
    if(lines){const lw=Math.max(2.5,Math.min(5,scale*1.2));
      c.save();c.shadowBlur=10*GL();c.shadowColor=tok('lapB');path(P2,lw,tok('lapB'));c.shadowColor=tok('lapA');path(P,lw,tok('lapA'));c.restore();
      c.fillStyle=tok('muted');c.font='11px "JetBrains Mono",monospace';c.textAlign='left';c.textBaseline='top';}
    else{const W0=this.win?this.win[0]:-1,W1=this.win?this.win[1]:n;const lw=Math.max(4,Math.min(8,scale*1.4));c.lineWidth=lw;
      for(let i=1;i<n;i++){const p0=P[i-1],p1=P[i];if(!p0||!p1)continue;c.globalAlpha=(i<W0||i>W1)?0.18:1;c.strokeStyle=this.colors[i]||tok('muted');c.beginPath();c.moveTo(p0[0],p0[1]);c.lineTo(p1[0],p1[1]);c.stroke();}c.globalAlpha=1;
      if(P2)path(P2,1.2,tok('lapB'),.55);}
    // start / finish: chequered block
    const p0=P.find(Boolean);if(p0){const q=6;for(let a=0;a<2;a++)for(let b=0;b<2;b++){c.fillStyle=(a+b)%2?'#000':'#fff';c.fillRect(p0[0]-q+a*q,p0[1]-q+b*q,q,q);}}
    c.font='700 11px "Barlow Condensed",sans-serif';c.textAlign='center';c.textBaseline='middle';
    this.extra.forEach(m=>{const p=P[m.i];if(!p)return;c.fillStyle='rgba(8,11,15,.92)';c.strokeStyle=tok('accent');c.lineWidth=1;c.beginPath();c.moveTo(p[0]-9,p[1]-7);c.lineTo(p[0]+6,p[1]-7);c.lineTo(p[0]+9,p[1]-4);c.lineTo(p[0]+9,p[1]+7);c.lineTo(p[0]-6,p[1]+7);c.lineTo(p[0]-9,p[1]+4);c.closePath();c.fill();c.stroke();c.fillStyle=tok('ink');c.fillText(m.label,p[0],p[1]+.5);});
    const dot=(p,col)=>{if(!p)return;c.save();c.shadowBlur=12;c.shadowColor=col;c.fillStyle=col;c.strokeStyle='#05070A';c.lineWidth=2;c.beginPath();c.arc(p[0],p[1],6,0,7);c.fill();c.stroke();c.restore();};
    // HUD: scale and, with a second line, the gap between the lines
    c.textAlign='left';c.textBaseline='bottom';c.font='10px "JetBrains Mono",monospace';c.fillStyle=tok('faint');const bar=gm*scale<200?gm:gm/2;c.fillRect(10,h-12,bar*scale,2);c.fillText(bar+' m',10,h-15);
    if(this.cursor!=null&&P[this.cursor]){
      if(P2&&P2[this.cursor]){dot(P2[this.cursor],tok('lapB'));dot(P[this.cursor],tok('lapA'));
        const g=this.lineGap(this.cursor);if(g){const txt=g.m<0.3?'stessa linea':`B ${g.m.toFixed(1)} m ${g.inside==null?(g.left?'a sinistra':'a destra'):g.inside?'più all\'interno':'più all\'esterno'}`;c.font='600 12px "JetBrains Mono",monospace';const tw=c.measureText(txt).width;c.fillStyle='rgba(5,7,10,.88)';c.fillRect(8,8,tw+16,22);c.fillStyle=tok('lapB');c.fillRect(8,8,3,22);c.fillStyle=tok('ink');c.textBaseline='middle';c.fillText(txt,16,19);}}
      else dot(P[this.cursor],tok('accent'));}
    if(P2&&!lines){c.font='10px "JetBrains Mono",monospace';c.fillStyle=tok('lapB');c.textAlign='right';c.textBaseline='bottom';c.fillText('zoom su una curva per le due linee',w-46,h-8);}
  }
}
function lerpColor(a,b,t){const pa=hex(a),pb=hex(b);return `rgb(${pa.map((v,i)=>Math.round(v+(pb[i]-v)*t)).join(',')})`;}
function hex(s){s=s.replace('#','');if(s.length===3)s=s.split('').map(x=>x+x).join('');return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16));}
function ramp(t){t=Math.max(0,Math.min(1,t));const a=tok('t-cold'),b=tok('t-ok'),c=tok('t-hot');return t<.5?lerpColor(a,b,t*2):lerpColor(b,c,(t-.5)*2);}

// simple multi-series line chart over laps
function lineChart(cv,{x,series,yfmt=v=>v,h=200,xlabel='giro',min,max,band}){
  const {c,w}=fitCanvas(cv,h);c.clearRect(0,0,w,h);const L=46,R=10,T=10,B=24;
  let lo=min??Infinity,hi=max??-Infinity;if(band&&Number.isFinite(band[0])&&min==null){lo=Math.min(lo,band[0]);hi=Math.max(hi,band[1]);}if(min==null||max==null)series.forEach(s=>s.data.forEach(v=>{if(Number.isFinite(v)){if(min==null&&v<lo)lo=v;if(max==null&&v>hi)hi=v;}}));
  if(!Number.isFinite(lo)){c.fillStyle=tok('muted');c.fillText('nessun dato',L,h/2);return;}
  const pad=(hi-lo)*0.1||0.5;if(min==null)lo-=pad;if(max==null)hi+=pad;
  const xs=x.filter(Number.isFinite),xa=Math.min(...xs),xb=Math.max(...xs);
  const X=v=>L+(v-xa)/((xb-xa)||1)*(w-L-R),Y=v=>h-B-(v-lo)/(hi-lo)*(h-T-B);
  if(band&&Number.isFinite(band[0])){const y1=Math.max(T,Y(Math.min(hi,band[1]))),y0=Math.min(h-B,Y(Math.max(lo,band[0])));if(y0>y1){c.fillStyle=tok('t-ok');c.globalAlpha=.1;c.fillRect(L,y1,w-L-R,y0-y1);c.globalAlpha=1;}}
  c.font='11px "JetBrains Mono",monospace';c.strokeStyle=tok('line');c.fillStyle=tok('faint');c.textAlign='right';c.textBaseline='middle';
  niceTicks(lo,hi,4).forEach(t=>{const y=Math.round(Y(t))+.5;c.beginPath();c.moveTo(L,y);c.lineTo(w-R,y);c.stroke();c.fillText(yfmt(t),L-5,y);});
  c.textAlign='center';c.textBaseline='top';x.forEach((v,i)=>{if(x.length<=30||i%Math.ceil(x.length/20)===0)c.fillText(v,X(v),h-B+6);});
  series.forEach(s=>{c.strokeStyle=s.color;c.fillStyle=s.color;c.lineWidth=s.nolines?0:1.8;c.shadowColor=s.color;c.shadowBlur=5*GL();c.beginPath();let st=false;s.data.forEach((v,i)=>{if(!Number.isFinite(v)){st=false;return;}const px=X(x[i]),py=Y(v);st?c.lineTo(px,py):c.moveTo(px,py);st=true;});if(!s.nolines)c.stroke();
    s.data.forEach((v,i)=>{if(!Number.isFinite(v))return;c.beginPath();c.arc(X(x[i]),Y(v),s.dot?.(i)?4.5:(s.nolines?3.5:2.4),0,7);c.fillStyle=s.dot?.(i)?tok('best'):s.color;c.fill();});});
  c.shadowBlur=0;
}
