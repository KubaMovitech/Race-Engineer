// ================= 2.11: comparable laps, guided setup test, one shape for every piece of advice =================

// ---------- 1. comparable laps: what can make two laps differ apart from the driving and the setup ----------
function lapComp(S,lap){const k='lc'+lap.i;if(S.cache.has(k))return S.cache.get(k);const at=(n,t)=>S.ch[n]?sampleAt(S.ch[n],t):NaN;
  const W=['FL','FR','RL','RR'];let wear=W.map(w=>at('Tyre Wear '+w,lap.t0+0.5)).filter(Number.isFinite);wear=wear.length?wear.reduce((a,b)=>a+b,0)/wear.length:NaN;
  if(Number.isFinite(wear)&&wear<=1.0001)wear*=100;   // the channel is a fraction in some files, a percentage in others
  const c=lapConditions(S,lap);
  const o={S,lap,fuel:at('Fuel Level',lap.t0+0.5),wear,track:c.track,wet:Math.max(c.rain||0,c.wet||0)>0.05,car:typeof proCarOf==='function'?proCarOf(S):(S.meta?.car||'')};
  S.cache.set(k,o);return o;}
// the differences that matter, in words; empty = comparable
function compDiffs(a,b){const D=[];const f=(x,d)=>(x>0?'+':'−')+Math.abs(x).toFixed(d);
  if(Number.isFinite(a.fuel)&&Number.isFinite(b.fuel)&&Math.abs(b.fuel-a.fuel)>5)D.push({k:'fuel',w:Math.abs(b.fuel-a.fuel)/5,t:`${tr('carburante')} ${f(b.fuel-a.fuel,0)} L`});
  if(Number.isFinite(a.wear)&&Number.isFinite(b.wear)&&Math.abs(b.wear-a.wear)>1.5)D.push({k:'wear',w:Math.abs(b.wear-a.wear)/1.5,t:`${tr('gomme')} ${Math.abs(b.wear-a.wear).toFixed(1)}% ${b.wear<a.wear?tr('più consumate'):tr('più nuove')}`});
  if(Number.isFinite(a.track)&&Number.isFinite(b.track)&&Math.abs(b.track-a.track)>3)D.push({k:'track',w:Math.abs(b.track-a.track)/3,t:`${tr('pista')} ${f(b.track-a.track,0)} °C`});
  if(a.wet!==b.wet)D.push({k:'wet',w:4,t:b.wet?tr('B sul bagnato'):tr('B sull\'asciutto')});
  if(b.lap.type!=='lanciato')D.push({k:'type',w:3,t:`B: ${tr(b.lap.type)}`});
  if(b.lap.invalid)D.push({k:'inv',w:1,t:tr('B non valido')});
  if(a.car&&b.car&&a.car!==b.car)D.push({k:'car',w:2,t:`${tr('auto diversa')} (${esc(b.car)})`});
  return D;}
// the laps of this track that are closest in conditions to A, among the reasonably fast ones
function compSuggest(SA,lA,n=3){const a=lapComp(SA,lA);const ven=SA.meta?.venue;const out=[];
  lds().filter(S=>!S.sample&&S.meta?.venue===ven).forEach(S=>{const best=S.best?.time;S.laps.filter(l=>l.complete&&!(S===SA&&l.i===lA.i)&&(!best||l.time<=best*1.03)).forEach(l=>{const b=lapComp(S,l);const D=compDiffs(a,b);out.push({S,l,D,score:D.reduce((s,d)=>s+d.w,0)+(l.time-(best||l.time))*0.5});});});
  return out.sort((x,y)=>x.score-y.score||x.l.time-y.l.time).slice(0,n);}

