// ================= 1.7: GRAFICA TV (overlay stile WEC / F1) + REGIA =================
// The overlay page (#tv) draws broadcast graphics on a transparent 1920×1080 canvas for OBS.
// The "Regia" (Muretto › Regia TV) decides what is on screen; its state reaches every overlay
// through the local bridge (/ovc → /live) and, with a team code, through the team server.
const TV_PRESETS={
  wec:{name:'WEC',col:{acc:'#E10600',bg:'#0E1117',ink:'#FFFFFF',sub:'#9AA4B0',hl:'#FFC400'},op:0.9,rad:3,font:'titillium',up:1},
  f1:{name:'F1',col:{acc:'#E10600',bg:'#15151E',ink:'#FFFFFF',sub:'#A7A7B5',hl:'#FFD12E'},op:0.94,rad:8,font:'titillium',up:1},
  night:{name:'Notte',col:{acc:'#27F4D2',bg:'#05070B',ink:'#EAF6F4',sub:'#7F8C99',hl:'#27F4D2'},op:0.82,rad:6,font:'barlow',up:1},
  clean:{name:'Pulito',col:{acc:'#FFFFFF',bg:'#000000',ink:'#FFFFFF',sub:'#B0B0B0',hl:'#FFD000'},op:0.6,rad:0,font:'barlow',up:0},
  gold:{name:'Oro',col:{acc:'#C9A227',bg:'#101010',ink:'#F7F3E8',sub:'#A39A86',hl:'#E8C547'},op:0.9,rad:2,font:'titillium',up:1}};
const TV_FONTS={titillium:'"Titillium Web",system-ui,sans-serif',barlow:'"Barlow Condensed","Arial Narrow",sans-serif',mono:'"JetBrains Mono",ui-monospace,monospace'};
const TV_G=[['tower','Classifica (torre)'],['bar','Barra sessione'],['card','Scheda pilota'],['battle','Duello 1 contro 1'],['ext','Gruppo in lotta'],['quali','Giro lanciato (qualifica)'],
  ['map','Mappa'],['wx','Meteo e previsioni'],['onb','Telemetria onboard'],['res','Risultati'],['flb','Banner giro veloce'],['rc','Banner direzione gara'],['pitb','Banner soste']];
const TV_DEF={v:1,preset:'wec',col:{...TV_PRESETS.wec.col},op:0.9,rad:3,font:'titillium',up:1,sc:1,name:'init',title:'',
  show:{tower:1,bar:1,card:0,battle:1,ext:0,quali:0,map:0,wx:0,onb:0,res:0,flb:1,rc:1,pitb:1},
  tower:{rows:16,info:'gap',cyc:8,cls:'',side:'l',tyre:1,ve:1,num:1,pits:0},pitb:'class',res:{cls:''},pos:{map:'tr',battle:'br',card:'bl'},focus:'',anim:1};
function tvMerge(a,b){const o={...a,...(b||{})};['col','show','tower','pos','res'].forEach(k=>o[k]={...a[k],...((b||{})[k]||{})});return o;}
const tvState=()=>tvMerge(TV_DEF,LS.get('tv:state',{}));

