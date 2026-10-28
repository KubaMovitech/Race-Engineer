// ================= PRO RACE ENGINEER and SETUP BUILDER =================
// Race Engineer: quick actions (the symptom guide), current diagnosis, action plan with "done", last test comparison.
// Setup Builder: the car seen from above with the values of the .svm on each corner, and the other versions of the setup.

// ---------- quick actions: what you want from the car → the guide's answer for that symptom ----------
const PRO_ACT=[['rot','Più rotazione in ingresso','Sottosterzo in ingresso','var(--pacc2)'],['stab','Più stabilità in frenata','Frena forte, poi si gira in trail braking','#FF5A6A'],
  ['tra','Migliora trazione','Perde trazione in uscita','#2BE38A'],['wear','Riduci usura gomme','Le gomme calano nello stint','#FFC53D'],
  ['vmax','Più velocità sul dritto','Lenta sul dritto','#22D3EE'],['aero','Bilanciamento nel veloce','Sottosterzo nelle curve veloci','#B57BFF']];
const PRO_ACT_IC={rot:'<path d="M12 4a8 8 0 1 1-7.4 5"/><path d="M4 4v5h5"/>',stab:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4"/><circle cx="12" cy="16" r=".6"/>',tra:'<circle cx="12" cy="12" r="8"/><path d="M8 12l3 3 5-6"/>',
  wear:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',vmax:'<path d="M4 18L14 8M14 8h-5M14 8v5"/><path d="M12 18l8-8"/>',aero:'<path d="M3 14c4-6 14-6 18 0"/><path d="M7 14v3M17 14v3M12 10v7"/>'};
function proActBox(id){const a=PRO_ACT.find(x=>x[0]===id);const s=typeof GUIDE_SYM!=='undefined'&&GUIDE_SYM.find(x=>x.s===a[2]);if(!s)return '';
  return `<div class="pactb"><b>${tr(a[1])}</b> · <span class="muted">${tr(s.s)}</span><ol>${s.f.map(f=>`<li>${esc(tr(f))}</li>`).join('')}</ol><p class="small muted">${esc(tr(s.p))}</p>
    <div class="gchips">${s.k.map(k=>GUIDE_P[k]?`<button type="button" class="gchip" data-gp="${k}">${tr(GUIDE_P[k].t)}</button>`:'').join('')}</div></div>`;}

// ---------- the previous run of this car on this track (same rule as «Il cambio ha funzionato?») ----------
function proPrevRun(S){const H=LS.get('suhist',{});const cur=H[S.id];if(!cur)return null;const car=(cur.car||'').toLowerCase();
  return Object.values(H).filter(h=>h.id!==S.id&&h.venue===cur.venue&&(!car||!h.car||h.car.toLowerCase()===car)&&(h.when<cur.when||(h.when===cur.when&&h.at<cur.at))).sort((a,b)=>String(b.when).localeCompare(String(a.when))||b.at-a.at)[0]||null;}
// speed of the best lap before and now, when the previous session is still loaded
function proTestChart(S,P){const B=S.best,PB=P?.best;if(!B||!PB)return '';const gA=lapGrid(P,PB,10),gB=lapGrid(S,B,10);const a=gA.get('Ground Speed'),b=gB.get('Ground Speed');if(!a||!b)return '';
  const n=Math.min(a.length,b.length),W=600,H=150;let hi=0;for(let i=0;i<n;i++)hi=Math.max(hi,a[i],b[i]);hi=Math.ceil(hi/20)*20;
  const X=i=>(34+i/(n-1)*(W-40)).toFixed(1),Y=v=>(8+(1-v/hi)*(H-28)).toFixed(1);const pl=(s,c)=>`<polyline points="${Array.from({length:n},(_,i)=>X(i)+','+Y(s[i])).join(' ')}" fill="none" style="stroke:${c}" stroke-width="1.4"/>`;
  const sa=twLapSectors(P,PB),sb=twLapSectors(S,B);
  const secs=sa&&sb?`<div class="ptsec">${[0,1,2].map(k=>{const d=sb[k]-sa[k];const z=Math.abs(d)<5e-4;return `<span>S${k+1} <b class="${z?'muted':d<0?'pos':'neg'}">${z?'':d>0?'+':'−'}${Math.abs(d).toFixed(3)}</b></span>`;}).join('')}</div>`:'';
  return `<div class="ptc"><div class="ptl"><span><i style="background:var(--lapB)"></i>${tr('Prima')} · ${fmtLap(PB.time)}</span><span><i style="background:var(--lapA)"></i>${tr('Ora')} · ${fmtLap(B.time)}</span></div>${secs}
    <svg viewBox="0 0 ${W} ${H}"><g class="pg">${[0,.5,1].map(f=>`<line x1="34" x2="${W-6}" y1="${8+f*(H-28)}" y2="${8+f*(H-28)}"/><text x="30" y="${12+f*(H-28)}" text-anchor="end">${Math.round(hi*(1-f))}</text>`).join('')}</g>${pl(a,'var(--lapB)')}${pl(b,'var(--lapA)')}</svg></div>`;}

function proEngHTML(S,D,laps){const F=engFindings(D,S,D.su||null,laps);const P=engPlan(F);const done=LS.get('pdone',{});
  const diag=[...F].sort((a,b)=>b.s-a.s||ENG_ORDER.indexOf(a.a)-ENG_ORDER.indexOf(b.a)).filter((f,i)=>f.s>0||i<4).slice(0,6);
  const area=k=>{const a=ENG_AREAS.find(x=>x[0]===k);return a?tr(a[1]):'';};
  const sev=s=>`<em class="${['ok','mid','hi'][s]}">${tr(['OK','Media','Alta'][s])}</em>`;
  const conf=laps.length>=3?tr('alta'):laps.length===2?tr('media'):tr('bassa');
  return `<div class="pre1"><div class="panel pact"><div class="panel-h"><h3>${tr('Azioni rapide')}</h3><span class="muted small">${tr('cosa vuoi dalla macchina')}</span></div>
      <div class="pactg">${PRO_ACT.map(([id,l,,c])=>`<button type="button" class="pab" data-a="${id}" style="--c:${c}"><svg viewBox="0 0 24 24" aria-hidden="true">${PRO_ACT_IC[id]}</svg><span>${tr(l)}</span></button>`).join('')}</div><div id="pActBox"></div></div>
    <div class="panel pdiag"><div class="panel-h"><h3>${tr('Diagnosi attuale')}</h3><span class="pdlm"><span class="muted small">${esc(engLapsText(laps))} · ${tr('affidabilità')} ${conf}</span><span class="seg" role="group" aria-label="${esc(tr('Giri da analizzare'))}"><button type="button" data-lm="best" aria-pressed="${engLapMode()==='best'}" title="${esc(tr('I giri puliti: il quadro più affidabile del setup'))}">${tr('Più veloci')}</button><button type="button" data-lm="last" aria-pressed="${engLapMode()==='last'}" title="${esc(tr('Dopo una modifica al setup: guarda solo come va adesso'))}">${tr('Ultimi')}</button></span></span></div>
      <table class="lbt pdt"><thead><tr><th class="l">${tr('Problema')}</th><th class="l">${tr('Area')}</th><th>${tr('Gravità')}</th><th class="l">${tr('Dati')}</th></tr></thead><tbody>
      ${diag.map(f=>`<tr class="s${f.s}"><td class="l"><span class="pdi">${f.s===2?'!':f.s===1?'⚠':'✓'}</span><b>${esc(f.t)}</b></td><td class="l muted">${area(f.a)}</td><td>${sev(f.s)}</td><td class="l small">${esc(f.ev.slice(0,2).join(' · '))}</td></tr>`).join('')}</tbody></table></div></div>
   <div class="pre2"><div class="panel pplan"><div class="panel-h"><h3>${tr('Piano d\'azione')}</h3><span class="muted small">${tr('una modifica alla volta · 3–5 giri per prova')}</span></div>
      ${P.length?P.map((f,i)=>{const x=f.fx.find(x=>!x.conflict)||{};const k=S.id+'|'+f.t;const ok=!!done[k];return `<div class="ppl${ok?' done':''}"><span class="ppn">${i+1}</span><div><b>${esc(tr(x.label||''))}: ${esc(x.dir||'')}</b>${x.now?` <span class="muted small">(${tr('ora')} <span class="mono">${esc(x.now)}</span>)</span>`:''}<small>${esc(f.t)} — ${esc(f.why||f.ev[0]||'')}</small></div>
        <button type="button" class="btn ppd" data-k="${esc(k)}" aria-pressed="${ok}">${ok?'✓ '+tr('Fatto'):tr('Segna come fatto')}</button></div>`;}).join('')+
        `<div class="ppb"><button type="button" class="btn primary" id="pToGen">${tr('Apri nel generatore')}</button><button type="button" class="btn" id="pToSet">${tr('Vai al Setup Builder')}</button></div>`
        :`<p class="small">${tr('Niente di urgente: il setup lavora nella finestra giusta. Per il tempo sul giro guarda Telemetria e Coach.')}</p>`}</div>
    <div class="panel ptest" id="pTest"><div class="panel-h"><h3>${tr('Confronto ultimo test')}</h3></div></div></div>`;}

(function(){const re=renderEng;window.renderEng=renderEng=function(){re();const el=$('#suEng');const S=active()?.S;const D=typeof DIAG!=='undefined'?DIAG:null;if(!el||!S||!D||D.S!==S||!proLook())return;
  try{let laps=engLaps(S);
    const head=el.querySelector('.ehead');if(!head)return;head.classList.add('pehead');head.insertAdjacentHTML('afterend',`<div class="pre">${proEngHTML(S,D,laps)}</div>`);
    // the comparison with the previous run goes in the right column, with the speed of both best laps when that session is loaded
    const pt=$('#pTest'),cm=el.querySelector('.ecmp');if(pt&&cm){const P=proPrevRun(S);const PS=P&&lds().find(x=>x.id===P.id);
      pt.insertAdjacentHTML('beforeend',P?(PS?proTestChart(S,PS):'')+`<div class="ptcm">${cm.innerHTML.replace(/^[\s\S]*?<\/div>/,'')}</div>`
        :`<div class="ptfirst"><b>${tr('Prima prova salvata con questa auto su questa pista.')}</b><ol><li>${tr('Fai una modifica del piano d\'azione.')}</li><li>${tr('Gira 3–5 giri puliti nelle stesse condizioni.')}</li><li>${tr('Carica la nuova telemetria (o lascia che arrivi da sola dal gioco).')}</li></ol><span>${tr('Qui vedrai prima e dopo: tempi, settori, velocità e se il problema è sparito.')}</span></div>`);
      const h=cm.querySelector('.panel-h span');if(h)pt.querySelector('.panel-h').append(h.cloneNode(true));cm.remove();}
    el.querySelectorAll('.pab').forEach(b=>b.onclick=()=>{const on=b.getAttribute('aria-pressed')!=='true';el.querySelectorAll('.pab').forEach(x=>x.setAttribute('aria-pressed',x===b&&on));
      const box=$('#pActBox');box.innerHTML=on?proActBox(b.dataset.a):'';box.querySelectorAll('[data-gp]').forEach(c=>c.onclick=()=>openGuide(c.dataset.gp));});
    el.querySelectorAll('.pdlm [data-lm]').forEach(b=>b.onclick=()=>{LS.set('eng:laps',b.dataset.lm);RENDER.setup();});
    el.querySelectorAll('.ppd').forEach(b=>b.onclick=()=>{const d=LS.get('pdone',{});d[b.dataset.k]=!d[b.dataset.k];if(!d[b.dataset.k])delete d[b.dataset.k];LS.set('pdone',d);renderEng();});
    const g=$('#pToGen');if(g)g.onclick=()=>{LS.set('su:tab','gen');$('#proNav .pn[data-n="setb"]')?.click();};
    const s=$('#pToSet');if(s)s.onclick=()=>{LS.set('su:tab','set');$('#proNav .pn[data-n="setb"]')?.click();};
  }catch(e){console.error(e);}};})();

// ---------- Setup Builder: the car from above ----------
function suFind(su,sec,re){const L=su?.sec?.[sec];const x=L&&L.find(i=>re.test(i.key));return x&&x.disp&&!/N\/A|Non-adjustable|Detached/.test(x.disp)?x.disp.replace(/\s*\(soft\)|\s*\(\d+\s*laps\)/g,''):null;}
function proCarHTML(su){const C={FL:'FRONTLEFT',FR:'FRONTRIGHT',RL:'REARLEFT',RR:'REARRIGHT'};const WN={FL:'Ant. sinistra',FR:'Ant. destra',RL:'Post. sinistra',RR:'Post. destra'};
  const corner=w=>{const s=C[w];const front=w[0]==='F';const rows=[['Campanatura',suFind(su,s,/^CamberSetting/)],['Convergenza',suFind(su,'SUSPENSION',front?/^FrontToeIn/:/^RearToeIn/)],['Pressione',suFind(su,s,/^PressureSetting/)],['Molla',suFind(su,s,/^SpringSetting/)],['Altezza',suFind(su,s,/^RideHeightSetting/)],['Packer',suFind(su,s,/^PackerSetting/)],['Comp. lenta',suFind(su,s,/^SlowBumpSetting/)],['Est. lenta',suFind(su,s,/^SlowReboundSetting/)],['Mescola',suFind(su,s,/^CompoundSetting/)]].filter(r=>r[1]);
    return `<div class="pcw pc${w}"><h4><span class="pwd"></span>${tr(WN[w])}</h4>${rows.map(([l,v])=>`<div><span>${tr(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;};
  const box=(t,ic,rows)=>{rows=rows.filter(r=>r[1]);return rows.length?`<div class="pcb"><h4>${ic} ${tr(t)}</h4>${rows.map(([l,v])=>`<div><span>${tr(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`:'';};
  const mid=[box('Aerodinamica','✈',[['Ala anteriore',suFind(su,'FRONTWING',/^FWSetting/)],['Ala posteriore',suFind(su,'REARWING',/^RWSetting/)]]),
    box('Freni','◉',[['Ripartizione',suFind(su,'CONTROLS',/^RearBrakeSetting/)],['Pressione',suFind(su,'CONTROLS',/^BrakePressureSetting/)],['Migrazione',suFind(su,'CONTROLS',/^BrakeMigrationSetting/)]]),
    box('Barre antirollio','⇄',[['Anteriore',suFind(su,'SUSPENSION',/^FrontAntiSway/)],['Posteriore',suFind(su,'SUSPENSION',/^RearAntiSway/)]]),
    box('Terzo elemento','⌇',[['Molla ant.',suFind(su,'SUSPENSION',/^Front3rdSpring/)],['Packer ant.',suFind(su,'SUSPENSION',/^Front3rdPacker/)],['Molla post.',suFind(su,'SUSPENSION',/^Rear3rdSpring/)],['Packer post.',suFind(su,'SUSPENSION',/^Rear3rdPacker/)]]),
    box('Differenziale','⚙',[['Precarico',suFind(su,'DRIVELINE',/^DiffPreload/)],['Trazione',suFind(su,'DRIVELINE',/^DiffPower/)],['Rilascio',suFind(su,'DRIVELINE',/^DiffCoast/)]]),
    box('Elettronica e ibrido','ϟ',[['TC mappa',suFind(su,'CONTROLS',/^TractionControlMap/)],['TC taglio',suFind(su,'CONTROLS',/^TCPowerCut/)],['Rigenerazione',suFind(su,'ENGINE',/^RegenerationMap/)],['Motore elettrico',suFind(su,'ENGINE',/^ElectricMotorMap/)]])].join('');
  const car=`<svg viewBox="0 0 160 300" class="pcarv" aria-hidden="true"><defs><linearGradient id="pcb" x1="0" x2="1"><stop offset="0" style="stop-color:var(--pcar1)"/><stop offset=".5" style="stop-color:var(--pcar2)"/><stop offset="1" style="stop-color:var(--pcar1)"/></linearGradient></defs>
    <path d="M60 18h40l8 30 14 6v40l-8 10 4 60 12 10v60l-10 30H54l-10-30v-60l12-10 4-60-8-10V54l14-6z" fill="url(#pcb)" style="stroke:var(--pacc)" stroke-width="1.2" opacity=".95"/>
    <path d="M30 16h100v10H30z" style="fill:var(--pcar3);stroke:var(--pacc)"/><path d="M26 276h108v12H26z" style="fill:var(--pcar3);stroke:var(--pacc)"/>
    <rect x="14" y="58" width="22" height="46" rx="5" style="fill:var(--panel)" stroke="#2BE38A" stroke-width="2"/><rect x="124" y="58" width="22" height="46" rx="5" style="fill:var(--panel)" stroke="#2BE38A" stroke-width="2"/>
    <rect x="12" y="196" width="26" height="52" rx="5" style="fill:var(--panel)" stroke="#FFC53D" stroke-width="2"/><rect x="122" y="196" width="26" height="52" rx="5" style="fill:var(--panel)" stroke="#FFC53D" stroke-width="2"/>
    <ellipse cx="80" cy="132" rx="14" ry="22" style="fill:var(--bg);stroke:var(--pacc2)"/><path d="M80 40v230" style="stroke:var(--pline2)" stroke-dasharray="3 5"/></svg>`;
  return `<div class="pcar2">${corner('FL')}${corner('FR')}<div class="pcc2">${car}</div>${corner('RL')}${corner('RR')}</div><div class="pcmid">${mid}</div>`;}
function proVersions(su){const car=(su?.car||'').toLowerCase();const L=svms().filter(x=>!car||(x.car||'').toLowerCase()===car);
  const nd=(a,b)=>{let n=0;for(const [sec,it] of Object.entries(a.sec||{}))for(const i of it){const o=b.sec?.[sec]?.find(x=>x.key===i.key);if(o&&o.raw!==i.raw)n++;}return n;};
  return L.map(x=>`<button type="button" class="pvr${x===su?' cur':''}" data-id="${esc(x.id)}"><i></i><div><b>${esc(x.label||x.name)}</b><small>${x===su?tr('in uso'):nd(su,x)+' '+tr('differenze')}</small></div></button>`).join('')||`<p class="muted small">${tr('Carica altri .svm della stessa auto per vederli qui.')}</p>`;}
function proSetupPanel(){const old=$('#pSetCar');const su=byId($('#suFile')?.value);const nav=$('#suTabs');if(!nav||!proLook()){old?.remove();return;}
  const S=active()?.S;const R=S?proFindings(S):null;const F=R?[...R.F].filter(f=>f.s>0).sort((a,b)=>b.s-a.s).slice(0,3):[];
  const h=`<div id="pSetCar" class="pset">${su?`<div class="panel psc"><div class="panel-h"><h3>${tr('Assetto')} · <span class="muted">${esc(su.label||su.name)}</span></h3><span class="muted small">${esc(su.car||'')}</span></div>${proCarHTML(su)}</div>
     <div class="pset-r"><div class="panel"><div class="panel-h"><h3>${tr('Versioni setup')}</h3><span class="muted small">${tr('stessa auto')}</span></div><div class="pvl">${proVersions(su)}</div></div>
     ${S?`<div class="panel"><div class="panel-h"><h3>${tr('Problemi rilevati dai dati')}</h3><button type="button" class="btn" id="pToEng">${tr('Race Engineer')} →</button></div>${F.length?F.map(proFindRow).join(''):`<p class="muted small">${tr('Niente di urgente.')}</p>`}</div>`:''}</div>`
     :`<div class="panel"><div class="empty">${tr('Carica un file setup .svm (Documenti o cartella UserData/player/Settings di Le Mans Ultimate).')}</div></div>`}</div>`;
  if(old)old.outerHTML=h;else nav.insertAdjacentHTML('afterend',h);
  $$('#pSetCar .pvr').forEach(b=>b.onclick=()=>{const s=$('#suFile');s.value=b.dataset.id;s.onchange&&s.onchange();});
  const e=$('#pToEng');if(e)e.onclick=()=>$('#proNav .pn[data-n="eng"]')?.click();}
(function(){const so=window.suTabOf;window.suTabOf=suTabOf=function(p){return p.id==='pSetCar'?'set':so(p);};})();
setTimeout(()=>{const base=RENDER.setup;RENDER.setup=()=>{base();try{proSetupPanel();}catch(e){console.error(e);}suTabsApply();};},0);

(function(){const st=document.createElement('style');st.textContent=`
html[data-look="pro"] .pehead .eplan{display:none}
html[data-look="pro"] .ehead .ey{color:var(--pacc2);font:600 .72rem "Titillium Web",sans-serif;letter-spacing:.14em}html[data-look="pro"] .ehead h2{font:700 1.4rem "Titillium Web",sans-serif;color:#fff;text-transform:none}
html[data-look="pro"] .ecount span{border-radius:10px;background:var(--panel2);border:1px solid var(--line)}
.pre1,.pre2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:16px;margin-bottom:16px}
.pactg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pab{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.02);color:var(--psil2);padding:12px;cursor:pointer;font:600 .85rem "Titillium Web",sans-serif;text-align:left}
.pab svg{width:26px;height:26px;flex:none;fill:none;stroke:var(--c);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.pab:hover{border-color:var(--c)}.pab[aria-pressed="true"]{border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent)}
.pactb{margin-top:12px;border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:rgba(255,255,255,.02)}.pactb ol{margin:8px 0;padding-left:20px}.pactb li{margin:3px 0}
.pdlm{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.pdlm .seg button{padding:4px 10px;font-size:.8rem}
.pdt{table-layout:fixed;width:100%}.pdt th:nth-child(1){width:34%}.pdt th:nth-child(2){width:18%}.pdt th:nth-child(3){width:12%}.pdt td{vertical-align:top;white-space:normal!important;overflow-wrap:anywhere}.pdt td b{color:#fff}.pdt .pdi{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:6px;margin-right:8px;font-weight:700;font-size:.8rem}
.pdt tr.s2 .pdi{background:rgba(255,59,78,.15);color:#FF3B4E}.pdt tr.s1 .pdi{background:var(--pwarnbg);color:var(--pwarn)}.pdt tr.s0 .pdi{background:rgba(43,227,138,.12);color:#2BE38A}
.pdt em{font-style:normal;font:600 .72rem "Titillium Web",sans-serif;padding:4px 10px;border-radius:6px;white-space:nowrap}.pdt em.hi{background:rgba(255,59,78,.15);color:#FF5A6A}.pdt em.mid{background:var(--pwarnbg);color:var(--pwarn)}.pdt em.ok{background:rgba(43,227,138,.12);color:#2BE38A}
.ppl{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
.ppn{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--psel);color:#fff;font-weight:700}
.ppl b{color:#fff}.ppl small{display:block;color:var(--muted);margin-top:2px;font-size:.86rem}.ppl.done{opacity:.6}.ppl.done .ppn{background:#14532D}
.ppd[aria-pressed="true"]{color:#2BE38A;border-color:#2BE38A}
.ppb{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.ptc svg{width:100%;height:auto;display:block}.ptc .pg line{stroke:rgba(255,255,255,.07)}.ptc .pg text{fill:var(--muted);font:10px "JetBrains Mono",monospace}
.ptl{display:flex;gap:16px;flex-wrap:wrap;font-size:.8rem;color:var(--psil)}.ptl i{display:inline-block;width:14px;height:3px;margin-right:6px;vertical-align:middle}
.ptsec{display:flex;gap:18px;margin:6px 0;font-size:.8rem;color:var(--muted)}.ptsec b{font-family:"JetBrains Mono",monospace;margin-left:4px}
.ptcm .ecg{margin-top:10px;grid-template-columns:1fr!important}.ptfirst{color:var(--psil);font-size:.9rem}.ptfirst b{color:#fff}.ptfirst ol{margin:10px 0;padding-left:20px}.ptfirst li{margin:4px 0}.ptfirst span{color:var(--muted);font-size:.82rem}
.pset{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:16px;margin-bottom:16px}.pset>.panel:only-child{grid-column:1/-1}
.pset-r{display:flex;flex-direction:column;gap:16px}
.pcar2{display:grid;grid-template-columns:1fr 170px 1fr;grid-template-rows:auto auto;gap:12px;align-items:center}
.pcc2{grid-row:1/3;grid-column:2}.pcarv{width:100%;height:auto;max-height:340px}
.pcFL{grid-column:1;grid-row:1}.pcFR{grid-column:3;grid-row:1}.pcRL{grid-column:1;grid-row:2}.pcRR{grid-column:3;grid-row:2}
.pcw,.pcb{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:rgba(255,255,255,.025)}
.pcw h4,.pcb h4{margin:0 0 6px;font:700 .78rem "Titillium Web",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#fff;display:flex;align-items:center;gap:8px}
.pcw .pwd{width:8px;height:8px;border-radius:50%;background:#2BE38A}.pcRL .pwd,.pcRR .pwd{background:#FFC53D}
.pcw>div,.pcb>div{display:flex;justify-content:space-between;gap:10px;font-size:.82rem;padding:2px 0}.pcw span,.pcb span{color:var(--muted)}.pcw b,.pcb b{font:600 .85rem "JetBrains Mono",monospace;color:#fff;white-space:nowrap}
.pcmid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
.pvl{display:flex;flex-direction:column;gap:6px}
.pvr{display:flex;gap:10px;align-items:center;text-align:left;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit;padding:8px 10px;cursor:pointer;font:inherit}
.pvr i{width:10px;height:10px;border-radius:50%;border:2px solid var(--faint);flex:none}.pvr.cur{border-color:var(--pacc,var(--pacc));background:var(--psel)}.pvr.cur i{border-color:#FFC53D;background:#FFC53D}
.pvr b{display:block;font-size:.85rem;color:#fff}.pvr small{color:var(--muted);font-size:.74rem}
@media (max-width:1200px){.pre1,.pre2,.pset{grid-template-columns:1fr}}
@media (max-width:760px){.pactg{grid-template-columns:1fr 1fr}.pcar2{grid-template-columns:1fr 1fr}.pcc2{display:none}.pcFL,.pcFR,.pcRL,.pcRR{grid-column:auto;grid-row:auto}.pcmid{grid-template-columns:1fr 1fr}.ppl{grid-template-columns:30px 1fr}.ppl .ppd{grid-column:2}}
`;document.head.appendChild(st);})();