function compPanelHTML(){const SA=TW.SA,lA=SA?.laps.find(l=>l.i===TW.a);if(!lA)return '';const SB=TW.SB,lB=SB?.laps.find(l=>l.i===TW.b);
  const now=lB?compDiffs(lapComp(SA,lA),lapComp(SB,lB)):null;const sug=compSuggest(SA,lA);
  const lapTxt=(S,l)=>`${S===SA?'':esc((S.meta?.date||'')+' ')}${tr('G')}${l.num} · ${fmtLap(l.time)}`;
  return `<div class="panel pcomp"><div class="panel-h"><h3>${tr('Confronto equo')}</h3><span class="muted small">${tr('carburante, gomme, pista e tipo di giro di A e B')}</span></div>
    ${now?(now.length?`<div class="pcw2"><b>⚠ ${tr('A e B non sono nelle stesse condizioni')}:</b> ${now.map(d=>`<span>${d.t}</span>`).join('')}<small>${tr('Le differenze di tempo possono venire da qui e non dalla guida.')}</small></div>`
      :`<div class="pcok">✓ ${tr('A e B sono confrontabili: stesso tipo di giro, carburante, gomme e pista simili.')}</div>`):`<p class="muted small">${tr('Scegli un giro B o usa uno di quelli suggeriti.')}</p>`}
    ${sug.length?`<div class="psug"><span class="muted small">${tr('Giri più confrontabili con A')}:</span>${sug.map(x=>`<button type="button" class="btn psb${SB===x.S&&TW.b===x.l.i?' on':''}" data-s="${esc(x.S.id)}" data-l="${x.l.i}"><b>${lapTxt(x.S,x.l)}</b><small>${x.D.length?x.D.map(d=>d.t).join(' · '):tr('stesse condizioni')}</small></button>`).join('')}</div>`:''}</div>`;}
(function(){const rt=RENDER.tele;RENDER.tele=()=>{rt();const head=$('#twBody .twhead');if(!head||!TW.SA)return;
  try{head.insertAdjacentHTML('afterend',compPanelHTML());
    $$('#twBody .psb').forEach(b=>b.onclick=()=>{const S=byId(b.dataset.s);if(!S)return;TW.SB=S;TW.b=+b.dataset.l;TW.auto=false;RENDER.tele();});}catch(e){console.error(e);}};})();

// ---------- 2. guided setup test: hypothesis, one change, what to measure, result ----------
// which measured number answers each kind of problem (the same table as «Il cambio ha funzionato?»)
const PT_MAP=[[/bloccagg[\s\S]*post/i,'lockR'],[/bloccagg/i,'lockF'],[/pattin|trazione|in uscita col gas/i,'spin'],[/fondo|tocca|packer|altezz/i,'rhLow'],
  [/curve veloci|nel veloce/i,'veloci'],[/curve lente|nel lento/i,'lente'],[/ingresso|inserimento/i,'entrata'],[/centro curva/i,'centro'],[/uscita/i,'uscita'],
  [/carcassa post|posteriori.*temperatura|temperatura.*post/i,'cR'],[/carcassa|anteriori.*temperatura|temperatura.*ant/i,'cF']];
