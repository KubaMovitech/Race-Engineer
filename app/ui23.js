// ================= DEBRIEF AUTOMATICO DELLA SESSIONE (offline, niente AI) =================
// One page from the .ld (+ .svm + .xml): the 3 setup changes that matter most, the 3 corners where time
// is lost and why, the stint (pace, consistency, degradation, fuel), and what to try in the next run.
function sessDebrief(S){const su=byId($('#suFile').value);const all=S.laps.filter(l=>l.complete);
  const fl=S.laps.filter(l=>l.complete&&l.type==='lanciato'&&!l.invalid);const use=fl.length?fl:all;const b=bestValid(S);
  if(!use.length||!b)return null;const out={S,b,setup:[],drive:[],stint:{},next:[]};
  // ---- setup: problems the doctor confirms in the data, balance first, then suspension, then tyres
  let D=null;try{const car=(S.meta.car||S.merged?.d.car||'').toLowerCase();const okSu=su&&(!car||su.car.toLowerCase().includes(car)||car.split(/\s+/).some(t=>t.length>3&&su.car.toLowerCase().includes(t)));
    D=diagnose(S,use,okSu?su:null);D.S=S;D.su=okSu?su:null;}catch(e){console.error(e);}
  const order=['us_slow','us_fast','os_slow','os_fast','us_in','us_mid','us_out','os_in','os_out','bottom','brk_unst','lock','spin','hot_f','hot_r','vmax'];
  if(D)order.forEach(id=>{const k=KB.find(x=>x.id===id);if(!k)return;let e=null;try{e=k.ev(D);}catch(_){}if(!e?.hit)return;
    // balance by speed already says mechanical or aero: skip the generic one for the same symptom
    if((id==='us_mid'&&out.setup.some(x=>/^us_(slow|fast)$/.test(x.id)))||(id==='os_out'&&out.setup.some(x=>/^os_(slow|fast)$/.test(x.id))))return;
    const f=k.fixes.filter(x=>!D.su||setupVal(D.su,x.key,x.sec)!=null).slice(0,2).map(x=>({label:x.label,dir:x.dir,now:setupVal(D.su,x.key,x.sec),why:x.why}));
    out.setup.push({id,t:k.label,ev:e.txt,f});});
  try{const R=susAnalyse(S,use);susHints(R,D?.su,D).filter(h=>h.k!=='good').forEach(h=>out.setup.push({id:'sus',t:tr('Ammortizzatori')+' · '+h.t,ev:h.d,f:h.f.map(x=>({label:x.label,dir:x.dir,now:x.now}))}));}catch(e){}
  if(D)D.cards.filter(c=>c.sec==='Gomme'&&(c.st==='bad'||c.st==='warn')&&c.fix).forEach(c=>{const t=document.createElement('div');t.innerHTML=c.fix;out.setup.push({id:'tyre',t:c.title,ev:c.tag||'',f:[{label:'',dir:t.textContent.replace(/\s+/g,' ').trim()}]});});
  out.setup=out.setup.slice(0,3);
  // ---- driving: against the reference lap if there is one, else against your own laps corner by corner
  const ro=refOptions(S).filter(([v])=>!v.startsWith(S.id+'|'));const ref=ro.length?pickRef(ro[0][0]):null;
  if(ref&&ref.lap&&!(ref.S===S&&ref.lap===b)){try{out.drive=coachTips(S,b,ref).slice(0,3).map(t=>({...t,vs:`${(ref.S.meta.driver||tr('riferimento')).replace(/#\d+$/,'')} ${fmtLap(ref.lap.time)}`}));out.refName=ro[0][1];}catch(e){}}
  if(!out.drive.length){const others=use.filter(l=>l!==b).sort((x,y)=>x.time-y.time).slice(0,6);const best={};
    others.forEach(l=>{try{coachTips(S,b,{S,lap:l}).forEach(t=>{if(!best[t.n]||t.dt>best[t.n].dt)best[t.n]={...t,vs:`${tr('il tuo giro')} ${l.num}`};});}catch(e){}});
    out.drive=Object.values(best).sort((x,y)=>y.dt-x.dt).slice(0,3);out.self=true;}
  out.gain=out.drive.reduce((s,t)=>s+t.dt,0);
  // ---- stint
  const T=use.map(l=>l.time),pool=use.filter(l=>l.time<=b.time*1.07);const pace=median(pool.map(l=>l.time));
  const m=avg_(pool.map(l=>l.time)),sd=pool.length>2?Math.sqrt(pool.reduce((s,l)=>s+(l.time-m)**2,0)/(pool.length-1)):NaN;
  let deg=NaN;if(pool.length>=5){const xs=pool.map(l=>l.num),ys=pool.map(l=>l.time);const xm=avg_(xs),ym=avg_(ys);let n=0,d=0;xs.forEach((x,i)=>{n+=(x-xm)*(ys[i]-ym);d+=(x-xm)**2;});deg=d?n/d:NaN;}
  const fuel=median(use.map(l=>{try{return lapStats(S,l).fuel;}catch(e){return NaN;}}).filter(v=>v>0&&v<20));
  out.stint={n:use.length,best:b.time,pace,sd,deg,fuel,wear:D?.raw?.wearAvg,inv:all.filter(l=>l.invalid).length};
  // ---- next run
  if(out.setup[0]){const f=out.setup[0].f[0];out.next.push(f?.label?`${f.label}: ${f.dir}${f.now?` (${tr('ora')} ${f.now})`:''} — ${tr('una sola modifica, poi 5 giri e confronta il passo')}`:`${out.setup[0].t}: ${f?.dir||''}`);}
  if(out.drive[0])out.next.push(`${out.drive[0].n}: ${out.drive[0].why.join(', ')} (${fx(out.drive[0].dt,2)} s ${tr('al giro')})`);
  if(Number.isFinite(sd)&&sd>0.6)out.next.push(tr('Costanza: i giri variano di ±')+fx(sd,2)+' s. '+tr('Prima del setup, cerca giri regolari: le differenze piccole nel setup spariscono sotto questa variazione.'));
  if(Number.isFinite(deg)&&deg>0.08)out.next.push(tr('Il passo cala di')+` ${fx(deg,2)} s `+tr('a giro: guarda pressioni e temperature delle gomme nello stint, o risparmia le gomme nelle prime fasi.'));
  return out;}

