// ================= 1.6: fine gara, piloti, finestra di sosta, undercut, mappa, overlay OBS, confronto setup =================
const avgN=(a,n)=>{const b=a.filter(Number.isFinite);return b.length?avg_(b.slice(-n)):NaN;};
const fmtPct=(v,d=1)=>Number.isFinite(v)?fx(v*100,d)+' %':'—';
const fmtL=(v,d=1)=>Number.isFinite(v)?fx(v,d)+' L':'—';

// consumption per driver of our car, from the lap history
function drvCons(stt){const L=stt.laps.filter(l=>!l.pit&&l.n>1&&l.t>0);const by={};
  L.forEach(l=>{const d=l.drv||'—';(by[d]=by[d]||[]).push(l);});
  return Object.entries(by).map(([d,ls])=>{const v=avgN(ls.map(l=>l.ve>0&&l.ve<0.3?l.ve:NaN),8),f=avgN(ls.map(l=>l.fuel>0&&l.fuel<30?l.fuel:NaN),8);
    const ok=ls.filter(l=>!l.inv).map(l=>l.t);return {drv:d,n:ls.length,vpl:v,fpl:f,pace:med_(ok.slice(-10)),best:ok.length?Math.min(...ok):NaN,ratio:v>0&&f>0?f/(v*100):NaN};}).sort((a,b)=>b.n-a.n);}

function lvDrivers(x){const {stt,c}=x;const el=$('#lvDrv');if(!el)return;const D=drvCons(stt);
  if(!D.length||!c){el.innerHTML=`<div class="muted small">${tr('Servono giri completi senza soste.')}</div>`;return;}
  const cap=c.fuelCap>0?c.fuelCap:NaN;
  el.innerHTML=`<table><thead><tr><th class="l">${tr('Pilota')}</th><th>${tr('Giri')}</th><th>${tr('Consumo/giro')}</th><th>Ratio</th><th>${tr('Giri con l\'attuale')}</th><th>${tr('Stint pieno')}</th></tr></thead><tbody>${D.map(d=>{
    const lv=c.ve>0&&d.vpl>0?c.ve/d.vpl:NaN,lf=c.fuel>0&&d.fpl>0?c.fuel/d.fpl:NaN;const now=Math.min(Number.isFinite(lv)?lv:Infinity,Number.isFinite(lf)?lf:Infinity);
    const full=Math.min(d.vpl>0?1/d.vpl:Infinity,cap>0&&d.fpl>0?cap/d.fpl:Infinity);const me=c.drv&&d.drv===c.drv;
    return `<tr class="${me?'ours':''}"><td class="l">${esc(d.drv)}${me?` <span class="tag info">${tr('in auto')}</span>`:''}<div class="muted small">${tr('passo')} ${fmtLap(d.pace)}</div></td><td>${d.n}</td><td>${d.vpl>0?fmtPct(d.vpl,2):''}<div class="muted small">${fmtL(d.fpl,2)}</div></td><td>${fx(d.ratio,2)}</td>
      <td><b class="${now<2?'neg':''}">${Number.isFinite(now)?fx(now,1):'—'}</b>${Number.isFinite(lv)&&Number.isFinite(lf)?`<div class="muted small" title="${esc(tr('limite energia · limite benzina'))}">${fx(lv,1)} · ${fx(lf,1)}</div>`:''}</td><td>${Number.isFinite(full)?fx(full,1):'—'}</td></tr>`;}).join('')}</tbody></table>
    <p class="muted small" style="margin:8px 0 0">${tr('«Giri con l\'attuale»: quanti giri farebbe ogni pilota con l\'energia e la benzina che ci sono ora a bordo, con i suoi consumi. Ratio = litri di benzina per 1% di energia.')}</p>`;}

// what to put in at each remaining stop to reach the flag
function finPlan(x,src){const {sc,stt,c,S2,rows,me}=x;if(!c||!S2)return null;
  let v=S2.vpl,f=S2.fpl;if(src&&src!=='cur'){const d=drvCons(stt).find(z=>z.drv===src);if(d){if(d.vpl>0)v=d.vpl;if(d.fpl>0)f=d.fpl;}}
  if(!(f>0)&&!(v>0))return null;const lt=S2.lt||c.estL;const fl=finishLaps(rows,me,sc);let toGo=Number.isFinite(fl)?fl:S2.toGo;if(!Number.isFinite(toGo))return null;
  const done=lt>0&&c.til>0?Math.min(0.95,c.til/lt):0;const margin=0.3;const need=Math.max(0,toGo-done)+margin;
  const V0=c.ve>0?c.ve:NaN,F0=c.fuel,cap=c.fuelCap>0?c.fuelCap:NaN;const hasVE=v>0&&Number.isFinite(V0);
  const lapsNow=Math.min(hasVE?V0/v:Infinity,f>0?F0/f:Infinity);const stintMax=Math.min(hasVE?1/v:Infinity,cap>0&&f>0?cap/f:Infinity);
  const ratio=hasVE&&f>0?f/(v*100):NaN;const out={v,f,hasVE,toGo,need,lapsNow,stintMax,ratio,stops:[],lt};
  if(lapsNow>=need){out.spare=lapsNow-need;out.pushV=hasVE?V0/need:NaN;out.pushF=f>0?F0/need:NaN;return out;}
  if(!Number.isFinite(stintMax)||stintMax<1)return out;
  const first=Math.max(0,Math.floor(done+lapsNow-0.05));const R=need-Math.max(0,first-done);const n=Math.ceil(R/stintMax-1e-9);const Ri=Math.ceil(R);const base=Math.floor(Ri/n),extra=Ri%n;
  let resV=hasVE?V0-Math.max(0,first-done)*v:NaN,resF=F0-Math.max(0,first-done)*f;let lap=(c.lap-1)+first;
  for(let i=0;i<n;i++){const k=base+(i<extra?1:0);const last=i===n-1;const res=last?margin:0.2;
    const tV=hasVE?Math.min(1,(k+res)*v):NaN,tF=Math.min(Number.isFinite(cap)?cap:Infinity,(k+res)*f);
    out.stops.push({lap,k,last,tV,addV:hasVE?Math.max(0,tV-Math.max(0,resV)):NaN,tF,addF:Math.max(0,tF-Math.max(0,resF)),ratio:hasVE&&tV>0?tF/(tV*100):NaN});
    resV=hasVE?tV-k*v:NaN;resF=tF-k*f;lap+=k;}
  return out;}