function ptMetric(f){const m=PT_MAP.find(([re])=>re.test(f.t));return m?m[1]:'pace';}
const ptKpi=k=>ENG_KPI.find(x=>x[0]===k);
const ptWin=()=>{const c=typeof cfg==='function'?cfg():{};return [c.tmin??75,c.tmax??95];};
function ptVal(h,k){const v=kpiVal(h,k);const K=ptKpi(k);return Number.isFinite(v)?v*(K?.[5]||1):NaN;}
// what the number has to do, in words
function ptGoal(k){const K=ptKpi(k);if(!K)return '';if(K[4]==='n')return tr('avvicinarsi a 1 (auto neutra)');if(K[4]===0){const [a,b]=ptWin();return `${tr('stare tra')} ${a} ${tr('e')} ${b} °C`;}return K[4]<0?tr('scendere'):tr('salire');}
// before → now: «migliorato», «peggiorato» or «inconcludente», with the reason
function ptJudge(k,a,b){if(!Number.isFinite(a)||!Number.isFinite(b))return {r:'inc',why:tr('manca il dato in una delle due prove')};const K=ptKpi(k);
  const MIN={pace:0.1,best:0.1,lockF:0.05,lockR:0.05,spin:0.05,rhLow:1,cF:2,cR:2};
  if(K[4]==='n'){const d=Math.abs(b-1)-Math.abs(a-1);return Math.abs(d)<0.03?{r:'inc',why:tr('differenza troppo piccola')}:{r:d<0?'ok':'ko'};}
  if(K[4]===0){const [lo,hi]=ptWin();const out=x=>x<lo?lo-x:x>hi?x-hi:0;const d=out(b)-out(a);return Math.abs(d)<MIN[k]?{r:'inc',why:tr('differenza troppo piccola')}:{r:d<0?'ok':'ko'};}
  const d=(b-a)*K[4];const need=Math.max(MIN[k]??0.02,Math.abs(a)*0.1);return Math.abs(b-a)<need?{r:'inc',why:tr('differenza troppo piccola')}:{r:d>0?'ok':'ko'};}
const PT_R={ok:['Migliorato','pos'],ko:['Peggiorato','neg'],inc:['Inconcludente','muted']};
function ptSnap(S,D,laps){const P=typeof proPace==='function'?proPace(S):null;const su=D.su;
  return {id:S.id,when:`${S.meta?.date||''} ${(S.meta?.time||'').slice(0,5)}`,m:engMetrics(D,S,laps),pace:P?.t,best:S.best?.time,n:laps.length,lm:engLapMode(),
    track:S.cond?.track?.avg,cond:S.cond?.label,su:su?.name||'',fuel:su?suFind(su,'GENERAL',/^FuelCapacity/)||suFind(su,'GENERAL',/^FuelSetting/):null,cmp:su?suFind(su,'FRONTLEFT',/^CompoundSetting/):null,
    val:null};}
function ptAll(){return LS.get('ptests',[]);}
function ptSave(L){LS.set('ptests',L.slice(-40));}
function ptActive(S){const car=(proCarOf(S)||'').toLowerCase();return ptAll().find(t=>!t.closed&&t.venue===S.meta?.venue&&(t.car||'').toLowerCase()===car)||null;}
function ptStart(S,D,laps,f){const x=f.fx.find(x=>!x.conflict)||{};const k=ptMetric(f);const L=ptAll().filter(t=>!(t.venue===S.meta?.venue&&!t.closed&&(t.car||'').toLowerCase()===(proCarOf(S)||'').toLowerCase()));
  const base=ptSnap(S,D,laps);if(x.key&&D.su)base.val=suValAny(D.su,x.key);
  L.push({id:'pt'+Date.now(),at:Date.now(),venue:S.meta?.venue||'',car:proCarOf(S),problem:f.t,change:{label:x.label||'',dir:x.dir||'',key:x.key||'',now:x.now||''},metric:k,
    hyp:`${tr(x.label||'')}: ${x.dir||''} → ${f.t}: ${ptGoal(k)}`,base});ptSave(L);}
