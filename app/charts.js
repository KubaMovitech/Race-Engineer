// ================= CHARTS =================
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
      p.series.forEach(s=>{if(!s.data)return;c.strokeStyle=s.color;c.lineWidth=s.w||1.6;c.globalAlpha=s.alpha||1;c.beginPath();let started=false,prevY=null;
        const stepN=Math.max(1,Math.floor((i1-i0)/(w*1.5)));
        for(let i=i0;i<=i1;i+=stepN){const v=s.data[i];if(!Number.isFinite(v)){started=false;continue;}const xx=this.xToPx(this.x[i]),yy=Y(v);
          if(!started){c.moveTo(xx,yy);started=true;}else{if(s.step&&prevY!=null)c.lineTo(xx,prevY);c.lineTo(xx,yy);}prevY=yy;}
        c.stroke();
        if(s.fill){const z=Y(Math.min(hi,Math.max(lo,0)));c.lineTo(this.xToPx(this.x[i1]),z);c.lineTo(this.xToPx(this.x[i0]),z);c.closePath();c.globalAlpha=0.14;c.fillStyle=s.color;c.fill();}
        c.globalAlpha=1;});
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
  constructor(cv,{onCursor}={}){
    this.cv=cv;this.onCursor=onCursor;this.cursor=null;this.zoomFit=false;
    cv.addEventListener('pointermove',e=>{if(!this.P)return;const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let bi=-1,bd=900;const [i0,i1]=this.fitWin||[0,this.P.length-1];for(let i=i0;i<=i1;i+=1){const dx=this.P[i][0]-x,dy=this.P[i][1]-y,d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i;}}if(bi>=0){this.cursor=bi;this.draw();this.onCursor&&this.onCursor(bi);}});
    cv.addEventListener('pointerleave',()=>{this.cursor=null;this.draw();this.onCursor&&this.onCursor(null);});
    new ResizeObserver(()=>this.draw()).observe(cv);
  }
  set(lat,lon,colors,venue,extra,overlay){this.lat=lat;this.lon=lon;this.colors=colors;this.venue=venue;this.extra=extra||[];this.overlay=overlay||null;this.draw();}
  setCursorIdx(i){this.cursor=i;this.draw();}
  setWindow(w){this.win=w;this.draw();}
  draw(){
    if(!this.lat)return;const {c,w,h}=fitCanvas(this.cv);const n=this.lat.length,view=getMapView(this.venue);
    const ang=view.rot*Math.PI/2,ca=Math.cos(ang),sa=Math.sin(ang);
    const proj=(la,lo)=>{const out=[];for(let i=0;i<la.length;i++){let x=lo[i],y=-la[i];if(view.flip)x=-x;out.push([x*ca-y*sa,x*sa+y*ca]);}return out;};
    const raw=proj(this.lat,this.lon),raw2=this.overlay?proj(this.overlay.lat,this.overlay.lon):null;
    const zoom=this.zoomFit&&this.win;this.fitWin=zoom?[Math.max(0,this.win[0]),Math.min(n-1,this.win[1])]:null;
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;const acc=(p)=>{if(!p||!Number.isFinite(p[0]))return;if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];};
    const [a0,a1]=this.fitWin||[0,n-1];for(let i=a0;i<=a1;i++){acc(raw[i]);if(raw2&&zoom)acc(raw2[i]);}
    if(zoom){const cx=(x0+x1)/2,cy=(y0+y1)/2,half=Math.max(x1-x0,y1-y0)/2*1.15||1e-4;x0=cx-half;x1=cx+half;y0=cy-half;y1=cy+half;}
    const pad=16,s=Math.min((w-2*pad)/(x1-x0||1),(h-2*pad)/(y1-y0||1)),ox=(w-(x1-x0)*s)/2,oy=(h-(y1-y0)*s)/2;
    const P=raw.map(([x,y])=>[ox+(x-x0)*s,oy+(y-y0)*s]);this.P=P;const P2=raw2?raw2.map(([x,y])=>[ox+(x-x0)*s,oy+(y-y0)*s]):null;
    c.clearRect(0,0,w,h);c.lineCap='round';c.lineJoin='round';
    const path=(Q,lw,col)=>{c.strokeStyle=col;c.lineWidth=lw;c.beginPath();let st=false;Q.forEach(p=>{if(!Number.isFinite(p[0])){st=false;return;}st?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]);st=true;});c.stroke();};
    path(P,zoom?26:12,tok('trackbed'));
    if(zoom&&P2){path(P,3,tok('lapA'));path(P2,3,tok('lapB'));
      c.fillStyle=tok('muted');c.font='11px "JetBrains Mono",monospace';c.textAlign='left';c.fillText('linea A e B · zoom sul tratto',8,14);}
    else{c.lineWidth=4.5;const W0=this.win?this.win[0]:-1,W1=this.win?this.win[1]:n;for(let i=1;i<n;i++){c.globalAlpha=(i<W0||i>W1)?0.18:1;c.strokeStyle=this.colors[i]||tok('muted');c.beginPath();c.moveTo(P[i-1][0],P[i-1][1]);c.lineTo(P[i][0],P[i][1]);c.stroke();}c.globalAlpha=1;}
    const p0=P[0];c.fillStyle=tok('ink');c.fillRect(p0[0]-4,p0[1]-4,8,8);
    c.font='600 11px "Barlow Condensed",sans-serif';c.textAlign='center';c.textBaseline='middle';
    this.extra.forEach(m=>{const p=P[m.i];if(!p)return;c.fillStyle=tok('panel');c.beginPath();c.arc(p[0],p[1],8,0,7);c.fill();c.strokeStyle=tok('muted');c.lineWidth=1;c.stroke();c.fillStyle=tok('ink');c.fillText(m.label,p[0],p[1]+.5);});
    const dot=(p,col)=>{c.fillStyle=col;c.strokeStyle=tok('panel');c.lineWidth=2;c.beginPath();c.arc(p[0],p[1],6,0,7);c.fill();c.stroke();};
    if(this.cursor!=null&&P[this.cursor]){if(zoom&&P2&&P2[this.cursor]){dot(P[this.cursor],tok('lapA'));dot(P2[this.cursor],tok('lapB'));}else dot(P[this.cursor],tok('accent'));}
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
  series.forEach(s=>{c.strokeStyle=s.color;c.fillStyle=s.color;c.lineWidth=s.nolines?0:1.8;c.beginPath();let st=false;s.data.forEach((v,i)=>{if(!Number.isFinite(v)){st=false;return;}const px=X(x[i]),py=Y(v);st?c.lineTo(px,py):c.moveTo(px,py);st=true;});if(!s.nolines)c.stroke();
    s.data.forEach((v,i)=>{if(!Number.isFinite(v))return;c.beginPath();c.arc(X(x[i]),Y(v),s.dot?.(i)?4.5:(s.nolines?3.5:2.4),0,7);c.fillStyle=s.dot?.(i)?tok('best'):s.color;c.fill();});});
}
