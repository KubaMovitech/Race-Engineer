// ================= THEME / SETTINGS =================
const ACCENTS=[['Rosso F1','#E10600','#7A0300'],['Papaya','#FF8000','#8A3B00'],['Verde corsa','#00A86B','#00553A'],['Blu','#1E6BFF','#0B2F7A'],['Viola','#9B30FF','#4B0F8A'],['Giallo','#F5C518','#8A6B00'],['Teal','#00C2B8','#005F5A'],['Argento','#C9D1D9','#59626C']];
const BGS=[['Carbonio',{bg:'#08090B',panel:'#101318',panel2:'#171B22',band:'#0D1015',line:'#232A33',grid:'#171D24',hdr:'#000000','hdr-line':'#1B2129',trackbed:'#1E252E'}],
 ['Grafite',{bg:'#14171C',panel:'#1B1F26',panel2:'#232831',band:'#181C22',line:'#2E3540',grid:'#222831',hdr:'#0D0F13','hdr-line':'#262C35',trackbed:'#2A313B'}],
 ['Notte blu',{bg:'#060A13',panel:'#0C1322',panel2:'#121B2E',band:'#09101C',line:'#1D2941',grid:'#141F34',hdr:'#02050B','hdr-line':'#16203A',trackbed:'#1A2540'}],
 ['Box notturno',{bg:'#0B0A09',panel:'#151311',panel2:'#1E1B18',band:'#110F0E',line:'#2F2A25',grid:'#201D1A',hdr:'#000000','hdr-line':'#26221E',trackbed:'#2A2520'}]];
function lum(hx){const [r,g,b]=hex(hx).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*r+.7152*g+.0722*b;}
function darken(hx,k){return '#'+hex(hx).map(v=>Math.round(v*k).toString(16).padStart(2,'0')).join('');}
function applyUI(){const u=LS.get('ui',{});const r=document.documentElement.style;
  const acc=u.accent||'#E10600',acc2=u.accent2||darken(acc,.5);r.setProperty('--accent',acc);r.setProperty('--accent2',acc2);r.setProperty('--accent-ink',lum(acc)>.45?'#0b0b0b':'#ffffff');r.setProperty('--accent-soft',darken(acc,.22));
  const bg=BGS.find(b=>b[0]===u.bg)||BGS[0];Object.entries(bg[1]).forEach(([k,v])=>r.setProperty('--'+k,v));
  document.body.classList.remove('d-compact','d-large');if(u.density&&u.density!=='normal')document.body.classList.add('d-'+u.density);}