function suValAny(su,key){for(const it of Object.values(su?.sec||{})){const x=it.find(i=>i.key===key);if(x)return x.disp;}return null;}
function ptHTML(t,S,D,laps){const K=ptKpi(t.metric);const lab=tr(K?.[1]||t.metric),u=K?.[2]||'',dp=K?.[3]??2;const same=t.base.id===S.id;
  let res='';if(!same&&D&&D.S===S){const cur=ptSnap(S,D,laps);const a=ptVal(t.base,t.metric),b=ptVal(cur,t.metric);const J=ptJudge(t.metric,a,b);
    const pa=t.base.pace,pb=cur.pace;const W=[];
    if(t.base.fuel&&cur.fuel&&t.base.fuel!==cur.fuel)W.push(`${tr('carburante diverso')} (${esc(t.base.fuel)} → ${esc(cur.fuel)})`);
    if(t.base.cmp&&cur.cmp&&t.base.cmp!==cur.cmp)W.push(`${tr('mescola diversa')} (${esc(t.base.cmp)} → ${esc(cur.cmp)})`);
    if(t.base.cond&&cur.cond&&t.base.cond!==cur.cond)W.push(`${tr('meteo diverso')} (${esc(tr(t.base.cond))} → ${esc(tr(cur.cond))})`);
    if(Number.isFinite(t.base.track)&&Number.isFinite(cur.track)&&Math.abs(cur.track-t.base.track)>3)W.push(`${tr('pista')} ${cur.track>t.base.track?'+':'−'}${fx(Math.abs(cur.track-t.base.track),0)} °C`);
    if(t.base.n<3||cur.n<3)W.push(`${tr('pochi giri buoni')} (${t.base.n} → ${cur.n})`);
    const nowVal=t.change.key&&D.su?suValAny(D.su,t.change.key):null;const changed=t.base.val==null||nowVal==null?null:nowVal!==t.base.val;
    const r=W.length&&J.r!=='inc'?{r:'inc',why:tr('le condizioni sono cambiate: ripeti la prova con carburante, gomme e pista simili')}:changed===false?{r:'inc',why:tr('la modifica non risulta nel setup scelto')}:J;
    res=`<div class="ptres ${PT_R[r.r][1]}"><b>${tr(PT_R[r.r][0])}</b>${r.why?` · <span>${esc(r.why)}</span>`:''}</div>
      <table class="lbt ptt"><thead><tr><th class="l"></th><th>${tr('Prima')}</th><th>${tr('Ora')}</th></tr></thead><tbody>
      <tr><td class="l">${esc(lab)}</td><td>${fx(a,dp)} ${u}</td><td><b>${fx(b,dp)} ${u}</b></td></tr>
      <tr><td class="l">${tr('Passo')}</td><td>${Number.isFinite(pa)?fmtLap(pa):'—'}</td><td>${Number.isFinite(pb)?fmtLap(pb):'—'}</td></tr>
      ${t.change.key?`<tr><td class="l">${esc(tr(t.change.label))}</td><td>${esc(t.base.val||'—')}</td><td>${esc(nowVal||'—')}</td></tr>`:''}</tbody></table>
      ${W.length?`<div class="ecw"><b>${tr('Prima di fidarti del confronto')}:</b><ul>${W.map(w=>`<li>${w}</li>`).join('')}</ul></div>`:''}
      <div class="ppb"><button type="button" class="btn primary" data-pt="keep">${tr('Tengo la modifica')}</button><button type="button" class="btn" data-pt="back">${tr('Torno indietro')}</button><button type="button" class="btn" data-pt="drop">${tr('Annulla la prova')}</button></div>`;
    t._last={r:r.r,a,b,pa,pb,id:S.id};}
  return `<div class="panel ptest2"><div class="panel-h"><h3>${tr('Prova setup in corso')}</h3><span class="muted small">${tr('iniziata il')} ${new Date(t.at).toLocaleDateString()} · ${esc(t.base.when)} · ${esc(t.base.su||'')}</span></div>
    <div class="pthyp"><div><span>${tr('Ipotesi')}</span><input type="text" id="ptHyp" value="${esc(t.hyp)}"></div>
      <div><span>${tr('Problema')}</span><b>${esc(t.problem)}</b></div><div><span>${tr('Modifica')}</span><b>${esc(tr(t.change.label))}: ${esc(t.change.dir)}</b>${t.change.now?` <small class="muted">(${tr('era')} ${esc(t.change.now)})</small>`:''}</div>
      <div><span>${tr('Cosa misuro')}</span><b>${esc(lab)}</b> <small class="muted">${tr('deve')} ${ptGoal(t.metric)} · ${tr('prima')} ${fx(ptVal(t.base,t.metric),dp)} ${u}</small></div></div>
    ${same?`<p class="ptwait">${tr('Ora cambia solo questo nel gioco, fai 3–5 giri puliti con carburante e gomme simili e carica la telemetria (o lascia che arrivi da sola): qui comparirà il risultato.')}</p>`:res||`<p class="muted small">${tr('Scegli la telemetria della prova e il suo .svm.')}</p>`}
    ${same?`<div class="ppb"><button type="button" class="btn" data-pt="drop">${tr('Annulla la prova')}</button></div>`:''}</div>`;}
