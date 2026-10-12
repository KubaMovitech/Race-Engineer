// ================= RITOCCHI GRAFICI =================

// ---------- 1. the bell: every alert of the session in a list; pop-ups only for us and the rivals, only in the Muretto ----------
function bellList(){const l=$('#lvBellList');if(!l)return;const ago=t=>{const s=Math.round((Date.now()-t)/1000);return s<60?`${s} s`:`${Math.round(s/60)} min`;};
  l.innerHTML=NOTIF.length?NOTIF.map(n=>`<div class="bl ${n.k||''}"${n.veh?` data-car="${esc(n.veh)}"`:''}><div class="blh"><b>${n.t}</b><span>${ago(n.at)}</span></div><div>${n.s}</div></div>`).join(''):`<div class="muted small">${tr('Nessun avviso per ora.')}</div>`;
  l.querySelectorAll('[data-car]').forEach(e=>e.onclick=()=>openCarModal(e.dataset.car));}
function bellUpdate(){const b=$('#lvBell');if(!b)return;const n=NOTIF.filter(x=>x.at>(LIVE.bellSeen||0)).length;b.querySelector('i').textContent=n||'';b.classList.toggle('on',n>0);if(!$('#lvBellList')?.hidden)bellList();}
window.bellUpdate=bellUpdate;
document.addEventListener('click',e=>{const l=$('#lvBellList');if(l&&!l.hidden&&!e.target.closest('.bellw'))l.hidden=true;});

(function(){const sk=liveSkeleton;window.liveSkeleton=liveSkeleton=function(){const v=$('#v-live');const fresh=!v.dataset.ok;sk();if(!fresh)return;
    const btns=v.querySelector('.lvbtns');if(btns&&!$('#lvBell')){btns.insertAdjacentHTML('afterbegin',`<div class="bellw"><button class="btn" type="button" id="lvBell" title="${esc(tr('Avvisi della sessione'))}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg><i></i></button><div id="lvBellList" class="belllist" hidden></div></div>`);
      $('#lvBell').onclick=()=>{const l=$('#lvBellList');l.hidden=!l.hidden;if(!l.hidden){bellList();LIVE.bellSeen=Date.now();bellUpdate();}};}
    // ---------- 2. Panoramica: the essentials first (car, gaps, pace, map), the detail panels after them ----------
    const ov=v.querySelector('.lvsub[data-p="ov"]');const first=ov&&ov.querySelector(':scope > .lvgrid');const gw=$('#lvGwOv')?.closest('.panel'),tf=$('#lvTraf')?.closest('.panel');
    if(first){const near=ov.querySelector(':scope > .lvgrid3');if(tf)first.after(tf);if(gw)(near||tf||first).after(gw);}
    bellUpdate();};})();

// ---------- 3. welcome page when nothing is open; a slim line on the other tabs ----------
function welcomeHTML(){const mine=lds().filter(x=>!x.sample).slice(-4).reverse();const team=teamParse(LS.get('live:team',''));const local=isBridgeHost();const nLib=(typeof SETLIB!=='undefined'?SETLIB.length:0);
  const card=(cls,title,body,btns)=>`<div class="wcard ${cls}"><h3>${title}</h3>${body}<div class="wbtns">${btns}</div></div>`;
  return `<div class="wtop"><div class="ey">Data Engineer</div><h1>${tr('Cosa vuoi fare?')}</h1></div><div class="wgrid">
    ${card('w1',tr('Analizza una sessione'),`<p>${tr('Trascina qui la telemetria .ld e i risultati .xml della stessa uscita in pista. Il setup .svm è facoltativo.')}</p>${mine.length?`<div class="wlist">${mine.map(S=>`<button type="button" class="wsess" data-id="${esc(S.id)}">${esc(S.label)}</button>`).join('')}</div>`:''}`,
      `<button class="btn primary" type="button" data-w="load">${tr('Carica file')}</button><button class="btn" type="button" data-w="sync">${tr('Aggiorna da LMU')}</button>`)}
    ${card('w2',tr('Muretto live'),`<p><span class="dot ${local?'good':''}"></span> ${local?tr('Bridge di questo PC collegato'):tr('Apri il programma Data Engineer per la telemetria di questo PC')}</p><p><span class="dot ${team?'good':''}"></span> ${team?`${tr('Squadra')}: <b>${esc(team.n||tr('collegata'))}</b>`:tr('Nessuna squadra: creala o entra con il codice')}</p>`,
      `<button class="btn primary" type="button" data-w="live">${tr('Apri il Muretto')}</button>`)}
    ${card('w3',tr('Setup'),`<p>${nLib?`${nLib} ${tr('setup in libreria')}. `:''}${tr('Generatore di setup, dottore, confronto tra setup e analisi delle sospensioni.')}</p>`,`<button class="btn primary" type="button" data-w="setup">${tr('Apri Setup')}</button>`)}</div>`;}