function openModal(id){const m=$(id);m.hidden=false;m.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{m.hidden=true;});m.onclick=e=>{if(e.target===m)m.hidden=true;};}
function initSettings(){
  const u=()=>LS.get('ui',{});
  const render=()=>{const cur=u();
    $('#swAccent').innerHTML=ACCENTS.map(([n,a,b])=>`<button type="button" class="sw" data-a="${a}" data-b="${b}" aria-pressed="${(cur.accent||'#E10600').toLowerCase()===a.toLowerCase()}"><i style="background:linear-gradient(135deg,${a},${b})"></i>${esc(n)}</button>`).join('');
    $('#swBg').innerHTML=BGS.map(([n,c])=>`<button type="button" class="sw" data-bg="${esc(n)}" aria-pressed="${(cur.bg||'Carbonio')===n}"><i style="background:linear-gradient(135deg,${c.panel},${c.bg});border:1px solid ${c.line}"></i>${esc(n)}</button>`).join('');
    $('#cAccent').value=cur.accent||'#E10600';$('#cA2').value=toHex(tok('lapA'));$('#cB2').value=toHex(tok('lapB'));
    $$('#segDensity button').forEach(b=>b.setAttribute('aria-pressed',(cur.density||'normal')===b.dataset.d));
    $$('#swAccent .sw').forEach(b=>b.onclick=()=>{LS.set('ui',{...u(),accent:b.dataset.a,accent2:b.dataset.b});applyUI();render();redrawAll();});
    $$('#swBg .sw').forEach(b=>b.onclick=()=>{LS.set('ui',{...u(),bg:b.dataset.bg});applyUI();render();redrawAll();});
    $$('#segDensity button').forEach(b=>b.onclick=()=>{LS.set('ui',{...u(),density:b.dataset.d});applyUI();render();redrawAll();});};
  $('#cAccent').oninput=e=>{LS.set('ui',{...u(),accent:e.target.value,accent2:darken(e.target.value,.45)});applyUI();redrawAll();};
  const setAB=()=>{LS.set('colors',{A:$('#cA2').value,B:$('#cB2').value});applyColors();redrawAll();};$('#cA2').oninput=setAB;$('#cB2').oninput=setAB;
  $('#uiReset').onclick=()=>{LS.set('ui',{});LS.set('colors',{});document.documentElement.removeAttribute('style');applyUI();applyColors();render();redrawAll();};
  $('#bkExport').onclick=()=>{const o={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('pitwall:'))o[k]=localStorage.getItem(k);}}catch(e){}
    openCode({title:'Backup',help:'Copia questo codice o salvalo come file: contiene impostazioni, note, abbinamenti setup, progressi e piani di squadra (non i file di telemetria).',text:JSON.stringify({app:'data-engineer',v:1,data:o}),file:'data-engineer-backup.json'});};
  $('#bkImport').onclick=()=>openCode({title:'Importa backup',help:'Incolla qui il codice del backup (oppure apri il file .json) e premi OK.',text:'',onOk:t=>{const j=JSON.parse(t);if(!j.data)throw new Error('codice non valido');Object.entries(j.data).forEach(([k,v])=>{try{localStorage.setItem(k,v);}catch(e){}});toast('Backup importato');setTimeout(()=>location.reload(),600);}});
  $('#btnSettings').onclick=()=>{render();openModal('#mSettings');};
}
function redrawAll(){const v=curView();renderHero();if(v==='lap'&&lapCur.g)RENDER.lap();else if(v==='cmp'&&cmpCur.ga)RENDER.cmp();else RENDER[v]&&RENDER[v]();}
function openCode({title,help,text,onOk,file}){$('#mCodeT').textContent=title;$('#mCodeHelp').textContent=help||'';$('#mCodeTxt').value=text||'';$('#mCodeTxt').readOnly=!onOk;
  $('#mCodeGo').hidden=!onOk;$('#mCodeFile').hidden=!text;$('#mCodeOpen').hidden=!onOk;
  $('#mCodeGo').onclick=()=>{try{onOk($('#mCodeTxt').value.trim());$('#mCode').hidden=true;}catch(e){toast('Codice non valido: '+e.message);}};
  $('#mCodeCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#mCodeTxt').value);toast('Copiato');}catch(e){$('#mCodeTxt').select();toast('Premi Ctrl+C per copiare');}};
  $('#mCodeFile').onclick=()=>{try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([$('#mCodeTxt').value],{type:'application/json'}));a.download=file||'data-engineer.json';document.body.appendChild(a);a.click();a.remove();}catch(e){toast('Salvataggio file non disponibile qui: copia il codice');}};
  $('#mCodeOpen').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='.json,.txt';i.onchange=async()=>{const f=i.files[0];if(f)$('#mCodeTxt').value=await f.text();};i.click();};
  openModal('#mCode');}

