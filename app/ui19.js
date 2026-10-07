// ================= 1.7: velocità massime, stint in tempo reale =================
// top speed per car: session, current stint, last lap (bridge 1.7 measures it lap by lap)
function vmaxOf(r){const mk='vm|'+r.veh+'|'+r.laps;if(LIVE.memo&&LIVE.memo.has(mk)){const o=LIVE.memo.get(mk);return o;}
  const L=fLaps(r.veh);const v=l=>l[11]>0&&l[11]<480?l[11]:0;const s=carStats(r.veh,r);const st=L.slice(-Math.max(0,s.stintLaps||0));
  const cur=r.vcur>0&&r.vcur<480?r.vcur:0;const last=L.length?v(L[L.length-1]):0;
  const o={ses:Math.max(cur,...L.map(v),0),stint:Math.max(cur,...st.map(v),0),lap:last,cur};if(LIVE.memo)LIVE.memo.set(mk,o);return o;}
function vmaxBest(rows){const b={};rows.forEach(r=>{const v=vmaxOf(r).ses;if(v>0&&(!b[r.cls]||v>b[r.cls]))b[r.cls]=v;});return b;}
function vmaxCell(r,vb){const o=vmaxOf(r);if(!(o.ses>0))return '<td class="muted">—</td>';const best=vb[r.cls]&&o.ses>=vb[r.cls]-0.05;
  return `<td title="${esc(`${tr('Sessione')} ${fx(o.ses,1)} · ${tr('stint')} ${fx(o.stint,1)} · ${tr('ultimo giro')} ${o.lap?fx(o.lap,1):'—'}${o.cur?` · ${tr('giro in corso')} ${fx(o.cur,1)}`:''} km/h`)}"><b class="${best?'bestv':''}">${fx(o.ses,0)}</b><div class="muted small">${o.stint?fx(o.stint,0):'—'} · ${o.lap?fx(o.lap,0):'—'}</div></td>`;}