function ptHistHTML(S){const H=ptAll().filter(t=>t.closed&&t.venue===S.meta?.venue).slice(-5).reverse();if(!H.length)return '';
  return `<details class="pthist"><summary>${tr('Prove fatte su questa pista')} (${H.length})</summary>${H.map(t=>{const K=ptKpi(t.metric);const r=PT_R[t.res?.r||'inc'];
    return `<div class="pth"><b class="${r[1]}">${tr(r[0])}</b> · ${esc(tr(t.change.label))}: ${esc(t.change.dir)} · ${esc(tr(K?.[1]||t.metric))} ${t.res?`${fx(t.res.a,K?.[3]??2)} → ${fx(t.res.b,K?.[3]??2)}`:''} · <span class="muted">${t.closed==='keep'?tr('tenuta'):t.closed==='back'?tr('tolta'):tr('annullata')}</span></div>`;}).join('')}</details>`;}

// ---------- 3. one shape for every piece of advice: problem, evidence, change, check; the why on click ----------
function adviceShape(card,f){if(card.dataset.shaped)return;card.dataset.shaped=1;const k=ptMetric(f);const K=ptKpi(k);
  const ev=card.querySelector('.eev'),why=card.querySelector(':scope>p'),fx_=card.querySelector('.efxs');
  if(ev)ev.insertAdjacentHTML('beforebegin',`<div class="eh">${tr('Evidenza')}</div>`);
  if(fx_)fx_.insertAdjacentHTML('beforebegin',`<div class="eh">${tr('Modifica')}</div>`);
  const chk=`<div class="eh">${tr('Verifica')}</div><div class="echk">${esc(tr(K?.[1]||'Passo'))}: ${tr('deve')} ${ptGoal(k)}${k==='pace'?'':` · ${tr('e il passo non deve peggiorare')}`}</div>`;
  (fx_||ev||card.querySelector('.eft')).insertAdjacentHTML('afterend',chk);
  if(why){const d=document.createElement('details');d.className='ewhy';d.innerHTML=`<summary>${tr('Perché')}</summary>`;card.append(d);d.append(why);}
  if(f.s>0&&f.fx.some(x=>!x.conflict))card.insertAdjacentHTML('beforeend',`<div class="ppb"><button type="button" class="btn ptgo">${tr('Prova questa modifica')}</button></div>`);}