function lvFinish(x){const {stt,c,S2}=x;const el=$('#lvFin');if(!el)return;const sel=$('#lvFinD');
  const D=drvCons(stt);const opts=`<option value="cur">${esc(tr('Ultimi 5 giri'))}</option>`+D.map(d=>`<option value="${esc(d.drv)}">${esc(d.drv)}</option>`).join('');
  if(sel&&sel.dataset.o!==opts){sel.innerHTML=opts;sel.dataset.o=opts;sel.value=LS.get('live:finD','cur');if(!sel.value)sel.value='cur';sel.onchange=e=>{LS.set('live:finD',e.target.value);renderLive(true);};}
  const P=finPlan(x,sel?sel.value:'cur');
  if(!P){el.innerHTML=`<div class="muted small">${tr('Serve la nostra auto in pista e almeno un giro completo senza soste.')}</div>`;return;}
  const k=[liveTile(tr('Giri alla bandiera'),'≈ '+fx(P.toGo,1),P.lt>0?`${tr('passo')} ${fmtLap(P.lt)}`:''),
    liveTile(tr('Giri con quello che hai'),fx(P.lapsNow,1),P.hasVE?`VE ${fmtPct(c.ve)} · ${fmtL(c.fuel)}`:fmtL(c.fuel)),
    liveTile(tr('Soste ancora necessarie'),P.spare!=null?'0':P.stops.length||'—',Number.isFinite(P.stintMax)&&P.stintMax<999?`${tr('stint pieno')} ≈ ${fx(P.stintMax,1)} ${tr('giri')}`:''),
    liveTile(tr('Ratio consigliato'),Number.isFinite(P.ratio)?fx(Math.ceil(P.ratio*1.03*100)/100,2):'—',Number.isFinite(P.ratio)?`${fx(P.f,2)} L ÷ ${fx(P.v*100,2)} % +3%`:tr('auto senza energia virtuale'))];
  let h=`<div class="kpis">${k.join('')}</div>`;
  if(P.spare!=null){h+=`<div class="finok"><b>${tr('Arrivi alla bandiera senza fermarti')}</b> · ${tr('margine')} ${fx(P.spare,1)} ${tr('giri')}${P.hasVE?` · ${tr('puoi usare fino a')} ${fmtPct(P.pushV,2)} ${tr('di energia a giro')}`:''}${P.pushF>0?` · ${fmtL(P.pushF,2)}/${tr('giro')}`:''}</div>`;}
  else if(P.stops.length){const S=P.stops;const show=S.length<=4?S.map((s,i)=>[s,i]):[[S[0],0],[S[1],1],null,[S[S.length-1],S.length-1]];
    h+=`<div class="tw" style="margin-top:10px"><table class="fint"><thead><tr><th class="l">${tr('Sosta')}</th><th>${tr('Box al giro')}</th><th>${tr('Giri dopo')}</th><th>${tr('VE da mettere')}</th><th>${tr('Benzina')}</th><th>Ratio</th></tr></thead><tbody>${show.map(z=>{if(!z)return `<tr><td class="l muted" colspan="6">… ${S.length-3} ${tr('soste uguali')} …</td></tr>`;const [s,i]=z;
      return `<tr class="${s.last?'finlast':''}"><td class="l">${s.last?`<b>${tr('Ultima')}</b>`:`${i+1}ª`}</td><td>${s.lap}</td><td>${s.k}</td><td title="${esc(tr('esci con')+' '+fmtPct(s.tV,0))}"><b>${P.hasVE?'+'+fmtPct(s.addV,0):'—'}</b></td><td title="${esc(tr('esci con')+' '+fmtL(s.tF,1))}"><b>+${fmtL(s.addF,1)}</b></td><td>${fx(s.ratio,2)}</td></tr>`;}).join('')}</tbody></table></div>`;
    const L=P.stops[P.stops.length-1];h+=`<div class="finok last"><b>${tr('Ultima sosta')} (${tr('giro')} ${L.lap})</b>: ${P.hasVE?`${tr('metti')} <b>${fmtPct(L.addV,0)}</b> ${tr('di energia')} (${tr('esci con')} ${fmtPct(L.tV,0)}), `:''}<b>${fmtL(L.addF,1)}</b> ${tr('di benzina')}${Number.isFinite(L.ratio)?`, ratio <b>${fx(L.ratio,2)}</b>`:''} → ${L.k} ${tr('giri fino alla bandiera')} (+${fx(0.3,1)} ${tr('di riserva')}).</div>`;}
  el.innerHTML=h+`<p class="muted small" style="margin:8px 0 0">${tr('Calcolo con i consumi scelti sopra, soste il più tardi possibile e stint uguali dopo la prima. Il ratio è la benzina (L) per ogni 1% di energia: impostalo nel menu box insieme all\'energia.')}</p>`;}

// ---------- pit lane tracking (entry time of every car in the pit lane) ----------
function pinTrack(rows,I){const P=LIVE.pin||(LIVE.pin={});const et=I?.et;if(!Number.isFinite(et))return P;const seen=new Set();
  rows.forEach(r=>{if(r.inPit&&!r.gar){seen.add(r.veh);if(!P[r.veh]||P[r.veh].et>et)P[r.veh]={et,st:0};if(r.pitSt===3)P[r.veh].st+=0;}});
  Object.keys(P).forEach(k=>{if(!seen.has(k))delete P[k];});return P;}
const carLoss=(veh,def)=>{const ps=(fCar(veh)?.pits||[]).filter(p=>!p.garage&&p.lane>0&&p.lane<200);const m=med_(ps.map(p=>p.lane+3));return Number.isFinite(m)?m:def;};
// projected gaps (s) of every other car relative to us, k laps from now
function pitProj(x,loss,k){const {rows,me,I}=x;if(!me)return null;const P=pinTrack(rows,I);const pace=r=>carStats(r.veh,r).pace5||r.estL||100;const lt=pace(me);
  const G=r=>r.gapL+r.lapsL*lt;return rows.filter(o=>o!==me&&!o.gar&&o.fin===0).map(o=>{const s=carStats(o.veh,o);let rel=G(o)-G(me)+k*(pace(o)-lt);let note='';
    if(o.inPit){const el=P[o.veh]?I.et-P[o.veh].et:0;rel+=Math.max(0,carLoss(o.veh,loss)-el);note='box';}
    else if(Number.isFinite(s.left)&&s.left<k+0.6){rel+=carLoss(o.veh,loss);note='sosta';}
    return {o,rel,note};});}
function rejoin(x,loss,k){const pr=pitProj(x,loss,k);if(!pr)return null;const {me}=x;let pos=1,pic=1,ah=null,bh=null,aC=null,bC=null;
  pr.forEach(p=>{const d=p.rel-loss;if(d<0){pos++;if(!ah||d>ah.d)ah={...p,d};if(p.o.cls===me.cls){pic++;if(!aC||d>aC.d)aC={...p,d};}}else{if(!bh||d<bh.d)bh={...p,d};if(p.o.cls===me.cls&&(!bC||d<bC.d))bC={...p,d};}});
  const traffic=(ah&&-ah.d<1.5)||(bh&&bh.d<1.5);return {k,pos,pic,ah,bh,aC,bC,traffic};}

function lvPitWindow(x,loss){const {stt,c,S2,me,I,kind}=x;const el=$('#lvPitOut');if(!el)return;const trk=I.trk||'';
  const man=+LS.get('pitloss:man:'+trk,0);
  const inp=`<div class="row" style="gap:10px;align-items:flex-end;margin-bottom:10px"><label class="f" style="min-width:170px">${tr('Tempo perso al box (s)')}<input type="number" id="lvLossIn" min="5" max="200" step="1" value="${man>0?man:''}" placeholder="${Number.isFinite(loss)?fx(loss,0):'30'}"></label><span class="muted small">${man>0?tr('valore impostato a mano'):Number.isFinite(loss)?tr('stimato da soste e menu box · scrivi un valore per correggerlo'):tr('nessuna sosta misurata: scrivi il tempo perso')}</span></div>`;
  if(!me||kind!=='race'){el.innerHTML=inp+`<div class="muted small">${tr('In gara: dove rientri fermandoti adesso o nei prossimi giri.')}</div>`;wireLoss(trk);return;}
  if(!Number.isFinite(loss)){el.innerHTML=inp;wireLoss(trk);return;}
  const kmax=Math.max(1,Math.min(6,S2&&Number.isFinite(S2.lastLap)&&c?S2.lastLap-(c.lap-1):4));const W=[];for(let k=0;k<=kmax;k++)W.push(rejoin(x,loss,k));
  const score=w=>w.pic*10+(w.traffic?3:0)+w.k*0.1;const best=W.reduce((a,b)=>score(b)<score(a)?b:a);
  const who=(p,sign)=>p?`<span class="clsdot" style="background:${LV_CLS(p.o.cls)}"></span>${esc(p.o.drv)} <b class="${Math.abs(p.d)<1.5?'neg':''}">${sign}${fx(Math.abs(p.d),1)}</b>${p.note==='box'?` <span class="tag info">${tr('ai box')}</span>`:p.note==='sosta'?` <span class="muted small">${tr('dopo la sua sosta')}</span>`:''}`:'—';
  const lap0=c?c.lap:(me.laps+1);
  el.innerHTML=inp+`<div class="tw"><table><thead><tr><th class="l">${tr('Box')}</th><th>${tr('Rientri')}</th><th class="l">${tr('Davanti')}</th><th class="l">${tr('Dietro')}</th><th></th></tr></thead><tbody>${W.map(w=>`<tr class="${w===best?'pwbest':''}"><td class="l">${w.k===0?tr('a fine giro'):tr('giro')+' '+(lap0+w.k)}${w===best?' <span class="tag good">★</span>':''}</td><td><b>P${w.pic}</b> <span class="muted small">P${w.pos}</span></td>
    <td class="l">${who(w.ah,'+')}</td><td class="l">${who(w.bh,'−')}</td><td>${w.traffic?`<span class="tag warn">${tr('traffico')}</span>`:`<span class="tag good">${tr('libero')}</span>`}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted small" style="margin:8px 0 0">${tr('Con')} ${fx(loss,0)} ${tr('s persi al box. Tiene conto del passo di ogni auto, di chi deve fermarsi prima e di chi è già ai box. ★ = rientro migliore (posizione, poi aria libera). Sulla mappa il cerchio tratteggiato è dove rientreresti adesso.')}</p>`;
  $('#lvPwT').textContent=`${tr('se ti fermi adesso')}: P${W[0].pic}`;LIVE.ghost=W[0].aC?W[0].aC.o.veh:(W[0].ah?W[0].ah.o.veh:null);wireLoss(trk);}
function wireLoss(trk){const i=$('#lvLossIn');if(!i||i.dataset.w)return;i.dataset.w=1;i.onchange=()=>{const v=+i.value;LS.set('pitloss:man:'+trk,v>0?v:0);renderLive(true);};}

