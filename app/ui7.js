// ================= PACE AVERAGES & DRIVER COMPARISON (results .xml) =================
function driverPace(d){
  const L=d.laps,pitIdx=new Set();L.forEach((l,i)=>{if(l.pit){pitIdx.add(i);pitIdx.add(i+1);}});
  const ok=L.filter((l,i)=>i>0&&!pitIdx.has(i)&&!l.invalid&&Number.isFinite(l.time)&&(!l.kind||l.kind==='lanciato'));
  const best=ok.length?Math.min(...ok.map(l=>l.time)):NaN;const pace=ok.filter(l=>l.time<=best*1.07);
  const sorted=pace.map(l=>l.time).sort((a,b)=>a-b);const avgN=n=>sorted.length>=n?mean(sorted.slice(0,n)):NaN;
  const sec=[0,1,2].map(k=>{const key='s'+(k+1);const v=L.filter(l=>!l.invalid&&Number.isFinite(l[key])).map(l=>l[key]);return {best:v.length?Math.min(...v):NaN,avg:mean(pace.map(l=>l[key]).filter(Number.isFinite))};});
  const ideal=sec.every(s=>Number.isFinite(s.best))?sec.reduce((a,s)=>a+s.best,0):NaN;
  return {best,avg3:avgN(3),avg5:avgN(5),avg10:avgN(10),avg:mean(pace.map(l=>l.time)),sd:pace.length>=3?std(pace.map(l=>l.time)):NaN,n:pace.length,ideal,sec,laps:pace};
}
let PACE={sort:'avg5',asc:true,sel:null,cls:null};
function paceHTML(sess,me){
  if(PACE.sess!==sess){PACE.sess=sess;PACE.cls=null;PACE.sel=null;}
  const classes=[...new Set(sess.drivers.map(d=>d.cls).filter(Boolean))];
  if(PACE.cls==null||!classes.includes(PACE.cls))PACE.cls=me.cls||classes[0]||'';
  return `<div class="panel" id="paceP"><div class="panel-h"><h3>Passo medio e confronto piloti</h3>
    ${classes.length>1?`<label class="f">Classe<select id="pcCls">${classes.map(c=>`<option${c===PACE.cls?' selected':''}>${esc(c)}</option>`).join('')}</select></label>`:''}
    <span class="hint">clic su un'intestazione per ordinare · clic su una riga per aggiungerla al confronto</span></div>
    <div class="tw" id="pcTable"></div>
    <div class="panel-h" style="margin-top:18px"><h3>Confronto</h3><div class="chips" id="pcChips"></div></div>
    <canvas class="mini" id="pcChart" style="height:240px"></canvas><div class="legend" id="pcLeg"></div>
    <div class="tw" id="pcSec" style="margin-top:12px"></div>
    <p class="muted small">Media 3 / 5 / 10 = media dei tuoi 3, 5, 10 giri migliori. Media passo = tutti i giri validi entro il 107% del proprio best, esclusi primo giro e giri box. Ideale = somma dei migliori settori.</p></div>`;
}
function wirePace(sess,me){
  const field=()=>sess.drivers.filter(d=>(d.cls||'')===PACE.cls||!PACE.cls);
  const stats=new Map(sess.drivers.map(d=>[d,driverPace(d)]));
  const key=d=>d.name+'|'+d.car;
  if(!PACE.sel||!PACE.sel.some(k=>sess.drivers.some(d=>key(d)===k))){
    const f=field().filter(d=>stats.get(d).n>0).sort((a,b)=>(stats.get(a).avg5||stats.get(a).best||1e9)-(stats.get(b).avg5||stats.get(b).best||1e9));
    const mi=f.indexOf(me);PACE.sel=[...new Set([me,f[0],mi>0?f[mi-1]:f[1]].filter(Boolean))].map(key);}
  const cols=()=>[tok('lapA'),tok('lapB'),tok('best'),tok('good'),tok('warn'),'#C9D1D9'];
  const draw=()=>{
    const ms=stats.get(me);const empty=field().filter(d=>!stats.get(d).n&&d!==me).length;const rk=Number.isFinite(ms.avg5)?'avg5':Number.isFinite(ms.avg3)?'avg3':'best',rl={avg5:'media 5',avg3:'media 3',best:'best'}[rk];const rows=field().filter(d=>stats.get(d).n>0||d===me).map(d=>({d,s:stats.get(d)}));
    const k=PACE.sort;const val=r=>k==='name'?r.d.name:k==='pos'?(r.d.cpos||r.d.pos||999):r.s[k];
    rows.sort((a,b)=>{const x=val(a),y=val(b);if(typeof x==='string')return PACE.asc?x.localeCompare(y):y.localeCompare(x);const fx_=Number.isFinite(x)?x:1e9,fy=Number.isFinite(y)?y:1e9;return PACE.asc?fx_-fy:fy-fx_;});
    const mins={};['best','ideal','avg3','avg5','avg10','avg','sd'].forEach(c=>{mins[c]=Math.min(...rows.map(r=>r.s[c]).filter(Number.isFinite));});
    const th=(c,l,cls='')=>`<th class="${cls}" data-k="${c}" style="cursor:pointer">${l}${PACE.sort===c?(PACE.asc?' ▲':' ▼'):''}</th>`;
    const cell=(r,c,f=fmtLap)=>{const v=r.s[c];return `<td class="${Number.isFinite(v)&&v===mins[c]?'t-best':''}">${Number.isFinite(v)?f(v):'—'}</td>`;};
    $('#pcTable').innerHTML=`<table><thead><tr>${th('pos','Pos')}${th('name','Pilota','l')}<th class="l">Auto</th>${th('best','Best')}${th('ideal','Ideale')}${th('avg3','Media 3')}${th('avg5','Media 5')}${th('avg10','Media 10')}${th('avg','Media passo')}${th('n','Giri')}${th('sd','σ')}<th>Δ ${rl} vs te</th></tr></thead><tbody>
      ${rows.map(r=>{const on=PACE.sel.includes(key(r.d));const dv=r.s[rk]-ms[rk];return `<tr class="clickable ${on?'sel':''}" data-key="${esc(key(r.d))}" style="${r.d===me?'font-weight:700':''}"><td>${r.d.cpos||r.d.pos||'—'}</td><td class="l" style="font-family:var(--f-body)">${on?'● ':''}${esc(r.d.name.replace(/#\d+$/,''))}${r.d===me?' <span class="tag best">tu</span>':''}</td><td class="l" style="font-family:var(--f-body)">${esc(r.d.car)}</td>${cell(r,'best')}${cell(r,'ideal')}${cell(r,'avg3')}${cell(r,'avg5')}${cell(r,'avg10')}${cell(r,'avg')}<td>${r.s.n||'—'}</td>${cell(r,'sd',v=>fx(v,3))}<td style="color:${!Number.isFinite(dv)||r.d===me?'inherit':dv<0?'var(--bad)':'var(--good)'}">${r.d===me||!Number.isFinite(dv)?'—':fsign(dv,3)}</td></tr>`;}).join('')}</tbody></table>${empty?`<p class="muted small" style="margin:6px 0 0">${empty} piloti senza giri validi non sono mostrati.</p>`:''}`;
    $$('#pcTable th[data-k]').forEach(h=>h.onclick=()=>{const c=h.dataset.k;if(PACE.sort===c)PACE.asc=!PACE.asc;else{PACE.sort=c;PACE.asc=c!=='n';}draw();});
    $$('#pcTable tr.clickable').forEach(tr=>tr.onclick=()=>{const k2=tr.dataset.key;PACE.sel=PACE.sel.includes(k2)?PACE.sel.filter(x=>x!==k2):[...PACE.sel,k2].slice(-6);draw();});
    // comparison
    const sel=PACE.sel.map(k2=>sess.drivers.find(d=>key(d)===k2)).filter(Boolean);const C=cols();
    $('#pcChips').innerHTML=sel.map((d,i)=>`<span class="chip" style="border-color:${C[i]}"><span class="nm" style="color:${C[i]}">${esc(d.name.replace(/#\d+$/,''))}</span><button type="button" data-rm="${esc(key(d))}" aria-label="Togli">×</button></span>`).join('')||'<span class="muted small">Scegli i piloti dalla tabella</span>';
    $$('#pcChips [data-rm]').forEach(b=>b.onclick=()=>{PACE.sel=PACE.sel.filter(x=>x!==b.dataset.rm);draw();});
    const nl=Math.max(1,...sel.map(d=>d.laps.length));const x=[...Array(nl).keys()].map(i=>i+1);
    const validT=(d,l)=>{const s=stats.get(d);return s.laps.includes(l)?l.time:NaN;};
    lineChart($('#pcChart'),{x,h:240,series:sel.map((d,i)=>({data:x.map((_,j)=>d.laps[j]?validT(d,d.laps[j]):NaN),color:C[i]})),yfmt:v=>fmtLap(v).slice(0,-2)});
    $('#pcLeg').innerHTML=sel.map((d,i)=>`<span><i style="background:${C[i]}"></i>${esc(d.name.replace(/#\d+$/,''))}</span>`).join('');
    const ref=sel.includes(me)?me:sel[0];const rs=ref&&stats.get(ref);
    const dcell=(v,r,f=x=>x.toFixed(3))=>`${Number.isFinite(v)?f(v):'—'}${Number.isFinite(v)&&Number.isFinite(r)&&v!==r?` <span style="color:${v<r?'var(--good)':'var(--bad)'};font-size:.8em">${fsign(v-r,3)}</span>`:''}`;
    $('#pcSec').innerHTML=sel.length?`<table><thead><tr><th class="l">Pilota</th><th>Best S1</th><th>Best S2</th><th>Best S3</th><th>Media S1</th><th>Media S2</th><th>Media S3</th><th>Media 5</th><th>Media passo</th></tr></thead><tbody>${sel.map((d,i)=>{const s=stats.get(d);const own=d===ref;return `<tr><td class="l" style="font-family:var(--f-body);color:${C[i]}">${esc(d.name.replace(/#\d+$/,''))}${own?' (riferimento)':''}</td>${[0,1,2].map(k=>`<td>${own?fx(s.sec[k].best,3):dcell(s.sec[k].best,rs.sec[k].best)}</td>`).join('')}${[0,1,2].map(k=>`<td>${own?fx(s.sec[k].avg,3):dcell(s.sec[k].avg,rs.sec[k].avg)}</td>`).join('')}<td>${own?fmtLap(s.avg5):dcell(s.avg5,rs.avg5,fmtLap)}</td><td>${own?fmtLap(s.avg):dcell(s.avg,rs.avg,fmtLap)}</td></tr>`;}).join('')}</tbody></table>
      ${sel.length>1&&rs?`<p class="small" style="margin:8px 0 0">${sel.filter(d=>d!==ref).map(d=>{const s=stats.get(d);const diffs=[0,1,2].map(k=>s.sec[k].avg-rs.sec[k].avg);const k=diffs.indexOf(Math.min(...diffs.filter(Number.isFinite)));return Number.isFinite(diffs[k])&&diffs[k]<0?`<b>${esc(d.name.replace(/#\d+$/,''))}</b> ti batte soprattutto nel settore ${k+1} (${fx(-diffs[k],3)} s di media).`:`${esc(d.name.replace(/#\d+$/,''))}: nessun settore più veloce di te in media.`;}).join('<br>')}</p>`:''}`:'';
  };
  draw();
  const cs=$('#pcCls');if(cs)cs.onchange=e=>{PACE.cls=e.target.value;PACE.sel=null;wirePace(sess,me);};
}
