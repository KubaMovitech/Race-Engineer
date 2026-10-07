// ================= MURETTO: vista a schede (Panoramica, Classifica, Auto, Strategia, Rivali, Meteo, Eventi) =================
const LV_SUBS=[['ov','Panoramica'],['lb','Classifica'],['car','Auto'],['str','Strategia'],['riv','Rivali'],['wx','Meteo'],['ev','Eventi']];
const sesKind=I=>I&&I.ses>=10?'race':I&&I.ses>=5&&I.ses<=8?'qual':I&&I.ses===9?'warm':'prac';
const SES_BADGE={race:'GARA',qual:'QUALIFICA',prac:'PROVE',warm:'WARMUP'};
const COMP_COL={S:'#F4F4F4',M:'#F5C518',H:'#FF3B3B',W:'#35B6FF','?':'#5B6573'};
const COMP_INK=k=>k==='H'?'#fff':'#0b0b0b';
const COMP_N={S:'Soft',M:'Medium',H:'Hard',W:'Wet'};
function R(r){return {raw:r,id:r[0],drv:r[1],veh:r[2],cls:r[3],pos:r[4],laps:r[5],ld:r[6],best:r[7],last:r[8],bs1:r[9],bs2:r[10],ls1:r[11],ls2:r[12],pits:r[13],pen:r[14],inPit:r[15],pitSt:r[16],
  gapL:r[17],lapsL:r[18],gapN:r[19],lapsN:r[20],x:r[21],z:r[22],spd:r[23],ctl:r[24],me:r[25],flag:r[26],fin:r[27],til:r[28],estL:r[29],gar:r[30],sec:r[31],
  fuel:r[32]??-1,ve:r[33]??-1,comp:r[34]||'',cf:r[35]||'',cr:r[36]||'',dents:r[37]||0,det:r[38]||0,tl:r[39]||0,qual:r[40]??-1,blS1:r[41],blS2:r[42],cs1:r[43],cs2:r[44],vcur:r[49]};}
function liveRows(sc){const rows=(sc?.v||[]).map(R);const rst=LIVE.rst;
  if(rst&&rst.l&&rst.at>Date.now()-15000)rows.forEach(r=>{if(r.fuel>=0&&r.ve>=0)return;const e=rst.l.find(x=>x.driverName===r.drv||x.vehicleName===r.veh);if(!e)return;
    if(r.fuel<0&&Number.isFinite(e.fuelFraction))r.fuel=e.fuelFraction;if(r.ve<0&&Number.isFinite(e.veFraction))r.ve=e.veFraction;});
  const cp={};[...rows].sort((a,b)=>a.pos-b.pos).forEach(r=>{cp[r.cls]=(cp[r.cls]||0)+1;r.pic=cp[r.cls];});return rows;}
function compHTML(comp,cf,cr){if(!comp)return cf||cr?`<span class="muted small">${esc([cf,cr].filter(Boolean).join('/'))}</span>`:'—';
  const mixed=new Set(comp).size>1;return `<span class="tyq${mixed?' mixed':''}" title="${esc([...comp].map((c,i)=>['AS','AD','PS','PD'][i]+' '+(COMP_N[c]||c)).join(' · '))}">${[...comp].map(c=>`<i style="background:${COMP_COL[c]||COMP_COL['?']};color:${COMP_INK(c)}">${c}</i>`).join('')}</span>`;}
function barHTML(v,warn){if(!(v>=0))return '<span class="muted">—</span>';const p=Math.max(0,Math.min(1,v));return `<span class="lvbar${p<(warn||0.12)?' low':''}"><i style="width:${p*100}%"></i><b>${Math.round(p*100)}</b></span>`;}
// ---------- live sectors (F1 / WEC style) ----------
// personal bests from valid lap history + the game's figures; class bests from those
function secPB(r){const mk='spb|'+r.veh+'|'+r.laps;if(LIVE.memo&&LIVE.memo.has(mk))return LIVE.memo.get(mk);const pb=[Infinity,Infinity,Infinity];const put=(k,v)=>{if(v>1&&v<pb[k])pb[k]=v;};
  fLaps(r.veh).forEach(l=>{if(l[7]||l[3]||!(l[4]>0&&l[5]>l[4]))return;put(0,l[4]);put(1,l[5]-l[4]);if(l[1]>l[5])put(2,l[1]-l[5]);});
  if(r.bs1>0)put(0,r.bs1);if(r.ls1>0&&r.ls2>r.ls1){put(0,r.ls1);put(1,r.ls2-r.ls1);if(r.last>r.ls2)put(2,r.last-r.ls2);}
  if(r.cs1>0){put(0,r.cs1);if(r.cs2>r.cs1)put(1,r.cs2-r.cs1);}if(LIVE.memo)LIVE.memo.set(mk,pb);return pb;}
// the three cells: current lap where done, previous lap (dimmed) for the rest
function secLive(r){const prev=[NaN,NaN,NaN];if(r.ls1>0&&r.ls2>r.ls1){prev[0]=r.ls1;prev[1]=r.ls2-r.ls1;if(r.last>r.ls2)prev[2]=r.last-r.ls2;}
  if(!Number.isFinite(prev[2])){const L=fLaps(r.veh);const l=L[L.length-1];if(l&&l[1]>l[5]&&l[5]>0&&Math.abs(l[5]-r.ls2)<0.01)prev[2]=l[1]-l[5];}
  const cur=[r.cs1>0?r.cs1:NaN,r.cs1>0&&r.cs2>r.cs1?r.cs2-r.cs1:NaN,NaN];const at=r.sec===1?0:r.sec===2?1:r.sec===0?2:-1;
  return [0,1,2].map(k=>{const live=k<at&&Number.isFinite(cur[k]);return {t:live?cur[k]:prev[k],old:!live,run:k===at&&!r.inPit&&!r.gar};});}
function secMini(r,rows){const cb=secClassBest(rows);return `<span class="sxmini">${secCells(r,cb,'span')}</span>`;}
function secClassBest(rows){const b={};rows.forEach(r=>{const pb=secPB(r);pb.forEach((v,k)=>{const key=r.cls+k;if(Number.isFinite(v)&&(!b[key]||v<b[key]))b[key]=v;});});return b;}
function secCells(r,cb,tag='td'){const pb=secPB(r);return secLive(r).map((s,k)=>{let c='',tt='';if(Number.isFinite(s.t)){const best=cb[r.cls+k],p=pb[k];c=best&&s.t<=best+0.0005?'sp':s.t<=p+0.0005?'sg':'sy';
    tt=`${tr('Settore')} ${k+1}: ${fx(s.t,3)} · ${tr('personale')} ${Number.isFinite(p)?fx(p,3):'—'}${best?` · ${tr('classe')} ${fx(best,3)}`:''}${Number.isFinite(p)&&s.t>p+0.0005?` (+${fx(s.t-p,3)})`:''}`;}
  return `<${tag} class="sxc"><span class="sx ${c}${s.old?' old':''}${s.run?' run':''}" title="${esc(tt)}">${Number.isFinite(s.t)?fx(s.t,3):'—'}</span></${tag}>`;}).join('');}
const sgn=(v,d=1)=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(d):'—';

// per-car numbers from the lap history every bridge keeps
function carStats(veh,r){const mk='cs|'+veh+'|'+(r?r.laps:'');if(LIVE.memo&&LIVE.memo.has(mk))return LIVE.memo.get(mk);const out=carStats_(veh,r);if(LIVE.memo)LIVE.memo.set(mk,out);return out;}
function carStats_(veh,r){const c=fCar(veh);const L=fLaps(veh);const cl=cleanLaps(L);const t=cl.map(l=>l[1]);
  const pits=c?.pits||[];const lastPit=pits[pits.length-1];const lastLap=L.length?L[L.length-1][0]:(r?.laps||0);
  const flagPit=Math.max(0,...L.filter(l=>l[3]&&l[0]>1).map(l=>l[0]));const stintStart=lastPit?Math.max(lastPit.lap,flagPit):flagPit;const stintLaps=Math.max(0,(r?.laps??lastLap)-stintStart);
  // consumption per lap inside the current stint (fractions of tank / energy)
  const st=L.filter(l=>l[0]>stintStart+1&&!l[3]);const dF=[],dV=[];for(let i=1;i<st.length;i++){if(st[i][0]!==st[i-1][0]+1)continue;const f=st[i-1][8]-st[i][8],v=st[i-1][9]-st[i][9];if(f>0&&f<0.3)dF.push(f);if(v>0&&v<0.3)dV.push(v);}
  let fpl=med_(dF.slice(-6)),vpl=med_(dV.slice(-6));
  if(!Number.isFinite(fpl)){const all=[];for(let i=1;i<L.length;i++){if(L[i][3]||L[i-1][3]||L[i][0]!==L[i-1][0]+1)continue;const f=L[i-1][8]-L[i][8];if(f>0&&f<0.3)all.push(f);}fpl=med_(all.slice(-6));}
  const fuel=r?.fuel,ve=r?.ve;const lf=fuel>=0&&fpl>0?fuel/fpl:NaN,lv=ve>=0&&vpl>0?ve/vpl:NaN;const left=Math.min(Number.isFinite(lf)?lf:Infinity,Number.isFinite(lv)?lv:Infinity);
  const sec=L.filter(l=>!l[7]&&!l[3]&&l[4]>0&&l[5]>l[4]&&l[1]>l[5]);const ideal=sec.length?Math.min(...sec.map(l=>l[4]))+Math.min(...sec.map(l=>l[5]-l[4]))+Math.min(...sec.map(l=>l[1]-l[5])):NaN;
  const lastL=L[L.length-1];
  // race pace: the last 5 laps run, whatever their time (not only the laps close to the best one, which kept
  // old fast laps and ignored traffic, rain or worn tyres); out of it lap 1, laps in or out of the pits and a lap
  // more than 10% slower than the others (a spin, an off)
  const r5=L.filter(l=>l[0]>1&&!l[3]&&l[1]>0).slice(-5).map(l=>l[1]);const m5=med_(r5);
  return {c,L,cl,pace5:avg_(r5.filter(x=>x<=m5*1.1)),pace10:avg_(t.slice(-10)),paceAll:avg_(t),sd:sd_(t.slice(-10)),best:t.length?Math.min(...t):NaN,ideal,
    pits,lastPit,stintLaps,fpl,vpl,lf,lv,left:Number.isFinite(left)?left:NaN,nextPit:Number.isFinite(left)&&r?r.laps+1+Math.floor(left):NaN,limit:Number.isFinite(lv)&&(!Number.isFinite(lf)||lv<lf)?'ve':'fuel',
    lastInv:lastL?!!lastL[7]:false,lastT:lastL?lastL[1]:NaN,swaps:c?.swaps||[],drivers:c?.drivers||[]};}
function soloPlan(){const v=LS.get('strategy',null);if(!v)return null;const lap=parseLapT(v.lap),fuel=+v.fuel,tank=+v.tank,ve=+v.ve||0,veMax=+v.veMax||100,res=+v.res||0;
  if(!(lap>0)||!(fuel>0)||!(tank>0))return null;const stintMax=Math.max(1,Math.floor(Math.min(ve>0?Infinity:tank/fuel-res,ve>0?veMax/ve-res:Infinity)));
  const total=+v.laps>0?Math.round(+v.laps):Math.floor((+v.race||60)*60/lap)+1;const n=Math.ceil(total/stintMax);const L=[];if(v.mode==='first'){let rem=total;while(rem>0){const k=Math.min(stintMax,rem);L.push(k);rem-=k;}}else{const b=Math.floor(total/n),x=total%n;for(let i=0;i<n;i++)L.push(b+(i<x?1:0));}
  let c=0;return {lap,total,stintMax,stints:L.map(k=>{const s={from:c+1,to:c+k,n:k};c+=k;return s;})};}
// finishing laps in a timed race: the leader finishes on the first crossing after time runs out, everyone else on their next crossing
function finishLaps(rows,me,sc){const I=sc?.i||{};if(!me)return NaN;if(I.maxLaps>0&&I.maxLaps<99999)return I.maxLaps-me.laps;if(!(I.rem>0))return NaN;
  const lead=rows.find(r=>r.pos===1);if(!lead)return NaN;const lp=carStats(lead.veh,lead).pace5||lead.estL,mp=carStats(me.veh,me).pace5||me.estL;if(!(lp>0)||!(mp>0))return NaN;
  const lFirst=Math.max(0,lp-(lead.til||0));const lToGo=lFirst>=I.rem?1:Math.ceil((I.rem-lFirst)/lp)+1;const tFin=lFirst+(lToGo-1)*lp;
  if(me===lead)return lToGo;const mFirst=Math.max(0,mp-(me.til||0));const before=tFin<mFirst?0:Math.floor((tFin-mFirst)/mp)+1;return before+1;}
// where we would rejoin after a stop now
function pitOut(rows,me,loss){if(!me||!(loss>0))return null;const lt=carStats(me.veh,me).pace5||me.estL||100;const G=r=>r.gapL+r.lapsL*lt;
  const g=G(me)+loss;const others=rows.filter(r=>r!==me&&!r.gar&&r.fin===0).map(r=>({r,g:G(r)})).sort((a,b)=>a.g-b.g);
  let pos=1;let ahead=null,behind=null;for(const o of others){if(o.g<g){pos++;ahead=o;}else{behind=behind||o;}}
  const sameCls=others.filter(o=>o.r.cls===me.cls);let pic=1;let aC=null,bC=null;for(const o of sameCls){if(o.g<g){pic++;aC=o;}else bC=bC||o;}
  return {pos,pic,ahead,behind,aC,bC,g};}