function openSessionDebrief(){const a=active();if(!a?.S){toast(tr('Scegli una telemetria .ld'));return;}const S=a.S,m=S.meta;const X=sessDebrief(S);
  if(!X){toast(tr('Servono giri completi.'));return;}const st=X.stint;
  let h=`<h1>${tr('Debrief')} · ${esc(m.venue||'')}</h1><p>${esc(m.date||'')} ${esc((m.time||'').slice(0,5))} · ${esc((m.driver||'').replace(/#\d+$/,''))} · ${esc(m.car||S.merged?.d.car||'')} · ${esc(S.cond.label||'')}${Number.isFinite(S.cond.track?.avg)?`, ${tr('pista')} ${fx(S.cond.track.avg,1)} °C`:''}</p>
    <div class="rk"><div>${tr('Miglior giro')}<b>${fmtLap(st.best)}</b></div><div>${tr('Passo')}<b>${fmtLap(st.pace)}</b></div><div>${tr('Costanza')}<b>${Number.isFinite(st.sd)?'±'+fx(st.sd,2)+' s':'—'}</b></div><div>${tr('Calo a giro')}<b>${Number.isFinite(st.deg)?(st.deg>0?'+':'')+fx(st.deg,2)+' s':'—'}</b></div><div>${tr('Benzina/giro')}<b>${Number.isFinite(st.fuel)?fx(st.fuel,2)+' L':'—'}</b></div>${Number.isFinite(st.wear)?`<div>${tr('Usura/giro')}<b>${fx(st.wear,2)}%</b></div>`:''}</div>`;
  h+=`<h2>${tr('Setup: le modifiche che contano')}</h2>`+(X.setup.length?`<ol>${X.setup.map(s=>`<li><b>${esc(s.t)}</b><br><span class="muted small">${esc(s.ev)}</span>${s.f.length?`<ul>${s.f.map(f=>`<li>${f.label?`<b>${esc(f.label)}</b>: `:''}${esc(f.dir)}${f.now?` <span class="mono muted">(${tr('ora')} ${esc(f.now)})</span>`:''}</li>`).join('')}</ul>`:''}</li>`).join('')}</ol>`:`<p>${tr('Nessun problema evidente nei dati: il setup è in equilibrio per questi giri.')}</p>`);
  h+=`<h2>${tr('Guida: dove perdi tempo')}</h2>`+(X.drive.length?`<p class="muted small">${X.self?tr('Il tuo giro migliore confrontato con i tuoi altri giri, curva per curva: è tempo che hai già fatto, quindi è alla tua portata.'):tr('Contro il giro di riferimento')+': '+esc(X.refName||'')}</p>
    <ol>${X.drive.map(t=>`<li><b>${esc(t.n)}</b> · ${fx(t.dt,2)} s <span class="muted small">(${tr('contro')} ${esc(t.vs)})</span><br>${esc(t.why.join(', '))}</li>`).join('')}</ol><p>${tr('Tempo recuperabile in queste curve')}: <b>${fx(X.gain,2)} s</b> ${tr('al giro')}.</p>`:`<p>${tr('Giri molto uniformi: non c\'è una curva dove perdi chiaramente tempo. Carica un giro di riferimento (★ nel pannello File) per un confronto esterno.')}</p>`);
  h+=`<h2>${tr('Stint')}</h2><p>${st.n} ${tr('giri completi')}${st.inv?`, ${st.inv} ${tr('non validi')}`:''}. ${tr('Passo')} ${fmtLap(st.pace)}, ${tr('a')} ${fx(st.pace-st.best,2)} s ${tr('dal migliore')}.${Number.isFinite(st.deg)?` ${st.deg>0.03?tr('Il tempo sul giro sale di')+' '+fx(st.deg,2)+' s '+tr('a giro (gomme e benzina).'):tr('Passo stabile nello stint.')}`:''}</p>`;
  if(X.next.length)h+=`<h2>${tr('Prossima uscita')}</h2><ol>${X.next.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`;
  h+=`<p class="muted small" style="margin-top:16px">${tr('Debrief automatico di Data Engineer: regole fisse sulla telemetria, nessuna AI. Cambia una cosa alla volta e confronta.')}</p>`;
  $('#mReport h2').textContent=tr('Debrief');$('#rpBody').innerHTML=h;$('#rpPrint').hidden=window.self!==window.top;
  $('#rpPrint').onclick=()=>window.print();$('#rpCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#rpBody').innerText);toast(tr('Debrief copiato'));}catch(e){toast('Copia non disponibile qui');}};
  openModal('#mReport');}

// a Debrief button next to Report in the session header; Report keeps its own title
(function(){const rh=renderHero;window.renderHero=renderHero=function(){rh();const a=active();const r=$('#btnReport');if(!a?.S||!r||$('#btnDebrief'))return;
    const b=document.createElement('button');b.type='button';b.className='btn primary';b.id='btnDebrief';b.textContent=tr('Debrief');b.style.alignSelf='center';b.onclick=openSessionDebrief;r.after(b);};
  const or=openReport;window.openReport=openReport=function(){or();const h=$('#mReport h2');if(h)h.textContent='Report';};})();