// ================= PROGRESS (history kept in this browser) =================
function histKey(S){const car=S.meta.car&&S.meta.car!=='Hyper'?S.meta.car:(S.merged?.d.car||S.meta.car||'auto');return `${S.meta.venue}|${car}`;}
function recordHistory(S){
  if(!S||!S.meta.venue)return;const best=bestValid(S);if(!best)return;
  const fl=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid);const pace=median(fl.filter(l=>l.time<=best.time*1.05).map(l=>l.time));
  const g=lapGrid(S,best,2),segs=refSegments(g).filter(s=>s.c).map(s=>({d:Math.round(g.d[s.c.apex]),t:+(g.t[s.e]-g.t[s.s]).toFixed(3),v:Math.round(g.get('Ground Speed')[s.c.apex])}));
  const H=LS.get('hist',{});H[S.id+'|'+S.meta.date+' '+S.meta.time]={key:histKey(S),date:sessDate(S),label:`${S.meta.date} ${(S.meta.time||'').slice(0,5)}`,file:S.file,driver:(S.meta.driver||'').replace(/#\d+$/,''),best:best.time,pace,n:fl.length,track:S.cond.track?.avg,cond:S.cond.label,segs};
  LS.set('hist',H);}
RENDER.prog=()=>{
  lds().forEach(S=>{try{recordHistory(S);}catch(e){}});
  const H=Object.values(LS.get('hist',{}));const keys=[...new Set(H.map(h=>h.key))];const sel=$('#pgKey');
  const act=active()?.S;const prev=sel.value;opt(sel,keys.map(k=>[k,k.replace('|',' · ')]),false);
  if(prev&&keys.includes(prev))sel.value=prev;else if(act&&keys.includes(histKey(act)))sel.value=histKey(act);
  const list=H.filter(h=>h.key===sel.value).sort((a,b)=>a.date-b.date);const body=$('#pgBody');
  if(!list.length){body.innerHTML='<div class="panel empty">Carica almeno una telemetria: qui vedrai come migliori sessione dopo sessione.</div>';return;}
  const bestEver=list.reduce((a,b)=>a.best<b.best?a:b),first=list[0],last=list[list.length-1];
  const corners=last.segs.map(s=>({d:s.d,rows:list.map(h=>h.segs.find(x=>Math.abs(x.d-s.d)<45))}));
  body.innerHTML=`<div class="panel"><div class="kpis">
    <div class="kpi hl" style="--kc:${tok('best')}"><div class="l">Record personale</div><div class="v">${fmtLap(bestEver.best)}</div><div class="s">${esc(bestEver.label)}</div></div>
    <div class="kpi" style="--kc:${tok('good')}"><div class="l">Progresso dal primo</div><div class="v" style="color:${last.best<first.best?'var(--good)':'var(--bad)'}">${fsign(last.best-first.best,3)} s</div><div class="s">${list.length} sessioni</div></div>
    <div class="kpi" style="--kc:${tok('lapA')}"><div class="l">Passo ultima sessione</div><div class="v">${fmtLap(last.pace)}</div><div class="s">${Number.isFinite(first.pace)?fsign(last.pace-first.pace,3)+' s dal primo':''}</div></div>
    <div class="kpi" style="--kc:${tok('warn')}"><div class="l">Giri registrati</div><div class="v">${list.reduce((a,h)=>a+h.n,0)}</div><div class="s">giri lanciati validi</div></div></div></div>
   <div class="panel"><h3>Miglior giro e passo per sessione</h3><canvas class="mini" id="pgC" style="height:230px"></canvas><div class="legend"><span><i style="background:var(--best)"></i>miglior giro</span><span><i style="background:var(--lapA)"></i>passo</span></div></div>
   <div class="grid2"><div class="panel"><h3>Sessioni</h3><div class="tw"><table><thead><tr><th>#</th><th class="l">Data</th><th>Best</th><th>Passo</th><th>Giri</th><th>Pista</th><th class="l">Meteo</th><th></th></tr></thead><tbody>
     ${list.map((h,i)=>`<tr><td>${i+1}</td><td class="l">${esc(h.label)}</td><td class="${h===bestEver?'t-best':''}">${fmtLap(h.best)}</td><td>${fmtLap(h.pace)}</td><td>${h.n}</td><td>${fx(h.track,1)}°</td><td class="l" style="font-family:var(--f-body)">${esc(h.cond||'')}</td><td><button class="btn icon" data-del="${i}" title="Togli dallo storico" aria-label="Togli">×</button></td></tr>`).join('')}</tbody></table></div></div>
    <div class="panel"><h3>Curva per curva (miglior giro)</h3><div class="tw"><table><thead><tr><th class="l">Curva</th><th>Prima</th><th>Ultima</th><th>Δ</th><th>Migliore</th></tr></thead><tbody>
     ${corners.map((c,k)=>{const v=c.rows.filter(Boolean);if(!v.length)return '';const f=v[0],l=v[v.length-1],b=v.reduce((a,x)=>a.t<x.t?a:x);return `<tr><td class="l">T${k+1} <span class="muted small">${c.d} m</span></td><td>${fx(f.t,3)}</td><td>${fx(l.t,3)}</td><td class="${l.t<f.t-0.01?'pos':l.t>f.t+0.01?'neg':''}">${fsign(l.t-f.t,3)}</td><td class="t-best">${fx(b.t,3)}</td></tr>`;}).join('')}</tbody></table></div><p class="muted small">Tempo del tratto di ogni curva nel miglior giro di ogni sessione. Le curve sono abbinate per posizione in pista.</p></div></div>`;
  const x=list.map((_,i)=>i+1);lineChart($('#pgC'),{x,h:230,series:[{data:list.map(h=>h.best),color:tok('best'),dot:i=>list[i]===bestEver},{data:list.map(h=>h.pace),color:tok('lapA')}],yfmt:v=>fmtLap(v).slice(0,-2)});
  $$('#pgBody [data-del]').forEach(b=>b.onclick=()=>{const h=list[+b.dataset.del];const H2=LS.get('hist',{});for(const k in H2)if(H2[k].date===h.date&&H2[k].key===h.key&&H2[k].best===h.best)delete H2[k];LS.set('hist',H2);RENDER.prog();});
};

// ================= RAIN: WHEN TO FIT WETS =================
function learnWet(){xmls().forEach(R=>R.sessions.forEach(sess=>{if(!/race/i.test(sess.name))return;
  const classes=[...new Set(sess.drivers.map(d=>d.cls))];classes.forEach(cls=>{const g={};
  sess.drivers.filter(d=>d.cls===cls).forEach(d=>{const s=driverStats(d);if(!s.c2||!Number.isFinite(s.pace2))return;(g[s.c2]??=[]).push({p:s.pace2,box:s.box[0]});});
  const wet=Object.entries(g).filter(([k])=>/wet|inter/i.test(k)).flatMap(([,v])=>v),dry=Object.entries(g).filter(([k])=>!/wet|inter/i.test(k)).flatMap(([,v])=>v);
  if(wet.length>=2&&dry.length>=2){let cost=median(wet.map(x=>x.box).filter(Number.isFinite))-median(dry.map(x=>x.box).filter(Number.isFinite));if(!(cost>0))cost=NaN;
    LS.set('wet:'+R.venue+'|'+cls,{delta:median(dry.map(x=>x.p))-median(wet.map(x=>x.p)),cost,nw:wet.length,nd:dry.length,cls,date:Date.now()});}});}));}
function wetData(venue){const a=active();const cls=a?.S?.merged?.d.cls||(a?.xml?(a.xml.sessions[a.si].drivers[myDriverIdx(a.xml,a.xml.sessions[a.si])]?.cls):null);
  let w=cls?LS.get('wet:'+venue+'|'+cls,null):null;if(!w){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('pitwall:wet:'+venue+'|')){w=JSON.parse(localStorage.getItem(k));break;}}}catch(e){}}return w;}