// fresh-tyre gain for a class: lap time just before a stop with tyres vs 2–4 laps after
function freshGain(cls){const k='fg|'+cls;if(LIVE.memo&&LIVE.memo.has(k))return LIVE.memo.get(k);const G=[];
  Object.entries(LIVE.field?.cars||{}).forEach(([veh,c])=>{if(cls&&c.cls!==cls)return;const L=fLaps(veh);(c.pits||[]).forEach(p=>{if(!(p.tyres>=2)||p.garage)return;
    const pre=L.filter(l=>l[0]<p.lap&&l[0]>=p.lap-3&&!l[3]&&!l[7]&&l[1]>0).map(l=>l[1]),post=L.filter(l=>l[0]>=p.lap+2&&l[0]<=p.lap+4&&!l[3]&&!l[7]&&l[1]>0).map(l=>l[1]);
    if(pre.length&&post.length){const g=med_(pre)-med_(post);if(g>-3&&g<6)G.push(g);}});});
  const out={g:G.length>=2?Math.max(0,med_(G)):NaN,n:G.length};if(LIVE.memo)LIVE.memo.set(k,out);return out;}

function lvUndercut(x,loss){const {rows,me,I,kind}=x;const el=$('#lvUnd');if(!el)return;
  if(!me||kind!=='race'){el.innerHTML=`<div class="muted small">${tr('In gara: chi può farti l\'undercut e a chi puoi farlo tu.')}</div>`;return;}
  const P=pinTrack(rows,I);const FG=freshGain(me.cls);const gain=Number.isFinite(FG.g)?FG.g:0.8;const lt=carStats(me.veh,me).pace5||me.estL||100;const G=r=>r.gapL+r.lapsL*lt;
  const cl=rows.filter(r=>r.cls===me.cls&&r.fin===0&&!r.gar).sort((a,b)=>a.pos-b.pos);const i=cl.indexOf(me);const near=cl.slice(Math.max(0,i-2),i+3).filter(r=>r!==me&&Math.abs(G(r)-G(me))<60);
  const ms=carStats(me.veh,me);const myLeft=Number.isFinite(ms.left)?Math.floor(ms.left):NaN;
  const L=near.map(o=>{const s=carStats(o.veh,o);const d=G(o)-G(me);const ahead=d<0;const gap=Math.abs(d);const left=Number.isFinite(s.left)?Math.max(0,Math.floor(s.left)):NaN;
    let v='',k='';
    if(o.inPit){const el2=P[o.veh]?I.et-P[o.veh].et:0;const rem=Math.max(0,carLoss(o.veh,loss)-el2);const after=d+rem;
      v=`${tr('Ai box adesso')} (${fx(el2,0)} s): ${tr('esce')} ≈ ${after<0?fx(-after,1)+' s '+tr('davanti a te'):fx(after,1)+' s '+tr('dietro di te')}`;
      if(after>0&&after<loss){k='warn';v+=` · ${tr('se ti fermi ora rientri dietro: resta fuori e spingi (overcut)')}`;}else if(after>=loss){k='good';v+=` · ${tr('puoi fermarti senza perdere la posizione')}`;}else k='info';}
    else if(ahead){const need=gap-gain;const kk=Number.isFinite(left)?Math.max(1,Math.min(left,4)):1;
      if(need<0){k='good';v=`${tr('Undercut possibile')}: ${tr('fermati prima di lui')} (${tr('gomme nuove')} ≈ −${fx(gain,1)} s/${tr('giro')}, ${tr('distacco')} ${fx(gap,1)} s)`;}
      else if(gap-gain*kk<0){k='warn';v=`${tr('Undercut solo se lui resta fuori')} ${kk} ${tr('giri')} (${tr('si ferma tra')} ≈ ${left})`;}
      else{k='';v=`${tr('Undercut non basta')}: ${tr('mancano')} ${fx(need,1)} s${Number.isFinite(left)&&Number.isFinite(myLeft)&&myLeft>left?` · ${tr('tu puoi restare fuori più a lungo')} (${myLeft} ${tr('contro')} ${left} ${tr('giri')}): ${tr('prova l\'overcut')}`:''}`;}}
    else{if(gap-gain<0){k='bad';v=`${tr('Rischio undercut')}: ${tr('se si ferma ora può passarti')} · ${tr('copri fermandoti al giro dopo di lui')}`;}
      else{k='good';v=`${tr('Al sicuro')}: ${tr('margine')} ${fx(gap-gain,1)} s ${tr('sull\'undercut')}`;}}
    return `<div class="und ${k}" data-car="${esc(o.veh)}"><div class="uh"><span class="clsdot" style="background:${LV_CLS(o.cls)}"></span><b>P${o.pic} ${esc(o.drv)}</b><span class="muted small">${esc(o.label||o.veh)}</span><span class="ug">${ahead?'+':'−'}${fx(gap,1)} s ${ahead?tr('davanti'):tr('dietro')}</span></div>
      <div class="ui"><span>${tr('Stint')} ${s.stintLaps} ${tr('giri')}</span><span>${tr('Box tra')} ${Number.isFinite(left)?left:'—'}</span><span>${compHTML(o.comp,o.cf,o.cr)}</span>${s.lastPit?`<span>${tr('ultima sosta')} ${tr('giro')} ${s.lastPit.lap} · ${fx(s.lastPit.stop,1)} s</span>`:''}</div><div class="uv">${v}</div></div>`;});
  el.innerHTML=(L.join('')||`<div class="muted small">${tr('Nessuna auto della classe entro 60 s.')}</div>`)+`<p class="muted small" style="margin:8px 0 0">${tr('Gomme nuove')}: ≈ ${fx(gain,2)} s/${tr('giro')} ${FG.n?`(${tr('misurato su')} ${FG.n} ${tr('soste della classe')})`:`(${tr('stima: nessuna sosta con cambio gomme misurata')})`}. ${tr('Tu puoi restare fuori ancora')} ${Number.isFinite(myLeft)?myLeft:'—'} ${tr('giri')}.</p>`;}

// ---------- map: class leader, car ahead and car behind ----------
function mapRefs(x){const {rows,me,kind}=x;if(!me)return null;const cl=rows.filter(r=>r.cls===me.cls&&!r.gar);let L;
  if(kind==='race')L=cl.sort((a,b)=>a.pos-b.pos);else{L=cl.filter(r=>r.best>0).sort((a,b)=>a.best-b.best);if(!L.includes(me))L.push(me);}
  const i=L.indexOf(me);const lt=carStats(me.veh,me).pace5||me.estL||100;const G=r=>r.gapL+r.lapsL*lt;
  const gap=o=>kind==='race'?G(o)-G(me):(o.best>0&&me.best>0?o.best-me.best:NaN);
  const mk=(o,role,p)=>o&&o!==me?{o,role,p,gap:gap(o)}:null;
  return {me,P:i+1,lead:i>0?mk(L[0],'lead',1):null,ahead:i>1?mk(L[i-1],'ahead',i):null,behind:mk(L[i+1],'behind',i+2),kind};}
function mapXform(cv,sc){const pts=[...LIVE.trail.values()];const cars=(sc?.v||[]).filter(r=>!r[30]&&(r[21]||r[22]));const all=pts.length>30?pts:cars.map(r=>[r[21],r[22]]);if(!all.length)return null;
  const r=cv.getBoundingClientRect();let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;all.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  const pad=16,s=Math.min((r.width-2*pad)/((x1-x0)||1),(r.height-2*pad)/((z1-z0)||1));const ox=(r.width-(x1-x0)*s)/2,oz=(r.height-(z1-z0)*s)/2;return (x,z)=>[ox+(x-x0)*s,r.height-(oz+(z-z0)*s)];}
const MAPC={lead:'warn',ahead:'good',behind:'bad'};
function mapRefTxt(m,kind){if(!m)return '';const g=m.gap;const gs=Number.isFinite(g)?(kind==='race'?(g<0?'+'+fx(-g,1):'−'+fx(g,1)):(g<0?'−'+fx(-g,3):'+'+fx(g,3))):'';
  return `${m.role==='lead'?'P1':m.role==='ahead'?'▲ P'+m.p:'▼ P'+m.p}${gs?' · '+gs:''}`;}
