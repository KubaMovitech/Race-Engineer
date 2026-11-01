// ================= 2.16: tidier pages (details on request) and «Invita un amico» =================

// ---------- 1. each busy page shows the main things; the rest opens with «Mostra dettagli» ----------
// [view, setup tab or '', selectors of the panels that are details]
const ADV=[['stint','',['#stBody>:not(.dash)']],
  ['tele','',['#twBody .pevp','#twBody .twlow']],
  ['setup','eng',['#suEng .egrid','#suAI']],
  ['setup','set',['#suHistP','#v-setup .panel:has(#suSheet)']]];
const advKey=(v,t)=>'adv:'+v+(t?':'+t:'');
let advQ=0;
function advApply(){if(!proLook())return;const v=curView();const t=v==='setup'?LS.get('su:tab','eng'):'';
  $$('.adv-off').forEach(e=>e.classList.remove('adv-off'));$$('.advbar').forEach(b=>{if(b.dataset.k!==advKey(v,t))b.remove();});
  const R=ADV.find(r=>r[0]===v&&r[1]===t);if(!R)return;const sec=$('#v-'+v);if(!sec)return;
  const els=[...new Set(R[2].flatMap(s=>{try{return [...sec.querySelectorAll(s)];}catch(e){return [];}}))].filter(e=>!e.classList.contains('advbar')&&!e.classList.contains('sutab-off'));
  if(!els.length)return;const open=LS.get(advKey(v,t),false)===true;
  els.forEach(e=>e.classList.toggle('adv-off',!open));
  let bar=sec.querySelector('.advbar');
  if(!bar){bar=document.createElement('div');bar.className='advbar';bar.dataset.k=advKey(v,t);bar.innerHTML='<button type="button" class="btn" aria-expanded="false"></button><span class="muted small"></span>';
    bar.querySelector('button').onclick=()=>{LS.set(advKey(v,t),!(LS.get(advKey(v,t),false)===true));advApply();};}
  // the button sits just before the first detail panel, so the page reads: main things, then «Mostra dettagli»
  if(bar.nextElementSibling!==els[0])els[0].before(bar);
  // set the words only when they change: this runs on every change of the page
  const b=bar.querySelector('button'),sp=bar.querySelector('span');const bt=open?tr('Nascondi i dettagli'):tr('Mostra dettagli'),st=open?'':`${els.length} ${els.length===1?tr('pannello in più'):tr('pannelli in più')}`;
  b.setAttribute('aria-expanded',open);if(b.textContent!==bt)b.textContent=bt;if(sp.textContent!==st)sp.textContent=st;}
setTimeout(()=>{const m=$('main');if(!m)return;new MutationObserver(()=>{if(advQ)return;advQ=requestAnimationFrame(()=>{advQ=0;advApply();});}).observe(m,{childList:true,subtree:true});advApply();},0);

// ---------- 2. «Invita un amico»: one message with the download and, if there is a team, the way in ----------
function friendMessage(){const base=(typeof UPD!=='undefined'&&UPD.base)||(typeof DEFAULT_UPD!=='undefined'?DEFAULT_UPD:'');const exe=base.replace(/\/?$/,'/')+'DataEngineerBridge.exe';
  const team=typeof teamInviteUrl==='function'&&!liveOff()?teamInviteUrl():'';
  const L=[tr('Ciao! Uso Data Engineer per la telemetria di Le Mans Ultimate. Per averlo:'),
    `1) ${tr('Scarica il programma')}: ${exe}`,
    `2) ${tr('Aprilo. Se Windows avvisa, premi «Ulteriori informazioni» e poi «Esegui comunque». Si aggiorna da solo: non devi fare altro.')}`,
    `3) ${tr('Nelle opzioni del gioco attiva la telemetria MoTeC: le sessioni compaiono da sole nella Libreria.')}`];
  if(team)L.push(`4) ${tr('Per entrare nel nostro Muretto, con il programma acceso apri questo link')}: ${team}`);
  return L.join('\n');}
function inviteFriend(){const txt=friendMessage();navigator.clipboard?.writeText(txt).catch(()=>{});
  openCode({title:tr('Invita un amico'),help:tr('Messaggio copiato: incollalo su WhatsApp, Discord o dove vuoi. Contiene il link per scaricare il programma')+(txt.includes('#join')?' '+tr('e quello per entrare nella squadra: mandalo solo a chi corre con te.'):'.'),text:txt});
  if(navigator.share)try{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=tr('Condividi…');b.onclick=()=>navigator.share({text:txt}).catch(()=>{});const box=$('.modal:not([hidden]) .mbox');box?.querySelector('.panel-h')?.append(b);}catch(e){}}
setTimeout(()=>{const nav=$('#proNav');if(nav&&!$('#proInvite')){const b=document.createElement('button');b.type='button';b.id='proInvite';b.className='pinv';b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M18 8v6M15 11h6"/></svg><span>${tr('Invita un amico')}</span>`;b.onclick=inviteFriend;
    const before=nav.querySelector('#proLogo')||nav.querySelector('.pfoot');before?before.before(b):nav.append(b);}
  const row=$('#mSettings .lookrow');if(row&&!$('#setInvite')){row.insertAdjacentHTML('beforeend',`<button type="button" class="btn" id="setInvite">${tr('Invita un amico')}</button>`);$('#setInvite').onclick=()=>{$('#mSettings').hidden=true;inviteFriend();};}},50);

(function(){const st=document.createElement('style');st.textContent=`
.adv-off{display:none!important}
.advbar{display:flex;align-items:center;gap:12px;margin:4px 0 16px;padding:10px 0;border-top:1px dashed var(--line)}
.advbar .btn{height:34px}
html:not([data-look="pro"]) .advbar{display:none}
.pinv{display:none}
html[data-look="pro"] .pinv{display:flex;align-items:center;gap:10px;margin:10px 4px 0;padding:9px 12px;border:1px dashed var(--line);border-radius:10px;background:transparent;color:var(--psil,#C9CDD3);cursor:pointer;font:600 .86rem var(--f-body);text-align:left}
html[data-look="pro"] .pinv:hover{border-color:var(--pacc);color:#fff}
html[data-look="pro"] .pinv svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;flex:none}
html[data-look="pro"] #proNav .pinv{margin-top:auto}html[data-look="pro"] #proNav .pinv+#proLogo{margin-top:12px}
@media (max-width:1100px){html[data-look="pro"] .pinv span{display:none}html[data-look="pro"] .pinv{justify-content:center}}
@media (max-width:760px){html[data-look="pro"] #proNav .pinv{display:none}}
`;document.head.appendChild(st);})();
