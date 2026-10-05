// ================= REFERENCE LAPS =================
function isRef(S){const v=LS.get('ref:'+S.id,null);if(v!=null)return v;return /(^|[^a-z])go[ _v]|refer|\bref\b|\bpro\b/i.test(S.file||'');}
function bestValid(S){return S.best||S.laps.filter(l=>l.complete).sort((a,b)=>a.time-b.time)[0]||null;}
function refOptions(S){
  const same=lds().filter(x=>x.meta.venue===S.meta.venue);const opts=[];
  same.filter(x=>x!==S&&isRef(x)).forEach(x=>{const l=bestValid(x);if(l)opts.push([x.id+'|'+l.i,`★ ${(x.meta.driver||'riferimento').replace(/#\d+$/,'')} · ${fmtLap(l.time)} · ${x.label}`]);});
  const own=bestValid(S);if(own)opts.push([S.id+'|'+own.i,`Il tuo miglior giro · ${fmtLap(own.time)} (giro ${own.num})`]);
  same.filter(x=>x!==S&&!isRef(x)).forEach(x=>{const l=bestValid(x);if(l)opts.push([x.id+'|'+l.i,`${(x.meta.driver||'').replace(/#\d+$/,'')} · ${fmtLap(l.time)} · ${x.label}`]);});
  return opts;
}
function pickRef(v){const [id,i]=v.split('|');const RS=byId(id);return RS?{S:RS,lap:RS.laps[+i]}:null;}

// ---- per-corner driving metrics inside a reference segment
function cornerMetrics(g,c){
  const v=g.get('Ground Speed'),br=g.get('Brake Pos'),th=g.get('Throttle Pos'),st=g.get('Steering'),t=g.t,d=g.d,n=g.n;
  const s=Math.max(0,c.s),e=Math.min(n-1,c.e);let iMin=s;for(let i=s;i<=e;i++)if(v[i]<v[iMin])iMin=i;
  const m={segT:t[e]-t[s],vMin:v[iMin],dMin:d[iMin]};
  let bs=-1;if(br){let gap=0;for(let j=iMin;j>=Math.max(0,s-5,iMin-300);j--){if(br[j]>8){bs=j;gap=0;}else if(bs>=0&&br[j]<=2){if(++gap>15)break;}}}
  if(bs>=0){let be=bs;for(let j=bs;j<Math.min(n,iMin+120);j++){if(br[j]>2)be=j;}m.brake=d[bs];m.brakeV=v[bs];let pk=0;for(let j=bs;j<=be;j++)pk=Math.max(pk,br[j]);m.peak=pk;
    if(st){let smax=0;for(let j=bs;j<=iMin;j++)smax=Math.max(smax,Math.abs(st[j]));let turn=-1;for(let j=bs;j<=iMin;j++)if(Math.abs(st[j])>=smax*0.5){turn=j;break;}m.trail=turn>=0?br[turn]:NaN;let k=0,tot=0;for(let j=bs;j<=be;j++){tot++;if(Math.abs(st[j])>smax*0.25)k++;}m.trailPct=tot?k/tot*100:NaN;}
    m.brakeLen=d[be]-d[bs];}
  if(th){let ts=-1;for(let j=Math.max(bs>=0?bs:s,s);j<=e;j++){if(j>=iMin-40&&th[j]>5){ts=j;break;}}
    let tf=-1;if(ts>=0)for(let j=ts;j<=e;j++)if(th[j]>=95){tf=j;break;}
    m.fullThr=tf>=0?d[tf]:NaN;m.thrTime=ts>=0&&tf>=0?t[tf]-t[ts]:NaN;
    let lifts=0,mx=0;if(ts>=0)for(let j=ts;j<=(tf>=0?tf:e);j++){mx=Math.max(mx,th[j]);if(th[j]<mx-25){lifts++;mx=th[j];}}m.lifts=lifts;
    let coast=0;const a=bs>=0?bs:s,b=ts>=0?ts:e;for(let j=a;j<b;j++)if(th[j]<5&&(!br||br[j]<5))coast+=t[j+1]-t[j];m.coast=coast;}
  return m;
}
function refSegments(g0){const cr=detectCorners(g0);const segs=[];if(!cr.length)return [{name:'Giro',s:0,e:g0.n-1}];if(cr[0].s>5)segs.push({name:'Partenza',s:0,e:cr[0].s});cr.forEach(c=>segs.push({name:'T'+c.k,s:c.s,e:c.e,c}));const last=cr[cr.length-1];if(g0.n-1-last.e>5)segs.push({name:'Arrivo',s:last.e,e:g0.n-1});return segs;}