function rainPanelHTML(){const a=active();const venue=a?.S?.meta.venue||a?.xml?.venue;const w=venue?wetData(venue):null;const v=LS.get('rainCalc',{});
  return `<div class="panel" id="rainP"><div class="panel-h"><h3>Pioggia: conviene montare le Wet?</h3>${w?`<span class="badge">dati imparati a ${esc(venue)} (${esc(w.cls||'')}): ${w.nw} auto con Wet, ${w.nd} senza</span>`:'<span class="hint">carica una gara con pioggia (.xml) per avere valori misurati</span>'}</div>
   <div class="setgrid"><label class="f">Giri ancora da fare<input type="number" id="rcLaps" step="1" value="${v.laps??10}"></label><label class="f">Wet più veloci di (s/giro)<input type="number" id="rcDelta" step="0.1" value="${v.delta??(w?w.delta.toFixed(1):2.5)}"></label>
   <label class="f">Costo del cambio gomme (s)<input type="number" id="rcCost" step="0.5" value="${v.cost??(w&&Number.isFinite(w.cost)?w.cost.toFixed(1):12)}"></label><label class="f">Devi già fermarti?<select id="rcStop"><option value="1"${v.stop!=='0'?' selected':''}>Sì, cambio durante la sosta</option><option value="0"${v.stop==='0'?' selected':''}>No, sosta solo per le gomme</option></select></label></div>
   <div id="rcOut" style="margin-top:12px"></div></div>`;}
function calcRain(){const g=id=>+$(id).value;const laps=g('#rcLaps'),d=g('#rcDelta'),c=g('#rcCost'),stop=$('#rcStop').value==='1';
  const a=active();const venue=a?.S?.meta.venue||a?.xml?.venue;const pl=venue&&LS.get('pitloss:'+venue,null);const extra=stop?c:c+(pl?pl.loss:25);
  const gain=laps*d-extra,be=d>0?Math.max(0,extra/d):Infinity;LS.set('rainCalc',{laps,delta:d,cost:c,stop:stop?'1':'0'});
  $('#rcOut').innerHTML=`<div class="kpis"><div class="kpi" style="--kc:${gain>0?tok('good'):tok('bad')}"><div class="l">Verdetto</div><div class="v txt" style="color:${gain>0?'var(--good)':'var(--bad)'}">${gain>0?'Monta le Wet':'Resta con le slick'}</div><div class="s">${gain>0?'guadagni':'perdi'} circa ${fx(Math.abs(gain),0)} s</div></div>
    <div class="kpi" style="--kc:${tok('warn')}"><div class="l">Pareggio</div><div class="v">${fx(be,1)} giri</div><div class="s">sotto questi giri non conviene</div></div>
    <div class="kpi" style="--kc:${tok('lapA')}"><div class="l">Costo totale</div><div class="v">${fx(extra,0)} s</div><div class="s">${stop?'solo il cambio gomme':'sosta completa'+(pl?' (misurata)':' (stimata)')}</div></div></div>
    <p class="muted small" style="margin:8px 0 0">La differenza di passo misurata vale per quella pioggia: se aumenta, le Wet guadagnano di più; se la pista si asciuga, conviene restare con le slick.</p>`;}