(function(){const base=drawLiveMap;window.drawLiveMap=drawLiveMap=function(sc,ours){base(sc,ours);const cv=$('#lvMap');const leg=$('#lvMapLeg');if(!cv)return;
  const rows=liveRows(sc);const me=rows.find(r=>r.veh===LIVE.focus);const kind=sesKind(sc?.i);const M=mapRefs({rows,me,kind});if(!M){if(leg)leg.innerHTML='';return;}
  const T=mapXform(cv,sc);if(!T)return;const c=cv.getContext('2d');c.save();
  [M.lead,M.ahead,M.behind].filter(Boolean).forEach(m=>{const o=m.o;if(!(o.x||o.z))return;const [a,b]=T(o.x,o.z);const col=tok(MAPC[m.role]);
    c.beginPath();c.arc(a,b,9,0,7);c.lineWidth=2.5;c.strokeStyle=col;c.stroke();const t=mapRefTxt(m,kind);c.font='700 11px "JetBrains Mono",monospace';const w=c.measureText(t).width+10;
    const W=cv.getBoundingClientRect().width;const lx=Math.max(2,Math.min(W-w-2,m.role==='behind'?a-w-12:a+12)),ly=m.role==='behind'?b+8:b-26;c.fillStyle=col;c.beginPath();c.roundRect?c.roundRect(lx,ly,w,17,3):c.rect(lx,ly,w,17);c.fill();c.fillStyle='#0A0B0D';c.fillText(t,lx+5,ly+12.5);});
  // where we would rejoin now (race)
  if(kind==='race'&&!LS.get('live:sub','ov').startsWith('str')){const loss=liveLoss(liveCarState(LIVE.focus));if(Number.isFinite(loss)){const w=rejoin({rows,me,I:sc.i},loss,0);LIVE.ghost=w&&(w.aC||w.ah)?(w.aC||w.ah).o.veh:null;}}
  c.restore();
  if(leg){const it=[M.lead,M.ahead,M.behind].filter(Boolean);leg.innerHTML=`<span class="mlg me"><i></i>${tr('Tu')} · P${M.P} ${tr('di classe')}</span>`+it.map(m=>`<span class="mlg ${m.role}" data-car="${esc(m.o.veh)}"><i></i><b>${mapRefTxt(m,kind)}</b> ${esc(m.o.drv)}</span>`).join('')+(LIVE.ghost&&kind==='race'?`<span class="mlg gh"><i></i>${tr('rientro dopo la sosta')}</span>`:'');}};})();

// ================= OVERLAY OBS =================
// The same app opened with #ov=… shows only the chosen widgets on a transparent page: an OBS "Browser" source.
const OV_W=[['tower','Classifica','torre con posizioni e distacchi'],['battle','Duello','auto davanti e dietro con distacco e tendenza'],['rel','Relativo','auto vicine sul tracciato'],
  ['sec','Settori e giro','settori in diretta, ultimo giro, migliore, delta'],['fuel','Energia e benzina','VE, benzina, giri possibili, sosta'],['pit','Rientro dal box','dove rientreresti fermandoti adesso'],
  ['sess','Sessione','tempo o giri, bandiera, meteo'],['tyre','Gomme','temperature e usura viste dall\'alto'],['map','Mappa','pista con tutte le auto']];
const OV_DEF={w:['tower','battle','sec','fuel'],n:10,cls:1,sc:1,bg:0.8,lay:'col',car:'',tc:1};
const ovCfg=()=>({...OV_DEF,...LS.get('ov:cfg',{})});
function ovEncode(o,widgets){const p=new URLSearchParams();p.set('w',(widgets||o.w).join(','));p.set('n',o.n);p.set('cls',o.cls?1:0);p.set('sc',o.sc);p.set('bg',o.bg);p.set('lay',o.lay);if(o.car)p.set('car',o.car);
  const team=LS.get('live:team','');const local=isBridgeHost();if(o.tc&&team&&!local)p.set('t',team);return '#ov&'+p.toString();}