// ---------- notifications (driver changes, pit stops, penalties) ----------
const NOTIF=[];
const NOTIF_SEEN=new Map();
function liveNotify(kind,veh,d){const mode=LS.get('live:notif','class');if(mode==='off')return;const sc=LIVE.sc;if(LIVE.rec)return;
  // one alert per event: never repeat the same driver change / stop, and at most one driver-change alert per car every 5 minutes
  const key=kind==='swap'?'swap|'+veh:kind+'|'+veh+'|'+(d.in??d.et??'')+'|'+(d.txt||'');const last=NOTIF_SEEN.get(key);
  if(kind==='swap'){const id=veh+'|'+d.to;if(NOTIF_SEEN.has('swapto|'+id)||(last&&Date.now()-last<300e3))return;NOTIF_SEEN.set('swapto|'+id,Date.now());}else if(last)return;
  NOTIF_SEEN.set(key,Date.now());
  const rows=liveRows(sc);const me=rows.find(r=>r.veh===LIVE.focus);const r=veh?rows.find(x=>x.veh===veh):rows.find(x=>x.drv===d.drv);const riv=liveRivals();
  if(r&&mode==='class'&&me&&r.cls!==me.cls&&!riv.includes(r.veh)&&r.veh!==LIVE.focus)return;if(mode==='rivals'&&(!r||(!riv.includes(r.veh)&&r.veh!==LIVE.focus)))return;
  const et=sc?.i?.et;if(Number.isFinite(et)&&Number.isFinite(d.et??d.out)&&et-(d.et??d.out)>90)return; // old news (history)
  let t='',s='',k='info';const who=esc(r?r.drv:(d.drv||''))+(r?` <span class="muted">${esc(r.veh)}</span>`:'');
  if(kind==='swap'){k='warn';t=tr('Cambio pilota');s=`${esc(d.from)} → <b>${esc(d.to)}</b> · ${esc(veh)}`;}
  else if(kind==='pit'){k='info';t=tr('Sosta ai box')+(r?` · P${r.pos}`:'');s=`${who}<br>${tr('fermo')} <b>${fx(d.stop,1)} s</b> · ${tr('corsia')} ${fx(d.lane,0)} s${d.fuel>0.01?` · +${Math.round(d.fuel*100)}% ${tr('benzina')}`:''}${d.ve>0.01?` · +${Math.round(d.ve*100)}% VE`:''}${d.tyres?` · ${d.tyres} ${tr('gomme')} ${compHTML(d.c1)}`:''}${d.d0&&d.d1&&d.d0!==d.d1?` · ${tr('cambio pilota')}`:''}`;}
  else if(kind==='pen'){k='bad';t=tr('Penalità');s=esc(d.txt);}
  NOTIF.unshift({k,t,s,veh,at:Date.now()});if(NOTIF.length>30)NOTIF.pop();
  let box=$('#lvToasts');if(!box){box=document.createElement('div');box.id='lvToasts';document.body.appendChild(box);}
  const el=document.createElement('div');el.className='lvtoast '+k;el.innerHTML=`<b>${t}</b><div>${s}</div>`;if(veh)el.onclick=()=>openCarModal(veh);box.prepend(el);
  while(box.children.length>4)box.lastChild.remove();setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400);},9000);}