// ================= ENDURANCE TEAM PLANNER =================
const TM_RACE=[['name','Nome piano','Endurance','t'],['hours','Durata (ore)',6,0.25],['start','Ora del via (hh:mm)','13:00','t'],['veCap','Limite NRG per stint (%)',100,1],['ve','NRG per giro (%)',2.6,0.01],['fuel','Carburante per giro (L)',2.1,0.01],['res','Margine (giri)',0.5,0.1],['pit','Tempo perso per sosta (s)',50,0.5],['swap','Cambio pilota (s)',10,0.5],['tyre','Cambio 4 gomme (s)',12,0.5],['tyreEvery','Gomme ogni N stint',2,1],['maxStint','Max minuti per stint (0 = libero)',0,1],['minDrive','Min minuti per pilota (0 = libero)',0,1],['maxDrive','Max minuti per pilota (0 = libero)',0,1]];
const DRV_COL=['#27F4D2','#FF8000','#B138DD','#19D26B','#F5C518','#3A8DFF'];
function tmPlans(){return LS.get('team',{plans:[],cur:null});}
function tmSave(T){LS.set('team',T);}
function tmNewPlan(){const a=active()?.S;const p={id:'p'+Date.now(),race:Object.fromEntries(TM_RACE.map(([k,,d])=>[k,d])),drivers:[{name:(a?.meta.driver||tr('Pilota')+' 1').replace(/#\d+$/,''),lap:'1:30.000',stints:''},{name:tr('Pilota')+' 2',lap:'1:30.500',stints:''}]};
  if(a){const b=bestValid(a);const fl=a.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid);const pace=median(fl.filter(l=>b&&l.time<=b.time*1.05).map(l=>l.time));if(Number.isFinite(pace))p.drivers[0].lap=fmtLap(pace);
    const st=fl.map(l=>lapStats(a,l));const fu=median(st.map(s=>s.fuel).filter(v=>v>0));if(Number.isFinite(fu))p.race.fuel=+fu.toFixed(2);const pl=LS.get('pitloss:'+a.meta.venue,null);if(pl)p.race.pit=+pl.loss.toFixed(1);}
  const sv=LS.get('strategy',null);if(sv&&+sv.ve>0)p.race.ve=+sv.ve;if(sv&&+sv.veMax>0)p.race.veCap=+sv.veMax;return p;}
RENDER.team=()=>{let T=tmPlans();if(!T.plans.length){T.plans.push(tmNewPlan());T.cur=T.plans[0].id;tmSave(T);}
  if(!T.plans.find(p=>p.id===T.cur))T.cur=T.plans[0].id;const P=T.plans.find(p=>p.id===T.cur);
  opt($('#tmPlan'),T.plans.map(p=>[p.id,p.race.name||'Piano']),false);$('#tmPlan').value=T.cur;
  $('#tmRace').innerHTML=TM_RACE.map(([k,l,d,st])=>`<label class="f">${l}<input ${st==='t'?'type="text"':`type="number" step="${st}"`} data-r="${k}" value="${esc(P.race[k]??d)}"></label>`).join('');
  $('#tmDrivers').innerHTML=P.drivers.map((d,i)=>`<div class="drv"><label class="f">Pilota <span style="color:${DRV_COL[i%6]}">●</span><input type="text" data-d="${i}" data-k="name" value="${esc(d.name)}"></label><label class="f">Passo (m:ss)<input type="text" data-d="${i}" data-k="lap" value="${esc(d.lap)}"></label><label class="f">NRG ×<input type="number" step="0.01" data-d="${i}" data-k="veMul" value="${esc(d.veMul??1)}"></label><label class="f">Stint fissi (n)<input type="number" step="1" data-d="${i}" data-k="stints" value="${esc(d.stints??'')}" placeholder="—"></label><label class="f">Ordine<input type="number" step="1" data-d="${i}" data-k="order" value="${esc(d.order??i+1)}"></label><button class="btn icon" type="button" data-rm="${i}" title="Togli pilota" aria-label="Togli pilota">×</button></div>`).join('')+`<p class="muted small">NRG × = consumo del pilota rispetto al valore di gara (1,05 = consuma il 5% in più). «Stint fissi» forza il numero di stint di quel pilota; vuoto = turni a rotazione.</p>`;
  const save=()=>{tmSave(T);tmCalc(P);};
  $$('#tmRace [data-r]').forEach(i=>i.oninput=()=>{P.race[i.dataset.r]=i.type==='number'?+i.value:i.value;if(i.dataset.r==='name')opt($('#tmPlan'),T.plans.map(p=>[p.id,p.race.name||'Piano']),true);save();});
  $$('#tmDrivers [data-d]').forEach(i=>i.oninput=()=>{const d=P.drivers[+i.dataset.d];d[i.dataset.k]=i.type==='number'?(i.value===''?'':+i.value):i.value;save();});
  $$('#tmDrivers [data-rm]').forEach(b=>b.onclick=()=>{if(P.drivers.length<=1)return;P.drivers.splice(+b.dataset.rm,1);tmSave(T);RENDER.team();});
  $('#tmAddDrv').onclick=()=>{if(P.drivers.length>=6)return;P.drivers.push({name:tr('Pilota')+' '+(P.drivers.length+1),lap:P.drivers[0].lap});tmSave(T);RENDER.team();};
  $('#tmPlan').onchange=e=>{T.cur=e.target.value;tmSave(T);RENDER.team();};
  $('#tmNew').onclick=()=>{const p=tmNewPlan();p.race.name='Piano '+(T.plans.length+1);T.plans.push(p);T.cur=p.id;tmSave(T);RENDER.team();};
  $('#tmDup').onclick=()=>{const p=JSON.parse(JSON.stringify(P));p.id='p'+Date.now();p.race.name=(P.race.name||'Piano')+' (copia)';T.plans.push(p);T.cur=p.id;tmSave(T);RENDER.team();};
  $('#tmDel').onclick=()=>{if(T.plans.length<=1){toast('Deve restare almeno un piano');return;}T.plans=T.plans.filter(p=>p!==P);T.cur=T.plans[0].id;tmSave(T);RENDER.team();};
  $('#tmExport').onclick=()=>openCode({title:'Esporta piano',help:'Manda questo codice (o il file) ai compagni: con «Importa» lo caricano nella loro app.',text:JSON.stringify({app:'data-engineer',plan:P}),file:`piano-${(P.race.name||'endurance').replace(/\W+/g,'-')}.json`});
  $('#tmImport').onclick=()=>openCode({title:'Importa piano',help:'Incolla il codice ricevuto (o apri il file .json) e premi OK.',text:'',onOk:t=>{const j=JSON.parse(t);if(!j.plan||!j.plan.race)throw new Error('non è un piano');const p=j.plan;p.id='p'+Date.now();T.plans.push(p);T.cur=p.id;tmSave(T);RENDER.team();toast('Piano importato');}});
  tmCalc(P);};
function hhmm(min){const m=((Math.round(min)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
function tmCalc(P){
  const R=P.race,out=$('#tmOut');const T=R.hours*3600;const ds=P.drivers.map((d,i)=>({...d,i,col:DRV_COL[i%6],lapS:parseLapT(d.lap),mul:+d.veMul||1})).filter(d=>d.lapS>0);
  if(!ds.length||!(R.ve>0)||!(T>0)){out.innerHTML='<div class="panel empty">Inserisci durata, NRG per giro e almeno un pilota con il passo.</div>';return;}
  const order=[...ds].sort((a,b)=>(+a.order||a.i+1)-(+b.order||b.i+1));
  const fixed=order.some(d=>+d.stints>0);const queue=[];if(fixed){order.forEach(d=>{for(let k=0;k<(+d.stints||0);k++)queue.push(d);});}
  const startMin=(()=>{const m=String(R.start||'0:0').match(/(\d+):(\d+)/);return m?+m[1]*60+ +m[2]:0;})();
  const ratio=Math.ceil(R.fuel/R.ve*1.03*100)/100;
  let t=0,k=0,stints=[],tyreCount=0,prev=null;
  while(t<T&&k<200){const d=fixed?(queue[k]||order[k%order.length]):order[k%order.length];
    const veLap=R.ve*d.mul;let maxL=Math.floor(R.veCap/veLap-(R.res||0));if(R.maxStint>0)maxL=Math.min(maxL,Math.floor(R.maxStint*60/d.lapS));if(maxL<1)maxL=1;
    let stop=0,tyres=false,swap=false;if(k>0){stop=R.pit;swap=prev&&prev!==d;if(swap)stop+=R.swap;tyreCount++;tyres=R.tyreEvery>0&&tyreCount%R.tyreEvery===0;if(tyres)stop+=R.tyre;}
    t+=stop;const remain=T-t;let laps=Math.min(maxL,Math.max(1,Math.ceil(remain/d.lapS)));const last=laps*d.lapS>=remain;if(last)laps=Math.ceil(remain/d.lapS)+0;
    const ve=Math.min(R.veCap,Math.ceil((laps+(R.res||0))*veLap));
    stints.push({d,start:t,laps,dur:laps*d.lapS,ve,fuel:ve*ratio,stop,tyres,swap,last});t+=laps*d.lapS;prev=d;k++;if(last)break;}
  const tot=stints.reduce((a,s)=>a+s.laps,0),pitTot=stints.reduce((a,s)=>a+s.stop,0);
  const per=ds.map(d=>({d,min:stints.filter(s=>s.d===d).reduce((a,s)=>a+s.dur,0)/60,n:stints.filter(s=>s.d===d).length}));
  const warn=[];per.forEach(p=>{if(R.minDrive>0&&p.min<R.minDrive)warn.push(`${p.d.name} guida ${fx(p.min,0)} min, sotto il minimo di ${R.minDrive}.`);if(R.maxDrive>0&&p.min>R.maxDrive)warn.push(`${p.d.name} guida ${fx(p.min,0)} min, sopra il massimo di ${R.maxDrive}.`);});
  out.innerHTML=`<div class="panel"><div class="kpis">
    <div class="kpi hl" style="--kc:${tok('best')}"><div class="l">Giri stimati</div><div class="v">${tot}</div><div class="s">${fx(R.hours,2)} ore di gara</div></div>
    <div class="kpi" style="--kc:${tok('accent')}"><div class="l">Soste</div><div class="v">${stints.length-1}</div><div class="s">${fx(pitTot/60,1)} min ai box</div></div>
    <div class="kpi" style="--kc:${tok('lapA')}"><div class="l">Rapporto carburante</div><div class="v">${fx(ratio,2)}</div><div class="s">${fx(R.fuel,2)} L ÷ ${fx(R.ve,2)} % +3%</div></div>
    <div class="kpi" style="--kc:${tok('warn')}"><div class="l">Gomme</div><div class="v">${stints.filter(s=>s.tyres).length+1} treni</div><div class="s">cambio ogni ${R.tyreEvery} stint</div></div></div>
   ${warn.map(w=>`<div class="warnbar" style="margin-top:10px">${esc(w)}</div>`).join('')}
   <div class="gantt">${stints.map(s=>`<span style="flex:${s.dur+s.stop};background:${s.d.col}" title="${esc(s.d.name)} · ${s.laps} giri">${s.dur>T*0.05?esc(s.d.name.split(' ')[0]):''}</span>`).join('')}</div>
   <div class="legend">${per.map(p=>`<span><i style="background:${p.d.col}"></i>${esc(p.d.name)} · ${p.n} stint · ${fx(p.min,0)} min (${fx(p.min/(T/60)*100,0)}%)</span>`).join('')}</div></div>
   <div class="panel"><div class="panel-h"><h3>Piano stint</h3></div><div class="tw"><table><thead><tr><th>Stint</th><th class="l">Pilota</th><th>Inizio</th><th>Fine</th><th>Giri</th><th>Durata</th><th>NRG da impostare</th><th>Carburante</th><th class="l">Sosta prima</th><th>Sosta s</th></tr></thead><tbody>
   ${stints.map((s,i)=>`<tr><td>${i+1}</td><td class="l" style="font-family:var(--f-body);color:${s.d.col}">${esc(s.d.name)}</td><td>${hhmm(startMin+s.start/60)}</td><td>${hhmm(startMin+(s.start+s.dur)/60)}</td><td>${s.laps}</td><td>${fx(s.dur/60,0)} min</td><td>${fx(s.ve,0)} %</td><td>${fx(s.fuel,1)} L</td><td class="l">${i?[s.swap?'<span class="tag warn">cambio pilota</span>':'<span class="tag info">stesso pilota</span>',s.tyres?'<span class="tag good">4 gomme</span>':''].join(' '):'<span class="tag good">partenza</span>'}</td><td>${i?fx(s.stop,0):'—'}</td></tr>`).join('')}
   </tbody></table></div><p class="muted small">Ogni stint usa il passo e il consumo del suo pilota e si ferma prima di superare il limite di NRG (margine incluso). L'ultimo stint carica solo l'energia che serve per arrivare. Il tempo di rifornimento è dentro il «tempo perso per sosta».</p></div>`;
}

// ================= REPORT =================
function coachTips(S,lap,R){const g0=lapGrid(R.S,R.lap,2),segs=refSegments(g0).filter(s=>s.c),gm=lapGrid(S,lap,2,g0.len);const tips=[];
  segs.forEach(sg=>{const me=cornerMetrics(gm,sg.c),rf=cornerMetrics(g0,sg.c),dt=me.segT-rf.segT,why=[];
    if(me.brake!=null&&rf.brake!=null&&rf.brake-me.brake>8)why.push(`freni ${fx(rf.brake-me.brake,0)} m prima`);
    if(Number.isFinite(me.trail)&&Number.isFinite(rf.trail)&&rf.trail-me.trail>12)why.push('porta più freno in inserimento');
    if(me.coast-rf.coast>0.15)why.push(`${fx(me.coast,2)} s senza pedali`);if(rf.vMin-me.vMin>3)why.push(`${fx(rf.vMin-me.vMin,0)} km/h in meno a centro curva`);
    if(Number.isFinite(me.fullThr)&&Number.isFinite(rf.fullThr)&&me.fullThr-rf.fullThr>15)why.push('gas pieno più tardi');
    if(dt>0.03&&why.length)tips.push({n:sg.name,dt,why});});return tips.sort((a,b)=>b.dt-a.dt).slice(0,4);}
function openReport(){
  const a=active();if(!a){toast('Scegli una sessione');return;}let h='';
  if(a.S){const S=a.S,m=S.meta,b=bestValid(S),fl=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid),pace=median(fl.filter(l=>b&&l.time<=b.time*1.07).map(l=>l.time));
    const st=fl.map(l=>lapStats(S,l)),fuel=median(st.map(s=>s.fuel).filter(v=>v>0));
    h+=`<h1>${esc(m.venue)}</h1><p>${esc(m.date)} ${esc((m.time||'').slice(0,5))} · ${esc((m.driver||'').replace(/#\d+$/,''))} · ${esc(m.car||S.merged?.d.car||'')} · ${esc(S.cond.label)}, pista ${fx(S.cond.track?.avg,1)} °C</p>
     <div class="rk"><div>Miglior giro<b>${b?fmtLap(b.time):'—'}</b></div><div>Passo<b>${fmtLap(pace)}</b></div><div>Giri validi<b>${fl.length}</b></div><div>Carburante/giro<b>${fx(fuel,2)} L</b></div>${S.merged?`<div>Posizione<b>${S.merged.d.cpos||S.merged.d.pos||'—'}°</b></div>`:''}</div>`;
    if(S.merged){const D=S.merged.d;const L=D.laps;const hits=L.flatMap(l=>l.ev.filter(e=>e.k==='hit').map(e=>`giro ${l.num}: ${e.wall?'muro':'contatto con '+String(e.with).replace(/#\d+$/,'')}`));
      h+=`<h2>Eventi</h2><p>Soste ai giri ${L.filter(l=>l.pit).map(l=>l.num).join(', ')||'—'} · giri invalidati ${L.filter(l=>l.invalid).length} · fuori pista ${L.reduce((x,l)=>x+l.ev.filter(e=>e.k==='nfa').length,0)}</p>${hits.length?`<p>${esc(hits.slice(0,8).join(' · '))}</p>`:''}`;
      if(S.merged.sess.drivers.length>1){const tmp=document.createElement('div');tmp.innerHTML=rivalsHTML(S.merged.sess,D);const ul=tmp.querySelector('ul');if(ul)h+=`<h2>Contro i rivali</h2>${ul.outerHTML}`;}}
    const lim=limitEvents(S);if(lim){const by={};lim.ev.filter(e=>e.ov>1||e.off).forEach(e=>{by[e.corner]=(by[e.corner]||0)+1;});const top=Object.entries(by).sort((x,y)=>y[1]-x[1]).slice(0,3);if(top.length)h+=`<h2>Limiti di pista</h2><p>Curve a rischio: ${top.map(([k,v])=>`${esc(k)} (${v})`).join(', ')}</p>`;}
    const ro=refOptions(S);const R=ro[0]&&pickRef(ro[0][0]);if(R&&b&&!(R.S===S&&R.lap===b)){const tips=coachTips(S,b,R);if(tips.length)h+=`<h2>Consigli di guida (contro ${esc((R.S.meta.driver||'riferimento').replace(/#\d+$/,''))} ${fmtLap(R.lap.time)})</h2><ul>${tips.map(t=>`<li><b>${t.n}</b> (${fsign(t.dt,2)} s): ${esc(t.why.join(', '))}</li>`).join('')}</ul>`;}
    try{const su=byId($('#suFile').value);const D2=diagnose(S,fl.length?fl:S.laps.filter(l=>l.complete),su);const bad=D2.cards.filter(c=>c.st&&c.st!=='good');if(bad.length)h+=`<h2>Setup da controllare</h2><ul>${bad.map(c=>{const t=document.createElement('div');t.innerHTML=c.fix||'';return `<li><b>${esc(c.title)}</b>${c.fix?': '+esc(t.textContent):''}</li>`;}).join('')}</ul>`;}catch(e){}
    h+=`<h2>Giri</h2><table><thead><tr><th>Giro</th><th class="l">Tipo</th><th>Tempo</th><th>Carb.</th></tr></thead><tbody>${S.laps.filter(l=>l.complete||l.start).map(l=>`<tr><td>${l.num}</td><td class="l">${l.type}</td><td class="${l.invalid?'t-bad':l===b?'t-best':''}">${fmtLap(l.time)}</td><td>${fx(lapStats(S,l).fuel,2)}</td></tr>`).join('')}</tbody></table>`;}
  else{const R=a.xml,sess=R.sessions[a.si],D=sess.drivers[myDriverIdx(R,sess)];const ps=driverPace(D);
    h+=`<h1>${esc(R.venue)}</h1><p>${esc(sess.name)} · ${esc(R.time)} · ${esc(D.name.replace(/#\d+$/,''))} · ${esc(D.car)}</p><div class="rk"><div>Posizione<b>${D.cpos||D.pos||'—'}°</b></div><div>Miglior giro<b>${fmtLap(D.best)}</b></div><div>Media 5<b>${fmtLap(ps.avg5)}</b></div><div>Giri<b>${D.laps.length}</b></div></div>`;
    if(sess.drivers.length>1){const tmp=document.createElement('div');tmp.innerHTML=rivalsHTML(sess,D);const ul=tmp.querySelector('ul');if(ul)h+=`<h2>Contro i rivali</h2>${ul.outerHTML}`;}}
  h+=`<p class="muted small" style="margin-top:16px">Generato con Data Engineer</p>`;
  $('#rpBody').innerHTML=h;$('#rpPrint').hidden=window.self!==window.top;
  $('#rpPrint').onclick=()=>window.print();$('#rpCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#rpBody').innerText);toast('Report copiato');}catch(e){toast('Copia non disponibile qui');}};
  openModal('#mReport');}
