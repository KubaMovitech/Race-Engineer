// ================= RACE vs RIVALS (from multi-driver results .xml) =================
function myDriverIdx(R,sess){
  const saved=LS.get('xmldrv:'+R.id+'|'+sess.name,null);if(saved!=null&&sess.drivers[+saved])return +saved;
  const names=new Set(lds().map(S=>norm(S.meta.driver)).filter(Boolean));
  const m=sess.drivers.findIndex(d=>names.has(norm(d.name)));if(m>=0)return m;
  const pl=sess.drivers.filter(d=>d.isPlayer);if(pl.length===1)return sess.drivers.indexOf(pl[0]);
  return 0;
}
function driverPicker(R,sess,di){return `<div class="panel"><label class="f" style="max-width:360px">Pilota da analizzare<select id="xDrv">${sess.drivers.map((d,i)=>`<option value="${i}"${i===di?' selected':''}>${esc(d.name.replace(/#\d+$/,''))} · ${esc(d.car)}</option>`).join('')}</select></label></div>`;}
function lapT(l){return Number.isFinite(l.time)?l.time:NaN;}
function driverStats(d){
  const L=d.laps,pitIdx=L.map((l,i)=>l.pit?i:-1).filter(i=>i>=0);
  const excl=new Set([0,...pitIdx,...pitIdx.map(i=>i+1)]);
  const clean=(a,b)=>L.slice(a,b).map((l,k)=>excl.has(a+k)?NaN:lapT(l)).filter(Number.isFinite);
  const first=pitIdx.length?pitIdx[0]:L.length;
  const s1=clean(0,first),s2=pitIdx.length?clean(first+1,L.length):[];
  const box=pitIdx.map(i=>(lapT(L[i])||0)+(L[i+1]?lapT(L[i+1])||0:0));
  const cmp=i=>{const l=L[Math.min(L.length-1,i)];return l?(l.fc||'').replace(/^\d+,/,''):'';};
  return {pace1:median(s1),pace2:median(s2),pitLaps:pitIdx.map(i=>L[i].num),box,allPace:median(clean(0,L.length)),c1:cmp(1),c2:pitIdx.length?cmp(L.length-1):''};
}
function rivalsHTML(sess,me){
  const cls=me.cls;const field=sess.drivers.filter(d=>d.cls===cls).sort((a,b)=>(a.cpos||a.pos||99)-(b.cpos||b.pos||99));
  if(field.length<2)return '';
  const ms=driverStats(me),isRace=/race/i.test(sess.name);
  const rows=field.map(d=>({d,s:driverStats(d)}));
  const bestAll=Math.min(...field.map(d=>d.best).filter(Number.isFinite));
  const lead=field[0];
  const gapTxt=d=>{if(!isRace)return Number.isFinite(d.best)?fsign(d.best-lead.best,3):'—';if(d.nlaps<lead.nlaps)return `+${lead.nlaps-d.nlaps} ${lead.nlaps-d.nlaps===1?'giro':'giri'}`;return Number.isFinite(d.finish)&&Number.isFinite(lead.finish)?fsign(d.finish-lead.finish,1)+' s':'—';};
  const rank=(k)=>{const v=rows.map(r=>r.s[k]).filter(Number.isFinite).sort((a,b)=>a-b);return x=>Number.isFinite(x)?v.indexOf(x)+1:null;};
  const r1=rank('pace1'),r2=rank('pace2');
  const ahead=rows.find(r=>r.d.cpos===me.cpos-1);
  let insight='';
  if(isRace){const ins=[];const fast=rows.slice(0,Math.min(5,rows.length)).filter(r=>r.d!==me);
    const d1=ms.pace1-median(fast.map(r=>r.s.pace1)),d2=ms.pace2-median(fast.map(r=>r.s.pace2));
    if(Number.isFinite(d1))ins.push(`Stint 1: passo ${fmtLap(ms.pace1)}, ${r1(ms.pace1)}° di ${rows.length} (${fsign(d1,2)} s a giro rispetto ai primi 5).`);
    if(Number.isFinite(d2))ins.push(`Stint 2: passo ${fmtLap(ms.pace2)}, ${r2(ms.pace2)}° di ${rows.length} (${fsign(d2,2)} s a giro rispetto ai primi 5).`);
    if(Number.isFinite(me.best))ins.push(`Giro più veloce: ${fmtLap(me.best)}, ${[...field].sort((a,b)=>a.best-b.best).indexOf(me)+1}° della classe (${fsign(me.best-bestAll,3)} s dal migliore).`);
    if(ms.box.length){const others=rows.filter(r=>r.d!==me&&r.s.box.length===1).map(r=>r.s.box[0]);if(others.length)ins.push(`Giri del pit stop (entrata + uscita): ${fx(ms.box[0],1)} s, mediana della classe ${fx(median(others),1)} s.`);}
    const g=new Map();rows.forEach(r=>{if(r.s.c2&&Number.isFinite(r.s.pace2)){(g.get(r.s.c2)||g.set(r.s.c2,[]).get(r.s.c2)).push(r);}});
    if(g.size>=2){const parts=[...g.entries()].filter(([,a])=>a.length>=2).map(([c,a])=>({c,p:median(a.map(r=>r.s.pace2)),n:a.length,box:median(a.map(r=>r.s.box[0]).filter(Number.isFinite))})).sort((a,b)=>a.p-b.p);
      if(parts.length>=2){const f=parts[0],sl=parts[parts.length-1];const laps2=me.laps.length-(ms.pitLaps.length?me.laps.findIndex(l=>l.num===ms.pitLaps[0])+1:me.laps.length);const net=(sl.p-f.p)*laps2-(f.box-sl.box);
        ins.push(`<b>Gomme nello stint 2:</b> chi ha montato ${esc(f.c)} (${f.n} auto) ha girato in ${fmtLap(f.p)}, chi è rimasto su ${esc(sl.c)} (${sl.n} auto) in ${fmtLap(sl.p)}: ${fx(sl.p-f.p,1)} s a giro di differenza, contro ${fx(f.box-sl.box,0)} s in più ai box.${ms.c2===sl.c&&laps2>0?` Per te, su ${laps2} giri, il cambio ti avrebbe fatto ${net>0?'guadagnare':'perdere'} circa <b>${fx(Math.abs(net),0)} s</b>.`:''}`);}}
    if(ahead&&Number.isFinite(ahead.d.finish)&&Number.isFinite(me.finish))ins.push(`Il ${ahead.d.cpos}° posto (${esc(ahead.d.name.replace(/#\d+$/,''))}) era a ${fx(me.finish-ahead.d.finish,1)} s.`);
    if(Number.isFinite(me.cgrid))ins.push(`Partito ${me.cgrid}°, arrivato ${me.cpos}°.`);
    insight=`<ul style="margin:0 0 12px;padding-left:18px">${ins.map(x=>`<li>${x}</li>`).join('')}</ul>`;}
  return `<div class="panel"><div class="panel-h"><h3>${isRace?'Gara contro i rivali':'Qualifica contro i rivali'} · classe ${esc(cls)}</h3><span class="hint">${field.length} auto · dal file risultati</span></div>${insight}
   ${isRace?`<div class="grid2" style="margin-bottom:12px"><div><h3>Distacco dal leader, giro per giro (s)</h3><canvas class="mini" id="rvGap"></canvas></div><div><h3>Posizione giro per giro</h3><canvas class="mini" id="rvPos"></canvas></div></div><div class="legend" id="rvLeg" style="margin-bottom:10px"></div>`:''}
   <div class="tw"><table><thead><tr><th>Pos</th><th class="l">Pilota</th><th class="l">Auto</th>${isRace?'<th>Griglia</th>':''}<th>Best</th>${isRace?'<th>Passo stint 1</th><th>Passo stint 2</th><th>Sosta al giro</th><th>Giri box s</th><th class="l">Gomme stint 2</th>':'<th>Giri</th>'}<th>Distacco</th></tr></thead><tbody>
   ${rows.map(({d,s})=>`<tr class="${d===me?'sel':''}" style="${d===me?'font-weight:700':''}"><td>${d.cpos||d.pos}</td><td class="l" style="font-family:var(--f-body)">${esc(d.name.replace(/#\d+$/,''))}${d===me?' <span class="tag best">tu</span>':''}</td><td class="l" style="font-family:var(--f-body)">${esc(d.car)}</td>${isRace?`<td>${d.cgrid||'—'}</td>`:''}<td style="${d.best===bestAll?'color:var(--best)':''}">${fmtLap(d.best)}</td>${isRace?`<td>${fmtLap(s.pace1)}</td><td>${fmtLap(s.pace2)}</td><td>${s.pitLaps.join(', ')||'—'}</td><td>${s.box.map(x=>fx(x,1)).join(', ')||'—'}</td><td class="l" style="font-family:var(--f-body)">${s.c2&&s.c2!==s.c1?'<b>'+esc(s.c2)+'</b>':esc(s.c2||'—')}</td>`:`<td>${d.nlaps}</td>`}<td>${gapTxt(d)}${/DNF|Disq/i.test(d.status)?' <span class="tag bad">'+esc(d.status)+'</span>':''}</td></tr>`).join('')}
   </tbody></table></div><p class="muted small">Passo = mediana dei giri escludendo partenza, giro di entrata e di uscita dai box. «Giri box» = tempo del giro di entrata più quello di uscita.</p></div>`;
}
function drawRivals(sess,me){
  const cv=$('#rvGap');if(!cv)return;
  const field=sess.drivers.filter(d=>d.cls===me.cls).sort((a,b)=>(a.cpos||99)-(b.cpos||99));const lead=field[0];
  const pick=[...new Set([lead,...field.filter(d=>Math.abs((d.cpos||99)-(me.cpos||99))<=2),me])].slice(0,6);
  const nl=Math.max(...pick.map(d=>d.laps.length));const x=[...Array(nl).keys()].map(i=>i+1);
  const etAt=(d,i)=>{const l=d.laps[i];return l&&Number.isFinite(l.et)?l.et:NaN;};
  const palette=[tok('muted'),tok('lapB'),tok('good'),tok('warn'),tok('best'),tok('faint')];let k=0;
  const col=d=>d===me?tok('lapA'):palette[k++%palette.length];const cols=new Map(pick.map(d=>[d,col(d)]));
  // gap: time at end of lap i = et of lap i+1 (start); fall back to et + time
  const endT=(d,i)=>{const n=etAt(d,i+1);if(Number.isFinite(n))return n;const l=d.laps[i];return l&&Number.isFinite(l.et)&&Number.isFinite(l.time)?l.et+l.time:NaN;};
  lineChart(cv,{x,series:pick.map(d=>({data:x.map((_,i)=>endT(d,i)-endT(lead,i)),color:cols.get(d)})),yfmt:v=>v.toFixed(0)});
  lineChart($('#rvPos'),{x,series:pick.map(d=>({data:x.map((_,i)=>d.laps[i]?-(d.laps[i].pos||NaN):NaN),color:cols.get(d)})),yfmt:v=>String(Math.abs(Math.round(v)))});
  $('#rvLeg').innerHTML=pick.map(d=>`<span><i style="background:${cols.get(d)}"></i>${esc(d.name.replace(/#\d+$/,''))}${d===me?' (tu)':''}</span>`).join('');
}