// ---------- skeleton ----------
function liveSkeleton(){const v=$('#v-live');if(v.dataset.ok)return;v.dataset.ok=1;const sub=LS.get('live:sub','ov');
  v.innerHTML=`<div class="panel lvtop"><div class="panel-h lvhdr"><h2>Muretto</h2><span id="lvBadge" class="sesbadge"></span><span id="lvStat" class="lvstat"></span><span class="sp"></span>
      <label class="f lvsel" style="min-width:180px">Sorgente<select id="lvSrc"></select></label><label class="f lvsel" style="min-width:230px">Nostra auto<select id="lvCar"></select></label>
      <div class="lvbtns"><button class="btn" type="button" id="lvDeb">Debrief</button><details class="menu"><summary class="btn">Squadra ▾</summary><div class="menu-list"><button type="button" id="lvNew">Crea squadra</button><button type="button" id="lvJoin">Entra con codice</button><button type="button" id="lvCode">Codice squadra</button><button type="button" id="lvSave">Salva dati</button>
        <label class="f">Avvisi a comparsa<select id="lvNotif"><option value="class">Mia classe e rivali</option><option value="all">Tutte le auto</option><option value="rivals">Solo rivali</option><option value="off">Spenti</option></select></label><div id="lvTeam" class="lvteam"></div></div></details></div></div>
    <div id="lvHelp"></div><div id="lvSess" class="lvsess"></div>
    <nav class="lvtabs" role="tablist">${LV_SUBS.map(([k,l])=>`<button type="button" role="tab" data-sub="${k}" aria-selected="${k===sub}">${l}</button>`).join('')}</nav></div>
  <div id="lvAlerts"></div>
  <div class="lvsub" data-p="ov"${sub!=='ov'?' hidden':''}>
    <div class="lvgrid"><div class="panel"><div id="lvHead"></div><div id="lvKpi"></div></div>
      <div class="panel"><div class="panel-h"><h3>Pista</h3><span class="muted small" id="lvMapNote"></span></div><canvas id="lvMap" style="width:100%;height:300px"></canvas><div id="lvMapLeg" class="mapleg"></div></div></div>
    <div class="lvgrid3 lvg3e"><div class="panel"><div class="panel-h"><h3>Condizioni</h3><span class="muted small" id="lvCondT"></span></div><div id="lvCond"></div></div>
      <div class="panel"><div class="panel-h"><h3 id="lvConsT">Consumi</h3></div><div id="lvCons"></div></div>
      <div class="panel"><div class="panel-h"><h3>In breve</h3></div><div id="lvBrief"></div></div></div>
    <div class="grid2"><div class="panel"><div class="panel-h"><h3 id="lvNearT">Intorno a noi</h3></div><div id="lvNear" class="tw"></div></div>
      <div class="panel"><div class="panel-h"><h3>Relativo in pista</h3><span class="muted small">auto vicine sul tracciato</span></div><div id="lvRel" class="tw"></div></div></div>
    <div class="panel"><div class="panel-h"><h3>Ultimi eventi</h3></div><div id="lvEvShort" class="lvev"></div></div></div>
  <div class="lvsub" data-p="lb"${sub!=='lb'?' hidden':''}>
    <div class="panel"><div class="panel-h"><h3 id="lvLbT">Classifica</h3><span class="muted small" id="lvLbNote"></span><label class="f" style="min-width:150px">Classe<select id="lvCls"></select></label>
      <span class="seg" id="lvGapMode"><button type="button" data-g="all">Assoluto</button><button type="button" data-g="cls">Classe</button></span></div><div id="lvStand" class="tw lvlb"></div>
      <div class="sxleg"><span><i class="sx sp">S</i> miglior settore della classe</span><span><i class="sx sg">S</i> miglior settore personale</span><span><i class="sx sy">S</i> più lento del personale</span><span><i class="sx sy old">S</i> giro precedente</span><span><i class="sx run">S</i> settore in corso</span></div></div></div>
  <div class="lvsub" data-p="car"${sub!=='car'?' hidden':''}>
    <div class="lvgrid3"><div class="panel"><div class="panel-h"><h3>Gomme e freni</h3><span class="muted small" id="lvComp"></span></div><div id="lvTyres"></div></div>
      <div class="panel"><div class="panel-h"><h3>Danni e motore</h3></div><div id="lvDmg"></div></div>
      <div class="panel"><div class="panel-h"><h3>Elettronica</h3></div><div id="lvEl"></div></div></div>
    <div class="panel"><div class="panel-h"><h3>Pedali e velocità</h3><span class="muted small">ultimi 60 s</span></div><canvas id="lvIn" style="width:100%;height:170px"></canvas></div>
    <div class="panel"><div class="panel-h"><h3>Setup in uso</h3><span class="muted small" id="lvSetupT">dal garage di LMU</span></div><div id="lvSetup"></div></div>
    <div class="panel"><div class="panel-h"><h3>Prossima sosta</h3><span class="muted small">dal menu box selezionato in gioco</span></div><div id="lvPit"></div></div>
    <div class="panel"><div class="panel-h"><h3>Giri della nostra auto</h3></div><div id="lvLaps" class="tw" style="max-height:460px;overflow:auto"></div></div></div>
  <div class="lvsub" data-p="str"${sub!=='str'?' hidden':''}>
    <div class="panel"><div class="panel-h"><h3>Stint in tempo reale</h3><span class="seg" id="lvStrMode"><button type="button" data-m="solo">Solo</button><button type="button" data-m="end">Endurance</button></span></div><div id="lvStr"></div></div>
    <div class="grid2"><div class="panel"><div class="panel-h"><h3>Fino alla bandiera</h3><label class="f" style="min-width:190px">Consumi di<select id="lvFinD"></select></label></div><div id="lvFin"></div></div>
      <div class="panel"><div class="panel-h"><h3>Piloti: giri con l'energia attuale</h3><span class="muted small">consumi di ogni pilota della nostra auto</span></div><div id="lvDrv" class="tw"></div></div></div>
    <div class="grid2"><div class="panel"><div class="panel-h"><h3>Finestra di sosta</h3><span class="muted small" id="lvPwT"></span></div><div id="lvPitOut"></div></div>
      <div class="panel"><div class="panel-h"><h3>Undercut e overcut</h3><span class="muted small">auto vicine in classe, in diretta</span></div><div id="lvUnd"></div></div></div>
    <div id="lvPlanP"></div>
    <div class="grid2"><div class="panel"><div class="panel-h"><h3>Risparmio carburante ed energia</h3></div><div id="lvSave2"></div></div>
      <div class="panel"><div class="panel-h"><h3>Dati di strategia del gioco</h3><span class="muted small">dal menu box di LMU</span></div><div id="lvGame"></div></div></div>
    <div class="panel"><div class="panel-h"><h3>Stint della nostra auto</h3></div><div id="lvStints" class="tw"></div></div></div>
  <div class="lvsub" data-p="riv"${sub!=='riv'?' hidden':''}>
    <div class="panel"><div class="panel-h"><h3>Rivali</h3><span class="muted small">☆ nella classifica per sceglierli · clic su una riga per il dettaglio</span></div><div id="lvRiv"></div><canvas id="lvGap" style="width:100%;height:220px;margin-top:10px"></canvas></div>
    <div class="panel"><div class="panel-h"><h3>Strategie degli avversari</h3><span class="muted small">soste, stint, gomme e consumi di ogni auto · clic per il dettaglio</span></div><div id="lvStrat" class="tw"></div></div>
    <div class="panel"><div class="panel-h"><h3>Passo di tutti</h3><span class="muted small">giri puliti: senza soste, validi, entro il 107% del migliore · clic su un'intestazione per ordinare</span></div><div id="lvPace" class="tw"></div></div></div>
  <div class="lvsub" data-p="wx"${sub!=='wx'?' hidden':''}>
    <div class="panel"><div class="panel-h"><h3>Adesso in pista</h3><span class="muted small" id="lvNowT"></span></div><div id="lvNow"></div></div>
    <div class="panel"><div class="panel-h"><h3>Previsioni meteo</h3><span class="muted small">dal gioco</span></div><div id="lvWx"></div></div>
    <div class="panel"><div class="panel-h"><h3>Condizioni durante la sessione</h3></div><canvas id="lvWxC" style="width:100%;height:220px"></canvas><div id="lvWxNote" class="muted small"></div></div></div>
  <div class="lvsub" data-p="ev"${sub!=='ev'?' hidden':''}>
    <div class="panel"><div class="panel-h"><h3>Eventi</h3><span class="seg" id="lvEvF"><button type="button" data-f="us">Nostra auto</button><button type="button" data-f="cls">Classe</button><button type="button" data-f="riv">Rivali</button><button type="button" data-f="all">Tutti</button></span></div>
      <div class="row" id="lvEvT" style="margin-bottom:8px"></div><div id="lvEv" class="lvev" style="max-height:none"></div></div></div>`;
  $$('#v-live .lvtabs button').forEach(b=>b.onclick=()=>{LS.set('live:sub',b.dataset.sub);$$('#v-live .lvtabs button').forEach(x=>x.setAttribute('aria-selected',x===b));$$('#v-live .lvsub').forEach(p=>p.hidden=p.dataset.p!==b.dataset.sub);renderLive(true);});
  $('#lvCar').onchange=e=>{LIVE.focus=e.target.value;LS.set('live:focus',LIVE.focus);renderLive(true);};
  $('#lvCls').onchange=e=>{LIVE.cls=e.target.value;LS.set('live:cls',LIVE.cls);renderLive(true);};
  const seg=(id,key,def,attr)=>{const cur=LS.get(key,def);$$('#'+id+' button').forEach(b=>{b.setAttribute('aria-pressed',b.dataset[attr]===cur);b.onclick=()=>{LS.set(key,b.dataset[attr]);$$('#'+id+' button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderLive(true);};});};
  seg('lvGapMode','live:gapMode','all','g');seg('lvStrMode','live:stratMode',tmPlans().plans.length?'end':'solo','m');seg('lvEvF','live:evF','cls','f');
  $('#lvNotif').value=LS.get('live:notif','class');$('#lvNotif').onchange=e=>LS.set('live:notif',e.target.value);
  $('#lvNew').onclick=liveNewTeam;$('#lvDeb').onclick=()=>openDebrief();
  $('#lvJoin').onclick=()=>openCode({title:tr('Entra con codice'),help:tr('Incolla il codice squadra che ti ha mandato l\'ingegnere (inizia con DE1-).'),text:'',onOk:txt=>{if(!teamParse(txt))throw new Error(tr('codice squadra non valido'));LS.set('live:team',txt.trim());liveStart();toast(tr('Collegato alla squadra'));}});
  $('#lvCode').onclick=()=>{const c=LS.get('live:team','');if(!c){toast(tr('Nessuna squadra: creane una o entra con un codice'));return;}
    openCode({title:tr('Codice squadra'),help:tr('Mandalo ai piloti: lo incollano nel bridge alla prima apertura (o avviandolo con -setup). Chi ha il codice vede i dati: non pubblicarlo.'),text:c});};
  $('#lvSave').onclick=()=>{const F=LIVE.field;const data={de:'live',v:1,saved:new Date().toISOString(),started:new Date().toISOString(),sc:LIVE.sc,car:LIVE.focus,drivers:[],laps:liveCarState(LIVE.focus).laps,events:liveCarState(LIVE.focus).evs,
      field:{ses:F.ses,cars:Object.fromEntries(Object.entries(F.cars).map(([k,c])=>[k,{name:c.name,cls:c.cls,drivers:c.drivers,laps:[...c.laps.values()],pits:c.pits,swaps:c.swaps}]))},wx:LIVE.wxh,forecast:LIVE.wx};
    const n=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'_'+(LIVE.sc?.i?.trk||'sessione').replace(/\W+/g,'-')+'.de.json';
    openCode({title:tr('Salva dati'),help:tr('Giri, soste ed eventi ricevuti finora. Il file si riapre con «Carica».'),text:JSON.stringify(data),file:n});};
  $('#v-live').addEventListener('click',e=>{const st=e.target.closest('[data-rv]');if(st){e.stopPropagation();const v=st.dataset.rv;let Rv=liveRivals();Rv=Rv.includes(v)?Rv.filter(x=>x!==v):[...Rv,v].slice(-6);LS.set('live:rivals',Rv);renderLive(true);return;}
    const row=e.target.closest('[data-car]');if(row)openCarModal(row.dataset.car);});
}

// ---------- main render ----------
function renderLive(force){
  if(curView()!=='live'||(!force&&document.hidden))return;liveSkeleton();const now=Date.now();if(!force&&(now-LIVE.lastRender<700||(!LIVE.dirty&&now-LIVE.lastRender<1000)))return;LIVE.dirty=false;LIVE.lastRender=now;LIVE.memo=new Map();
  const sub=LS.get('live:sub','ov');const team=teamParse(LS.get('live:team',''));const S=LIVE.status;const local=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  liveSrcSel();const rec=LIVE.rec;$('#v-live').classList.toggle('rec',!!rec);
  const st=[];if(local)st.push(`<span class="pill ${S.local==='on'?'on':''}">${S.local==='on'?'● Bridge di questo PC':'○ Bridge non attivo'}</span>`);
  if(team)st.push(`<span class="pill ${S.team==='on'?'on':S.team==='blocked'||S.team==='refused'?'bad':''}">${S.team==='on'?'● Squadra online':S.team==='refused'?'Server: accesso rifiutato':S.team==='blocked'?'Server non raggiungibile':'○ Connessione al server…'}${team.n?' · '+esc(team.n):''}</span>`);
  if(!team&&!local)st.push(`<span class="pill">Nessuna squadra</span>`);st.push(liveBridgeChips());$('#lvStat').innerHTML=st.join(' ');
  let help='';const hosted=!local&&location.protocol!=='file:';
  if(!team&&!local&&!rec)help=`<p class="muted small" style="margin:6px 0 0">Il Muretto mostra in diretta telemetria, gomme, danni, meteo e classifica. Ogni pilota avvia <b>Data Engineer Bridge</b> sul PC con cui corre; l'ingegnere crea la squadra (menu «Squadra») e manda il codice ai piloti.</p>`;
  if(hosted&&team&&LIVE.blocked>=2)help+=`<div class="warnbar" style="margin-top:8px">Questa pagina ospitata non può collegarsi a server esterni. Apri il file <b>Data_Engineer.html</b> sul PC (o <b>http://localhost:8790</b> se hai il bridge acceso) e incolla lì il codice squadra.</div>`;
  if(LIVE.err)help+=`<div class="warnbar" style="margin-top:8px">${esc(LIVE.err)}</div>`;
  const age=LIVE.L.sc&&!rec?Math.round((now-LIVE.L.scAt)/60000):0;
  if(age>=2)help+=`<div class="warnbar" style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span>Nessun dato nuovo da ${age} min: la sessione è finita o il bridge è chiuso. Questi sono gli ultimi dati ricevuti.</span><button class="btn" type="button" id="lvClear">Svuota</button></div>`;
  $('#lvHelp').innerHTML=help;const clr=$('#lvClear');if(clr)clr.onclick=liveClear;
  const cars=liveCars(),names=Object.keys(cars);if(!names.includes(LIVE.focus)){const drv=names.find(n=>cars[n].some(D=>D.car&&now-D.carAt<8000));LIVE.focus=drv||names[0]||'';}
  const sel=$('#lvCar');const lbl=n=>{const rr=(LIVE.sc?.v||[]).find(z=>z[2]===n);return rr?R(rr).label:n;};const opts=names.map(n=>`<option value="${esc(n)}"${n===LIVE.focus?' selected':''}>${esc(lbl(n))}</option>`).join('')||`<option>${esc(tr('— nessuna auto —'))}</option>`;if(sel.dataset.o!==opts){sel.innerHTML=opts;sel.dataset.o=opts;}
  const sc=LIVE.sc,I=sc?.i||{};const kind=sesKind(I);const stt=liveCarState(LIVE.focus),c=stt.c;const rows=liveRows(sc);const me=rows.find(r=>r.veh===LIVE.focus);
  $('#lvBadge').innerHTML=sc?`<span class="sb ${kind}">${tr(SES_BADGE[kind])}</span>`:'';
  const ago=sc?Math.round((now-LIVE.scAt)/1000):null;
  $('#lvSess').innerHTML=sc?[['Pista',esc(I.trk)],['Sessione',SESN(I.ses)+(I.srv?' · '+esc(I.srv):'')],[kind==='race'&&I.maxLaps>0&&I.maxLaps<99999?'Giri':'Tempo rimasto',kind==='race'&&I.maxLaps>0&&I.maxLaps<99999?`${me?me.laps:'—'}/${I.maxLaps}`:hms(I.rem)],['Ora in pista',hms(I.tod)],
    ['Aria',fx(I.air,1)+' °C'],['Asfalto',fx(I.tt,1)+' °C'],['Pioggia',Math.round((I.rain||0)*100)+'%'],['Pista bagnata',Math.round((I.wavg||0)*100)+'%'],['Grip',['verde','basso','medio','alto','gommata'][I.grip]||'—'],
    ...(I.yel>0?[['Bandiera',`<span class="neg">${FCY[I.yel]||'gialla'}</span>`]]:[]),...(ago>5?[['Dati',`<span class="neg">${ago} s fa</span>`]]:[])]
    .map(([l,v])=>`<div class="cchip"><span>${l}</span><b>${v}</b></div>`).join(''):(rec?'':`<div class="muted small">${tr('In attesa dei dati…')}</div>`);
  const S2=c&&liveStrat(stt,sc);const ctx={sc,I,kind,stt,c,S2,names,now,rows,me,rec};
  // alerts (always visible)
  const al=[];if(c&&stt.live){if(S2&&Number.isFinite(S2.left)&&S2.left<2.2&&!c.pit)al.push(['bad',`Rientra ai box: ${S2.lim==='ve'?'energia':'carburante'} per ${fx(S2.left,1)} giri`]);
    (c.w||[]).forEach((w,i)=>{if(w.flat)al.push(['bad','Foratura '+tr(WN[i])]);if(w.det)al.push(['bad','Ruota staccata: '+tr(WN[i])]);});if(c.ovh)al.push(['bad','Motore in surriscaldamento']);if(c.detached)al.push(['bad','Parti staccate dalla vettura']);
    if(c.pen>0)al.push(['warn',`Penalità da scontare: ${c.pen}`]);if(c.tl>0&&c.tlPen>0&&c.tl>=c.tlPen-1)al.push(['warn',`Limiti di pista: ${c.tl}/${c.tlPen} (prossimo = penalità)`]);}
  $('#lvAlerts').innerHTML=al.map(([k,t])=>`<div class="lvalert ${k}">${esc(t)}</div>`).join('');
  const Ds=Object.values(LIVE.drivers).filter(D=>D.hi).sort((a,b)=>(a.hi.name||'').localeCompare(b.hi.name||''));
  $('#lvTeam').innerHTML=`<div class="muted small" style="margin-top:6px">${tr('Bridge della squadra')}</div>`+(Ds.length?Ds.map(D=>{const h=D.hi;const age=Math.round((now-D.seen)/1000);const on=h.on!==false&&age<75;
    return `<div class="lvrow"><span><span class="dot ${on?(h.drv?'good':'warn'):'bad'}"></span> ${esc(h.name||'pilota')}</span><b class="small">${!on?'offline':h.drv?'in auto':h.lmu?'LMU aperto':'LMU chiuso'}</b></div>`;}).join(''):`<div class="muted small">${tr('Nessun bridge collegato.')}</div>`);
  const fns={ov:lvOverview,lb:lvBoard,car:lvCar,str:lvStrategy,riv:lvRivals,wx:lvWeather,ev:lvEvents,tv:()=>{}};
  try{fns[sub](ctx);}catch(e){console.error(e);}
}

// ---------- Panoramica ----------
function lvOverview(x){const {sc,I,kind,stt,c,S2,names,now,rows,me,rec}=x;
  if(rec)liveRecHead(stt,sc);
  else if(!c&&!me){$('#lvHead').innerHTML=`<div class="muted">${names.length?'Nessun dato recente da questa auto.':'Nessun pilota collegato. Quando un pilota avvia il bridge e scende in pista, qui compare la sua auto.'}</div>`;$('#lvKpi').innerHTML='';}
  else{const cs=me?carStats(me.veh,me):null;const status=bigStatus(stt,c,me);
    const cls=c?.cls||me?.cls||'',drv=c?.drv||me?.drv||'';
    $('#lvHead').innerHTML=`<div class="lvhead"><span class="clsdot" style="background:${LV_CLS(cls)}"></span><div><div class="ey">${esc(cls)} · ${esc(me?.label||LIVE.focus)}</div><h2 style="margin:0">${esc(drv)}</h2></div>${status}</div>`;
    const cl=rows.filter(r=>r.cls===me?.cls).sort((a,b)=>a.pos-b.pos);const i=me?cl.indexOf(me):-1;const ah=cl[i-1],bh=cl[i+1];
    const T=[];
    if(kind==='race'){const lt=cs?.pace5||me?.estL;const gapTo=o=>o&&me?Math.abs((me.gapL+me.lapsL*lt)-(o.gapL+o.lapsL*lt)):NaN;const lead=cl[0];
      T.push(liveTile('Posizione',me?`P${me.pic}`:'—',me?`P${me.pos} assoluto${me.qual>0?` · partito P${me.qual}`:''}`:''),
        liveTile('Dal leader di classe',me&&lead&&lead!==me?(me.lapsL>lead.lapsL?`+${me.lapsL-lead.lapsL} ${tr('giri')}`:'+'+fx(gapTo(lead),1)):'—',lead&&lead!==me?esc(lead.drv):'sei in testa'),
        liveTile('Davanti',ah?'+'+fx(gapTo(ah),1):'—',ah?esc(ah.drv):''),liveTile('Dietro',bh?'−'+fx(gapTo(bh),1):'—',bh?esc(bh.drv):''),
        liveTile('Passo (ultimi 5)',fmtLap(cs?.pace5),cs&&Number.isFinite(cs.sd)?'costanza ±'+fx(cs.sd,2)+' s':''),liveTile('Ultimo giro',fmtLap(c?.last??me?.last),cs?.lastInv?'<span class="neg">invalidato</span>':'',cs?.lastInv?'inv':''),
        liveTile('Carburante',c?fx(c.fuel,1)+' L':me&&me.fuel>=0?Math.round(me.fuel*100)+'%':'—',S2&&Number.isFinite(S2.lf)?`${fx(S2.lf,1)} giri`:''),
        liveTile('Energia virtuale',c&&c.ve>0?fx(c.ve*100,1)+' %':me&&me.ve>=0?Math.round(me.ve*100)+'%':'—',S2&&Number.isFinite(S2.lv)?`${fx(S2.lv,1)} giri`:''),
        liveTile('Stint',cs?cs.stintLaps+' giri':'—',me&&me.pits===1?'1 sosta':`${me?me.pits:0} soste`),
        liveTile('Settori',me?secMini(me,rows):'—',me?tr('in diretta'):''));}
    else{const ref=rows.filter(r=>r.best>0).sort((a,b)=>a.best-b.best);const pole=ref[0],cpole=ref.find(r=>r.cls===me?.cls);const bp=me?ref.indexOf(me)+1:0;const bpc=me?ref.filter(r=>r.cls===me.cls).indexOf(me)+1:0;
      T.push(liveTile('Posizione (miglior giro)',bpc?`P${bpc}`:'—',bp?`P${bp} assoluto`:''),liveTile('Miglior giro',fmtLap(me?.best),'','hl'),
        liveTile('Dalla pole di classe',me&&cpole&&me.best>0?(cpole===me?'pole':'+'+fx(me.best-cpole.best,3)):'—',cpole&&cpole!==me?esc(cpole.drv):''),
        liveTile('Dalla pole assoluta',me&&pole&&me.best>0?(pole===me?'pole':'+'+fx(me.best-pole.best,3)):'—',pole?esc(pole.drv):''),
        liveTile('Giro ideale',fmtLap(cs?.ideal),Number.isFinite(cs?.ideal)&&me?.best>0?`${fx(me.best-cs.ideal,3)} s da trovare`:'somma dei settori migliori'),
        liveTile('Ultimo giro',fmtLap(c?.last??me?.last),cs?.lastInv?'<span class="neg">invalidato</span>':'',cs?.lastInv?'inv':''),
        liveTile('Delta live',c?`<span class="${c.db<0?'pos':c.db>0?'neg':''}">${sgn(c.db,2)}</span>`:'—','sul miglior giro'),
        liveTile('Giri',me?me.laps:'—',`${tr('tempo rimasto')} ${hms(I.rem)}`),liveTile('Gomme',compHTML(me?.comp,me?.cf,me?.cr),''),
        liveTile('Settori',me?secMini(me,rows):'—',me?tr('in diretta'):''));}
    $('#lvKpi').innerHTML=`<div class="kpis">${T.join('')}</div>`;}
  drawLiveMap(sc,names);
  // around us
  if(me){const cl=rows.filter(r=>r.cls===me.cls);let L;
    if(kind==='race'){L=cl.sort((a,b)=>a.pos-b.pos);$('#lvNearT').textContent=tr('Intorno a noi in classe');}
    else{L=cl.filter(r=>r.best>0).sort((a,b)=>a.best-b.best);if(!L.includes(me))L.push(me);$('#lvNearT').textContent=tr('Tempi della classe');}
    const i=L.indexOf(me);const part=L.slice(Math.max(0,i-3),i+4);const lt=carStats(me.veh,me).pace5||me.estL;
    $('#lvNear').innerHTML=`<table><thead><tr><th>Cl.</th><th class="l">Pilota</th>${kind==='race'?'<th>Distacco</th><th>Passo 5</th><th>Δ passo</th><th>Stint</th><th>Gomme</th>':'<th>Best</th><th>Δ</th><th>Ultimo</th><th>Gomme</th>'}</tr></thead><tbody>${part.map(r=>{const cs=carStats(r.veh,r);const myP=carStats(me.veh,me).pace5;
      if(kind==='race'){const g=(r.gapL+r.lapsL*lt)-(me.gapL+me.lapsL*lt);return `<tr class="${r===me?'ours':''}" data-car="${esc(r.veh)}"><td>P${r.pic}</td><td class="l">${esc(r.drv)}</td><td>${r===me?'—':g<0?'<span class="neg">'+fx(g,1)+'</span>':'<span class="pos">+'+fx(g,1)+'</span>'}</td><td>${fmtLap(cs.pace5)}</td><td>${r===me?'—':`<span class="${cs.pace5<myP?'neg':'pos'}">${sgn(cs.pace5-myP,2)}</span>`}</td><td>${cs.stintLaps}</td><td>${compHTML(r.comp,r.cf,r.cr)}</td></tr>`;}
      return `<tr class="${r===me?'ours':''}" data-car="${esc(r.veh)}"><td>P${L.indexOf(r)+1}</td><td class="l">${esc(r.drv)}</td><td>${fmtLap(r.best)}</td><td>${r===me||!(r.best>0)||!(me.best>0)?'—':`<span class="${r.best<me.best?'neg':'pos'}">${sgn(r.best-me.best,3)}</span>`}</td><td class="${cs.lastInv?'neg':''}">${fmtLap(cs.lastT>0?cs.lastT:r.last)}</td><td>${compHTML(r.comp,r.cf,r.cr)}</td></tr>`;}).join('')}</tbody></table>`;}
  else $('#lvNear').innerHTML='';
  // brief
  const B=[];if(S2&&kind==='race'){const fl=finishLaps(rows,me,sc);B.push(['Giri possibili con quello che hai',fx(S2.left,1)+(S2.lim==='ve'?' (energia)':' (carburante)')],['Ultimo giro utile per la sosta',Number.isFinite(S2.lastLap)?'giro '+S2.lastLap:'—'],['Giri alla bandiera',Number.isFinite(fl)?'≈ '+fl:'—'],['Soste ancora necessarie',Number.isFinite(S2.stops)?S2.stops:'—']);}
  if(kind!=='race'&&me){const lt=carStats(me.veh,me).best||me.estL;if(I.rem>0&&lt>0)B.push(['Giri ancora possibili nella sessione','≈ '+Math.floor(I.rem/lt)]);if(S2&&Number.isFinite(S2.left))B.push(['Giri con il carburante a bordo',fx(S2.left,1)]);
    const best=rows.filter(r=>r.best>0).sort((a,b)=>a.best-b.best)[0];if(best)B.push(['Miglior tempo della sessione',`${fmtLap(best.best)} · ${esc(best.drv)}`]);}
  const lossNow=liveLoss(stt);if(me&&kind==='race'){const po=pitOut(rows,me,lossNow);if(po)B.push(['Se ti fermi ora rientri',`P${po.pic} di classe${po.aC?' dietro a '+esc(po.aC.r.drv):''}`]);}
  if(LIVE.wx?.nodes?.length){const n=LIVE.wx.nodes;const nx=n.find((z,i)=>i>0&&(z.rain>1?z.rain:z.rain*100)>=40);B.push(['Meteo',nx?`${tr('pioggia probabile')} (${fx(nx.rain>1?nx.rain:nx.rain*100,0)}%)`:tr('niente pioggia prevista')]);}
  const flt=rows.filter(r=>r.inPit&&!r.gar).length;if(sc)B.push(['Auto ai box ora',flt]);
  $('#lvBrief').innerHTML=B.map(([l,v])=>`<div class="lvrow"><span>${l}</span><b>${v}</b></div>`).join('')||`<div class="muted small">${tr('In attesa dei dati…')}</div>`;
  try{lvCond(x);lvCons(x);lvRel(x);}catch(e){console.error(e);}
  $('#lvEvShort').innerHTML=lvEventList(x,'us').slice(0,8).join('')||`<div class="muted small">${tr('Nessun evento per ora.')}</div>`;}
function liveLoss(stt){const P=(stt.Ds||[]).filter(D=>D.pit).sort((a,b)=>(b.pitAt||0)-(a.pitAt||0))[0]?.pit||LIVE.rec?.pitRec;const losses=liveLapsLoss(stt);const lanes=losses.filter(x=>Number.isFinite(x.stop)).map(x=>x.loss-x.stop);
  const lane=med_(lanes);const stored=LS.get('pitloss:'+(LIVE.sc?.i?.trk||''),null);const tot=P?.est?.total;
  // other cars' measured lanes at this track are a good stand-in for ours
  const fieldLane=med_(Object.values(LIVE.field?.cars||{}).flatMap(c=>(c.pits||[]).filter(p=>!p.garage&&p.lane>0&&p.stop>=0).map(p=>p.lane-p.stop)));
  const man=+LS.get('pitloss:man:'+(LIVE.sc?.i?.trk||''),0);if(man>0)return man;
  const ln=Number.isFinite(lane)?lane:fieldLane;if(Number.isFinite(tot)&&Number.isFinite(ln))return tot+ln+3;if(stored?.loss)return stored.loss;
  // nothing measured yet: the field's measured losses, else the game's stop estimate + a typical lane
  const fl=med_(Object.values(LIVE.field?.cars||{}).flatMap(c=>(c.pits||[]).filter(p=>!p.garage&&p.lane>0&&p.lane<200).map(p=>p.lane+3)));return Number.isFinite(fl)?fl:Number.isFinite(tot)?tot+25:NaN;}

// ---------- Classifica ----------
function lvBoard(x){const {sc,I,kind,rows,me,names}=x;if(!sc){$('#lvStand').innerHTML=`<div class="muted small">${tr('In attesa dei dati…')}</div>`;return;}
  const classes=[...new Set(rows.map(r=>r.cls))];const cs=$('#lvCls');const co=`<option value="">${esc(tr('Tutte'))}</option>`+classes.map(c=>`<option${c===LIVE.cls?' selected':''}>${esc(c)}</option>`).join('');if(cs.dataset.o!==co){cs.innerHTML=co;cs.dataset.o=co;}
  const gm=LS.get('live:gapMode','all');const ours=new Set(names);const riv=liveRivals();const cbest={};rows.forEach(r=>{if(r.best>0&&(!cbest[r.cls]||r.best<cbest[r.cls]))cbest[r.cls]=r.best;});const obest=Math.min(...rows.filter(r=>r.best>0).map(r=>r.best));
  const star=r=>`<button type="button" class="star${riv.includes(r.veh)?' on':''}" data-rv="${esc(r.veh)}" title="${esc(tr('Segui come rivale'))}">${riv.includes(r.veh)?'★':'☆'}</button>`;
  const stat=r=>statusChip(r);
  const name=(r,s)=>{const sw=s.swaps[s.swaps.length-1];const recent=sw&&Number.isFinite(I.et)&&I.et-sw.et<300;return `${esc(r.drv)}${s.drivers.length>1?` <span class="muted small" title="${esc(s.drivers.join(', '))}">+${s.drivers.length-1}</span>`:''}${recent?' <span class="tag warn">⇄</span>':''}<div class="muted small">${esc(r.label||r.veh)}</div>`;};
  let shown=rows.filter(r=>!LIVE.cls||r.cls===LIVE.cls);let H,B;const hasV=rows.some(r=>vmaxOf(r).ses>0);
  if(kind==='race'){shown.sort((a,b)=>a.pos-b.pos);const leaderOf={};const lt=r=>carStats(r.veh,r).pace5||r.estL||100;
    shown.forEach(r=>{if(!leaderOf[r.cls])leaderOf[r.cls]=r;});const prevIn={};
    $('#lvLbT').textContent=tr('Classifica di gara');$('#lvLbNote').textContent=tr('clic su una riga per tempi, soste e cambi pilota');
    const cb=secClassBest(rows);const vb=vmaxBest(rows);
    H=`<th></th><th>Pos</th><th>Cl.</th><th class="l">Pilota</th><th>Stato</th><th class="l">VE · benzina</th><th>Giri</th><th>${gm==='cls'?'Dal 1° di classe':'Distacco'}</th><th>Interv.</th><th class="sxh">S1</th><th class="sxh">S2</th><th class="sxh">S3</th><th>Ultimo</th><th>Best · passo</th>${hasV?'<th title="velocità massima: sessione · stint · ultimo giro">Vel. max</th>':''}<th>Soste</th><th>Box tra</th><th title="mescola e giri delle gomme">Gomme</th><th>Danni · limiti</th>`;
    B=shown.map(r=>{const s=carStats(r.veh,r);const ld=leaderOf[r.cls];let gap,intv;
      if(gm==='cls'){const L=lt(r);gap=r===ld?'—':(r.lapsL-ld.lapsL>0?`+${r.lapsL-ld.lapsL}G`:'+'+fx((r.gapL+r.lapsL*L)-(ld.gapL+ld.lapsL*L),1));const pv=prevIn[r.cls];intv=pv?((r.lapsL-pv.lapsL)>0&&(r.gapL+r.lapsL*L)-(pv.gapL+pv.lapsL*L)>L?`+${r.lapsL-pv.lapsL}G`:'+'+fx((r.gapL+r.lapsL*L)-(pv.gapL+pv.lapsL*L),1)):'—';prevIn[r.cls]=r;}
      else{gap=r.pos===1?tr('leader'):r.lapsL>0?`+${r.lapsL}G`:'+'+fx(r.gapL,1);intv=r.pos===1?'—':r.lapsN>0?`+${r.lapsN}G`:'+'+fx(r.gapN,1);}
      const ch=r.qual>0?r.qual-r.pos:0;const lp=s.lastPit;const best=r.best>0&&r.best===cbest[r.cls];
      return `<tr class="${ours.has(r.veh)?'ours':''}${riv.includes(r.veh)?' riv':''}${r.inPit||r.gar?' inpit':''}" data-car="${esc(r.veh)}"><td>${star(r)}</td><td>${r.pos}${ch?` <span class="${ch>0?'pos':'neg'} small">${ch>0?'▲':'▼'}${Math.abs(ch)}</span>`:''}</td><td><span class="clsdot" style="background:${LV_CLS(r.cls)}"></span>${r.pic}</td><td class="l">${name(r,s)}</td><td>${stat(r)}</td>${energyCell(r)}<td>${r.laps}</td><td>${gap}</td><td>${intv}</td>
        ${secCells(r,cb)}<td class="${s.lastInv?'neg':''}">${fmtLap(s.lastT>0?s.lastT:r.last)}</td><td class="${best?'bestc':''}">${fmtLap(r.best)}<div class="muted small" title="${esc(tr('media ultimi 5 giri'))}">${fmtLap(s.pace5)}</div></td>${hasV?vmaxCell(r,vb):''}
        <td${lp?` title="${esc(tr('Ultima sosta')+': '+tr('giro')+' '+lp.lap+' · '+tr('fermo')+' '+fx(lp.stop,1)+' s · '+tr('corsia')+' '+fx(lp.lane,1)+' s'+(lp.tyres?' · '+lp.tyres+' '+tr('gomme'):''))}"`:''}><b>${r.pits}</b>${lp?`<div class="muted small">${fx(lp.stop,1)}s${lp.tyres?' · '+lp.tyres+'G':''}</div>`:''}${r.pen?` <span class="tag bad">P${r.pen}</span>`:''}</td>
        <td>${Number.isFinite(s.left)?`<span class="${s.left<2?'neg':''}">${Math.floor(s.left)}</span>`:'—'}</td>
        ${tyreCell(r)}<td>${r.det?'<span class="tag bad">!</span>':r.dents?`<span class="${r.dents>3?'neg':'muted'}">${Math.round(r.dents/16*100)}%</span>`:''}${r.tl?` <small class="${I.tlPen&&r.tl>=I.tlPen-1?'neg':'muted'}" title="${esc(tr('Limiti di pista'))}">TL ${r.tl}</small>`:''}</td></tr>`;}).join('');}
  else{shown=shown.sort((a,b)=>(a.best>0?a.best:1e9)-(b.best>0?b.best:1e9));const prev={};
    $('#lvLbT').textContent=kind==='qual'?tr('Classifica di qualifica'):tr('Tempi delle prove');$('#lvLbNote').textContent=tr('ordinata per miglior giro · settori in diretta');
    // sectors of each car's best lap: from the game, or from the lap history
    const secOf=r=>{if(r.blS1>0&&r.blS2>r.blS1&&r.best>r.blS2)return [r.blS1,r.blS2-r.blS1,r.best-r.blS2];const L=fLaps(r.veh).filter(l=>!l[7]&&l[1]>0&&l[4]>0&&l[5]>l[4]&&l[1]>l[5]);if(!L.length)return [NaN,NaN,NaN];const b=L.reduce((a,l)=>l[1]<a[1]?l:a);return [b[4],b[5]-b[4],b[1]-b[5]];};
    shown.forEach(r=>{r.ss=secOf(r);});const cbq=secClassBest(rows);const vbq=vmaxBest(rows);const bs={};shown.forEach(r=>{r.ss.forEach((v,i)=>{const k=r.cls+i;if(v>0&&(!bs[k]||v<bs[k]))bs[k]=v;});});
    H=`<th></th><th>Pos</th><th>Cl.</th><th class="l">Pilota</th><th>Stato</th><th>Best</th><th>${gm==='cls'?'Dalla pole di classe':'Dalla pole'}</th><th>Dal precedente</th><th class="sxh">S1</th><th class="sxh">S2</th><th class="sxh">S3</th><th>Ideale</th>${hasV?'<th>Vel. max</th>':''}<th>Ultimo</th><th>Giri</th><th class="l">VE · benzina</th><th>Gomme</th>`;
    let i=0;const cp={};B=shown.map(r=>{const s=carStats(r.veh,r);i++;cp[r.cls]=(cp[r.cls]||0)+1;const ref=gm==='cls'?cbest[r.cls]:obest;const pv=gm==='cls'?prev[r.cls]:prev.all;
      const secs=secCells(r,cbq);const bl=r.ss.every(v=>v>0)?`${tr('Settori del giro migliore')}: ${r.ss.map(v=>fx(v,3)).join(' · ')}`:'';
      const out=`<tr class="${ours.has(r.veh)?'ours':''}${riv.includes(r.veh)?' riv':''}${r.inPit||r.gar?' inpit':''}" data-car="${esc(r.veh)}"><td>${star(r)}</td><td>${r.best>0?i:'—'}</td><td><span class="clsdot" style="background:${LV_CLS(r.cls)}"></span>${r.best>0?cp[r.cls]:'—'}</td><td class="l">${name(r,s)}</td><td>${stat(r)}</td>
        <td class="${r.best>0&&r.best===cbest[r.cls]?'bestc':''}" title="${esc(bl)}">${fmtLap(r.best)}</td><td>${r.best>0&&ref?(r.best===ref?'—':'+'+fx(r.best-ref,3)):'—'}</td><td>${pv&&r.best>0?'+'+fx(r.best-pv.best,3):'—'}</td>${secs}<td>${fmtLap(s.ideal)}</td>${hasV?vmaxCell(r,vbq):''}<td class="${s.lastInv?'neg':''}">${fmtLap(s.lastT>0?s.lastT:r.last)}</td><td>${r.laps}</td>${energyCell(r)}${tyreCell(r)}</tr>`;
      if(r.best>0){prev[r.cls]=r;prev.all=r;}return out;}).join('');}
  $('#lvStand').innerHTML=`<table class="lbt"><thead><tr>${H}</tr></thead><tbody>${B}</tbody></table>`;}

// ---------- Auto ----------
function lvCar(x){const {c,stt}=x;
  if(c&&c.w){$('#lvComp').textContent=[c.cf,c.cr].filter(Boolean).join(' / ');
    $('#lvTyres').innerHTML=`<div class="lvtyres">${[0,1,2,3].map(i=>{const w=c.w[i];const wear=w.wear>0?(1-w.wear)*100:NaN;return `<div class="lvt${w.flat||w.det?' bad':''}" style="--tc:${tHeat(w.c)}">
      <div class="lvt-h"><b>${tr(WN[i])}</b><span>${w.flat?'<span class="neg">FORATA</span>':''}</span></div><div class="lvt-c" style="background:${tHeat(w.c)}">${fx(w.c,0)}°<small>carcassa</small></div>
      <div class="lvt-i">${(i%2===0?w.i:[...w.i].reverse()).map(t=>`<span style="background:${tHeat(t)}">${fx(t,0)}</span>`).join('')}</div>
      <div class="lvt-r"><span>${fx(w.p,1)} kPa</span><span>usura ${fx(wear,1)}%</span></div><div class="lvt-r"><span>freno ${fx(w.bt,0)}°</span><span>${w.surf===1?'bagnato':w.surf>=2&&w.surf<=4?'fuori pista':''}</span></div></div>`;}).join('')}</div>`;
    const d=c.dents||[];const zc=i=>d[i]>=2?'var(--bad)':d[i]===1?'var(--warn)':'var(--panel2)';const Z=[[1,1,1],[0,2,1],[7,3,1],[2,1,2],[3,3,2],[4,1,3],[6,2,3],[5,3,3]];const tot=Math.round(d.reduce((a,b)=>a+(b>=2?100:b?50:0),0)/8);
    $('#lvDmg').innerHTML=`<div class="lvdmg"><div class="lvcar">${Z.map(([i,col,row])=>`<span style="grid-column:${col};grid-row:${row};background:${zc(i)}" title="${esc(tr(ZONES[i]))}"></span>`).join('')}<span class="body" style="grid-column:2;grid-row:2"></span></div>
      <div><div class="lvrow"><span>Danni carrozzeria</span><b class="${tot?'neg':''}">${tot}%</b></div><div class="lvrow"><span>Parti staccate</span><b class="${c.detached?'neg':''}">${c.detached?'sì':'no'}</b></div>
      <div class="lvrow"><span>Ultimo urto</span><b>${c.imp?.[0]>0?hms(c.imp[0])+' · '+fx(c.imp[1],0):'—'}</b></div><div class="lvrow"><span>Acqua / olio</span><b class="${c.ovh?'neg':''}">${fx(c.water,0)} / ${fx(c.oil,0)} °C</b></div>
      <div class="lvrow"><span>Giri motore</span><b>${fx(c.rpm,0)} · ${c.gear<0?'R':c.gear===0?'N':c.gear}ª</b></div><div class="lvrow"><span>Altezza ant / post</span><b>${fx(c.w?.[0]?.rh,0)} / ${fx(c.w?.[2]?.rh,0)} mm</b></div></div></div>`;
    const lv=a=>a?`${a[0]}${a[1]?'/'+a[1]:''}`:'—';
    $('#lvEl').innerHTML=[['Ripartizione frenata',fx(c.bb,1)+' %'],['TC',lv(c.tc)+(c.tcOn?' <span class="pill warn">attivo</span>':'')],['TC taglio · slip',`${c.tc?.[2]??'—'} · ${c.tc?.[3]??'—'}`],['ABS',lv(c.abs)+(c.absOn?' <span class="pill warn">attivo</span>':'')],
      ['Mappa motore',lv(c.map)],['Migrazione freno',c.mig??'—'],['Barre ant / post',`${c.arb?.[0]??'—'} / ${c.arb?.[1]??'—'}`],['Batteria',fx((c.bat||0)*100,0)+' %'],['Limitatore box',c.lim?'<span class="pill warn">ON</span>':'off'],['Fari',c.hl?'accesi':'spenti']]
      .map(([l,v])=>`<div class="lvrow"><span>${l}</span><b>${v}</b></div>`).join('');}
  else{['#lvTyres','#lvDmg','#lvEl'].forEach(s=>$(s).innerHTML=`<div class="muted small">${tr('Nessun dato: l\'auto non è in pista.')}</div>`);}
  drawLiveInputs(LIVE.buf[LIVE.focus]||[]);
  // pit menu estimate
  const Dp=(stt.Ds||[]).filter(D=>D.pit).sort((a,b)=>(b.pitAt||0)-(a.pitAt||0))[0];const pit=Dp?.pit||LIVE.rec?.pitRec;const losses=liveLapsLoss(stt);
  if(!pit&&!losses.length)$('#lvPit').innerHTML=`<div class="muted small">Appare quando il pilota è in pista con il bridge acceso: il gioco calcola quanto dura la sosta con quello che è selezionato nel menu box (energia, gomme, riparazioni, cambio pilota).</div>`;
  else{const est=pit?.est||{};const tot=est.total;const loss=liveLoss(stt);
    const parts=Object.entries(est).filter(([k,v])=>k!=='total'&&v>0).map(([k,v])=>`<div class="lvrow"><span>${esc(tr(EST_N[k]||k))}</span><b>${fx(v,1)} s</b></div>`).join('');const w=pit?.wear||{};const pc=v=>Number.isFinite(v)?fx(v*100,0)+'%':'—';
    $('#lvPit').innerHTML=`<div class="kpis">${[liveTile('Fermo ai box',Number.isFinite(tot)?fx(tot,1)+' s':'—','stima del gioco'),liveTile('Tempo perso in tutto',Number.isFinite(loss)?'≈ '+fx(loss,0)+' s':'—','corsia + sosta')].join('')}</div>
      <div class="grid2" style="margin-top:10px;gap:14px"><div>${parts}${(pit?.menu||[]).map(m=>`<div class="lvrow"><span>${esc(String(m.n).replace(/:$/,''))}</span><b>${esc(m.v)}</b></div>`).join('')}</div>
      <div>${Number.isFinite(w.aero)?`<div class="lvrow"><span>Danno aerodinamico</span><b class="${w.aero>0.02?'neg':''}">${pc(w.aero)}</b></div>`:''}${w.brakes?`<div class="lvrow"><span>Usura freni</span><b>${w.brakes.map(pc).join(' · ')}</b></div>`:''}${w.suspension?`<div class="lvrow"><span>Danni sospensioni</span><b class="${w.suspension.some(v=>v>0.02)?'neg':''}">${w.suspension.map(pc).join(' · ')}</b></div>`:''}
        ${losses.slice(-3).map(l=>`<div class="lvrow"><span>Sosta al giro ${l.lap}</span><b>${fx(l.loss,1)} s${Number.isFinite(l.stop)?` (fermo ${fx(l.stop,1)})`:''}</b></div>`).join('')}</div></div>`;}
  const L=stt.laps;const best=Math.min(...L.filter(l=>!l.inv&&!l.pit&&l.t>0).map(l=>l.t));
  $('#lvLaps').innerHTML=L.length?`<table><thead><tr><th>Giro</th><th class="l">Pilota</th><th>Tempo</th><th>Carb.</th><th>VE</th><th>Usura %</th><th>Carcassa</th><th>Asfalto</th><th></th></tr></thead><tbody>${[...L].reverse().slice(0,120).map(l=>`<tr class="${l.inv?'inv':''}${l.t===best?' best':''}">
    <td>${l.n}</td><td class="l">${esc(l.drv||'')}</td><td class="lt">${fmtLap(l.t)}</td><td>${l.fuel>0?fx(l.fuel,2):'—'}</td><td>${l.ve>0?fx(l.ve*100,2):'—'}</td><td>${fx((l.wear||[]).reduce((a,b)=>a+b,0)/4,2)}</td><td>${fx((l.carc||[]).reduce((a,b)=>a+b,0)/4,0)}</td><td>${fx(l.trk,1)}</td><td>${l.pit?'<span class="tag info">box</span>':''}${l.inv?' <span class="tag bad">inv.</span>':''}</td></tr>`).join('')}</tbody></table>`:`<div class="muted small">${tr('I giri compaiono qui man mano che vengono completati.')}</div>`;}

// ---------- Strategia ----------
function lvStrategy(x){const {sc,I,kind,stt,c,S2,rows,me}=x;const mode=LS.get('live:stratMode',tmPlans().plans.length?'end':'solo');
  if(S2){const fl=finishLaps(rows,me,sc);$('#lvStr').innerHTML=`<div class="kpis">${[liveTile('Giri possibili',fx(S2.left,1),S2.lim==='ve'?'limita l\'energia virtuale':'limita il carburante'),
      liveTile('Ultimo giro utile per la sosta',Number.isFinite(S2.lastLap)?'giro '+S2.lastLap:'—',''),liveTile('Giri alla bandiera',Number.isFinite(fl)?'≈ '+fl:Number.isFinite(S2.toGo)?'≈ '+S2.toGo:'—',I.maxLaps>0&&I.maxLaps<99999?'gara a giri':'il leader chiude il giro dopo lo scadere del tempo'),
      liveTile('Soste ancora necessarie',Number.isFinite(S2.stops)?S2.stops:'—',Number.isFinite(S2.stint)&&S2.stint<999?'stint pieno ≈ '+fx(S2.stint,0)+' giri':''),
      liveTile('Carburante per finire',Number.isFinite(S2.need)?fx(S2.need,1)+' L':'—','oltre a quello a bordo'),liveTile('Consumo',`${fx(S2.fpl,2)} L · ${Number.isFinite(S2.vpl)?fx(S2.vpl*100,2)+' %':'—'}`,'per giro (benzina · energia)')].join('')}</div>
      <p class="muted small" style="margin:8px 0 0">${S2.n?`Medie sugli ultimi ${S2.n} giri senza soste.`:'Le medie compaiono dopo il primo giro completo senza soste.'}${kind!=='race'?' '+tr('In prova e qualifica i numeri servono a preparare la gara.'):''}</p>`;}
  else $('#lvStr').innerHTML=`<div class="muted small">${tr('Serve la nostra auto in pista con il bridge acceso.')}</div>`;
  // plan
  let h='';if(mode==='end'){const T=tmPlans();const pid=LS.get('live:plan','');const P=T.plans.find(p=>p.id===pid)||T.plans.find(p=>p.id===T.cur)||T.plans[0];
    h=`<div class="panel"><div class="panel-h"><h3>Piano endurance</h3><label class="f" style="min-width:220px">Piano<select id="lvPlan">${T.plans.map(p=>`<option value="${p.id}"${P&&p.id===P.id?' selected':''}>${esc(p.race.name||'Piano')}</option>`).join('')}</select></label></div>`;
    const PS=P&&tmStints(P);if(!PS)h+=`<div class="muted small">Crea un piano in Strategia › Endurance: qui vedrai la gara reale confrontata con il piano.</div>`;
    else{const L=stt.laps;const raceT=I.et||0;const lastLap=L[L.length-1];const pits=c?.pits??me?.pits??0;const k=Math.min(pits,PS.stints.length-1),ps=PS.stints[k],nx=PS.stints[k+1];const cum=ps.lap0+ps.laps;
      const lastPitN=Math.max(0,...L.filter(l=>l.pit).map(l=>l.n));const inStint=c?Math.max(0,(c.lap-1)-lastPitN):NaN;const delta=lastLap&&Number.isFinite(lastLap.et)?lastLap.et-planTimeAt(PS,lastLap.n):NaN;
      const lastOut=stt.evs.filter(e=>e.k==='pit_out').sort((a,b)=>b.et-a.et)[0];const stintT=raceT-(lastOut?lastOut.et:0);const drv=(c?.drv||'').toLowerCase(),pdr=(ps.d.name||'').toLowerCase();const mism=drv&&pdr&&!drv.includes(pdr.split(' ')[0])&&!pdr.includes(drv.split(' ')[0]);
      const liveEnd=S2&&Number.isFinite(S2.lastLap)?S2.lastLap:NaN;const toChange=nx&&Number.isFinite(liveEnd)&&c?Math.max(0,liveEnd-(c.lap-1)):NaN;
      h+=`<div class="kpis">${[liveTile('Stint',`${k+1} di ${PS.stints.length}`,`piano: ${esc(ps.d.name)} · ${ps.laps} giri`),liveTile('Giri nello stint',Number.isFinite(inStint)?`${inStint} / ${ps.laps}`:'—',`tempo di guida ${hms(stintT)}`),
        liveTile('Fine stint',Number.isFinite(liveEnd)?'giro '+liveEnd:'—',`piano: giro ${cum}`+(Number.isFinite(liveEnd)?` (${liveEnd-cum>=0?'+':''}${liveEnd-cum})`:'')),
        liveTile('Rispetto al piano',Number.isFinite(delta)?`<span class="${delta>0?'neg':'pos'}">${delta>0?'+':''}${fx(delta,0)} s</span>`:'—',Number.isFinite(delta)?(delta>0?'in ritardo':'in anticipo'):'serve un giro completo'),
        liveTile('Prossimo pilota',nx?esc(nx.d.name):'—',nx?`piano ${hhmm(PS.startMin+nx.start/60)}${Number.isFinite(toChange)?` · tra ${toChange} giri`:''}`:'ultimo stint')].join('')}</div>
        ${mism?`<div class="warnbar" style="margin-top:10px">In auto c'è ${esc(c.drv)}, il piano prevede ${esc(ps.d.name)}.</div>`:''}
        <div class="gantt lvg">${PS.stints.map((s,i)=>`<span style="flex:${s.dur+s.stop};background:${s.d.col};opacity:${i<k?.45:1}" title="${esc(s.d.name)} · ${s.laps} giri">${s.dur>PS.T*0.05?esc(s.d.name.split(' ')[0]):''}</span>`).join('')}<i class="now" style="left:${Math.min(100,raceT/PS.T*100)}%"></i></div>`;}
    h+='</div>';}
  else{const sp=soloPlan();h=`<div class="panel"><div class="panel-h"><h3>Piano da solo</h3><span class="muted small">da Strategia › Solo</span></div>`;
    if(!sp)h+=`<div class="muted small">Imposta la gara in Strategia › Solo: qui vedrai lo stint attuale confrontato con il piano.</div>`;
    else{const lap=c?.lap??(me?me.laps+1:1);const k=sp.stints.findIndex(s=>lap<=s.to);const ps=sp.stints[k<0?sp.stints.length-1:k];const liveEnd=S2&&Number.isFinite(S2.lastLap)?S2.lastLap:NaN;
      h+=`<div class="kpis">${[liveTile('Stint',`${(k<0?sp.stints.length-1:k)+1} di ${sp.stints.length}`,`giri ${ps.from}–${ps.to}`),liveTile('Sosta prevista',k<sp.stints.length-1?'giro '+ps.to:'nessuna',Number.isFinite(liveEnd)?`dai consumi: giro ${liveEnd}${liveEnd<ps.to?' <span class="neg">(prima del piano)</span>':''}`:''),
        liveTile('Giri totali previsti',sp.total,`passo ${fmtLap(sp.lap)}`),liveTile('Stint massimo',sp.stintMax+' giri','')].join('')}</div>
        <div class="gantt lvg">${sp.stints.map((s,i)=>`<span style="flex:${s.n};background:${i%2?'var(--lapB)':'var(--lapA)'};opacity:${i<k?.45:1}">${s.from}–${s.to}</span>`).join('')}<i class="now" style="left:${Math.min(100,(lap-1)/sp.total*100)}%"></i></div>`;}
    h+='</div>';}
  $('#lvPlanP').innerHTML=h;const ps=$('#lvPlan');if(ps)ps.onchange=e=>{LS.set('live:plan',e.target.value);renderLive(true);};
  // saver
  if(S2&&c&&Number.isFinite(S2.left)){const lim=S2.lim,cur=lim==='ve'?S2.vpl:S2.fpl,amount=lim==='ve'?c.ve:c.fuel;const n=Math.floor(S2.left);const needOne=amount/(n+1);const pct=(needOne/cur-1)*100;
    const rowsS=[[`Fare ${n+1} giri invece di ${n}`,`${lim==='ve'?fx(needOne*100,2)+' %':fx(needOne,2)+' L'} ${tr('per giro')}`,`${fx(pct,1)}%`]];
    if(Number.isFinite(S2.toGo)&&S2.stops>0){const total=S2.toGo;const st=S2.stops-1;const tank=lim==='ve'?1:(c.fuelCap||NaN);const need=(amount+st*tank)/total;rowsS.push([st===0?'Arrivare senza altre soste':`Fare ${st} ${st===1?'sosta':'soste'} invece di ${S2.stops}`,`${lim==='ve'?fx(need*100,2)+' %':fx(need,2)+' L'} ${tr('per giro')}`,`${fx((need/cur-1)*100,1)}%`]);}
    $('#lvSave2').innerHTML=rowsS.map(([a,b,p])=>`<div class="lvrow"><span>${a}</span><b>${b} <span class="${parseFloat(p)<-6?'neg':'muted'}">(${p})</span></b></div>`).join('')+`<p class="muted small">${lim==='ve'?'L\'energia virtuale è il limite di questo stint.':'Il carburante è il limite di questo stint.'} Sotto il −5% di solito serve lift-and-coast deciso: valuta se il tempo perso vale la sosta risparmiata (≈ ${fx(liveLoss(stt),0)} s).</p>`;}
  else $('#lvSave2').innerHTML=`<div class="muted small">${tr('Serve almeno un giro completo senza soste.')}</div>`;
  // pit window, undercut / overcut, end of race (ui18.js)
  const loss=liveLoss(stt);const po=pitOut(rows,me,loss);try{lvPitWindow(x,loss);lvUndercut(x,loss);lvFinish(x);lvDrivers(x);}catch(e){console.error(e);}
  try{lvGame(x);}catch(e){console.error(e);}
  // stints of our car
  const L=stt.laps;const st=[];let cur=null;L.forEach(l=>{if(!cur||(l.pit&&cur.laps.length&&!cur.laps[cur.laps.length-1].pit)){cur={laps:[]};st.push(cur);}cur.laps.push(l);});
  $('#lvStints').innerHTML=st.length?`<table><thead><tr><th>Stint</th><th class="l">Pilota</th><th>Giri</th><th>Best</th><th>Passo</th><th>Degrado s/giro</th><th>Carb./giro</th><th>VE/giro</th><th>Usura/giro</th><th>Asfalto</th></tr></thead><tbody>${st.map((s,i)=>{const cl=s.laps.filter(l=>!l.pit&&!l.inv&&l.t>0);const b=Math.min(...cl.map(l=>l.t));const g=cl.filter(l=>l.t<=b*1.05);
    const xs=g.map((l,j)=>j),ys=g.map(l=>l.t);let slope=NaN;if(g.length>=4){const mx=avg_(xs),my=avg_(ys);slope=xs.reduce((a,x,j)=>a+(x-mx)*(ys[j]-my),0)/xs.reduce((a,x)=>a+(x-mx)**2,0);}
    return `<tr><td>${i+1}</td><td class="l">${esc([...new Set(s.laps.map(l=>l.drv).filter(Boolean))].join(', '))}</td><td>${s.laps.length}</td><td>${fmtLap(b)}</td><td>${fmtLap(med_(g.map(l=>l.t)))}</td><td class="${slope>0.05?'neg':''}">${sgn(slope,3)}</td><td>${fx(med_(cl.map(l=>l.fuel).filter(v=>v>0)),2)}</td><td>${fx(med_(cl.map(l=>l.ve).filter(v=>v>0))*100,2)}</td><td>${fx(med_(cl.map(l=>avg_(l.wear||[]))),2)}</td><td>${fx(avg_(s.laps.map(l=>l.trk)),1)}</td></tr>`;}).join('')}</tbody></table>
    <p class="muted small">Degrado = quanto peggiora il tempo a ogni giro nello stint (giri entro il 105% del migliore). Include l'effetto del carburante che cala, che di solito lo fa sembrare più basso.</p>`:`<div class="muted small">${tr('I giri compaiono qui man mano che vengono completati.')}</div>`;}

// ---------- Rivali ----------
function lvRivals(x){const {sc,I,kind,rows,me,names}=x;const us=LIVE.focus;let riv=liveRivals().filter(v=>v!==us&&rows.some(r=>r.veh===v));
  if(!riv.length&&me){const cl=rows.filter(r=>r.cls===me.cls).sort((a,b)=>kind==='race'?a.pos-b.pos:(a.best||1e9)-(b.best||1e9));const i=cl.indexOf(me);riv=[cl[i-1],cl[i+1]].filter(Boolean).map(r=>r.veh);}
  if(!me||!riv.length){$('#lvRiv').innerHTML=`<div class="muted small">${tr('Servono la classifica e la nostra auto in pista.')}</div>`;drawGap([]);}
  else{const ms=carStats(me.veh,me);const lt=ms.pace5||me.estL;const tot=r=>r.gapL+r.lapsL*lt;const loss=liveLoss(liveCarState(us));const series=[];
    const body=riv.map((v,i)=>{const r=rows.find(z=>z.veh===v);const s=carStats(v,r);const rel=tot(me)-tot(r);const gs=gapSeries(us,v);const col=DRV_COL[(i+1)%6];series.push({v,col,gs});
      const tr5=gs.length>=4?(gs[gs.length-1][1]-gs[Math.max(0,gs.length-6)][1])/Math.min(5,gs.length-1):NaN;const after=Number.isFinite(loss)?rel+loss:NaN;const lp=s.lastPit;
      if(kind!=='race')return `<tr data-car="${esc(v)}"><td><span class="clsdot" style="background:${col}"></span>P${r.pic}</td><td class="l">${esc(r.drv)}<div class="muted small">${esc(r.label||v)}</div></td><td>${fmtLap(r.best)}</td><td>${r.best>0&&me.best>0?`<span class="${r.best<me.best?'neg':'pos'}">${sgn(r.best-me.best,3)}</span>`:'—'}</td><td>${fmtLap(s.pace5)}</td><td>${fmtLap(s.ideal)}</td><td>${r.laps}</td><td>${compHTML(r.comp,r.cf,r.cr)}</td><td><button type="button" class="star on" data-rv="${esc(v)}">★</button></td></tr>`;
      return `<tr data-car="${esc(v)}"><td><span class="clsdot" style="background:${col}"></span>P${r.pic}</td><td class="l">${esc(r.drv)}<div class="muted small">${esc(r.label||v)}</div></td><td>${rel>0?`<span class="neg">${fx(rel,1)} ${tr('davanti')}</span>`:`<span class="pos">${fx(-rel,1)} ${tr('dietro')}</span>`}</td>
        <td>${Number.isFinite(tr5)?`<span class="${tr5>0?'neg':'pos'}">${sgn(tr5,2)}</span>`:'—'}</td><td>${fmtLap(s.pace5)}${Number.isFinite(s.pace5)&&Number.isFinite(ms.pace5)?` <span class="${s.pace5<ms.pace5?'neg':'pos'}">(${sgn(s.pace5-ms.pace5,2)})</span>`:''}</td>
        <td>${veCell(r)}</td><td>${s.stintLaps}</td><td>${Number.isFinite(s.nextPit)?'≈ '+s.nextPit:'—'}</td><td>${lp?`${fx(lp.stop,1)} s${lp.tyres?' · '+lp.tyres+'G':''}`:'—'}</td><td>${compHTML(r.comp,r.cf,r.cr)}</td>
        <td>${ovtText(rel,s.pace5,ms.pace5,me,rows)}</td><td>${Number.isFinite(after)?(after>0?`${fx(after,1)} ${tr('dietro')}`:`${fx(-after,1)} ${tr('davanti')}`):'—'}</td><td><button type="button" class="star on" data-rv="${esc(v)}">★</button></td></tr>`;}).join('');
    const head=kind!=='race'?'<th>Cl.</th><th class="l">Rivale</th><th>Best</th><th>Δ best</th><th>Passo 5</th><th>Ideale</th><th>Giri</th><th>Gomme</th><th></th>':
      `<th>Cl.</th><th class="l">Rivale</th><th>Distacco</th><th title="${esc(tr('+ = va peggio per noi'))}">Tendenza s/giro</th><th>Passo ultimi 5</th><th>VE · benzina</th><th>Stint</th><th>Box stimato</th><th>Ultima sosta</th><th>Gomme</th><th>Aggancio</th><th>Se ti fermi ora</th><th></th>`;
    $('#lvRiv').innerHTML=`<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <p class="muted small" style="margin:6px 0 0">${liveRivals().length?'':'Mostro l\'auto davanti e quella dietro in classe: tocca ☆ nella classifica per scegliere i rivali. '}${kind==='race'?`«Box stimato» viene dai loro consumi giro per giro. ${Number.isFinite(loss)?`«Se ti fermi ora» = distacco più ${fx(loss,0)} s di sosta.`:'«Se ti fermi ora» = distacco più il tempo di sosta.'}`:''}</p>`;
    drawGap(kind==='race'?series:[]);}
  try{lvStratAll(x);}catch(e){console.error(e);}
  // pace of everyone
  const F=LIVE.field?.cars||{};const ps=Object.entries(F).filter(([v,c])=>!LIVE.cls||c.cls===LIVE.cls).map(([v,c])=>{const r=rows.find(z=>z.veh===v);const s=carStats(v,r);const t=s.cl.map(l=>l[1]);
    return {v,label:r?.label,name:r?.drv||c.name,cls:c.cls,pos:r?r.pos:NaN,n:t.length,best:s.best,a5:s.pace5,a10:s.pace10,all:s.paceAll,medn:med_(t),sd:s.sd};}).filter(p=>p.n>0);
  if(!ps.length)$('#lvPace').innerHTML=`<div class="muted small">I tempi compaiono man mano che le auto completano i giri.</div>`;
  else{const ourA=ps.find(p=>p.v===us)?.a5;const key=LIVE.paceSort||'a5',dir=LIVE.paceDir||1;ps.sort((a,b)=>{const p=a[key],q=b[key];if(typeof p==='string')return dir*p.localeCompare(q);return dir*((Number.isFinite(p)?p:1e9)-(Number.isFinite(q)?q:1e9));});
    const cb={};ps.forEach(p=>{['best','a5','a10','all'].forEach(k=>{if(Number.isFinite(p[k])&&(!cb[p.cls+k]||p[k]<cb[p.cls+k]))cb[p.cls+k]=p[k];});});
    const th=(k,l,cls='')=>`<th class="${cls}" data-ps="${k}" style="cursor:pointer">${l}${key===k?(dir>0?' ▲':' ▼'):''}</th>`;const td=(p,k)=>`<td class="${p[k]===cb[p.cls+k]?'bestc':''}">${fmtLap(p[k])}</td>`;
    $('#lvPace').innerHTML=`<table><thead><tr>${th('pos','Pos')}${th('name','Pilota','l')}${th('cls','Classe','l')}${th('n','Giri puliti')}${th('best','Best')}${th('a5','Media ultimi 5')}${th('a10','Media ultimi 10')}${th('all','Media gara')}${th('medn','Mediana')}${th('sd','Costanza ±')}<th>Δ vs noi</th></tr></thead><tbody>
      ${ps.map(p=>`<tr class="${names.includes(p.v)?'ours':''}" data-car="${esc(p.v)}"><td>${Number.isFinite(p.pos)?p.pos:'—'}</td><td class="l">${esc(p.name)}<div class="muted small">${esc(p.label||p.v)}</div></td><td class="l"><span class="clsdot" style="background:${LV_CLS(p.cls)}"></span>${esc(p.cls)}</td><td>${p.n}</td>${td(p,'best')}${td(p,'a5')}${td(p,'a10')}${td(p,'all')}<td>${fmtLap(p.medn)}</td><td>${fx(p.sd,2)}</td>
        <td>${Number.isFinite(p.a5)&&Number.isFinite(ourA)&&p.v!==us?`<span class="${p.a5<ourA?'neg':'pos'}">${sgn(p.a5-ourA,2)}</span>`:'—'}</td></tr>`).join('')}</tbody></table>`;
    $$('#lvPace [data-ps]').forEach(t=>t.onclick=e=>{e.stopPropagation();const k=t.dataset.ps;if(LIVE.paceSort===k)LIVE.paceDir=-(LIVE.paceDir||1);else{LIVE.paceSort=k;LIVE.paceDir=k==='n'?-1:1;}renderLive(true);});}}

// ---------- Meteo ----------
function lvWeather(x){const {I}=x;const wx=LIVE.wx;try{lvNow(x);}catch(e){console.error(e);}
  if(!wx?.nodes?.length)$('#lvWx').innerHTML=`<div class="muted small">${tr('In attesa dei dati…')}</div>`;
  else{const end=I.end>0?I.end:NaN,tod0=Number.isFinite(I.tod)&&Number.isFinite(I.et)?I.tod-I.et:NaN;const nn=wx.nodes.length;
    $('#lvWx').innerHTML=`<div class="lvwx">${wx.nodes.map((n,i)=>{const fr=i/(nn-1),t=end*fr;const sky=Math.round(n.sky);const rc=n.rain>1?n.rain:n.rain*100;
      return `<div class="lvwn${Number.isFinite(I.et)&&Number.isFinite(t)&&I.et>=t&&(i===nn-1||I.et<end*(i+1)/(nn-1))?' cur':''}"><div class="t">${i===0?'inizio':i===nn-1?'fine':Math.round(fr*100)+'%'}${Number.isFinite(t)?`<small>${hms(t)}${Number.isFinite(tod0)?' · '+hhmm((tod0+t)/60):''}</small>`:''}</div>
        <div class="i">${SKYI[sky]||'·'}</div><div class="s">${esc(tr(SKY[sky]||''))}</div><div class="v">${fx(n.temp,0)} °C</div><div class="rb"><i style="width:${Math.min(100,rc||0)}%"></i></div><div class="s">pioggia ${fx(rc,0)}%</div>${n.hum>0&&n.hum<=100?`<div class="s">${tr('umidità')} ${fx(n.hum,0)}%</div>`:''}</div>`;}).join('')}</div>`;}
  const H=LIVE.wxh||[];const cv=$('#lvWxC');if(!cv)return;const r=cv.getBoundingClientRect(),dpr=devicePixelRatio||1;if(!r.width)return;cv.width=r.width*dpr;cv.height=r.height*dpr;const c=cv.getContext('2d');c.scale(dpr,dpr);c.font='11px "JetBrains Mono",monospace';
  if(H.length<2){c.fillStyle=tok('muted');c.fillText(tr('Il grafico si riempie durante la sessione (un punto ogni 30 s).'),8,18);$('#lvWxNote').textContent='';return;}
  const L=40,Rr=40,T=12,B=22,W=r.width-L-Rr,Hh=r.height-T-B;const x0=H[0][0],x1=H[H.length-1][0];const X=t=>L+(t-x0)/((x1-x0)||1)*W;
  const temps=H.flatMap(h=>[h[1],h[2]]).filter(Number.isFinite);let t0=Math.floor(Math.min(...temps)-1),t1=Math.ceil(Math.max(...temps)+1);const Yt=v=>T+(1-(v-t0)/(t1-t0))*Hh,Yp=v=>T+(1-v)*Hh;
  c.strokeStyle=tok('grid');c.fillStyle=tok('faint');c.textAlign='right';niceTicks(t0,t1,4).forEach(v=>{const y=Yt(v);c.beginPath();c.moveTo(L,y);c.lineTo(L+W,y);c.stroke();c.fillText(v+'°',L-4,y+3);});
  c.textAlign='left';[0,0.5,1].forEach(v=>c.fillText(Math.round(v*100)+'%',L+W+4,Yp(v)+3));
  c.fillStyle=tok('lapA')+'33';c.beginPath();c.moveTo(X(H[0][0]),Yp(0));H.forEach(h=>c.lineTo(X(h[0]),Yp(h[4]||0)));c.lineTo(X(x1),Yp(0));c.fill();
  const line=(i,col,Y)=>{c.strokeStyle=col;c.lineWidth=2;c.beginPath();H.forEach((h,j)=>j?c.lineTo(X(h[0]),Y(h[i])):c.moveTo(X(h[0]),Y(h[i])));c.stroke();};
  line(2,tok('warn'),Yt);line(1,tok('good'),Yt);line(3,tok('lapA'),Yp);
  c.textAlign='center';c.fillStyle=tok('faint');niceTicks(x0,x1,6).forEach(t=>{if(t>=x0&&t<=x1)c.fillText(hms(t).replace(/^0:/,''),X(t),r.height-6);});
  $('#lvWxNote').innerHTML=`<span style="color:var(--warn)">■</span> asfalto · <span style="color:var(--good)">■</span> aria · <span style="color:var(--lapA)">■</span> pioggia · area = pista bagnata`;}

// ---------- Eventi ----------
function lvEventList(x,f){const {rows,me,stt}=x;const us=LIVE.focus;const riv=liveRivals();const out=[];
  const okVeh=v=>f==='all'||v===us||(f==='riv'&&riv.includes(v))||(f==='cls'&&me&&rows.find(r=>r.veh===v)?.cls===me.cls);const vehOfDrv=d=>rows.find(r=>r.drv===d)?.veh||Object.entries(LIVE.field?.cars||{}).find(([k,c])=>c.drivers?.includes(d)||c.name===d)?.[0];
  const types=LS.get('live:evT',{hit:1,tl:1,pen:1,pit:1,swap:1,chat:0,us:1});
  if(types.us)stt.evs.forEach(e=>out.push({et:e.et,k:EVC[e.k]||'info',html:`<b>${tr('Noi')}</b> · ${esc(evText(e))}`,lap:e.lap}));
  Object.entries(LIVE.field?.cars||{}).forEach(([v,c])=>{if(!okVeh(v))return;
    if(types.pit)(c.pits||[]).forEach(p=>out.push({et:p.out,k:'info',veh:v,html:`<b>${esc(p.d1||c.name)}</b> · ${tr('sosta')}: ${tr('fermo')} ${fx(p.stop,1)} s, ${tr('corsia')} ${fx(p.lane,0)} s${p.fuel>0.01?`, +${Math.round(p.fuel*100)}% ${tr('benzina')}`:''}${p.ve>0.01?`, +${Math.round(p.ve*100)}% VE`:''}${p.tyres?`, ${p.tyres} ${tr('gomme')} ${compHTML(p.c1)}`:''}${p.garage?' · garage':''}`,lap:p.lap}));
    if(types.swap)(c.swaps||[]).forEach(w=>out.push({et:w.et,k:'warn',veh:v,html:`<b>${tr('Cambio pilota')}</b> · ${esc(w.from)} → ${esc(w.to)} <span class="muted">${esc(v)}</span>`,lap:w.lap}));});
  (LIVE.field?.stream||[]).forEach(e=>{const v=vehOfDrv(e.drv);const v2=e.other?vehOfDrv(e.other):null;if(!okVeh(v)&&!(v2&&okVeh(v2)))return;
    if(e.tag==='Incident'&&types.hit)out.push({et:e.et,k:'bad',veh:v,html:`<b>${esc(e.drv)}</b> ${e.wall?tr('contro le barriere'):`${tr('contatto con')} <b>${esc(e.other)}</b>`} <span class="muted">(${fx(e.mag,0)})</span>`});
    else if(e.tag==='TrackLimits'&&types.tl){const inv=/Invalid/i.test(e.txt),pen=/Penalty/i.test(e.txt),warn=/Warning/i.test(e.txt);if(!inv&&!pen&&!warn)return;out.push({et:e.et,k:pen||inv?'bad':'warn',veh:v,html:`<b>${esc(e.drv)}</b> · ${inv?tr('giro invalidato (limiti)'):pen?tr('penalità per limiti di pista'):tr('avviso limiti di pista')}${e.at.CurrentPoints?` <span class="muted">${tr('punti')} ${esc(e.at.CurrentPoints)}</span>`:''}`});}
    else if(e.tag==='Penalty'&&types.pen)out.push({et:e.et,k:'bad',veh:v,html:`<b>${esc(e.drv)}</b> · ${esc(e.txt.replace(e.drv,'').trim())}`});
    else if(e.tag==='Sector'&&types.hit)out.push({et:e.et,k:'bad',veh:v,html:`<b>${esc(e.drv)}</b> · ${tr('danni alle sospensioni')}`});
    else if(e.tag==='ChatMessage'&&types.chat)out.push({et:e.et,k:'info',html:`💬 ${esc(e.txt)}`});});
  return out.sort((a,b)=>b.et-a.et).map(e=>`<div class="lve ${e.k}"${e.veh?` data-car="${esc(e.veh)}"`:''}><span class="t">${hms(e.et)}${e.lap?' · G'+e.lap:''}</span><span>${e.html}</span></div>`);}
function lvEvents(x){const T=LS.get('live:evT',{hit:1,tl:1,pen:1,pit:1,swap:1,chat:0,us:1});
  const names={us:'Nostra auto',pit:'Soste',swap:'Cambi pilota',hit:'Contatti e danni',tl:'Limiti di pista',pen:'Penalità',chat:'Chat'};
  $('#lvEvT').innerHTML=Object.entries(names).map(([k,l])=>`<label class="chk"><input type="checkbox" data-evt="${k}"${T[k]?' checked':''}> ${l}</label>`).join('');
  $$('#lvEvT [data-evt]').forEach(i=>i.onchange=()=>{T[i.dataset.evt]=i.checked?1:0;LS.set('live:evT',T);renderLive(true);});
  const list=lvEventList(x,LS.get('live:evF','cls'));$('#lvEv').innerHTML=list.slice(0,300).join('')||`<div class="muted small">${tr('Nessun evento per ora.')}</div>`;}

// ---------- car detail ----------
function openCarModal(veh){let m=$('#mCar');if(!m){m=document.createElement('div');m.className='modal';m.id='mCar';m.hidden=true;m.innerHTML='<div class="mbox wide"><div class="panel-h"><h2 id="mCarT"></h2><button class="btn" type="button" data-close>Chiudi</button></div><div id="mCarB"></div></div>';document.body.appendChild(m);}
  const rows=liveRows(LIVE.sc);const r=rows.find(z=>z.veh===veh);const s=carStats(veh,r);const c=fCar(veh);const kind=sesKind(LIVE.sc?.i);
  $('#mCarT').innerHTML=`<span class="clsdot" style="background:${LV_CLS(r?.cls||c?.cls)}"></span>${esc(r?.drv||c?.name||'')} <span class="muted small">${esc(r?.label||veh)}</span>`;
  const L=s.L;const best=Math.min(...L.filter(l=>!l[7]&&l[1]>0).map(l=>l[1]));const drvs=c?.drivers||[];
  const k=[liveTile('Posizione',r?`P${r.pos}`:'—',r?`P${r.pic} ${tr('di classe')}`:''),liveTile('Miglior giro',fmtLap(r?.best||s.best),'','hl'),liveTile('Passo ultimi 5',fmtLap(s.pace5),Number.isFinite(s.sd)?'±'+fx(s.sd,2):''),liveTile('Giro ideale',fmtLap(s.ideal),''),
    liveTile('Benzina',r&&r.fuel>=0?Math.round(r.fuel*100)+'%':'—',Number.isFinite(s.fpl)?fx(s.fpl*100,1)+'% '+tr('per giro'):''),liveTile('Energia virtuale',r&&r.ve>=0?Math.round(r.ve*100)+'%':'—',Number.isFinite(s.vpl)?fx(s.vpl*100,1)+'% '+tr('per giro'):''),
    liveTile('Box stimato',Number.isFinite(s.nextPit)?'giro '+s.nextPit:'—',Number.isFinite(s.left)?`${fx(s.left,1)} giri (${s.limit==='ve'?'energia':'benzina'})`:''),liveTile('Gomme',r?.comp?tyreCar(r.comp,true):compHTML('',r?.cf,r?.cr),r?.comp?esc([...new Set(r.comp)].map(k=>COMP_N[k]||k).join(' + ')):''),liveTile('Soste',r?r.pits:(s.pits.length),`stint ${s.stintLaps} giri`)];
  const pits=s.pits.map((p,i)=>`<tr><td>${i+1}</td><td>${p.lap}</td><td>${hms(p.in)}</td><td>${fx(p.stop,1)}</td><td>${fx(p.lane,1)}</td><td>${p.fuel>=0?'+'+Math.round(p.fuel*100)+'%':'—'}</td><td>${p.ve>=0?'+'+Math.round(p.ve*100)+'%':'—'}</td><td>${p.tyres?`${p.tyres} · ${compHTML(p.c0)} → ${compHTML(p.c1)}`:'—'}</td><td class="l">${p.d0&&p.d1&&p.d0!==p.d1?`${esc(p.d0)} → <b>${esc(p.d1)}</b>`:esc(p.d1||'')}</td><td>${p.garage?'garage':''}</td></tr>`).join('');
  const laps=[...L].reverse().map(l=>{const s3=l[1]>0&&l[5]>0?l[1]-l[5]:NaN;return `<tr class="${l[7]?'inv':''}${l[1]===best?' best':''}"><td>${l[0]}</td><td class="lt">${fmtLap(l[1])}</td><td>${l[4]>0?fx(l[4],3):'—'}</td><td>${l[5]>0?fx(l[5]-l[4],3):'—'}</td><td>${fx(s3,3)}</td><td>${l[6]||'—'}</td><td>${l[8]>=0?Math.round(l[8]*100)+'%':'—'}</td><td>${l[9]>=0?Math.round(l[9]*100)+'%':'—'}</td><td class="l">${esc(drvs[l[10]]||'')}</td><td>${l[3]?'<span class="tag info">box</span>':''}${l[7]?' <span class="tag bad">inv.</span>':''}</td></tr>`;}).join('');
  const inc=(LIVE.field?.stream||[]).filter(e=>drvs.includes(e.drv)||drvs.includes(e.other)).slice(-40).reverse().map(e=>`<div class="lve ${e.tag==='TrackLimits'?'warn':'bad'}"><span class="t">${hms(e.et)}</span><span>${esc(e.tag==='Incident'?(e.wall?tr('contro le barriere'):`${e.drv} ↔ ${e.other}`)+` (${fx(e.mag,0)})`:e.txt)}</span></div>`).join('');
  $('#mCarB').innerHTML=`<div class="kpis">${k.join('')}</div>${drvs.length>1?`<p class="small" style="margin:10px 0 0">${tr('Piloti')}: ${drvs.map(esc).join(', ')}${s.swaps.length?` · ${s.swaps.length} ${tr('cambi pilota')}`:''}</p>`:''}
    <canvas id="mCarC" style="width:100%;height:160px;margin-top:12px"></canvas>
    <h3 style="margin-top:14px">Soste</h3>${pits?`<div class="tw"><table><thead><tr><th>#</th><th>Giro</th><th>Ora</th><th>Fermo s</th><th>Corsia s</th><th>Benzina</th><th>VE</th><th>Gomme</th><th class="l">Pilota</th><th></th></tr></thead><tbody>${pits}</tbody></table></div>`:`<p class="muted small">${tr('Nessuna sosta registrata.')}</p>`}
    <div style="margin-top:14px"><div><h3>Giri</h3><div class="tw" style="max-height:380px;overflow:auto"><table><thead><tr><th>Giro</th><th>Tempo</th><th>S1</th><th>S2</th><th>S3</th><th>Pos</th><th>Benzina</th><th>VE</th><th class="l">Pilota</th><th></th></tr></thead><tbody>${laps}</tbody></table></div></div>
    <div style="margin-top:14px"><h3>Contatti e limiti</h3><div class="lvev" style="max-height:260px">${inc||`<p class="muted small">${tr('Nessun evento.')}</p>`}</div></div></div>`;
  openModal('#mCar');
  // lap chart
  const cv=$('#mCarC');const rr=cv.getBoundingClientRect(),dpr=devicePixelRatio||1;if(!rr.width)return;cv.width=rr.width*dpr;cv.height=rr.height*dpr;const g=cv.getContext('2d');g.scale(dpr,dpr);g.font='11px "JetBrains Mono",monospace';
  const P=L.filter(l=>l[1]>0&&l[1]<best*1.15);if(P.length<2){g.fillStyle=tok('muted');g.fillText(tr('Servono almeno due giri.'),8,18);return;}
  const x0=P[0][0],x1=P[P.length-1][0],y0=best*0.995,y1=Math.max(...P.map(l=>l[1]));const Lp=54,W=rr.width-Lp-10,H=rr.height-24;const X=n=>Lp+(n-x0)/((x1-x0)||1)*W,Y=t=>6+(1-(t-y0)/((y1-y0)||1))*H;
  g.strokeStyle=tok('grid');g.fillStyle=tok('faint');g.textAlign='right';niceTicks(y0,y1,4).forEach(t=>{const y=Y(t);g.beginPath();g.moveTo(Lp,y);g.lineTo(Lp+W,y);g.stroke();g.fillText(fmtLap(t).replace(/^0:/,''),Lp-4,y+3);});
  g.strokeStyle=tok('lapA');g.lineWidth=1.6;g.beginPath();P.forEach((l,i)=>i?g.lineTo(X(l[0]),Y(l[1])):g.moveTo(X(l[0]),Y(l[1])));g.stroke();
  P.forEach(l=>{g.fillStyle=l[7]?tok('bad'):l[3]?tok('faint'):l[1]===best?tok('best'):tok('lapA');g.beginPath();g.arc(X(l[0]),Y(l[1]),l[1]===best?4:2.5,0,7);g.fill();});
  s.pits.forEach(p=>{const x=X(p.lap);if(x<Lp||x>Lp+W)return;g.strokeStyle=tok('warn');g.setLineDash([3,3]);g.beginPath();g.moveTo(x,6);g.lineTo(x,6+H);g.stroke();g.setLineDash([]);});
  g.textAlign='center';g.fillStyle=tok('faint');niceTicks(x0,x1,8).forEach(n=>{if(n>=x0&&n<=x1)g.fillText('G'+n,X(n),rr.height-4);});}

// map: add the pit-out ghost
(function(){const base=drawLiveMap;window.drawLiveMap=drawLiveMap=function(sc,ours){base(sc,ours);const v=LIVE.ghost&&(sc?.v||[]).find(r=>r[2]===LIVE.ghost);const cv=$('#lvMap');if(!v||!cv)return;
  const pts=[...LIVE.trail.values()];const cars=(sc?.v||[]).filter(r=>!r[30]&&(r[21]||r[22]));const all=pts.length>30?pts:cars.map(r=>[r[21],r[22]]);if(!all.length)return;
  const r=cv.getBoundingClientRect();let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;all.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  const pad=16,s=Math.min((r.width-2*pad)/((x1-x0)||1),(r.height-2*pad)/((z1-z0)||1));const ox=(r.width-(x1-x0)*s)/2,oz=(r.height-(z1-z0)*s)/2;const a=ox+(v[21]-x0)*s,b=r.height-(oz+(v[22]-z0)*s);
  const c=cv.getContext('2d');c.save();c.setLineDash([3,3]);c.strokeStyle=tok('warn');c.lineWidth=2;c.beginPath();c.arc(a,b,12,0,7);c.stroke();c.restore();};})();

// ---------- two-level main navigation ----------
(function(){const GROUPS=[['ana','Analisi',['stint','lap','cmp','coach']],['set','Setup',['setup','diary']],['str','Strategia',['str','team']],['prog','Progressi',['prog']],['live','Muretto',['live']]];
  const SUBL={str:'Solo',team:'Endurance'};const nav=$('.tabs');if(!nav||$('.mtabs'))return;
  const main=document.createElement('nav');main.className='mtabs';main.setAttribute('role','tablist');main.innerHTML=GROUPS.map(([g,l])=>`<button type="button" class="mtab" data-group="${g}">${g==='live'?'<span class="livedot"></span>':''}${l}</button>`).join('');
  nav.before(main);nav.classList.add('subtabs');
  $$('.tabs .tab').forEach(t=>{if(SUBL[t.dataset.view])t.textContent=SUBL[t.dataset.view];});
  const groupOf=v=>GROUPS.find(g=>g[2].includes(v))||GROUPS[0];
  const sync=v=>{const g=groupOf(v);$$('.mtab').forEach(b=>b.setAttribute('aria-selected',b.dataset.group===g[0]));$$('.tabs .tab').forEach(t=>t.hidden=!g[2].includes(t.dataset.view));nav.hidden=g[2].length<2;};
  $$('.mtab').forEach(b=>b.onclick=()=>{const g=GROUPS.find(x=>x[0]===b.dataset.group);const last=LS.get('grp:'+g[0],g[2][0]);showView(g[2].includes(last)?last:g[2][0]);});
  const os=showView;window.showView=showView=function(v){os(v);LS.set('grp:'+groupOf(v)[0],v);sync(v);};
  sync(LS.get('tab','stint'));})();

function liveClear(){const L=LIVE.L;L.drivers={};L.sc=null;L.scAt=0;L.buf={};L.field={ses:'',cars:{},stream:[],streamSet:new Set()};L.wx=null;L.wxh=[];L.rst=null;NOTIF.length=0;LIVE.dirty=true;renderLive(true);}