// ---------- names, numbers, gaps ----------
function tvName(r,mode){const n=String(r.drv||'').trim();const p=n.split(/\s+/);const sur=p.length>1?p.slice(1).join(' '):p[0]||'';
  switch(mode){case 'tla':return sur.replace(/[^A-Za-zÀ-ÿ]/g,'').slice(0,3).toUpperCase();case 'sur':return sur.toUpperCase();case 'full':return n;
    case 'team':return r.team||n;case 'car':return (r.model||r.veh||'').replace(/\s*#\d+$/,'');default:return p.length>1?`${p[0][0]}. ${sur.toUpperCase()}`:n.toUpperCase();}}
const tvNum=r=>r.num||((r.veh||'').match(/#(\d+)/)||[])[1]||'';
const tvT=v=>Number.isFinite(v)&&v>0?fmtLap(v).replace(/^0:/,''):'—';

function tvCtx(st){const sc=LIVE.sc,I=sc?.i||{};LIVE.memo=new Map();const rows=liveRows(sc);const kind=sesKind(I);
  const names=Object.keys(liveCars());if(!names.includes(LIVE.focus)){const now=Date.now();LIVE.focus=names.find(n=>liveCars()[n].some(D=>D.car&&now-D.carAt<8000))||names[0]||'';}
  let focus=rows.find(r=>r.veh===st.focus)||rows.find(r=>r.veh===LIVE.focus)||rows.find(r=>r.pos===1);
  const lt=r=>carStats(r.veh,r).pace5||r.estL||100;return {sc,I,kind,rows,focus,lt,ours:new Set(names)};}
function tvOrder(x,cls){let L=x.rows.filter(r=>!cls||r.cls===cls);
  if(x.kind==='race')L.sort((a,b)=>a.pos-b.pos);else L.sort((a,b)=>(a.best>0?a.best:1e9)-(b.best>0?b.best:1e9));return L;}
function tvGapTo(x,a,b){const lt=x.lt(b);return (a.gapL+a.lapsL*lt)-(b.gapL+b.lapsL*lt);}

// ---------- the view: one per root (OBS page, or the preview in the Regia) ----------
function TVView(root){this.root=root;root.classList.add('tvroot');root.innerHTML=`<div class="tvstage"><div class="tvz tvtower"></div><div class="tvz tvbar"></div><div class="tvz tvcard"></div><div class="tvz tvbattle"></div><div class="tvz tvext"></div><div class="tvz tvquali"></div>
  <div class="tvz tvmap"><canvas></canvas></div><div class="tvz tvwx"></div><div class="tvz tvonb"></div><div class="tvz tvres"></div><div class="tvz tvban"></div></div>`;
  this.st=root.firstChild;this.rows=new Map();this.prevPos=new Map();this.prevLaps=new Map();this.flash=new Map();this.ban=[];this.banCur=null;this.cb={};this.pits=new Map();this.penSeen=new Set();this.t0=Date.now();this.fcy=0;this.finalShown=false;this.resPage=0;this.resAt=0;}
TVView.prototype.style=function(s){const r=this.root.style;const C=s.col;r.setProperty('--tv-acc',C.acc);r.setProperty('--tv-bg',C.bg);r.setProperty('--tv-ink',C.ink);r.setProperty('--tv-sub',C.sub);r.setProperty('--tv-hl',C.hl);
  r.setProperty('--tv-op',s.op);r.setProperty('--tv-rad',s.rad+'px');r.setProperty('--tv-font',TV_FONTS[s.font]||TV_FONTS.titillium);r.setProperty('--tv-sc',s.sc);
  this.root.classList.toggle('tvup',!!s.up);this.root.classList.toggle('tvnoanim',!s.anim);this.root.dataset.side=s.tower.side;['map','battle','card'].forEach(k=>this.root.dataset['p'+k]=s.pos[k]);
  const w=this.root.clientWidth||1920;this.st.style.transform=`scale(${w/1920})`;};
TVView.prototype.vis=function(k,on){const el=this.st.querySelector('.tv'+k);if(el)el.classList.toggle('on',!!on);return el;};
TVView.prototype.render=function(s){const x=tvCtx(s);this.style(s);const on=s.show;const q=x.kind!=='race';
  try{this.vis('tower',on.tower&&x.rows.length)&&on.tower&&this.tower(s,x);}catch(e){console.error(e);}
  const fns=[['bar',on.bar,()=>this.bar(s,x)],['card',on.card&&x.focus,()=>this.card(s,x)],['battle',on.battle&&x.focus&&!(q&&on.quali),()=>this.battle(s,x)],['ext',on.ext&&x.focus&&x.kind==='race',()=>this.ext(s,x)],
    ['quali',on.quali&&x.focus,()=>this.quali(s,x)],['map',on.map,()=>this.map(s,x)],['wx',on.wx&&LIVE.sc,()=>this.wx(s,x)],['onb',on.onb,()=>this.onb(s,x)],['res',on.res&&x.rows.length,()=>this.res(s,x)]];
  fns.forEach(([k,show,f])=>{const el=this.vis(k,show);if(show&&el){try{f();}catch(e){console.error(e);}}});
  try{this.banners(s,x);}catch(e){console.error(e);}};
// ---- timing tower: rows keep their element, so position changes slide like on TV
TVView.prototype.tower=function(s,x){const el=this.st.querySelector('.tvtower');const T=s.tower;
  let cls=T.cls;const classes=[...new Set(x.rows.map(r=>r.cls))];if(cls==='auto'){const i=Math.floor((Date.now()-this.t0)/((T.cyc||8)*2000))%Math.max(1,classes.length);cls=classes[i]||'';}
  const L=tvOrder(x,cls);const N=Math.max(5,Math.min(30,T.rows|0));let show=L.slice(0,N);const f=x.focus;
  if(f&&L.includes(f)&&!show.includes(f)){const i=L.indexOf(f);show=[...L.slice(0,N-3),...L.slice(i-1,i+2)];}
  const modes=['gap','int','last','ve'];const mode=T.info==='cycle'?modes[Math.floor((Date.now()-this.t0)/((T.cyc||8)*1000))%modes.length]:T.info;
  const ML={gap:x.kind==='race'?tr('Distacco'):tr('Distacco'),int:tr('Intervallo'),last:tr('Ultimo giro'),best:tr('Miglior giro'),ve:tr('Energia'),pits:tr('Soste'),tyre:tr('Gomme')};
  if(!el.firstChild){el.innerHTML=`<div class="tvth"><div class="a"></div><div class="b"></div></div><div class="tvtl"></div><div class="tvtf"></div>`;}
  const I=x.I;const laps=I.maxLaps>0&&I.maxLaps<99999;const lead=L[0];
  el.querySelector('.tvth .a').innerHTML=`${s.title?`<b>${esc(s.title)}</b>`:''}<span>${esc(tr(SES_BADGE[x.kind]))}</span>${cls?`<i class="tvcls" style="background:${LV_CLS(cls)}">${esc(cls)}</i>`:''}`;
  el.querySelector('.tvth .b').innerHTML=laps?`${tr('GIRO')} <b>${lead?Math.min(I.maxLaps,lead.laps+1):'—'}</b>/${I.maxLaps}`:`<b>${hms(I.rem)}</b>`;
  el.querySelector('.tvtf').textContent=ML[mode]||'';
  const list=el.querySelector('.tvtl');const rh=38;list.style.height=(show.length*rh)+'px';const seen=new Set();const now=Date.now();
  const cbest={};x.rows.forEach(r=>{if(r.best>0&&(!cbest[r.cls]||r.best<cbest[r.cls]))cbest[r.cls]=r.best;});
  let prev=null;show.forEach((r,i)=>{seen.add(r.veh);let e=this.rows.get(r.veh);if(!e){e=document.createElement('div');e.className='tvr';e.innerHTML=`<span class="p"></span><i class="cs"></i><span class="nb"></span><span class="n"></span><span class="x"></span><span class="ty"></span><span class="v"></span><span class="ar"></span>`;e.style.transform=`translateY(${i*rh}px)`;list.appendChild(e);this.rows.set(r.veh,e);}
    const p=cls?r.pic:(x.kind==='race'?r.pos:i+1);const pp=this.prevPos.get(r.veh);if(pp&&pp!==p&&x.kind==='race')this.flash.set(r.veh,{d:pp-p,until:now+5000});this.prevPos.set(r.veh,p);
    const pl=this.prevLaps.get(r.veh);if(pl!=null&&r.laps>pl&&r.last>0)this.flash.set(r.veh+'|lap',{t:r.last,until:now+8000,pb:r.last<=r.best+0.0005,cb:r.last<=cbest[r.cls]+0.0005});this.prevLaps.set(r.veh,r.laps);
    e.style.transform=`translateY(${i*rh}px)`;const isF=f&&r.veh===f.veh;
    let txt='',cl='';const lf=this.flash.get(r.veh+'|lap');
    if(r.inPit||r.gar){txt=r.gar?tr('GARAGE'):'PIT';cl='pit';}
    else if(lf&&lf.until>now&&(mode==='gap'||mode==='int')){txt=tvT(lf.t);cl=lf.cb?'lapcb':lf.pb?'lappb':'lap';}
    else if(mode==='gap'){if(x.kind==='race'){if(i===0&&(!cls||r===L[0])){txt=tr('LEADER');cl='lead';}else{const ld=L[0];const g=cls?tvGapTo(x,r,ld):r.gapL;const lp=cls?(r.lapsL-ld.lapsL):r.lapsL;txt=lp>0&&g>x.lt(r)?`+${lp} ${lp>1?tr('GIRI'):tr('GIRO')}`:'+'+fx(g,1);}}
      else{txt=i===0?tvT(r.best):(r.best>0&&L[0].best>0?'+'+fx(r.best-L[0].best,3):'—');}}
    else if(mode==='int'){if(x.kind==='race'){if(!prev){txt=tr('LEADER');cl='lead';}else{const g=tvGapTo(x,r,prev);txt=r.lapsL>prev.lapsL&&g>x.lt(r)?`+${r.lapsL-prev.lapsL} ${tr('GIRI')}`:'+'+fx(g,1);}}
      else txt=prev&&r.best>0&&prev.best>0?'+'+fx(r.best-prev.best,3):tvT(r.best);}
    else if(mode==='last'){txt=tvT(carStats(r.veh,r).lastT>0?carStats(r.veh,r).lastT:r.last);}
    else if(mode==='best'){txt=tvT(r.best);if(r.best>0&&r.best===cbest[r.cls])cl='lapcb';}
    else if(mode==='ve'){txt=r.ve>=0?Math.round(r.ve*100)+'%':r.fuel>=0?Math.round(r.fuel*100)+'%':'—';}
    else if(mode==='pits'){txt=`${r.pits} ${tr('SOSTE')}`;}
    else if(mode==='tyre'){txt=(COMP_N[r.comp?.[0]]||'—').toUpperCase();}
    // battle wash: interval to the car ahead in the list
    let wash='';if(x.kind==='race'&&prev&&!r.inPit&&r.lapsL===prev.lapsL){const g=tvGapTo(x,r,prev);if(g<0.3)wash='w3';else if(g<0.5)wash='w5';}
    const fl=this.flash.get(r.veh);const ar=fl&&fl.until>now?(fl.d>0?`<b class="up">▲${fl.d}</b>`:`<b class="dn">▼${-fl.d}</b>`):'';
    const fast=r.best>0&&r.best===cbest[r.cls];
    e.className=`tvr${isF?' f':''}${x.ours.has(r.veh)?' o':''}${wash?' '+wash:''}${r.inPit||r.gar?' inpit':''}`;
    e.children[0].textContent=p;e.children[1].style.background=LV_CLS(r.cls);e.children[2].textContent=T.num?tvNum(r):'';e.children[2].hidden=!T.num;
    e.children[3].innerHTML=`${esc(tvName(r,s.name))}${fast&&x.kind==='race'?'<i class="fl" title="giro più veloce">⏱</i>':''}`;
    e.children[4].className='x '+cl;e.children[4].textContent=txt;
    e.children[5].innerHTML=T.tyre&&r.comp?`<i style="background:${COMP_COL[r.comp[0]]||COMP_COL['?']};color:${COMP_INK(r.comp[0])}">${r.comp[0]}</i>`:'';e.children[5].hidden=!T.tyre;
    e.children[6].innerHTML=T.ve&&(r.ve>=0||r.fuel>=0)?`<i style="height:${Math.round(Math.max(0,Math.min(1,r.ve>=0?r.ve:r.fuel))*100)}%" class="${(r.ve>=0?r.ve:r.fuel)<0.12?'low':''}"></i>`:'';e.children[6].hidden=!T.ve;
    e.children[7].innerHTML=ar;prev=r;});
  [...this.rows.entries()].forEach(([k,e])=>{if(!seen.has(k)){e.remove();this.rows.delete(k);}});};
// ---- session bar (top centre)
TVView.prototype.bar=function(s,x){const el=this.st.querySelector('.tvbar');const I=x.I;if(!x.sc){el.innerHTML='';return;}const laps=I.maxLaps>0&&I.maxLaps<99999;const lead=tvOrder(x,'')[0];
  const fl=I.yel>0?`<span class="flag y">${esc((FCY[I.yel]||'FCY').toUpperCase())}</span>`:(x.kind==='race'&&I.phase===5?`<span class="flag g">${tr('VERDE')}</span>`:'');
  el.innerHTML=`${s.title?`<span class="ti">${esc(s.title)}</span>`:''}<span class="ses">${esc(tr(SES_BADGE[x.kind]))}</span><span class="tm">${laps?`${tr('GIRO')} ${lead?Math.min(I.maxLaps,lead.laps+1):'—'}/${I.maxLaps}`:hms(I.rem)}</span>${fl}
    <span class="wx">${esc(tr(skyNow?skyNow(I):''))} · ${tr('ARIA')} ${fx(I.air,0)}° · ${tr('PISTA')} ${fx(I.tt,0)}°${I.rain>0.05?` · ${tr('PIOGGIA')} ${Math.round(I.rain*100)}%`:''}</span>`;};
// ---- driver card (lower third)
TVView.prototype.card=function(s,x){const el=this.st.querySelector('.tvcard');const r=x.focus;const cs=carStats(r.veh,r);const L=tvOrder(x,r.cls);const p=x.kind==='race'?r.pic:L.indexOf(r)+1;
  const ld=L[0];const gap=x.kind==='race'?(r===ld?tr('LEADER'):'+'+fx(tvGapTo(x,r,ld),1)):(r===ld?tr('POLE'):r.best>0&&ld.best>0?'+'+fx(r.best-ld.best,3):'—');
  el.innerHTML=`<div class="cp" style="--cc:${LV_CLS(r.cls)}"><b>P${p}</b><small>${esc(r.cls)}</small></div><div class="cn"><span class="num">#${esc(tvNum(r))}</span><div><b>${esc(tvName(r,'full').toUpperCase())}</b><small>${esc([r.team,(r.model||'').replace(/\s*#\d+$/,'')].filter(Boolean).join(' · '))}</small></div></div>
    <div class="cst"><div><span>${tr('Distacco')}</span><b>${gap}</b></div><div><span>${tr('Migliore')}</span><b>${tvT(r.best)}</b></div><div><span>${tr('Ultimo')}</span><b>${tvT(cs.lastT>0?cs.lastT:r.last)}</b></div>
    <div><span>${tr('Gomme')}</span><b>${r.comp?`<i class="cmp" style="background:${COMP_COL[r.comp[0]]};color:${COMP_INK(r.comp[0])}">${r.comp[0]}</i> ${cs.stintLaps} ${tr('giri')}`:'—'}</b></div>
    ${r.ve>=0||r.fuel>=0?`<div><span>${r.ve>=0?tr('Energia'):tr('Benzina')}</span><b class="vb"><i style="width:${Math.round((r.ve>=0?r.ve:r.fuel)*100)}%"></i><em>${Math.round((r.ve>=0?r.ve:r.fuel)*100)}%</em></b></div>`:''}</div>`;};
// ---- 1v1 battle
TVView.prototype.battle=function(s,x){const el=this.st.querySelector('.tvbattle');const f=x.focus;const L=tvOrder(x,f.cls);const i=L.indexOf(f);let a=L[i-1],b=f;if(!a){a=f;b=L[i+1];}
  if(!b){el.innerHTML='';el.classList.remove('on');return;}const g=x.kind==='race'?tvGapTo(x,b,a):(b.best>0&&a.best>0?b.best-a.best:NaN);
  const H=this.gh||(this.gh={});const key=a.veh+'|'+b.veh;const now=x.I.et||0;const h=H[key]||(H[key]=[]);if(!h.length||now-h[h.length-1].et>=1)h.push({et:now,g});while(h.length>240)h.shift();
  const old=h.find(z=>now-z.et<=x.lt(b)*1.05);const tdv=old&&now-old.et>5?g-old.g:NaN;const p=r=>x.kind==='race'?r.pic:L.indexOf(r)+1;
  const side=r=>`<div class="bs"><span class="p" style="--cc:${LV_CLS(r.cls)}">${p(r)}</span><b>${esc(tvName(r,s.name))}</b><small>${tvT(carStats(r.veh,r).lastT>0?carStats(r.veh,r).lastT:r.last)}</small></div>`;
  el.innerHTML=`<div class="bh">${tr('LOTTA PER LA')} P${p(a)}</div><div class="bb">${side(a)}<div class="bg"><b>${Number.isFinite(g)?(x.kind==='race'?fx(g,1):'+'+fx(g,3)):'—'}</b>${Number.isFinite(tdv)&&x.kind==='race'?`<small class="${tdv<0?'cl':'op'}">${tdv<0?'▼':'▲'} ${fx(Math.abs(tdv),1)} ${tr('s/giro')}</small>`:''}</div>${side(b)}</div>`;};
// ---- group of cars fighting (chain of gaps < 1.5 s)
TVView.prototype.ext=function(s,x){const el=this.st.querySelector('.tvext');const f=x.focus;const L=tvOrder(x,f.cls);const i=L.indexOf(f);let a=i,b=i;
  while(a>0&&tvGapTo(x,L[a],L[a-1])<1.5&&i-a<5)a--;while(b<L.length-1&&tvGapTo(x,L[b+1],L[b])<1.5&&b-a<5)b++;const G=L.slice(a,b+1);
  if(G.length<2){el.innerHTML=`<div class="eh">${tr('NESSUN GRUPPO IN LOTTA')}</div>`;return;}
  el.innerHTML=`<div class="eh">${tr('LOTTA')} · P${G[0].pic}–P${G[G.length-1].pic} · ${esc(f.cls)}</div><div class="ec">${G.map((r,j)=>`<div class="e${r===f?' f':''}"><span class="p" style="--cc:${LV_CLS(r.cls)}">${r.pic}</span><b>${esc(tvName(r,s.name))}</b><small>${j?'+'+fx(tvGapTo(x,r,G[j-1]),1):tr('davanti')}</small></div>`).join('')}</div>`;};
// ---- flying lap (qualifying)
TVView.prototype.quali=function(s,x){const el=this.st.querySelector('.tvquali');const r=x.focus;const L=tvOrder(x,r.cls);const cb=secClassBest(x.rows);const pb=secPB(r);const ref=L.find(z=>z.best>0);
  const t=r.til>0?r.til:0;const S=secLive(r);const cell=(k)=>{const v=S[k];if(!Number.isFinite(v.t)||v.old)return `<div class="qs"><span>S${k+1}</span><b>—</b></div>`;const best=cb[r.cls+k];const c=best&&v.t<=best+0.0005?'p':v.t<=pb[k]+0.0005?'g':'y';const d=Number.isFinite(pb[k])?v.t-pb[k]:NaN;
    return `<div class="qs ${c}"><span>S${k+1}</span><b>${fx(v.t,3)}</b><small>${Number.isFinite(d)?(d>0?'+':'')+fx(d,3):''}</small></div>`;};
  el.innerHTML=`<div class="qh"><span class="p" style="--cc:${LV_CLS(r.cls)}">${L.indexOf(r)+1||'—'}</span><b>${esc(tvName(r,'init'))}</b><span class="lt">${r.inPit?'PIT':fmtLap(t).replace(/^0:/,'')}</span></div>
    <div class="qss">${[0,1,2].map(cell).join('')}</div><div class="qt"><span>${tr('Da battere')} ${ref?esc(tvName(ref,'tla')):''}</span><b>${tvT(ref?.best)}</b><span>${tr('Personale')}</span><b>${tvT(r.best)}</b></div>`;};
// ---- track map
TVView.prototype.map=function(s,x){const cv=this.st.querySelector('.tvmap canvas');const W=440,H=300;cv.width=W*2;cv.height=H*2;cv.style.width=W+'px';cv.style.height=H+'px';const g=cv.getContext('2d');g.setTransform(2,0,0,2,0,0);g.clearRect(0,0,W,H);
  const pts=[...LIVE.trail.values()];const cars=x.rows.filter(r=>!r.gar&&(r.x||r.z));const all=pts.length>30?pts:cars.map(r=>[r.x,r.z]);if(!all.length)return;
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;all.forEach(([a,b])=>{x0=Math.min(x0,a);x1=Math.max(x1,a);z0=Math.min(z0,b);z1=Math.max(z1,b);});const pad=18,k=Math.min((W-2*pad)/((x1-x0)||1),(H-2*pad)/((z1-z0)||1));const ox=(W-(x1-x0)*k)/2,oz=(H-(z1-z0)*k)/2;const T=(a,b)=>[ox+(a-x0)*k,H-(oz+(b-z0)*k)];
  g.fillStyle='rgba(255,255,255,.28)';pts.forEach(([a,b])=>{const [p,q]=T(a,b);g.fillRect(p-1.6,q-1.6,3.2,3.2);});
  const f=x.focus;cars.sort((a,b)=>(a===f)-(b===f)).forEach(r=>{const [p,q]=T(r.x,r.z);g.beginPath();g.arc(p,q,r===f?7:4.5,0,7);g.fillStyle=LV_CLS(r.cls);g.fill();if(r===f){g.lineWidth=2.5;g.strokeStyle='#fff';g.stroke();g.font='700 12px '+TV_FONTS[s.font];g.fillStyle='#fff';g.fillText(tvName(r,'tla'),p+10,q+4);}});};
// ---- weather
TVView.prototype.wx=function(s,x){const el=this.st.querySelector('.tvwx');const I=x.I;const N=LIVE.wx?.nodes||[];const end=I.end>0?I.end:0;
  el.innerHTML=`<div class="wh">${tr('METEO')}</div><div class="wn"><b>${esc(tr(skyNow?skyNow(I):''))}</b><span>${tr('Aria')} ${fx(I.air,1)}° · ${tr('Pista')} ${fx(I.tt,1)}° · ${tr('Bagnato')} ${Math.round((I.wavg||0)*100)}%</span></div>
    ${N.length?`<div class="wf">${N.map((n,i)=>{const rc=n.rain>1?n.rain:n.rain*100;return `<div><span>${i===0?tr('INIZIO'):i===N.length-1?tr('FINE'):Math.round(i/(N.length-1)*100)+'%'}</span><b>${fx(n.temp??n.t??NaN,0)}°</b><small>${Math.round(rc||0)}%</small></div>`;}).join('')}</div>`:''}`;};
// ---- onboard telemetry (our cars only: the bridge sends inputs)
TVView.prototype.onb=function(s,x){const el=this.st.querySelector('.tvonb');const f=x.focus;const stt=liveCarState(f?.veh||LIVE.focus);const c=stt.c;if(!c||!stt.live){el.innerHTML=`<div class="oh">${tr('Telemetria disponibile solo per le auto della squadra')}</div>`;return;}
  const rpm=c.rpm||0,mx=c.rpmMax||Math.max(9000,rpm);const a=Math.max(0,Math.min(1,rpm/mx));const B=LIVE.buf[stt.c.car||LIVE.focus]||[];const last=B[B.length-1]||[];const thr=last[2]??c.thr??0,brk=last[3]??c.brk??0;
  el.innerHTML=`<svg viewBox="0 0 200 120" class="arc"><path d="M20 110 A80 80 0 0 1 180 110" class="bgp"/><path d="M20 110 A80 80 0 0 1 180 110" class="fgp${a>0.92?' hi':''}" style="stroke-dasharray:${251*a} 300"/></svg>
    <div class="spd"><b>${fx(c.spd??last[1],0)}</b><span>km/h</span></div><div class="gear">${c.gear<0?'R':c.gear===0?'N':c.gear??'—'}</div>
    <div class="pd"><div><i class="t" style="height:${Math.round(thr*100)}%"></i></div><div><i class="b" style="height:${Math.round(brk*100)}%"></i></div></div>
    ${c.ve>0?`<div class="ove"><span>VE</span><b>${fx(c.ve*100,1)}%</b></div>`:''}`;};
// ---- results / classification
TVView.prototype.res=function(s,x){const el=this.st.querySelector('.tvres');const L=tvOrder(x,s.res.cls||'');const per=10;const pages=Math.max(1,Math.ceil(L.length/per));
  if(Date.now()-this.resAt>8000){this.resAt=Date.now();this.resPage=(this.resPage+1)%pages;}const pg=Math.min(this.resPage,pages-1);const part=L.slice(pg*per,pg*per+per);const ld=L[0];
  el.innerHTML=`<div class="rh"><b>${x.kind==='race'?tr('CLASSIFICA'):tr('TEMPI')}</b><span>${s.res.cls?esc(s.res.cls):tr('Tutte le classi')}${pages>1?` · ${pg+1}/${pages}`:''}</span></div>
    <div class="rt">${part.map((r,i)=>{const p=pg*per+i+1;const g=x.kind==='race'?(r===ld?`${r.laps} ${tr('GIRI')}`:r.lapsL-ld.lapsL>0&&tvGapTo(x,r,ld)>x.lt(r)?`+${r.lapsL-ld.lapsL} ${tr('GIRI')}`:'+'+fx(s.res.cls?tvGapTo(x,r,ld):r.gapL,1)):(r===ld?tvT(r.best):r.best>0?'+'+fx(r.best-ld.best,3):'—');
      return `<div class="rr${r.fin>=2?' dnf':''}"><span class="p">${p}</span><i class="cs" style="background:${LV_CLS(r.cls)}"></i><span class="nb">${esc(tvNum(r))}</span><b>${esc(tvName(r,'full').toUpperCase())}</b><small>${esc(r.team||'')}</small><span class="g">${g}</span><span class="bl">${tvT(r.best)}</span></div>`;}).join('')}</div>`;};
// ---- banners: fastest lap, race control, pit stops, final lap
TVView.prototype.push=function(b){if(this.ban.some(z=>z.key===b.key)||this.banSeen?.has(b.key))return;(this.banSeen||(this.banSeen=new Set())).add(b.key);this.ban.push(b);if(this.ban.length>6)this.ban.shift();};
TVView.prototype.banners=function(s,x){const el=this.st.querySelector('.tvban');const now=Date.now();const ready=this.ready||(this.ready=now+4000);const live=now>ready;// no banners for what was already there on load
  const cb={};x.rows.forEach(r=>{if(r.best>0&&(!cb[r.cls]||r.best<cb[r.cls].best))cb[r.cls]=r;});
  Object.entries(cb).forEach(([c,r])=>{const pv=this.cb[c];this.cb[c]={veh:r.veh,best:r.best};if(live&&s.show.flb&&pv&&r.best<pv.best-0.0005)this.push({key:'fl|'+c+'|'+r.best,k:'fl',h:`<span class="bk" style="--cc:${LV_CLS(c)}">${tr('GIRO PIÙ VELOCE')} · ${esc(c)}</span><b>#${esc(tvNum(r))} ${esc(tvName(r,'init'))}</b><em>${tvT(r.best)}</em>`});});
  const st=LIVE.field?.stream||[];st.slice(-30).forEach(e=>{if(e.tag!=='Penalty'||!/received/i.test(e.txt))return;const k='pen|'+e.et+'|'+e.drv;if(this.penSeen.has(k))return;this.penSeen.add(k);if(!live||!s.show.rc)return;
    const t=/drive.?through/i.test(e.txt)?'DRIVE THROUGH':/stop.?go/i.test(e.txt)?'STOP & GO':(e.txt.match(/(\d+)\s*s(ec)?/i)||[])[1]?`+${(e.txt.match(/(\d+)\s*s/i)||[])[1]} s`:tr('PENALITÀ');
    const r=x.rows.find(z=>z.drv===e.drv);this.push({key:k,k:'rc',h:`<span class="bk rc">${tr('DIREZIONE GARA')}</span><b>${r?'#'+esc(tvNum(r))+' ':''}${esc((e.drv||'').toUpperCase())}</b><em>${esc(t)}</em>`});});
  if(x.I.yel>0&&!this.fcy&&live&&s.show.rc)this.push({key:'fcy|'+Math.round(x.I.et||0),k:'rc',h:`<span class="bk y">${tr('DIREZIONE GARA')}</span><b>${esc((FCY[x.I.yel]||'FULL COURSE YELLOW').toUpperCase())}</b>`});this.fcy=x.I.yel>0;
  const ld=tvOrder(x,'')[0];if(ld&&x.kind==='race'&&!this.finalShown){const I=x.I;const fin=I.maxLaps>0&&I.maxLaps<99999?ld.laps===I.maxLaps-1:(I.rem<=0&&I.et>60);if(fin){this.finalShown=true;if(live&&s.show.rc)this.push({key:'final',k:'rc',h:`<span class="bk">${tr('ULTIMO GIRO')}</span>`});}}
  const F=LIVE.field?.cars||{};const f=x.focus;Object.entries(F).forEach(([veh,c])=>{const n=(c.pits||[]).length;const pv=this.pits.get(veh);this.pits.set(veh,n);if(pv==null||n<=pv||!live||!s.show.pitb)return;
    const r=x.rows.find(z=>z.veh===veh);if(!r)return;if(s.pitb==='focus'&&r!==f)return;if(s.pitb==='class'&&f&&r.cls!==f.cls)return;const p=c.pits[n-1];
    this.push({key:'pit|'+veh+'|'+p.in,k:'pit',h:`<span class="bk pit">${tr('SOSTA')}</span><b>#${esc(tvNum(r))} ${esc(tvName(r,'init'))}</b><em>${fx(p.stop,1)} s${p.tyres?` · ${p.tyres} ${tr('GOMME')}`:''}${p.ve>0.01?` · +${Math.round(p.ve*100)}% VE`:p.fuel>0.01?` · +${Math.round(p.fuel*100)}% ${tr('BENZ.')}`:''}${p.d0&&p.d1&&p.d0!==p.d1?` · ${tr('CAMBIO PILOTA')}`:''}</em>`});});
  if(this.banCur&&now>this.banCur.until){this.banCur=null;el.classList.remove('on');}
  if(!this.banCur&&this.ban.length){const b=this.ban.shift();this.banCur={...b,until:now+6500};el.className='tvz tvban on k-'+b.k;el.innerHTML=b.h;}};

// ---------- control state transport ----------
// sent at most ~4 times a second and only when something changed (sliders fire continuously)
let tvQ=null,tvTm=0,tvLast='';
function tvSend(st){LS.set('tv:state',st);LIVE.ovc={...st,at:Date.now()};tvQ=st;clearTimeout(tvTm);tvTm=setTimeout(tvFlush,250);}
function tvFlush(){const st=tvQ;tvQ=null;if(!st)return;const js=JSON.stringify(st);if(js===tvLast)return;tvLast=js;const msg={...st,at:Date.now()};
  if(isBridgeHost())fetch('/ovc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(msg)}).catch(()=>{});
  const t=teamParse(LS.get('live:team',''));if(t&&LIVE.mq)liveSeal(t,msg).then(b=>LIVE.mq.pub('de/'+t.t+'/regia/ovc',b,true)).catch(()=>{});}
(function(){const base=liveIn_;window.liveIn_=liveIn_=function(id,kind,d,ret){if(kind==='ovc'){if(d&&typeof d==='object')LIVE.ovc=d;return;}return base(id,kind,d,ret);};})();

// ---------- the OBS page (#tv) ----------
(function(){if(!/^#tv(&|$)/.test(location.hash))return;const p=new URLSearchParams(location.hash.replace(/^#tv&?/,''));document.documentElement.classList.add('ovmode','tvmode');
  const root=document.createElement('div');root.id='ovRoot';document.body.appendChild(root);const v=new TVView(root);
  window.renderLive=renderLive=function(){};const t=p.get('t');if(t&&teamParse(t))LS.set('live:team',t);liveStart();
  const fix=()=>{root.style.width=innerWidth+'px';root.style.height=innerHeight+'px';};fix();addEventListener('resize',fix);
  setInterval(()=>{const st=tvMerge(TV_DEF,LIVE.ovc||LS.get('tv:state',{}));v.render(st);},250);})();

// ---------- Regia (Muretto › Regia TV) ----------
function tvUrl(){const base=(isBridgeHost()||isFileHost())?location.href.split('#')[0]:'http://localhost:8790/';const t=LS.get('live:team','');return base+'#tv'+(!isBridgeHost()&&t?'&t='+encodeURIComponent(t):'');}
function lvRegia(x){const el=$('#lvTv');if(!el)return;let st=tvState();
  if(!el.dataset.ok){el.dataset.ok=1;
    el.innerHTML=`<div class="rgrid"><div class="rcol">
      <div class="panel"><div class="panel-h"><h3>${tr('In onda')}</h3><span class="muted small">${tr('clic per accendere o spegnere')}</span></div><div class="rgb" id="rgG"></div></div>
      <div class="panel"><div class="panel-h"><h3>${tr('Inquadratura')}</h3></div><div class="row" style="gap:8px;flex-wrap:wrap"><label class="f" style="min-width:240px">${tr('Auto in primo piano')}<select id="rgF"></select></label>
        <button class="btn" type="button" data-fq="lead">${tr('Leader')}</button><button class="btn" type="button" data-fq="ahead">${tr('Davanti')}</button><button class="btn" type="button" data-fq="behind">${tr('Dietro')}</button><button class="btn" type="button" data-fq="ours">${tr('Nostra auto')}</button></div></div>
      <div class="panel"><div class="panel-h"><h3>${tr('Classifica')}</h3></div><div class="setgrid">
        <label class="f">${tr('Righe')}<input type="number" id="rgRows" min="5" max="30"></label>
        <label class="f">${tr('Colonna dati')}<select id="rgInfo"><option value="gap">${tr('Distacco')}</option><option value="int">${tr('Intervallo')}</option><option value="last">${tr('Ultimo giro')}</option><option value="best">${tr('Miglior giro')}</option><option value="ve">${tr('Energia')}</option><option value="pits">${tr('Soste')}</option><option value="tyre">${tr('Gomme')}</option><option value="cycle">${tr('A rotazione')}</option></select></label>
        <label class="f">${tr('Classe')}<select id="rgCls"></select></label><label class="f">${tr('Nomi')}<select id="rgName"><option value="init">S. LAI</option><option value="sur">LAI</option><option value="tla">LAI (3)</option><option value="full">Stefano Lai</option><option value="team">${tr('Squadra')}</option><option value="car">${tr('Auto')}</option></select></label>
        <label class="f">${tr('Lato')}<select id="rgSide"><option value="l">${tr('sinistra')}</option><option value="r">${tr('destra')}</option></select></label><label class="f">${tr('Secondi a rotazione')}<input type="number" id="rgCyc" min="3" max="60"></label></div>
        <div class="row" style="gap:14px;margin-top:8px;flex-wrap:wrap"><label class="chk"><input type="checkbox" id="rgNum"> ${tr('numero')}</label><label class="chk"><input type="checkbox" id="rgTy"> ${tr('gomme')}</label><label class="chk"><input type="checkbox" id="rgVe"> ${tr('energia')}</label><label class="chk"><input type="checkbox" id="rgAnim"> ${tr('animazioni')}</label></div></div>
      <div class="panel"><div class="panel-h"><h3>${tr('Banner e risultati')}</h3></div><div class="setgrid"><label class="f">${tr('Soste da annunciare')}<select id="rgPitb"><option value="focus">${tr('solo auto in primo piano')}</option><option value="class">${tr('classe in primo piano')}</option><option value="all">${tr('tutte')}</option></select></label>
        <label class="f">${tr('Classe nei risultati')}<select id="rgRes"></select></label><label class="f">${tr('Titolo evento')}<input type="text" id="rgTitle" maxlength="40" placeholder="Fuji 6 Ore"></label></div></div>
      <div class="panel"><div class="panel-h"><h3>${tr('Stile')}</h3></div><div class="rgp" id="rgPre"></div><div class="setgrid" style="margin-top:10px">
        <label class="f">${tr('Colore principale')}<input type="color" id="rgAcc"></label><label class="f">${tr('Sfondo')}<input type="color" id="rgBg"></label><label class="f">${tr('Testo')}<input type="color" id="rgInk"></label><label class="f">${tr('Evidenza')}<input type="color" id="rgHl"></label>
        <label class="f">${tr('Opacità')}<input type="range" id="rgOp" min="0.3" max="1" step="0.02"></label><label class="f">${tr('Angoli')}<input type="range" id="rgRad" min="0" max="16" step="1"></label><label class="f">${tr('Dimensione')}<input type="range" id="rgSc" min="0.7" max="1.4" step="0.02"></label>
        <label class="f">${tr('Carattere')}<select id="rgFont"><option value="titillium">Titillium</option><option value="barlow">Barlow Condensed</option><option value="mono">Mono</option></select></label>
        <label class="f">${tr('Mappa')}<select id="rgPmap"><option value="tr">${tr('in alto a destra')}</option><option value="br">${tr('in basso a destra')}</option><option value="tl">${tr('in alto a sinistra')}</option></select></label>
        <label class="f">${tr('Duello')}<select id="rgPbattle"><option value="br">${tr('in basso a destra')}</option><option value="bc">${tr('in basso al centro')}</option><option value="tr">${tr('in alto a destra')}</option></select></label>
        <label class="f">${tr('Scheda pilota')}<select id="rgPcard"><option value="bl">${tr('in basso a sinistra')}</option><option value="bc">${tr('in basso al centro')}</option></select></label></div>
        <label class="chk" style="margin-top:8px"><input type="checkbox" id="rgUp"> ${tr('scritte in maiuscolo')}</label></div>
      <div class="panel"><div class="panel-h"><h3>${tr('Indirizzo per OBS')}</h3></div><div class="obsu"><span>${tr('Grafica TV')}</span><input type="text" readonly id="rgUrl"><button class="btn" type="button" id="rgCopy">${tr('Copia')}</button></div>
        <p class="muted small">${tr('In OBS: Fonti › + › Browser, 1920 × 1080, togli la spunta a «File locale». Tutto quello che cambi qui va in onda subito su ogni OBS collegato (bridge di questo PC o squadra).')}</p></div></div>
      <div class="rcol"><div class="panel rprev"><div class="panel-h"><h3>${tr('Anteprima')}</h3><span class="muted small">1920 × 1080</span></div><div class="tvprev"><div id="rgPrev"></div></div></div></div></div>`;
    const set=(f)=>{st=tvState();f(st);tvSend(st);lvRegiaSync(st,x);};
    $('#rgG').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;set(s=>{s.show[b.dataset.g]=s.show[b.dataset.g]?0:1;});});
    $('#rgPre').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(!b)return;const P=TV_PRESETS[b.dataset.p];set(s=>{s.preset=b.dataset.p;s.col={...P.col};s.op=P.op;s.rad=P.rad;s.font=P.font;s.up=P.up;});});
    $('#rgF').onchange=e=>set(s=>{s.focus=e.target.value;});
    $$('#lvTv [data-fq]').forEach(b=>b.onclick=()=>{const X=tvCtx(tvState());const f=X.focus;const L=f?tvOrder(X,f.cls):[];const i=L.indexOf(f);const k=b.dataset.fq;
      const t=k==='lead'?L[0]:k==='ahead'?L[i-1]:k==='behind'?L[i+1]:X.rows.find(r=>r.veh===LIVE.focus);if(t)set(s=>{s.focus=t.veh;});});
    const bind=(id,fn,ev='change')=>{$(id).addEventListener(ev,e=>set(s=>fn(s,e.target)));};
    bind('#rgRows',(s,t)=>s.tower.rows=+t.value||16);bind('#rgInfo',(s,t)=>s.tower.info=t.value);bind('#rgCls',(s,t)=>s.tower.cls=t.value);bind('#rgName',(s,t)=>s.name=t.value);bind('#rgSide',(s,t)=>s.tower.side=t.value);bind('#rgCyc',(s,t)=>s.tower.cyc=+t.value||8);
    bind('#rgNum',(s,t)=>s.tower.num=t.checked?1:0);bind('#rgTy',(s,t)=>s.tower.tyre=t.checked?1:0);bind('#rgVe',(s,t)=>s.tower.ve=t.checked?1:0);bind('#rgAnim',(s,t)=>s.anim=t.checked?1:0);
    bind('#rgPitb',(s,t)=>s.pitb=t.value);bind('#rgRes',(s,t)=>s.res.cls=t.value);bind('#rgTitle',(s,t)=>s.title=t.value.trim(),'input');
    [['#rgAcc','acc'],['#rgBg','bg'],['#rgInk','ink'],['#rgHl','hl']].forEach(([id,k])=>bind(id,(s,t)=>{s.col[k]=t.value;s.preset='custom';},'input'));
    bind('#rgOp',(s,t)=>s.op=+t.value,'input');bind('#rgRad',(s,t)=>s.rad=+t.value,'input');bind('#rgSc',(s,t)=>s.sc=+t.value,'input');bind('#rgFont',(s,t)=>s.font=t.value);bind('#rgUp',(s,t)=>s.up=t.checked?1:0);
    bind('#rgPmap',(s,t)=>s.pos.map=t.value);bind('#rgPbattle',(s,t)=>s.pos.battle=t.value);bind('#rgPcard',(s,t)=>s.pos.card=t.value);
    $('#rgCopy').onclick=()=>navigator.clipboard?.writeText($('#rgUrl').value).then(()=>toast(tr('Copiato')),()=>{});
    LIVE.tvPrev=new TVView($('#rgPrev'));tvSend(st);}
  lvRegiaSync(st,x);}
function lvRegiaSync(st,x){const g=$('#rgG');if(!g)return;
  g.innerHTML=TV_G.map(([k,l])=>`<button type="button" class="rgbtn${st.show[k]?' on':''}" data-g="${k}"><i></i>${tr(l)}</button>`).join('');
  $('#rgPre').innerHTML=Object.entries(TV_PRESETS).map(([k,P])=>`<button type="button" class="rgpre${st.preset===k?' on':''}" data-p="${k}" style="--a:${P.col.acc};--b:${P.col.bg};--h:${P.col.hl}"><i></i>${esc(P.name)}</button>`).join('');
  const rows=x.rows||[];const fo=`<option value="">${esc(tr('automatica (nostra auto)'))}</option>`+[...rows].sort((a,b)=>a.pos-b.pos).map(r=>`<option value="${esc(r.veh)}">P${r.pos} · ${esc(r.drv)} · ${esc(r.label||r.veh)}</option>`).join('');const F=$('#rgF');if(F.dataset.o!==fo){F.innerHTML=fo;F.dataset.o=fo;}F.value=st.focus||'';
  const cls=[...new Set(rows.map(r=>r.cls))];const co=`<option value="">${esc(tr('Tutte'))}</option><option value="auto">${esc(tr('A rotazione'))}</option>`+cls.map(c=>`<option>${esc(c)}</option>`).join('');const C=$('#rgCls');if(C.dataset.o!==co){C.innerHTML=co;C.dataset.o=co;}C.value=st.tower.cls||'';
  const ro=`<option value="">${esc(tr('Tutte'))}</option>`+cls.map(c=>`<option>${esc(c)}</option>`).join('');const Rs=$('#rgRes');if(Rs.dataset.o!==ro){Rs.innerHTML=ro;Rs.dataset.o=ro;}Rs.value=st.res.cls||'';
  const v=(id,val)=>{const e=$(id);if(e&&document.activeElement!==e){if(e.type==='checkbox')e.checked=!!val;else e.value=val;}};
  v('#rgRows',st.tower.rows);v('#rgInfo',st.tower.info);v('#rgName',st.name);v('#rgSide',st.tower.side);v('#rgCyc',st.tower.cyc);v('#rgNum',st.tower.num);v('#rgTy',st.tower.tyre);v('#rgVe',st.tower.ve);v('#rgAnim',st.anim);
  v('#rgPitb',st.pitb);v('#rgTitle',st.title);v('#rgAcc',st.col.acc);v('#rgBg',st.col.bg);v('#rgInk',st.col.ink);v('#rgHl',st.col.hl);v('#rgOp',st.op);v('#rgRad',st.rad);v('#rgSc',st.sc);v('#rgFont',st.font);v('#rgUp',st.up);
  v('#rgPmap',st.pos.map);v('#rgPbattle',st.pos.battle);v('#rgPcard',st.pos.card);v('#rgUrl',tvUrl());}
// preview runs on its own timer while the Regia is open
setInterval(()=>{const p=LIVE.tvPrev;if(!p||!p.root.isConnected||p.root.offsetParent===null)return;p.render(tvState());},300);
// Muretto: new tab
(function(){LV_SUBS.push(['tv','Regia TV']);const base=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){const v=$('#v-live');const fresh=!v.dataset.ok;base();if(!fresh||$('#lvTv'))return;
    const sub=LS.get('live:sub','ov');const d=document.createElement('div');d.className='lvsub';d.dataset.p='tv';d.hidden=sub!=='tv';d.innerHTML='<div id="lvTv"></div>';v.appendChild(d);};
  const rl=renderLive;window.renderLive=renderLive=function(force){rl(force);if(!document.documentElement.classList.contains('ovmode')&&curView()==='live'&&LS.get('live:sub','ov')==='tv'){try{lvRegia({rows:liveRows(LIVE.sc)});}catch(e){console.error(e);}}};})();

// keyboard: 1…8 switch the Muretto tabs (not while typing)
addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName||''))return;if(curView()!=='live')return;const i=+e.key;if(!(i>=1&&i<=LV_SUBS.length))return;const b=$$('#v-live .lvtabs button')[i-1];if(b){b.click();e.preventDefault();}});