(function(){const rh=renderHero;window.renderHero=renderHero=function(){rh();const h=$('#hero');if(!h)return;const a=active();h.classList.toggle('welcome',!a&&curView()==='stint');h.classList.toggle('slim',!a&&curView()!=='stint');
    if(a)return;
    if(curView()==='stint'){h.innerHTML=welcomeHTML();h.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{const w=b.dataset.w;if(w==='load')$('#fileIn').click();else if(w==='sync')syncLMU();else showView(w);});
      h.querySelectorAll('.wsess').forEach(b=>b.onclick=()=>{$('#gSess').value=b.dataset.id;LS.set('sess',b.dataset.id);renderHero();RENDER[curView()]();});}
    else{h.innerHTML=`<div class="muted small">${tr('Nessuna telemetria aperta.')} <button class="btn" type="button" id="hLoad">${tr('Carica file')}</button></div>`;$('#hLoad').onclick=()=>$('#fileIn').click();}};
  const rs=RENDER.stint;RENDER.stint=()=>{rs();if(!active())$('#stBody').innerHTML='';};
  // ---------- 6. the session menu only when there is something to choose ----------
  const fs=fillSelects;window.fillSelects=fillSelects=function(){fs();const g=$('#gSess');if(g)g.hidden=!g.options.length;};})();

// ---------- 4. Setup without telemetry: the panels that need it step aside, one line says what to load ----------
setTimeout(()=>{const gen=$('#genP');const top=$('#v-setup > .panel');if(gen&&top&&top!==gen)top.after(gen); // the generator right under the setup choice
  if(gen&&!$('#suNoTele'))gen.insertAdjacentHTML('afterend',`<div class="panel muted small" id="suNoTele" hidden>${tr('Apri una telemetria .ld (con il .svm della stessa auto) per i controlli automatici, le pressioni da cambiare, sospensioni e ammortizzatori e lo storico dei setup.')}</div>`);
  const base=RENDER.setup;RENDER.setup=()=>{base();const S=active()?.S;['#suDiag','#suTyre','#suSusp','#suHist'].forEach(id=>{const p=$(id)?.closest('.panel');if(p)p.hidden=!S;});const n=$('#suNoTele');if(n)n.hidden=!!S;};
  if(curView()==='setup')RENDER.setup();},0);

// ---------- 5. long explanations under a small "i" in the panel title ----------
function infoize(){document.querySelectorAll('main .panel p.muted.small:not([data-inf])').forEach(p=>{p.dataset.inf=1;if(p.textContent.trim().length<110||p.querySelector('input,select,button,a'))return;
  const panel=p.closest('.panel');const h=panel&&panel.querySelector(':scope > .panel-h');if(!h)return;p.classList.add('infop');
  if(!h.querySelector('.infob')){const b=document.createElement('button');b.type='button';b.className='infob';b.textContent='i';b.title=tr('Come si legge');b.setAttribute('aria-label',tr('Come si legge'));b.onclick=()=>panel.classList.toggle('showinfo');h.appendChild(b);}});}
(function(){let pend=0;const m=$('main');if(!m)return;new MutationObserver(()=>{if(pend)return;pend=requestAnimationFrame(()=>{pend=0;infoize();});}).observe(m,{childList:true,subtree:true});})();