// ================= COACH =================
RENDER.coach=()=>{
  const S=active()?.S;const ids=['#coIdeal','#coTips','#coStyle','#coCons','#coGGtxt'];
  if(!S){ids.forEach(i=>$(i).innerHTML='');$('#coIdeal').innerHTML='<div class="empty">Scegli una telemetria .ld in alto.</div>';return;}
  const rs=$('#coRef');const newRef=rs.dataset.sess!==S.id;if(newRef){opt(rs,refOptions(S),false);rs.dataset.sess=S.id;}
  const ls=$('#coLap');if(ls.dataset.sess!==S.id||newRef){const prev=ls.dataset.sess===S.id?ls.value:null;opt(ls,lapOptions(S).filter(([i])=>S.laps[+i].complete),false);const b=bestValid(S),r0=pickRef(rs.value||'');
    let d=b;if(r0&&r0.S===S){const alt=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&l!==r0.lap).sort((a,c)=>a.time-c.time)[0];if(alt)d=alt;}
    ls.value=prev??(d?String(d.i):ls.value);ls.dataset.sess=S.id;}
  const R=pickRef(rs.value),lap=S.laps[+ls.value];if(!R||!lap){$('#coIdeal').innerHTML='<div class="empty">Serve almeno un giro completo.</div>';return;}
  const g0=lapGrid(R.S,R.lap,2),segs=refSegments(g0),corners=segs.filter(s=>s.c);
  // --- ideal lap
  const laps=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid);
  const grids=laps.map(l=>({l,g:lapGrid(S,l,2,g0.len)}));
  if(grids.length>=2){
    const rows=segs.map(sg=>{const ts=grids.map(({l,g})=>({l,t:g.t[sg.e]-g.t[sg.s]}));const best=ts.reduce((a,b)=>a.t<b.t?a:b);const bl=bestValid(S);const inBest=ts.find(x=>x.l===bl)?.t;return {sg,best,inBest,gain:inBest-best.t};});
    const ideal=rows.reduce((a,r)=>a+r.best.t,0),bl=bestValid(S),pot=bl.time-ideal;
    const mx=Math.max(...rows.map(r=>r.gain));
    $('#coIdeal').innerHTML=`<div class="kpis" style="margin-bottom:12px"><div class="kpi hl"><div class="l">Giro ideale</div><div class="v">${fmtLap(ideal)}</div><div class="s">da ${grids.length} giri validi</div></div><div class="kpi"><div class="l">Tuo miglior giro</div><div class="v">${fmtLap(bl.time)}</div><div class="s">giro ${bl.num}</div></div><div class="kpi"><div class="l">Tempo già nelle tue mani</div><div class="v" style="color:var(--good)">${fx(pot,3)} s</div><div class="s">senza cambiare setup</div></div></div>
    <div class="tw"><table><thead><tr><th>Tratto</th><th>Migliore</th><th>Nel giro</th><th>Nel tuo best</th><th>Guadagno</th><th class="l" style="width:40%"></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.sg.name}</td><td>${fx(r.best.t,3)}</td><td>${r.best.l.num}</td><td>${fx(r.inBest,3)}</td><td class="${r.gain>0.02?'pos':''}">${r.gain>0.0005?'−'+fx(r.gain,3):'—'}</td><td class="l"><span style="display:inline-block;height:8px;border-radius:4px;background:var(--good);width:${mx>0?Math.max(0,r.gain/mx*100):0}%"></span></td></tr>`).join('')}</tbody></table></div>`;
  }else $('#coIdeal').innerHTML='<div class="note">Servono almeno 2 giri validi lanciati nella stessa sessione per costruire il giro ideale.</div>';
  // --- style vs reference
  const gm=lapGrid(S,lap,2,g0.len),same=R.S===S&&R.lap===lap;
  const cm=corners.map(sg=>({sg,me:cornerMetrics(gm,sg.c),rf:cornerMetrics(g0,sg.c)}));
  const tips=[];
  cm.forEach(({sg,me,rf})=>{const dt=me.segT-rf.segT;const why=[];
    if(me.brake!=null&&rf.brake!=null&&rf.brake-me.brake>8)why.push(`freni ${fx(rf.brake-me.brake,0)} m prima`);
    if(me.brake!=null&&rf.brake!=null&&me.brake-rf.brake>8&&me.vMin<rf.vMin-2)why.push(`freni ${fx(me.brake-rf.brake,0)} m dopo ma entri troppo forte e perdi velocità minima`);
    if(Number.isFinite(me.trail)&&Number.isFinite(rf.trail)&&rf.trail-me.trail>12)why.push(`all'inserimento hai ${fx(me.trail,0)}% di freno contro ${fx(rf.trail,0)}%: porta più freno dentro la curva`);
    if(me.coast-rf.coast>0.15)why.push(`${fx(me.coast,2)} s senza pedali (rif. ${fx(rf.coast,2)} s)`);
    if(rf.vMin-me.vMin>3)why.push(`velocità minima ${fx(me.vMin,0)} contro ${fx(rf.vMin,0)} km/h`);
    if(Number.isFinite(me.fullThr)&&Number.isFinite(rf.fullThr)&&me.fullThr-rf.fullThr>15)why.push(`gas pieno ${fx(me.fullThr-rf.fullThr,0)} m più tardi`);
    if(me.lifts>rf.lifts)why.push(`rialzi il gas in uscita (${me.lifts}×)`);
    if(me.peak&&rf.peak&&rf.peak-me.peak>10)why.push(`pressione massima sul freno ${fx(me.peak,0)}% contro ${fx(rf.peak,0)}%`);
    if(dt>0.03&&why.length)tips.push({sg,dt,why});});
  tips.sort((a,b)=>b.dt-a.dt);
  $('#coTips').innerHTML=same?'<div class="note">Stai confrontando il giro con sé stesso: scegli un altro giro o un riferimento diverso.</div>':tips.length?`<div class="diag">${tips.slice(0,6).map(t=>`<div class="card warn"><span class="st"><span class="dot warn"></span>${t.sg.name}<em>${fsign(t.dt,3)} s</em></span><ul>${t.why.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`).join('')}</div>`:'<div class="note">Nessuna differenza di tecnica evidente rispetto al riferimento.</div>';
  const c2=(a,b,d=0,u='')=>`${Number.isFinite(a)?fx(a,d):'—'}<span class="muted"> / ${Number.isFinite(b)?fx(b,d):'—'}</span>${u}`;
  $('#coStyle').innerHTML=`<table><thead><tr><th>Curva</th><th>Δ tratto</th><th>Frenata m</th><th>Freno max %</th><th>Freno all'inserimento %</th><th>Senza pedali s</th><th>Vel. min</th><th>Apertura gas s</th><th>Rialzi gas</th></tr></thead><tbody>${cm.map(({sg,me,rf})=>{const dt=me.segT-rf.segT;return `<tr class="clickable" data-d="${g0.d[sg.c.apex]}"><td>${sg.name}</td><td class="${dt>0.03?'neg':dt<-0.03?'pos':''}">${fsign(dt,3)}</td><td>${c2(me.brake,rf.brake)}</td><td>${c2(me.peak,rf.peak)}</td><td>${c2(me.trail,rf.trail)}</td><td>${c2(me.coast,rf.coast,2)}</td><td>${c2(me.vMin,rf.vMin)}</td><td>${c2(me.thrTime,rf.thrTime,2)}</td><td>${c2(me.lifts,rf.lifts)}</td></tr>`;}).join('')}</tbody></table><p class="muted small">Valori: tuo / riferimento. «Freno all'inserimento» = quanta pressione hai ancora quando lo sterzo arriva a metà: più alta = più trail braking. «Apertura gas» = tempo da quando riapri a gas pieno.</p>`;
  $$('#coStyle tr.clickable').forEach(tr=>tr.onclick=()=>{goCompare(R.S,R.lap,S,lap,+tr.dataset.d);});
  // --- consistency
  if(grids.length>=3){
    const rows=corners.map(sg=>{const ms=grids.map(({g})=>cornerMetrics(g,sg.c));const sd=k=>std(ms.map(m=>m[k]).filter(Number.isFinite)),mn=k=>mean(ms.map(m=>m[k]).filter(Number.isFinite));return {sg,bs:sd('brake'),bm:mn('brake'),vs:sd('vMin'),vm:mn('vMin'),fs:sd('fullThr'),ts:sd('segT')};});
    const worst=Math.max(...rows.map(r=>r.ts));
    $('#coCons').innerHTML=`<table><thead><tr><th>Curva</th><th>Frenata ± m</th><th>Vel. min ± km/h</th><th>Gas pieno ± m</th><th>Tempo ± s</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.sg.name}${r.ts===worst?' <span class="tag warn">meno costante</span>':''}</td><td>${fx(r.bm,0)} ± ${fx(r.bs,0)}</td><td>${fx(r.vm,0)} ± ${fx(r.vs,1)}</td><td>± ${fx(r.fs,0)}</td><td>± ${fx(r.ts,3)}</td></tr>`).join('')}</tbody></table><p class="muted small">± = deviazione standard su ${grids.length} giri validi. Parti dalla curva meno costante: fissa un riferimento visivo per la frenata.</p>`;
  }else $('#coCons').innerHTML=`<div class="note">Servono almeno 3 giri validi lanciati (qui ${grids.length}).</div>`;
  drawGG(gm,g0,same);
};
function goCompare(RS,rl,S,lap,d){showView('cmp');$('#cmpSessA').value=RS.id;$('#cmpSessB').value=S.id;$('#cmpLapA').dataset.sess='';$('#cmpLapB').dataset.sess='';RENDER.cmp();$('#cmpLapA').value=String(rl.i);$('#cmpLapB').value=String(lap.i);RENDER.cmp();if(d!=null)cmpChart.setRange(d-300,d+250);}
function envelope(glat,glong){const bins=new Array(36).fill(0).map(()=>[]);for(let i=0;i<glat.length;i++){const x=glat[i],y=glong[i];if(!Number.isFinite(x)||!Number.isFinite(y))continue;const r=Math.hypot(x,y);if(r<0.2)continue;const a=Math.atan2(y,x);const b=Math.floor(((a+Math.PI)/(2*Math.PI))*36)%36;bins[b].push(r);}return bins.map(b=>b.length>5?pct(b,0.97):NaN);}
function drawGG(gm,g0,same){
  const cv=$('#coGG');const {c,w,h}=fitCanvas(cv);c.clearRect(0,0,w,h);
  const la=gm.get('G Force Lat'),lo=gm.get('G Force Long'),ra=g0.get('G Force Lat'),ro=g0.get('G Force Long');if(!la||!lo){$('#coGGtxt').innerHTML='<div class="note">Canali G non presenti.</div>';return;}
  const mx=Math.max(2,pct(la.map(Math.abs),0.995),pct(lo.map(Math.abs),0.995),pct(ra.map(Math.abs),0.995))*1.1;const cx=w/2,cy=h/2,sc=(Math.min(w,h)/2-18)/mx;
  c.strokeStyle=tok('grid');c.lineWidth=1;for(let r=0.5;r<=mx;r+=0.5){c.beginPath();c.arc(cx,cy,r*sc,0,7);c.stroke();}
  c.strokeStyle=tok('line');c.beginPath();c.moveTo(cx,10);c.lineTo(cx,h-10);c.moveTo(10,cy);c.lineTo(w-10,cy);c.stroke();
  c.fillStyle=tok('faint');c.font='11px "IBM Plex Mono",monospace';c.textAlign='center';c.fillText('frenata',cx,14);c.fillText('trazione',cx,h-6);c.textAlign='left';c.fillText('1 G',cx+sc+3,cy-4);
  c.fillStyle=tok('lapB');c.globalAlpha=.25;for(let i=0;i<la.length;i+=2){c.fillRect(cx+la[i]*sc-1,cy-lo[i]*sc-1,2,2);}c.globalAlpha=1;
  const env=(E,col,dash)=>{c.strokeStyle=col;c.lineWidth=2;c.setLineDash(dash?[5,4]:[]);c.beginPath();let st=false;for(let k=0;k<=36;k++){const b=k%36,r=E[b];if(!Number.isFinite(r)){st=false;continue;}const a=(b+0.5)/36*2*Math.PI-Math.PI;const x=cx+Math.cos(a)*r*sc,y=cy-Math.sin(a)*r*sc;st?c.lineTo(x,y):c.moveTo(x,y);st=true;}c.stroke();c.setLineDash([]);};
  const Em=envelope(la,lo),Er=envelope(ra,ro);env(Er,tok('lapA'),true);env(Em,tok('lapB'),false);
  const q=(E,from,to)=>mean(E.filter((_,b)=>{const a=((b+0.5)/36*360-180+360)%360;return from<to?a>=from&&a<to:a>=from||a<to;}));
  const comb=(q(Em,30,60)+q(Em,120,150))/(q(Er,30,60)+q(Er,120,150)),lat=(q(Em,345,15)+q(Em,165,195))/(q(Er,345,15)+q(Er,165,195)),brk=q(Em,75,105)/q(Er,75,105);
  $('#coGGtxt').innerHTML=`<div class="legend" style="justify-content:center"><span><i style="background:var(--lapB)"></i>tuo giro</span><span><i style="background:var(--lapA)"></i>riferimento (tratteggio)</span></div>${same?'':`<p class="small" style="text-align:center;margin:6px 0 0">Aderenza usata rispetto al riferimento: frenata <b>${fx(brk*100,0)}%</b> · curva pura <b>${fx(lat*100,0)}%</b> · frenata + curva insieme <b>${fx(comb*100,0)}%</b></p><p class="muted small" style="text-align:center">Se il valore combinato è il più basso, stai separando troppo frenata e sterzata: prova a rilasciare il freno più gradualmente mentre inserisci.</p>`}`;
}

// ================= DIARY =================
function sessDate(S){const m=(S.meta.date||'').match(/(\d+)\/(\d+)\/(\d+)/),t=(S.meta.time||'0:0:0').split(':');return m?new Date(+m[3],+m[2]-1,+m[1],+t[0]||0,+t[1]||0).getTime():0;}
function runSummary(S){
  const key='run';if(S.cache.has(key))return S.cache.get(key);
  const fl=S.laps.filter(l=>l.complete&&l.type==='lanciato'),valid=fl.filter(l=>!l.invalid);const b=bestValid(S);
  const pace=valid.filter(l=>b&&l.time<=b.time*1.05);const st=fl.map(l=>lapStats(S,l));
  const av=(ax)=>mean(st.map(s=>mean(ax.map(w=>mean([s.w[w].I,s.w[w].C,s.w[w].O])))));
  const B=fl.length?balance(S,fl.slice(0,6)):null,SL=fl.length?slipEvents(S,fl.slice(0,6)):null;
  const o={best:b,pace:mean(pace.map(l=>l.time)),n:fl.length,tf:av(['FL','FR']),tr:av(['RL','RR']),vmax:Math.max(...st.map(s=>s.vmax)),B,SL,track:S.cond.track?.avg};
  S.cache.set(key,o);return o;
}
function svmDiff(a,b){const rows=[];const secs=new Set([...Object.keys(a.sec),...Object.keys(b.sec)]);const WN={FRONTLEFT:'ant. sx',FRONTRIGHT:'ant. dx',REARLEFT:'post. sx',REARRIGHT:'post. dx'};
  for(const s of secs){const A=a.sec[s]||[],B=b.sec[s]||[];const keys=new Set([...A.map(x=>x.key),...B.map(x=>x.key)]);for(const k of keys){const x=A.find(i=>i.key===k),y=B.find(i=>i.key===k);const da=x?(x.disp||x.raw):'—',db=y?(y.disp||y.raw):'—';if(da!==db&&!/Notes/.test(k))rows.push({label:(SETUP_LABELS[k]||k)+(WN[s]?' '+WN[s]:''),a:da,b:db,sec:SETUP_GROUPS[s]||(WN[s]?'Ruote':s)});}}
  // merge symmetric corners
  const out=[];for(const r of rows){const base=r.label.replace(/ (ant|post)\. (sx|dx)$/,'');const m=r.label.match(/ (ant|post)\. (sx|dx)$/);if(m){const twin=out.find(o=>o.base===base&&o.axle===m[1]&&o.a===r.a&&o.b===r.b);if(twin){twin.label=base+' '+m[1]+'.';continue;}out.push({...r,base,axle:m[1]});}else out.push(r);}
  return out;
}
RENDER.diary=()=>{
  const runs=lds().slice().sort((a,b)=>sessDate(a)-sessDate(b));const S0=active()?.S;
  const venues=[...new Set(runs.map(r=>r.meta.venue))];
  const suOpts=[['','— setup non indicato —'],...svms().map(s=>[s.id,s.label])];
  $('#diRuns').innerHTML=venues.map(v=>{const rs=runs.filter(r=>r.meta.venue===v);return `<div class="panel"><div class="panel-h"><h3>${esc(v)}</h3><span class="hint">${rs.length} ${rs.length===1?'prova':'prove'}</span></div><div style="display:grid;gap:12px">${rs.map((S,k)=>diaryRow(S,k?rs[k-1]:null,suOpts)).join('')}</div>${rs.length<2?'<p class="muted small" style="margin:10px 0 0">Carica un’altra telemetria su questa pista con un setup diverso: qui vedrai cosa hai cambiato e che effetto ha avuto.</p>':''}</div>`;}).join('')||'<div class="panel empty">Carica almeno una telemetria .ld.</div>';
  $$('#diRuns select[data-run]').forEach(s=>{s.value=LS.get('runsu:'+s.dataset.run,'');s.onchange=()=>{LS.set('runsu:'+s.dataset.run,s.value);RENDER.diary();};});
  $$('#diRuns textarea[data-note]').forEach(t=>{t.value=LS.get('note:'+t.dataset.note,'');t.oninput=()=>LS.set('note:'+t.dataset.note,t.value);});
  // setup vs setup
  opt($('#diA'),svms().map(s=>[s.id,s.label]));opt($('#diB'),svms().map(s=>[s.id,s.label]));if(!$('#diB').dataset.init&&svms().length>1){$('#diB').value=svms()[1].id;$('#diB').dataset.init=1;}
  const a=byId($('#diA').value),b=byId($('#diB').value);
  if(!a||!b){$('#diDiff').innerHTML='<div class="note">Carica almeno un file .svm.</div>';}
  else if(a===b){$('#diDiff').innerHTML='<div class="note">Scegli due setup diversi (ne hai caricato '+svms().length+').</div>';}
  else{const d=svmDiff(a,b);$('#diDiff').innerHTML=d.length?`<table><thead><tr><th>Gruppo</th><th class="l">Parametro</th><th>A</th><th>B</th></tr></thead><tbody>${d.map(r=>`<tr><td class="l" style="font-family:var(--f-body)">${esc(r.sec)}</td><td class="l" style="font-family:var(--f-body)">${esc(r.label)}</td><td>${esc(r.a)}</td><td><b>${esc(r.b)}</b></td></tr>`).join('')}</tbody></table>`:'<div class="note">I due setup sono identici.</div>';}
};
function diaryRow(S,prev,suOpts){
  const r=runSummary(S),su=byId(LS.get('runsu:'+S.id,''));
  const ph=r.B?.phases;const bal=ph?['entrata','centro','uscita'].map(k=>`${k[0].toUpperCase()+k.slice(1,3)}. ${fx(ph[k].steerIdx,2)}`).join(' · '):'—';
  let changes='';
  if(prev){const p=runSummary(prev),psu=byId(LS.get('runsu:'+prev.id,''));
    const diff=su&&psu&&su!==psu?svmDiff(psu,su):null;
    const dB=r.best&&p.best?r.best.time-p.best.time:NaN,dP=r.pace-p.pace;
    let seg='';if(r.best&&p.best){const g0=lapGrid(prev,p.best,2),segs=refSegments(g0),g1=lapGrid(S,r.best,2,g0.len);const ds=segs.map(s=>({n:s.name,d:(g1.t[s.e]-g1.t[s.s])-(g0.t[s.e]-g0.t[s.s])})).sort((a,b)=>a.d-b.d);const gain=ds.filter(x=>x.d<-0.02).slice(0,3),loss=ds.filter(x=>x.d>0.02).slice(-3).reverse();seg=`${gain.length?'Guadagni: '+gain.map(x=>`${x.n} <span class="pos mono">${fsign(x.d,2)}</span>`).join(', '):''}${loss.length?`${gain.length?' · ':''}Perdite: `+loss.map(x=>`${x.n} <span class="neg mono">${fsign(x.d,2)}</span>`).join(', '):''}`;}
    changes=`<div class="fix" style="background:var(--panel2);border-radius:6px;padding:9px 11px;font-size:.86rem"><b style="font-family:var(--f-display);letter-spacing:.05em;text-transform:uppercase;font-size:.74rem;color:var(--accent)">Rispetto alla prova precedente</b><br>
      ${diff?(diff.length?'Setup cambiato: '+diff.slice(0,6).map(d=>`${esc(d.label)} <span class="mono">${esc(d.a)}→${esc(d.b)}</span>`).join(', ')+(diff.length>6?` e altri ${diff.length-6}`:''):'Setup identico.'):(su&&psu?'Stesso file setup.':'Indica il setup delle due prove per vedere cosa è cambiato.')}<br>
      Best <b class="mono ${dB<0?'pos':'neg'}">${fsign(dB,3)} s</b> · passo <b class="mono ${dP<0?'pos':'neg'}">${fsign(dP,3)} s</b> · gomme ant. ${fsign(r.tf-p.tf,1)} °C, post. ${fsign(r.tr-p.tr,1)} °C · pista ${fsign(r.track-p.track,1)} °C${r.SL&&p.SL?` · pattinamento ${fsign(r.SL.spin-p.SL.spin,2)} s`:''}<br>${seg}</div>`;}
  return `<div class="card"><span class="st"><span class="dot ${r.best?'good':''}"></span>${esc(S.meta.date)} ${esc((S.meta.time||'').slice(0,5))} · ${esc((S.meta.driver||'').replace(/#\d+$/,''))}<em>${esc(S.file)}</em></span>
   <div class="row" style="align-items:flex-end"><label class="f" style="flex:1 1 240px">Setup usato<select data-run="${esc(S.id)}">${suOpts.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label><label class="f" style="flex:2 1 300px">Note<textarea data-note="${esc(S.id)}" style="min-height:38px" placeholder="Sensazioni, cosa volevi provare…"></textarea></label></div>
   <div class="kpis"><div class="kpi"><div class="l">Best</div><div class="v">${r.best?fmtLap(r.best.time):'—'}</div></div><div class="kpi"><div class="l">Passo</div><div class="v">${fmtLap(r.pace)}</div><div class="s">${r.n} giri lanciati</div></div><div class="kpi"><div class="l">Gomme ant / post</div><div class="v">${fx(r.tf,0)}° / ${fx(r.tr,0)}°</div><div class="s">pista ${fx(r.track,1)}°</div></div><div class="kpi"><div class="l">Bilanciamento</div><div class="v txt" style="font-size:1rem">${bal}</div><div class="s">&gt;1 sottosterzo · &lt;1 sovrasterzo</div></div><div class="kpi"><div class="l">Bloccaggi / pattinamento</div><div class="v">${r.SL?fx(r.SL.lockF+r.SL.lockR,2)+' / '+fx(r.SL.spin,2):'—'}</div><div class="s">s per giro</div></div></div>${changes}</div>`;
}