function ovDecode(h){const p=new URLSearchParams(h.replace(/^#ov&?/,''));const o={...OV_DEF};if(p.get('w'))o.w=p.get('w').split(',').filter(k=>OV_W.some(w=>w[0]===k));
  ['n','sc','bg'].forEach(k=>{if(p.get(k)!=null&&isFinite(+p.get(k)))o[k]=+p.get(k);});o.cls=p.get('cls')!=='0';if(p.get('lay'))o.lay=p.get('lay');o.car=p.get('car')||'';o.t=p.get('t')||'';return o;}

function ovCtx(o){const sc=LIVE.sc,I=sc?.i||{};LIVE.memo=new Map();const names=Object.keys(liveCars());
  if(o.car&&names.includes(o.car))LIVE.focus=o.car;else if(!names.includes(LIVE.focus)){const now=Date.now();LIVE.focus=names.find(n=>liveCars()[n].some(D=>D.car&&now-D.carAt<8000))||names[0]||'';}
  const rows=liveRows(sc);const me=rows.find(r=>r.veh===LIVE.focus);const stt=liveCarState(LIVE.focus);const c=stt.c;const S2=c&&liveStrat(stt,sc);return {sc,I,kind:sesKind(I),rows,me,stt,c,S2,names};}
const ovName=n=>{const p=String(n||'').trim().split(/\s+/);return p.length>1?(p[0][0]+'. '+p.slice(1).join(' ')):p[0]||'';};
const ovGapTxt=v=>Number.isFinite(v)?(v<0?'−':'+')+fx(Math.abs(v),1):'—';
function ovBox(t,body,cls=''){return `<div class="ovb ${cls}">${t?`<div class="ovh">${t}</div>`:''}${body}</div>`;}

function ovTower(x,o){const {rows,me,kind,I}=x;if(!rows.length)return ovBox(tr('Classifica'),`<div class="ovm">${tr('In attesa dei dati…')}</div>`);
  let L=rows.filter(r=>!o.cls||!me||r.cls===me.cls);L=kind==='race'?L.sort((a,b)=>a.pos-b.pos):L.filter(r=>r.best>0).sort((a,b)=>a.best-b.best);
  const N=Math.max(3,Math.min(30,o.n|0));let show=L.slice(0,N);if(me&&L.includes(me)&&!show.includes(me)){const i=L.indexOf(me);show=[...L.slice(0,N-3),null,...L.slice(i-1,i+2)].filter((v,j,a)=>v!==undefined);}
  const lt=me?carStats(me.veh,me).pace5||me.estL||100:100;const G=r=>r.gapL+r.lapsL*lt;const first=L[0];let prev=null;
  const body=show.map(r=>{if(!r){prev=null;return '<div class="ovr sep">⋯</div>';}const i=L.indexOf(r);let g;
    if(kind==='race'){g=i===0?(o.cls?tr('Leader'):tr('Leader')):r.lapsL>first.lapsL&&(G(r)-G(first))>lt?`+${r.lapsL-first.lapsL}G`:'+'+fx(G(r)-G(first),1);}
    else g=i===0?fmtLap(r.best):'+'+fx(r.best-first.best,3);
    prev=r;return `<div class="ovr${r===me?' me':''}${r.inPit||r.gar?' pit':''}"><span class="p">${i+1}</span><i class="cb" style="background:${LV_CLS(r.cls)}"></i><span class="n">${esc(ovName(r.drv))}</span>${r.inPit?'<span class="tagp">BOX</span>':''}<span class="g">${g}</span></div>`;}).join('');
  return ovBox(`${kind==='race'?tr('Gara'):kind==='qual'?tr('Qualifica'):tr('Prove')}${o.cls&&me?' · '+esc(me.cls):''}`,body,'tower');}

function ovBattle(x){const {rows,me,kind,I}=x;if(!me)return ovBox(tr('Duello'),`<div class="ovm">—</div>`);const M=mapRefs(x);
  const T=LIVE.ovT||(LIVE.ovT={});const et=I.et||0;const trend=(veh,g)=>{const h=T[veh]||(T[veh]=[]);if(!h.length||et-h[h.length-1].et>=1)h.push({et,g});while(h.length>200)h.shift();const lt=carStats(me.veh,me).pace5||90;const old=h.find(s=>et-s.et<=lt*1.05)||h[0];return old&&et-old.et>5?g-old.g:NaN;};
  const one=(m,lab)=>{if(!m)return `<div class="ovd none"><span class="lb">${lab}</span><span class="n">—</span></div>`;const g=m.gap;const ab=Math.abs(g);const tdv=trend(m.o.veh,ab);
    const closing=Number.isFinite(tdv)&&tdv<-0.05,opening=Number.isFinite(tdv)&&tdv>0.05;const good=m.role==='behind'?opening:closing;
    return `<div class="ovd ${m.role}"><span class="lb">${lab}</span><span class="p">P${m.p}</span><span class="n">${esc(ovName(m.o.drv))}</span><span class="g">${kind==='race'?fx(ab,1):(g<0?'−':'+')+fx(ab,3)}</span>${Number.isFinite(tdv)&&kind==='race'?`<span class="tr ${good?'ok':'ko'}">${tdv<0?'▼':'▲'} ${fx(Math.abs(tdv),1)}</span>`:''}</div>`;};
  const ah=M&&(M.ahead||(M.lead&&M.P===2?{...M.lead,role:'ahead',p:1}:null));
  return ovBox(`${tr('Duello')} · P${M?M.P:'—'}`,one(ah,tr('Davanti'))+one(M&&M.behind,tr('Dietro')),'battle');}

function ovRel(x){const {rows,me,I}=x;const LD=I.lapDist;if(!me||!(LD>0))return ovBox(tr('Relativo'),`<div class="ovm">—</div>`);const lt=carStats(me.veh,me).pace5||me.estL||100;const myP=me.laps+me.ld/LD;
  const rel=rows.filter(r=>r!==me&&!r.gar&&r.fin===0).map(r=>{const d=((r.ld-me.ld)%LD+LD*1.5)%LD-LD/2;const lapd=Math.round(r.laps+r.ld/LD-myP-d/LD);return {r,d,t:d/LD*lt,lapd};}).sort((a,b)=>b.d-a.d);
  const list=[...rel.filter(q=>q.d>0).slice(-3),{me:true},...rel.filter(q=>q.d<=0).slice(0,3)];
  return ovBox(tr('Relativo'),list.map(q=>q.me?`<div class="ovr me"><span class="p">${me.pic}</span><i class="cb" style="background:${LV_CLS(me.cls)}"></i><span class="n">${esc(ovName(me.drv))}</span><span class="g">—</span></div>`:
    `<div class="ovr${q.lapd>0?' up':q.lapd<0?' dn':''}${q.r.inPit?' pit':''}"><span class="p">${q.r.pic}</span><i class="cb" style="background:${LV_CLS(q.r.cls)}"></i><span class="n">${esc(ovName(q.r.drv))}</span><span class="g">${q.t>0?'+':'−'}${fx(Math.abs(q.t),1)}</span></div>`).join(''),'rel');}

function ovSec(x){const {rows,me,c}=x;if(!me)return ovBox(tr('Giro'),`<div class="ovm">—</div>`);const cb=secClassBest(rows);const cs=carStats(me.veh,me);
  const db=c&&Number.isFinite(c.db)?c.db:NaN;
  return ovBox(`${tr('Giro')} ${c?c.lap:me.laps+1}`,`<div class="ovsec">${secCells(me,cb,'span')}</div><div class="ovl"><div><span>${tr('Ultimo')}</span><b class="${cs.lastInv?'neg':''}">${fmtLap(cs.lastT>0?cs.lastT:me.last)}</b></div><div><span>${tr('Migliore')}</span><b class="bst">${fmtLap(me.best)}</b></div>${Number.isFinite(db)?`<div><span>Delta</span><b class="${db<0?'pos':'neg'}">${db>0?'+':''}${fx(db,2)}</b></div>`:''}</div>`,'sec');}

function ovFuel(x){const {c,S2,rows,me,sc}=x;if(!c)return ovBox(tr('Energia'),`<div class="ovm">—</div>`);const fl=finishLaps(rows,me,sc);const ve=c.ve>0;
  const bar=(v,l,s)=>`<div class="ovbar"><span class="l">${l}</span><span class="t"><i style="width:${Math.max(0,Math.min(100,v*100))}%" class="${v<0.12?'low':''}"></i></span><b>${s}</b></div>`;
  return ovBox(tr('Energia e benzina'),(ve?bar(c.ve,'VE',fmtPct(c.ve,1)):'')+bar(c.fuelCap>0?c.fuel/c.fuelCap:0,tr('Benz.'),fmtL(c.fuel,1))+
    `<div class="ovl"><div><span>${tr('Giri possibili')}</span><b class="${S2&&S2.left<2.2?'neg':''}">${S2&&Number.isFinite(S2.left)?fx(S2.left,1):'—'}</b></div><div><span>${tr('Box al giro')}</span><b>${S2&&Number.isFinite(S2.lastLap)?S2.lastLap:'—'}</b></div><div><span>${tr('Alla bandiera')}</span><b>${Number.isFinite(fl)?'≈ '+fl:'—'}</b></div><div><span>${tr('Per giro')}</span><b>${S2?(ve&&S2.vpl>0?fmtPct(S2.vpl,2):fmtL(S2.fpl,2)):'—'}</b></div></div>`,'fuel');}

function ovPit(x){const {me,stt,kind}=x;if(!me||kind!=='race')return ovBox(tr('Rientro dal box'),`<div class="ovm">${tr('solo in gara')}</div>`);const loss=liveLoss(stt);
  if(!Number.isFinite(loss))return ovBox(tr('Rientro dal box'),`<div class="ovm">—</div>`);const w=rejoin(x,loss,0);
  return ovBox(tr('Se ti fermi adesso'),`<div class="ovpit"><b>P${w.pic}</b><span>${w.ah?`${tr('dietro a')} ${esc(ovName(w.ah.o.drv))} ${fx(-w.ah.d,1)}`:tr('in testa')}</span><span>${w.bh?`${tr('davanti a')} ${esc(ovName(w.bh.o.drv))} ${fx(w.bh.d,1)}`:''}</span>${w.traffic?`<em>${tr('traffico')}</em>`:''}</div><div class="ovm">${tr('sosta')} ≈ ${fx(loss,0)} s</div>`,'pit');}

function ovSess(x){const {I,kind,me,sc}=x;if(!sc)return ovBox(tr('Sessione'),`<div class="ovm">${tr('In attesa dei dati…')}</div>`);const laps=I.maxLaps>0&&I.maxLaps<99999;
  return ovBox(`${tr(SES_BADGE[kind])}${I.trk?' · '+esc(I.trk):''}`,`<div class="ovs"><b>${laps?`${me?me.laps:'—'}/${I.maxLaps}`:hms(I.rem)}</b>${I.yel>0?`<span class="fl">${esc(FCY[I.yel]||'FCY')}</span>`:''}</div><div class="ovl"><div><span>${tr('Aria')}</span><b>${fx(I.air,0)}°</b></div><div><span>${tr('Asfalto')}</span><b>${fx(I.tt,0)}°</b></div><div><span>${tr('Pioggia')}</span><b>${Math.round((I.rain||0)*100)}%</b></div><div><span>${tr('Bagnato')}</span><b>${Math.round((I.wavg||0)*100)}%</b></div></div>`,'sess');}

function ovTyre(x){const {c}=x;if(!c||!c.w)return ovBox(tr('Gomme'),`<div class="ovm">—</div>`);
  return ovBox(`${tr('Gomme')}${c.cf?' · '+esc(c.cf):''}`,`<div class="ovty">${[0,1,2,3].map(i=>{const w=c.w[i];const wear=w.wear>0?(1-w.wear)*100:NaN;return `<div class="tw4${w.flat||w.det?' bad':''}" style="--tc:${tHeat(w.c)}"><b>${fx(w.c,0)}°</b><span>${Number.isFinite(wear)?fx(100-wear,0)+'%':''}</span><small>${fx(w.p,0)}</small></div>`;}).join('')}</div>`,'tyre');}

function ovMap(x){return ovBox('',`<canvas class="ovmap"></canvas>`,'map');}
function ovDrawMaps(x,root){$$('.ovmap',root).forEach(cv=>{const r=cv.getBoundingClientRect(),dpr=devicePixelRatio||1;if(!r.width)return;cv.width=r.width*dpr;cv.height=r.height*dpr;const g=cv.getContext('2d');g.scale(dpr,dpr);
  const T=mapXform(cv,x.sc);if(!T)return;g.fillStyle='rgba(255,255,255,.18)';[...LIVE.trail.values()].forEach(([a,b])=>{const [p,q]=T(a,b);g.fillRect(p-1.2,q-1.2,2.4,2.4);});
  const M=mapRefs(x);const role={};if(M)[M.lead,M.ahead,M.behind].filter(Boolean).forEach(m=>role[m.o.veh]=m.role);
  [...x.rows].sort((a,b)=>(a===x.me)-(b===x.me)).forEach(r=>{if(r.gar||!(r.x||r.z))return;const [p,q]=T(r.x,r.z);const mine=r===x.me;g.beginPath();g.arc(p,q,mine?6:4,0,7);g.fillStyle=LV_CLS(r.cls);g.fill();
    if(mine){g.lineWidth=2;g.strokeStyle='#fff';g.stroke();}else if(role[r.veh]){g.lineWidth=2;g.strokeStyle=tok(MAPC[role[r.veh]]);g.beginPath();g.arc(p,q,7.5,0,7);g.stroke();}});});}

const OV_FN={tower:ovTower,battle:ovBattle,rel:ovRel,sec:ovSec,fuel:ovFuel,pit:ovPit,sess:ovSess,tyre:ovTyre,map:ovMap};
function ovRender(root,o){const x=ovCtx(o);root.style.setProperty('--ovs',o.sc);root.style.setProperty('--ovbg',o.bg);root.className='ovroot lay-'+o.lay;
  let h='';try{h=o.w.map(k=>OV_FN[k]?OV_FN[k](x,o):'').join('');}catch(e){console.error(e);}
  const st=LIVE.status;const on=st.local==='on'||st.team==='on';if(!on&&!LIVE.sc)h=ovBox('Data Engineer',`<div class="ovm">${tr('In attesa del bridge…')}</div>`);
  if(root._h!==h){root.innerHTML=h;root._h=h;}ovDrawMaps(x,root);}

// overlay page mode
(function(){if(!/^#ov(&|$)/.test(location.hash))return;const o=ovDecode(location.hash);document.documentElement.classList.add('ovmode');
  const root=document.createElement('div');root.id='ovRoot';document.body.appendChild(root);
  window.renderLive=renderLive=function(){};if(o.t&&teamParse(o.t)){LS.set('live:team',o.t);}liveStart();
  setInterval(()=>ovRender(root,o),300);})();

// builder (Muretto › Overlay OBS)
function ovBase(){if(isBridgeHost()||isFileHost())return location.href.split('#')[0];return 'http://localhost:8790/';}
function openOverlay(){let m=$('#mObs');if(!m){m=document.createElement('div');m.className='modal';m.id='mObs';m.hidden=true;document.body.appendChild(m);}
  const o=ovCfg();const names=Object.keys(liveCars());
  m.innerHTML=`<div class="mbox wide"><div class="panel-h"><h2>${tr('Overlay per OBS')}</h2><button class="btn" type="button" data-close>${tr('Chiudi')}</button></div>
    <div class="obsgrid"><div><h3>${tr('Cosa mostrare')}</h3><div class="obsw">${OV_W.map(([k,l,d])=>`<label class="chk"><input type="checkbox" data-w="${k}"${o.w.includes(k)?' checked':''}><span><b>${tr(l)}</b><small>${tr(d)}</small></span></label>`).join('')}</div>
      <div class="setgrid" style="margin-top:10px"><label class="f">${tr('Righe in classifica')}<input type="number" id="obN" min="3" max="30" value="${o.n}"></label>
      <label class="f">${tr('Dimensione')}<input type="range" id="obSc" min="0.6" max="2" step="0.05" value="${o.sc}"></label>
      <label class="f">${tr('Sfondo')}<input type="range" id="obBg" min="0" max="1" step="0.05" value="${o.bg}"></label>
      <label class="f">${tr('Disposizione')}<select id="obLay"><option value="col">${tr('in colonna')}</option><option value="row">${tr('in riga')}</option></select></label>
      <label class="f">${tr('Auto')}<select id="obCar"><option value="">${tr('automatica (chi guida)')}</option>${names.map(n=>`<option value="${esc(n)}"${n===o.car?' selected':''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" id="obCls"${o.cls?' checked':''}><span>${tr('Classifica solo della nostra classe')}</span></label>
      ${!isBridgeHost()&&LS.get('live:team','')?`<label class="chk"><input type="checkbox" id="obTc"${o.tc?' checked':''}><span>${tr('Includi il codice squadra (serve senza bridge su questo PC)')}</span></label>`:''}</div>
      <h3 style="margin-top:14px">${tr('Indirizzi per OBS')}</h3><div id="obUrls"></div>
      <div class="muted small" style="margin-top:8px">${tr('In OBS: Fonti › + › Browser › incolla l\'indirizzo (togli la spunta a «File locale»). Larghezza consigliata 420, altezza 900 per la colonna. Lo sfondo è trasparente.')} <br>${tr('Per la grafica TV completa (stile WEC / F1, con regia) usa Muretto › Regia TV.')}${isHosted()?`<br><b>${tr('Da questa pagina ospitata usa il bridge: l\'indirizzo punta a http://localhost:8790.')}</b>`:''}</div></div>
      <div><h3>${tr('Anteprima')}</h3><div class="obsprev"><div id="obPrev"></div></div></div></div></div>`;
  const save=()=>{const n={w:$$('#mObs [data-w]').filter(i=>i.checked).map(i=>i.dataset.w),n:+$('#obN').value||10,sc:+$('#obSc').value,bg:+$('#obBg').value,lay:$('#obLay').value,car:$('#obCar').value,cls:$('#obCls').checked,tc:$('#obTc')?$('#obTc').checked:true};LS.set('ov:cfg',n);urls(n);};
  const urls=n=>{const base=ovBase();const all=base+ovEncode(n);const row=(l,u)=>`<div class="obsu"><span>${l}</span><input type="text" readonly value="${esc(u)}"><button class="btn" type="button" data-cp="${esc(u)}">${tr('Copia')}</button></div>`;
    $('#obUrls').innerHTML=row(`<b>${tr('Tutto insieme')}</b>`,all)+`<details style="margin-top:6px"><summary class="muted small">${tr('Un indirizzo per ogni riquadro (per posizionarli liberamente in OBS)')}</summary>${n.w.map(k=>row(tr(OV_W.find(w=>w[0]===k)[1]),base+ovEncode(n,[k]))).join('')}</details>`;
    $$('#obUrls [data-cp]').forEach(b=>b.onclick=()=>{navigator.clipboard?.writeText(b.dataset.cp).then(()=>toast(tr('Copiato')),()=>{});});};
  $('#obLay').value=o.lay;$$('#mObs input,#mObs select').forEach(i=>i.oninput=i.onchange=save);urls(o);openModal('#mObs');
  const prev=$('#obPrev');const tick=()=>{if(m.hidden){clearInterval(t);return;}ovRender(prev,ovCfg());};const t=setInterval(tick,400);tick();}
(function(){const add=()=>{const d=$('#lvDeb');if(!d||$('#lvObs'))return;const b=document.createElement('button');b.className='btn';b.type='button';b.id='lvObs';b.textContent=tr('Overlay OBS');b.onclick=openOverlay;d.after(b);};
  const os=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){os();add();};add();})();

// ================= CONFRONTO SETUP (Setup) =================
// effect of raising each parameter by one step: bal + = more understeer, top = top speed, df = downforce, brk = braking stability,
// trac = traction, tyre = tyre temperature / wear, cool = cooling, kerb = kerbs and bumps
const SU_FX=[
  [/^RWSetting$/,{df:2,top:-2,bal:1},['più ala posteriore','meno ala posteriore']],
  [/^FWSetting$/,{df:1,top:-1,bal:-1},['più ala anteriore','meno ala anteriore']],
  [/^FrontAntiSwaySetting$/,{bal:1,kerb:-1},['barra anteriore più rigida','barra anteriore più morbida']],
  [/^RearAntiSwaySetting$/,{bal:-1,trac:-0.5,kerb:-1},['barra posteriore più rigida','barra posteriore più morbida']],
  [/^FrontToeInSetting$/,{bal:0.5,tyre:0.5},['più convergenza','meno convergenza (più apertura)']],
  [/^RearToeInSetting$/,{bal:0.5,brk:0.5,tyre:0.5},['più convergenza','meno convergenza']],
  [/^Front3rd(Spring|Packer)Setting$/,{df:0.5,kerb:-0.5},['più duro','più morbido']],
  [/^Rear3rd(Spring|Packer)Setting$/,{df:0.5,kerb:-0.5,bal:-0.3},['più duro','più morbido']],
  [/^Front3rd(Slow|Fast)(Bump|Rebound)Setting$/,{kerb:-0.3,bal:0.3},['più duro','più morbido']],
  [/^Rear3rd(Slow|Fast)(Bump|Rebound)Setting$/,{kerb:-0.3,bal:-0.3},['più duro','più morbido']],
  [/^RearBrakeSetting$/,{},['','']],
  [/^BrakeMigrationSetting$/,{brk:-0.3,bal:-0.3},['più migrazione','meno migrazione']],
  [/^BrakePressureSetting$/,{brk:-0.3},['più pressione','meno pressione']],
  [/^TractionControlMapSetting$/,{trac:1,tyre:-0.3},['TC più alto','TC più basso']],
  [/^TCPowerCutMapSetting$/,{trac:0.5},['taglio più forte','taglio più leggero']],
  [/^TCSlipAngleMapSetting$/,{trac:-0.5},['più slittamento concesso','meno slittamento concesso']],
  [/^(AntilockBrakeSystemMap|ABS)Setting$/,{brk:1},['ABS più alto','ABS più basso']],
  [/^DiffPowerSetting$/,{trac:1,bal:0.7},['più bloccato','più libero']],
  [/^DiffCoastSetting$/,{brk:1,bal:0.7},['più bloccato','più libero']],
  [/^DiffPreloadSetting$/,{bal:0.5,trac:0.5,brk:0.5},['più precarico','meno precarico']],
  [/^(Water|Oil)RadiatorSetting$/,{cool:-1,top:0.3},['più nastro','meno nastro']],
  [/^BrakeDuct(Rear)?Setting$/,{cool:-1,top:0.2},['più chiuse','più aperte']],
  [/^RegenerationMapSetting$/,{},['più recupero in frenata','meno recupero in frenata']],
  [/^ElectricMotorMapSetting$/,{},['più spinta elettrica','meno spinta elettrica']],
  [/^EngineMixtureSetting$/,{},['','']],
  [/^(FinalDrive|RatioSet|Gear\dSetting)/,{},['','']],
  [/^(Fuel|VirtualEnergy|FuelCapacity|NumPitstops)Setting$/,{},['carico gara (non cambia la guida)','carico gara (non cambia la guida)']],
];
// per wheel (section FRONTLEFT … REARRIGHT): sign of balance depends on the axle
const SU_W={CamberSetting:[{bal:1,tyre:-0.5},{bal:-1,trac:0.5,tyre:-0.5},['meno campanatura negativa','più campanatura negativa']],
  PressureSetting:[{bal:0.7,tyre:1},{bal:-0.7,tyre:1},['pressione più alta','pressione più bassa']],
  SpringSetting:[{bal:1,kerb:-1,df:0.3},{bal:-1,trac:-0.5,kerb:-1,df:0.3},['molla più dura','molla più morbida']],
  RideHeightSetting:[{bal:0.7,df:-0.5},{bal:-0.7,df:0.3},['più alta','più bassa']],
  PackerSetting:[{df:0.3,kerb:-0.5},{df:0.3,kerb:-0.5},['packer più spessi','packer più sottili']],
  SlowBumpSetting:[{bal:0.4,kerb:-0.4},{bal:-0.4,kerb:-0.4},['più dura','più morbida']],
  FastBumpSetting:[{kerb:-0.8},{kerb:-0.8},['più dura','più morbida']],
  SlowReboundSetting:[{bal:0.4},{bal:-0.4},['più dura','più morbida']],FastReboundSetting:[{kerb:-0.5},{kerb:-0.5},['più dura','più morbida']],
  TenderSpringSetting:[{kerb:-0.3},{kerb:-0.3},['','']],TenderTravelSetting:[{kerb:-0.3},{kerb:-0.3},['','']],
  BrakeDiscSetting:[{},{},['','']],CompoundSetting:[{},{},['','']]};
const SU_DIM=[['bal','Bilanciamento','più sottosterzo','più sovrasterzo'],['df','Carico aerodinamico','più carico','meno carico'],['top','Velocità di punta','più veloce in rettilineo','più lenta in rettilineo'],
  ['brk','Stabilità in frenata','più stabile','più nervosa'],['trac','Trazione','più trazione','meno trazione'],['tyre','Gomme','più calde / più usura','più fredde / meno usura'],['cool','Raffreddamento','più fresco','più caldo'],['kerb','Cordoli e buche','più morbida','più rigida']];
const num1=s=>{const m=String(s||'').match(/-?\d+(\.\d+)?/);return m?+m[0]:NaN;};
function suIndex(su){const o={};Object.entries(su.sec).forEach(([sec,items])=>items.forEach(x=>{if(!x.disp||/N\/A|Non-adjustable/.test(x.disp))return;o[sec+'|'+x.key]={sec,key:x.key,raw:+x.raw,disp:x.disp,label:x.label};}));return o;}
function suCompare(A,B){const a=suIndex(A),b=suIndex(B);const keys=[...new Set([...Object.keys(a),...Object.keys(b)])];const ch=[];const tot={};SU_DIM.forEach(([k])=>tot[k]=0);
  keys.forEach(k=>{const x=a[k],y=b[k];if(!x||!y||x.disp===y.disp)return;const st=Number.isFinite(x.raw)&&Number.isFinite(y.raw)?y.raw-x.raw:NaN;let w={},txt='';
    const wheel=/^(FRONT|REAR)(LEFT|RIGHT)$/.exec(y.sec);
    if(wheel&&SU_W[y.key]){const d=SU_W[y.key];w=wheel[1]==='FRONT'?d[0]:d[1];txt=d[2];}
    else{const f=SU_FX.find(([re])=>re.test(y.key));if(f){w=f[1];txt=f[2];}}
    let dir=Math.sign(st)||0;
    if(y.key==='RearBrakeSetting'){const fa=num1(x.disp),fb=num1(y.disp);if(Number.isFinite(fa)&&Number.isFinite(fb)){dir=Math.sign(fb-fa);w={brk:1,bal:0.7};txt=fb>fa?'frenata più all\'anteriore':'frenata più al posteriore';}}
    if(/^(FinalDrive|RatioSet)Setting$/.test(y.key)){const ra=num1(x.disp),rb=num1(y.disp);if(Number.isFinite(ra)&&Number.isFinite(rb)){dir=Math.sign(rb-ra);w={top:-1};txt=rb>ra?'rapporto più corto (più accelerazione)':'rapporto più lungo (più velocità massima)';}}
    const mag=Math.min(3,Math.abs(st)||1);const eff={};Object.entries(w).forEach(([d,v])=>{eff[d]=v*dir*Math.sqrt(mag);tot[d]=(tot[d]||0)+eff[d];});
    if(Array.isArray(txt))txt=dir<0?txt[1]:txt[0];
    ch.push({k,sec:y.sec,key:y.key,label:y.label,pos:wheel?({FRONTLEFT:'Ant. sx',FRONTRIGHT:'Ant. dx',REARLEFT:'Post. sx',REARRIGHT:'Post. dx'})[y.sec]:'',a:x.disp,b:y.disp,st,eff,txt});});
  return {ch,tot};}
function suGroupName(sec){return /^(FRONT|REAR)(LEFT|RIGHT)$/.test(sec)?tr('Ruote e sospensioni'):tr(SETUP_GROUPS[sec]||sec);}
function renderSuCmp(){const box=$('#suCmp');if(!box)return;const S=svms();const sa=$('#suCA'),sb=$('#suCB');
  const opts=`<option value="">${esc(tr('— scegli —'))}</option>`+S.map(s=>`<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
  [sa,sb].forEach((s,i)=>{if(s.dataset.o!==opts){const v=s.value||LS.get('sucmp:'+i,'');s.innerHTML=opts;s.dataset.o=opts;s.value=v;}});
  if(!sa.value&&S[0])sa.value=S[0].id;if(!sb.value&&S[1])sb.value=S.find(s=>s.id!==sa.value)?.id||'';
  const ta=$('#suTA'),tb=$('#suTB');const lo=`<option value="">${esc(tr('— nessuna —'))}</option>`+lds().map(s=>`<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
  [ta,tb].forEach(s=>{if(s.dataset.o!==lo){const v=s.value;s.innerHTML=lo;s.dataset.o=lo;s.value=v;}});
  const A=byId(sa.value),B=byId(sb.value);
  if(S.length<2){box.innerHTML=`<div class="empty">${tr('Carica almeno due file setup .svm (la base e quello da provare) con «Carica» in alto.')}</div>`;return;}
  if(!A||!B||A===B){box.innerHTML=`<div class="empty">${tr('Scegli due setup diversi.')}</div>`;return;}
  const {ch,tot}=suCompare(A,B);const warn=A.car&&B.car&&A.car!==B.car?`<div class="warnbar" style="margin-bottom:10px">${tr('I due setup sono di auto diverse')}: ${esc(A.car)} · ${esc(B.car)}</div>`:'';
  if(!ch.length){box.innerHTML=warn+`<div class="empty">${tr('I due setup sono identici.')}</div>`;return;}
  const chips=SU_DIM.map(([k,l,p,n])=>{const v=tot[k]||0;if(Math.abs(v)<0.25)return '';const s=Math.min(3,Math.round(Math.abs(v)));return `<div class="suc d-${k} ${v>0?"up":"dn"}"><span>${tr(l)}</span><b>${tr(v>0?p:n)}</b><i>${'●'.repeat(Math.max(1,s))}${'○'.repeat(3-Math.max(1,s))}</i></div>`;}).join('');
  const groups={};ch.forEach(c=>{(groups[suGroupName(c.sec)]=groups[suGroupName(c.sec)]||[]).push(c);});
  const effTxt=c=>Object.entries(c.eff).filter(([d,v])=>Math.abs(v)>=0.3).map(([d,v])=>{const D=SU_DIM.find(z=>z[0]===d);return `<span class="sue">${tr(v>0?D[2]:D[3])}</span>`;}).join('');
  // the strongest causes of the balance change
  const top=ch.filter(c=>Math.abs(c.eff.bal||0)>=0.5).sort((a,b)=>Math.abs(b.eff.bal)-Math.abs(a.eff.bal)).slice(0,4);
  const concl=[];if(Math.abs(tot.bal)>=0.5)concl.push(`${tr('Il confronto dovrebbe avere')} <b>${tr(tot.bal>0?'più sottosterzo':'più sovrasterzo')}</b> ${tr('della base')}${top.length?` (${top.map(c=>esc(tr(c.label))+(c.pos?' '+tr(c.pos):'')).join(', ')})`:''}.`);
  else concl.push(tr('Il bilanciamento complessivo resta simile: le modifiche si compensano.'));
  if(Math.abs(tot.top)>=0.5)concl.push(`${tr('In rettilineo')}: <b>${tr(tot.top>0?'più veloce':'più lenta')}</b>${Math.abs(tot.df)>=0.5?`, ${tr('con')} ${tr(tot.df>0?'più carico in curva veloce':'meno carico in curva veloce')}`:''}.`);
  if(Math.abs(tot.brk)>=0.5)concl.push(`${tr('In frenata')}: <b>${tr(tot.brk>0?'più stabile':'più nervosa')}</b>.`);
  if(Math.abs(tot.trac)>=0.5)concl.push(`${tr('In uscita')}: <b>${tr(tot.trac>0?'più trazione':'meno trazione')}</b>.`);
  if(Math.abs(tot.cool)>=0.5)concl.push(`${tr('Temperature')}: <b>${tr(tot.cool>0?'più basse':'più alte')}</b> ${tr('(motore / freni)')}.`);
  box.innerHTML=warn+`<div class="sucs">${chips}</div><ul class="suconc">${concl.map(c=>`<li>${c}</li>`).join('')}</ul>
    <div class="tw"><table class="sut"><thead><tr><th class="l">${tr('Parametro')}</th><th>${esc(A.label)}</th><th>${esc(B.label)}</th><th>${tr('Passi')}</th><th class="l">${tr('Modifica · effetto atteso')}</th></tr></thead><tbody>${Object.entries(groups).map(([g,cs])=>`<tr class="sug"><td colspan="5">${esc(g)}</td></tr>`+cs.map(c=>`<tr><td class="l">${esc(tr(c.label))}${c.pos?` <span class="muted">${tr(c.pos)}</span>`:''}</td><td>${esc(c.a)}</td><td><b>${esc(c.b)}</b></td><td class="${c.st>0?'pos':c.st<0?'neg':''}">${Number.isFinite(c.st)?(c.st>0?'+':'')+c.st:'—'}</td><td class="l"><div>${esc(tr(c.txt||''))}</div><div>${effTxt(c)}</div></td></tr>`).join('')).join('')}</tbody></table></div>
    <p class="muted small">${tr('Effetti tipici di ogni modifica (regole fisse): servono a capire cosa aspettarsi, la conferma arriva dalla pista. «Passi» = scatti nel menu del gioco.')}</p>`+suTelCmp(byId(ta.value),byId(tb.value),A,B);}
// the same numbers from two telemetry files: one with each setup
function suTelCmp(SA,SB,A,B){if(!SA||!SB)return `<p class="muted small" style="margin-top:6px">${tr('Scegli sopra una telemetria .ld fatta con ogni setup per confrontare anche tempi, velocità e gomme.')}</p>`;
  const st=S=>{const L=S.laps.filter(l=>l.complete&&l.type==='lanciato');if(!L.length)return null;const ss=L.map(l=>lapStats(S,l));const best=L.reduce((a,b)=>a.time<b.time?a:b);const fast=ss.filter(s=>s.time<=best.time*1.02);
    const m=f=>avg_(fast.map(f).filter(Number.isFinite));const wm=(w,f)=>m(s=>f(s.w[w]));
    return {best:best.time,avg:m(s=>s.time),n:L.length,vmax:m(s=>s.vmax),fuel:m(s=>s.fuel>0?s.fuel:NaN),F:{I:avg_(['FL','FR'].map(w=>wm(w,x=>x.I))),O:avg_(['FL','FR'].map(w=>wm(w,x=>x.O))),C:avg_(['FL','FR'].map(w=>wm(w,x=>x.C))),p:avg_(['FL','FR'].map(w=>wm(w,x=>x.p)))},
      R:{I:avg_(['RL','RR'].map(w=>wm(w,x=>x.I))),O:avg_(['RL','RR'].map(w=>wm(w,x=>x.O))),C:avg_(['RL','RR'].map(w=>wm(w,x=>x.C))),p:avg_(['RL','RR'].map(w=>wm(w,x=>x.p)))},
      brk:avg_(['FL','FR','RL','RR'].map(w=>wm(w,x=>x.bMax))),rh:Math.min(...['FL','FR','RL','RR'].map(w=>wm(w,x=>x.rhMin)).filter(Number.isFinite)),wear:avg_(['FL','FR','RL','RR'].map(w=>wm(w,x=>x.wear)))};};
  const a=st(SA),b=st(SB);if(!a||!b)return `<div class="muted small">${tr('Servono giri lanciati completi in entrambe le telemetrie.')}</div>`;
  const R=[['Miglior giro',a.best,b.best,fmtLap,-1,3],['Media giri veloci',a.avg,b.avg,fmtLap,-1,3],['Velocità massima (km/h)',a.vmax,b.vmax,v=>fx(v,1),1,1],['Benzina per giro (L)',a.fuel,b.fuel,v=>fx(v,2),-1,2],
    ['Gomme ant. int / centro / est (°C)',a.F,b.F,v=>`${fx(v.I,0)} / ${fx(v.C,0)} / ${fx(v.O,0)}`,0],['Gomme post. int / centro / est (°C)',a.R,b.R,v=>`${fx(v.I,0)} / ${fx(v.C,0)} / ${fx(v.O,0)}`,0],
    ['Pressione ant. / post. (kPa)',[a.F.p,a.R.p],[b.F.p,b.R.p],v=>`${fx(v[0],1)} / ${fx(v[1],1)}`,0],['Freni max (°C)',a.brk,b.brk,v=>fx(v,0),0],['Altezza minima (mm)',a.rh,b.rh,v=>fx(v,1),0],['Usura gomme per giro (%)',a.wear,b.wear,v=>fx(v,2),-1,2]];
  return `<h3 style="margin-top:16px">${tr('In pista')}: ${esc(SA.label)} · ${esc(SB.label)}</h3><div class="tw"><table class="sut"><thead><tr><th class="l">${tr('Dato')}</th><th>${esc(A.label)} <span class="muted small">(${a.n} ${tr('giri')})</span></th><th>${esc(B.label)} <span class="muted small">(${b.n} ${tr('giri')})</span></th><th>Δ</th></tr></thead><tbody>${R.map(([l,x,y,f,better,d])=>{
    const dv=typeof x==='number'&&typeof y==='number'?y-x:NaN;const cls=better&&Number.isFinite(dv)&&Math.abs(dv)>1e-6?(dv*better>0?'pos':'neg'):'';
    return `<tr><td class="l">${tr(l)}</td><td>${f(x)}</td><td><b>${f(y)}</b></td><td class="${cls}">${Number.isFinite(dv)?(dv>0?'+':'')+fx(dv,d??1):''}</td></tr>`;}).join('')}</tbody></table></div>`;}
(function(){const v=$('#v-setup');if(!v||$('#suCmpP'))return;const p=document.createElement('div');p.className='panel';p.id='suCmpP';
  p.innerHTML=`<div class="panel-h"><h3>${tr('Confronto setup')}</h3><span class="muted small">${tr('base contro un altro set: differenze ed effetti attesi')}</span></div>
    <div class="setgrid sucsel"><label class="f">${tr('Base')}<select id="suCA"></select></label><label class="f">${tr('Da confrontare')}<select id="suCB"></select></label>
      <label class="f">${tr('Telemetria con la base')}<select id="suTA"></select></label><label class="f">${tr('Telemetria con l\'altro')}<select id="suTB"></select></label></div><div id="suCmp" style="margin-top:12px"></div>`;
  const first=v.querySelector('.panel');first.after(p);
  ['#suCA','#suCB','#suTA','#suTB'].forEach((s,i)=>$(s).onchange=()=>{if(i<2)LS.set('sucmp:'+i,$(s).value);renderSuCmp();});
  setTimeout(()=>{const base=RENDER.setup;RENDER.setup=()=>{base();try{renderSuCmp();}catch(e){console.error(e);}};if(curView()==='setup')RENDER.setup();},0);})();