(function(){const re=renderEng;window.renderEng=renderEng=function(){re();const el=$('#suEng');const S=active()?.S;const D=typeof DIAG!=='undefined'?DIAG:null;if(!el||!S||!D||D.S!==S)return;
  try{const laps=engLaps(S);const F=engFindings(D,S,D.su||null,laps);
    const start=f=>{ptStart(S,D,laps,f);renderEng();el.querySelector('.ptest2')?.scrollIntoView({behavior:'smooth',block:'start'});};
    el.querySelectorAll('.ef').forEach(card=>{const t=card.querySelector('.eft b')?.textContent;const f=F.find(x=>x.t===t||tr(x.t)===t);if(!f)return;adviceShape(card,f);card.querySelector('.ptgo')?.addEventListener('click',()=>start(f));});
    // the plan of Race Engineer: the same button
    const P=engPlan(F);el.querySelectorAll('.ppl').forEach((row,i)=>{const f=P[i];if(!f||row.querySelector('.ptgo'))return;row.querySelector('.ppd')?.insertAdjacentHTML('beforebegin',`<button type="button" class="btn ptgo">${tr('Prova')}</button>`);row.querySelector('.ptgo').onclick=()=>start(f);});
    // the test in progress for this car and track, on top
    const t=ptActive(S);const host=el.querySelector('.pre')||el.querySelector('.ehead');
    if(t&&host){host.insertAdjacentHTML(host.classList.contains('pre')?'afterbegin':'afterend',ptHTML(t,S,D,laps));
      const box=el.querySelector('.ptest2');box.querySelector('#ptHyp').onchange=e=>{const L=ptAll();const x=L.find(y=>y.id===t.id);if(x){x.hyp=e.target.value;ptSave(L);}};
      box.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>{const L=ptAll();const x=L.find(y=>y.id===t.id);if(!x)return;const a=b.dataset.pt;
        if(a==='drop'&&!t._last){ptSave(L.filter(y=>y.id!==t.id));}else{x.closed=a;x.res=t._last||null;ptSave(L);}renderEng();});}
    const hh=ptHistHTML(S);if(hh)(el.querySelector('.pplan')||host)?.insertAdjacentHTML('beforeend',hh);
  }catch(e){console.error(e);}};})();

(function(){const st=document.createElement('style');st.textContent=`
.pcomp{margin-bottom:16px}.pcw2{border:1px solid rgba(255,159,67,.4);background:rgba(255,159,67,.08);border-radius:8px;padding:8px 12px;font-size:.9rem}.pcw2 span{display:inline-block;margin:0 10px 0 4px;color:#fff}.pcw2 small{display:block;color:var(--muted);margin-top:4px}
.pcok{color:#2BE38A;font-size:.92rem}
.psug{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.psb{display:flex;flex-direction:column;align-items:flex-start;gap:2px;height:auto!important;padding:6px 12px;text-align:left}
.psb b{font:600 .85rem var(--f-mono)}.psb small{font-size:.76rem;color:var(--muted);text-transform:none;letter-spacing:0}.psb.on{border-color:var(--pacc,#C9A54C)}
.ptest2{margin-bottom:16px;border-color:var(--pacc,#C9A54C)!important}
.pthyp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;margin-bottom:12px}.pthyp>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.pthyp span{font-size:.76rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.pthyp b{color:#fff}.pthyp div:first-child{grid-column:1/-1}.pthyp input{width:100%}
.ptwait{border:1px dashed var(--line);border-radius:8px;padding:10px 12px;color:var(--psil,#C9CDD3);margin:0}
.ptres{font-size:1.1rem;margin:4px 0 10px}.ptres b{font-size:1.25rem}.ptres span{font-size:.9rem;color:var(--muted)}
.ptt{max-width:520px;margin-bottom:10px}
.pthist{margin-top:12px}.pthist summary{cursor:pointer;color:var(--muted)}.pth{font-size:.86rem;padding:4px 0;border-bottom:1px solid var(--line)}
.ef .eh{font:600 .72rem var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:10px 0 4px}
.ef .echk{font-size:.88rem;color:var(--psil,#C9CDD3);border-left:2px solid #2BE38A;padding:2px 0 2px 8px}
.ef .ewhy{margin-top:8px}.ef .ewhy summary{cursor:pointer;color:var(--muted);font-size:.84rem}.ef .ewhy p{margin:6px 0 0}
.ef .ppb{margin-top:10px}
.ppl .ptgo,.ppl .ppd{grid-column:3}.ppl .ptgo{align-self:end}.ppl .ppd{align-self:start}.ppl>span.ppn{grid-row:span 2}.ppl>div{grid-row:span 2}
@media (max-width:760px){.pthyp{grid-template-columns:1fr}}
`;document.head.appendChild(st);})();