// ---------- stint in tempo reale ----------
const mmss=s=>{if(!Number.isFinite(s)||s<0)return '—';s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${m}:${String(x).padStart(2,'0')}`;};
function lapRef(c,veh){const R=LIVE.lapRef||(LIVE.lapRef={});let o=R[veh];if(!c)return null;
  if(!o||o.lap!==c.lap||c.fuel>o.fuel+0.5||(c.ve>0&&c.ve>o.ve+0.01)){o=R[veh]={lap:c.lap,fuel:c.fuel,ve:c.ve,til:c.til||0};}return o;}
function liveStint(x){const {c,S2,I,kind,rows,me,stt,sc}=x;if(!c||!S2)return null;const lt=S2.lt||c.estL;if(!(lt>0))return null;
  const fpl=S2.fpl,vpl=S2.vpl;const lf=fpl>0?c.fuel/fpl:NaN,lv=c.ve>0&&vpl>0?c.ve/vpl:NaN;const left=Math.min(Number.isFinite(lf)?lf:Infinity,Number.isFinite(lv)?lv:Infinity);
  if(!Number.isFinite(left))return null;const d=Math.max(0,Math.min(0.99,(c.til||0)/lt));
  const full=Math.max(0,Math.floor(d+left-0.05));const pitLap=(c.lap-1)+full;const tPit=Math.max(0,(full-d)*lt);
  // this lap so far
  const ref=lapRef(c,LIVE.focus);let curF=NaN,curV=NaN;if(ref&&d>0.25&&ref.til<lt*0.1){const fr=d-(ref.til/lt);if(fr>0.2){curF=(ref.fuel-c.fuel)/fr;if(c.ve>0)curV=(ref.ve-c.ve)/fr;}}
  const o={lt,fpl,vpl,lf,lv,left,lim:Number.isFinite(lv)&&lv<lf?'ve':'fuel',d,full,pitLap,tPit,tLeft:left*lt,curF,curV,segs:[]};
  if(kind!=='race')return o;
  const loss=liveLoss(stt);const P=finPlan(x,'cur');const L=Number.isFinite(loss)?loss:30;
  o.loss=L;o.toGo=P?P.toGo:NaN;o.rem=I.rem;let t=0;
  if(P&&P.spare!=null){o.segs.push({k:'stint',n:1,from:c.lap,to:c.lap-1+Math.ceil(P.toGo),laps:P.toGo,t0:0,t1:I.rem,last:true});o.noStop=true;return o;}
  o.segs.push({k:'stint',n:1,from:c.lap,to:pitLap,laps:full-d,t0:0,t1:tPit});t=tPit;
  const stops=P?P.stops:[];let lap=pitLap;stops.forEach((s,i)=>{o.segs.push({k:'pit',t0:t,t1:t+L,addV:s.addV,addF:s.addF,tV:s.tV,tF:s.tF,ratio:s.ratio,lap});t+=L;
    o.segs.push({k:'stint',n:i+2,from:lap+1,to:lap+s.k,laps:s.k,t0:t,t1:t+s.k*lt,last:s.last});t+=s.k*lt;lap+=s.k;});
  return o;}

function lvStintLive(x){const {c,kind,I}=x;const el=$('#lvStr');if(!el)return;const o=liveStint(x);
  if(!o){el.innerHTML=`<div class="muted small">${tr('Serve la nostra auto in pista con il bridge acceso e almeno un giro completo senza soste.')}</div>`;return;}
  const bar=(lab,val,laps,frac,lim)=>`<div class="stb${lim?' lim':''}"><div class="h"><span>${lab}</span><b>${val}</b></div><div class="t"><i style="width:${Math.max(0,Math.min(100,frac*100))}%"></i></div><div class="f"><span>${Number.isFinite(laps)?fx(laps,1)+' '+tr('giri'):'—'}</span><span>${Number.isFinite(laps)?mmss(laps*o.lt):''}</span></div></div>`;
  const delta=(cur,avg)=>Number.isFinite(cur)&&avg>0?`<span class="${cur>avg*1.01?'neg':cur<avg*0.99?'pos':'muted'}">${cur>avg?'+':''}${fx((cur/avg-1)*100,1)}%</span>`:'';
  let h=`<div class="stlive"><div class="stbig ${o.left<2.2?'warn':''}"><span class="l">${tr('Puoi guidare ancora')}</span><b>${mmss(o.tLeft)}</b><span class="s">${fx(o.left,1)} ${tr('giri')} · ${tr('limita')} ${o.lim==='ve'?tr('l\'energia'):tr('la benzina')}</span></div>
    <div class="stbars">${c.ve>0?bar(tr('Energia virtuale'),fmtPct(c.ve,1),o.lv,c.ve,o.lim==='ve'):''}${bar(tr('Benzina'),fmtL(c.fuel,1),o.lf,c.fuelCap>0?c.fuel/c.fuelCap:0,o.lim==='fuel')}</div>
    <div class="stkp">${liveTile(tr('Box a fine giro'),String(o.pitLap),`${tr('tra')} ${Math.max(0,o.pitLap-(c.lap-1))} ${tr('giri')} · ${mmss(o.tPit)}`)}
      ${kind==='race'?liveTile(tr('Alla bandiera'),Number.isFinite(o.toGo)?'≈ '+fx(o.toGo,1):'—',`${tr('tempo')} ${mmss(I.rem)}`):liveTile(tr('Tempo sessione'),mmss(I.rem),Number.isFinite(I.rem)&&o.lt>0?`≈ ${Math.floor(I.rem/o.lt)} ${tr('giri')}`:'')}
      ${liveTile(tr('Giro in corso'),Number.isFinite(o.curV)?fmtPct(o.curV,2):Number.isFinite(o.curF)?fmtL(o.curF,2):'—',Number.isFinite(o.curV)?`${tr('media')} ${fmtPct(o.vpl,2)} ${delta(o.curV,o.vpl)}`:Number.isFinite(o.curF)?`${tr('media')} ${fmtL(o.fpl,2)} ${delta(o.curF,o.fpl)}`:tr('proiezione dopo un quarto di giro'))}
      ${liveTile(tr('Consumo medio'),`${o.vpl>0?fmtPct(o.vpl,2):fmtL(o.fpl,2)}`,`${fmtL(o.fpl,2)} ${tr('benz.')} · ${tr('ultimi 5 giri')}`)}</div></div>`;
  if(kind==='race'&&o.segs.length){const T=Math.max(I.rem||0,o.segs[o.segs.length-1].t1)||1;
    h+=`<div class="stgantt">${o.segs.map(s=>`<span class="${s.k}${s.n===1?' now':''}" style="flex:${Math.max(0.002,(s.t1-s.t0)/T)}" title="${esc(s.k==='pit'?`${tr('Sosta')} · ${fx(s.t1-s.t0,0)} s`:`Stint ${s.n} · ${tr('giri')} ${s.from}–${s.to} · ${mmss(s.t1-s.t0)}`)}">${s.k==='stint'&&(s.t1-s.t0)/T>0.07?`<b>${s.n}</b> ${s.from}–${s.to}`:''}</span>`).join('')}</div>
      <div class="stax"><span>${tr('adesso')}</span><span>${tr('bandiera')} · ${mmss(I.rem)}</span></div>
      <div class="tw"><table class="sttab"><thead><tr><th class="l">Stint</th><th>${tr('Giri')}</th><th>${tr('Durata')}</th><th>${tr('Inizia tra')}</th><th>${tr('Finisce tra')}</th><th class="l">${tr('Alla sosta prima')}</th></tr></thead><tbody>${o.segs.filter(s=>s.k==='stint').map(s=>{const pit=o.segs[o.segs.indexOf(s)-1];
        return `<tr class="${s.n===1?'ours':''}"><td class="l"><b>${s.n}</b>${s.n===1?` <span class="tag info">${tr('in corso')}</span>`:''}${s.last?` <span class="tag good">${tr('fino alla bandiera')}</span>`:''}</td><td>${s.from}–${s.to} <span class="muted small">(${fx(s.laps,1)})</span></td><td>${mmss(s.t1-s.t0)}</td><td>${s.n===1?'—':mmss(s.t0)}</td><td>${mmss(s.t1)}</td>
          <td class="l">${pit&&pit.k==='pit'?`${pit.addV>=0&&Number.isFinite(pit.addV)?'+'+fmtPct(pit.addV,0)+' VE · ':''}+${fmtL(pit.addF,1)}${Number.isFinite(pit.ratio)?' · ratio '+fx(pit.ratio,2):''}`:'—'}</td></tr>`;}).join('')}</tbody></table></div>
      <p class="muted small" style="margin:6px 0 0">${tr('Si aggiorna in continuo con benzina ed energia a bordo e i consumi degli ultimi 5 giri. Soste da')} ${fx(o.loss,0)} s.</p>`;}
  el.innerHTML=h;}
(function(){const base=lvStrategy;window.lvStrategy=lvStrategy=function(x){base(x);try{lvStintLive(x);}catch(e){console.error(e);}};})();

// ---------- leaderboard cells: tyres and energy, fixed width and aligned ----------
function tyreCell(r){const c=r.comp||'';if(!c)return `<td class="tyc2"><span class="muted small">${esc((r.cf||r.cr||'—').slice(0,6))}</span></td>`;
  // the four tyres seen from above: front left / right on top, rear left / right below
  const k=[0,1,2,3].map(i=>c[i]||c[c.length-1]);const tip=k.map((x,i)=>tr(['Ant. sx','Ant. dx','Post. sx','Post. dx'][i])+': '+(COMP_N[x]||x)).join(' · ');
  const col=x=>COMP_COL[x]||COMP_COL['?'];const st=carStats(r.veh,r);
  return `<td class="tyc2" title="${esc(tip)}"><span class="ty4">${k.map(x=>`<i style="background:${col(x)};color:${COMP_INK(x)}">${esc(x)}</i>`).join('')}</span><small>${st.stintLaps}${tr('g')}</small></td>`;}
function energyCell(r){const row=(lab,v,cls)=>{const p=Math.max(0,Math.min(1,v));return `<span class="eg ${cls}${p<0.12?' low':''}"><em>${lab}</em><span class="t"><i style="width:${(p*100).toFixed(1)}%"></i></span><b>${Math.round(p*100)}</b></span>`;};
  if(!(r.ve>=0)&&!(r.fuel>=0))return '<td class="egc muted">—</td>';
  return `<td class="egc">${r.ve>=0?row('VE',r.ve,'ve'):''}${r.fuel>=0?row(LANG==='en'?'F':'B',r.fuel,'fu'):''}</td>`;}
// the Muretto uses the whole screen width
(function(){const os=showView;window.showView=showView=function(v){os(v);document.body.classList.toggle('vwide',v==='live');};document.body.classList.toggle('vwide',curView()==='live');})();

// ---------- team code of the local bridge (change / remove it from the app) ----------
async function bridgeTeam(code){const r=await fetch('/team',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const j=await r.json();if(!j.ok)throw new Error(j.error||'errore');return j;}
function openBridgeTeam(){fetch('/team',{cache:'no-store'}).then(r=>r.json()).catch(()=>({})).then(st=>{
  openCode({title:tr('Codice squadra del bridge'),help:(st.team?tr('Il bridge di questo PC ora manda i dati alla squadra')+(st.name?' «'+st.name+'»':'')+'. ':tr('Il bridge di questo PC ora non è in nessuna squadra. '))+tr('Incolla il nuovo codice (DE1-…) e premi OK; lascia vuoto e premi OK per toglierlo. Il bridge si riavvia da solo.'),text:'',
    onOk:txt=>{if(txt&&!teamParse(txt))throw new Error(tr('codice squadra non valido'));bridgeTeam(txt).then(()=>{if(txt){LS.set('live:team',txt);}toast(txt?tr('Codice salvato nel bridge: riavvio in corso…'):tr('Codice tolto dal bridge: riavvio in corso…'));setTimeout(()=>location.reload(),4000);}).catch(e=>toast(tr('Il bridge non ha accettato il codice')+': '+e.message));}});});}
(function(){const add=()=>{if(!isBridgeHost())return;const ml=$('#v-live .menu-list');if(!ml||$('#lvBTeam'))return;const b=document.createElement('button');b.type='button';b.id='lvBTeam';b.textContent=tr('Codice del bridge di questo PC');b.onclick=openBridgeTeam;ml.insertBefore(b,$('#lvSave'));
    // joining a team from the bridge's own page also moves the bridge to that team
    const j=$('#lvJoin');if(j)j.onclick=()=>openCode({title:tr('Entra con codice'),help:tr('Incolla il codice squadra (inizia con DE1-): lo usano sia questa pagina sia il bridge di questo PC, che si riavvia da solo.'),text:'',onOk:txt=>{if(!teamParse(txt))throw new Error(tr('codice squadra non valido'));LS.set('live:team',txt.trim());liveStart();bridgeTeam(txt.trim()).then(()=>toast(tr('Collegato alla squadra: il bridge si riavvia con il nuovo codice'))).catch(()=>toast(tr('Collegato alla squadra')));}});};
  const os=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){os();add();};})();

// ---------- every bridge of the team: last live data, at a glance ----------
function liveBridgeChips(){const now=Date.now();const G=LIVE.gate||{};const Ds=Object.values(LIVE.drivers).filter(D=>D.hi&&D.id);
  return Ds.map(D=>{const g=G[D.id]||{};const age=g.lastLive?Math.round((now-g.lastLive)/1000):null;const off=D.hi.on===false||age==null||age>60;
    const k=off?'bad':age>12?'warn':'good';const nm=(D.hi.name||'pilota').split(' ')[0];
    return `<span class="bchip ${k}" title="${esc((D.hi.name||'')+' · '+(off?tr('nessun dato in diretta'):tr('ultimo dato')+' '+age+' s fa')+(D.hi.ver?' · bridge '+D.hi.ver:''))}"><i></i>${esc(nm)}${off?' · off':age>3?` · ${age}s`:''}</span>`;}).join('');}

// ---------- which server the team uses: our relay when published (version.json › "relay") ----------
(function(){const setRelay=r=>{if(typeof r!=='string')return;r=r.trim();if(r&&!/^(https|wss):\/\//.test(r))return;if(r===LS.get('relay:url',''))return;LS.set('relay:url',r);if(LS.get('live:team',''))liveStart();};
  if(isBridgeHost())fetch('/version',{cache:'no-store'}).then(x=>x.json()).then(v=>{if('relay' in v)setRelay(v.relay||'');}).catch(()=>{});
  else if(DEFAULT_UPD&&!isHosted())fetch(DEFAULT_UPD+'version.json?t='+Date.now(),{cache:'no-store'}).then(x=>x.json()).then(v=>setRelay(v.relay||'')).catch(()=>{});})();

// ---------- Questo PC: what the bridge window used to show, plus team code, updates and exit ----------
function openPcPanel(){let m=$('#mPc');if(!m){m=document.createElement('div');m.className='modal';m.id='mPc';m.hidden=true;document.body.appendChild(m);}
  m.innerHTML=`<div class="mbox wide"><div class="panel-h"><h2>${tr('Questo PC')}</h2><button class="btn" type="button" data-close>${tr('Chiudi')}</button></div><div id="pcBody"><div class="muted small">${tr('Collegamento al bridge…')}</div></div>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn" type="button" id="pcTeam">${tr('Codice squadra')}</button><button class="btn" type="button" id="pcUpd">${tr('Novità e aggiornamenti')}</button><span style="flex:1"></span><button class="btn" type="button" id="pcQuit">${tr('Esci da Data Engineer')}</button></div>
    <details style="margin-top:12px"><summary class="muted small">${tr('Registro (ultime righe)')}</summary><pre id="pcLog" class="pclog"></pre></details></div>`;
  $('#pcTeam').onclick=openBridgeTeam;$('#pcUpd').onclick=()=>{m.hidden=true;openNews();};
  $('#pcQuit').onclick=()=>{if(!confirm(tr('Chiudere Data Engineer? I dati smettono di arrivare alla squadra.')))return;fetch('/quit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(()=>{m.hidden=true;const o=document.createElement('div');o.style.cssText='position:fixed;inset:0;z-index:999;background:var(--bg);display:flex;align-items:center;justify-content:center;font:18px var(--f-body);color:var(--ink)';o.textContent=tr('Data Engineer è chiuso. Puoi chiudere questa finestra.');document.body.appendChild(o);try{window.close();}catch(e){}}).catch(()=>{});};
  const row=(l,v,k='')=>`<div class="lvrow"><span>${l}</span><b class="${k}">${v}</b></div>`;
  const tick=async()=>{if(m.hidden)return clearInterval(t);let s;try{s=await (await fetch('/status',{cache:'no-store'})).json();}catch(e){$('#pcBody').innerHTML=`<div class="warnbar">${tr('Il bridge di questo PC non risponde.')}</div>`;return;}
    $('#pcBody').innerHTML=`<div class="grid2" style="gap:16px"><div>${row(tr('Versione'),'v'+esc(s.version||''))}${row('Le Mans Ultimate',s.lmu?(s.driving?`${tr('in auto')} · ${esc(s.driver||'')}${s.lap?' · '+tr('giro')+' '+s.lap:''}`:tr('collegato, non in auto')):tr('non aperto o nel menu'),s.lmu?'pos':'muted')}</div>
      <div>${s.team?row(tr('Squadra'),esc(s.teamName||tr('collegata')))+row(tr('Server'),(s.relay?'Data Engineer':'MQTT pubblico')+' · '+(s.up?`<span class="pos">${tr('online')}</span>`:`<span class="neg">${tr('riconnessione…')}</span>`))+row(tr('Dati inviati'),Math.round((s.sent||0)/1024)+' KB')+(s.err&&!s.up?row(tr('Ultimo errore'),esc(s.err),'neg'):''):row(tr('Squadra'),tr('nessuna: il Muretto funziona solo su questo PC'),'muted')}</div></div>`;
    $('#pcLog').textContent=(s.log||[]).join('\n');};
  const t=setInterval(tick,2000);tick();openModal('#mPc');}
(function(){const add=()=>{if(!isBridgeHost())return;const d=$('#lvDeb');if(!d||$('#lvPc'))return;const b=document.createElement('button');b.className='btn';b.type='button';b.id='lvPc';b.textContent=tr('Questo PC');b.onclick=openPcPanel;d.before(b);};
  const os=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){os();add();};})();
