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
// One invitation surface for both the sidebar and the Pit wall. Clipboard failure never reports success.
async function inviteCopy(text,field){
  try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(text);toast(tr('Copiato. Incollalo nella chat della squadra.'));return true;}
  catch(e){field.focus();field.select();toast(tr('Copia manualmente il testo selezionato con Ctrl+C.'));return false;}
}
function inviteFriend(){
  let m=$('#mInvite');if(!m){m=document.createElement('div');m.id='mInvite';m.className='modal';m.hidden=true;document.body.append(m);}
  const code=LS.get('live:team','');const team=!liveOff()&&teamParse(code);const url=team?teamInviteUrl():'';const web=team?engineerUrl():'';const txt=friendMessage();
  m.innerHTML=`<div class="mbox invitebox" role="dialog" aria-modal="true" aria-labelledby="inviteTitle">
    <div class="panel-h"><div><div class="ey">${tr('CORRI IN SQUADRA')}</div><h2 id="inviteTitle">${tr('Invita un compagno')}</h2></div><button type="button" class="btn" data-close>${tr('Chiudi')}</button></div>
    <p class="inviteintro">${tr('Un messaggio pronto, poi siete nello stesso Muretto.')}</p>
    <ol class="invitesteps"><li><b>01</b><span>${tr('Scarica Data Engineer')}<small>${tr('Il programma va avviato sul PC del compagno.')}</small></span></li><li><b>02</b><span>${tr('Apri il link squadra')}<small>${tr('Con Data Engineer acceso, il link apre il suo Muretto locale.')}</small></span></li><li><b>03</b><span>${tr('Controlla il collegamento')}<small>${tr('Stato del Muretto mostra quando arrivano i dati dei compagni.')}</small></span></li></ol>
    ${team?`<div class="invitelink"><div class="inviteheading"><b>${esc(team.n||tr('Squadra'))}</b><span class="tst good">${tr('Link pronto')}</span></div><label for="inviteUrl">${tr('Link per chi guida (con il programma acceso)')}</label><div class="invitecopy"><input id="inviteUrl" type="text" readonly value="${esc(url)}"><button type="button" class="btn primary" id="inviteLinkCopy">${tr('Copia link squadra')}</button></div><p class="muted small">${tr('Il link funziona sul PC di chi lo apre, con Data Engineer avviato. Condividilo solo con la squadra.')}</p></div>
    <div class="invitelink"><div class="inviteheading"><b>${tr('Per chi fa l\'ingegnere')}</b><span class="tst good">${tr('niente da installare')}</span></div><label for="inviteWeb">${tr('Link del Muretto (browser)')}</label><div class="invitecopy"><input id="inviteWeb" type="text" readonly value="${esc(web)}"><button type="button" class="btn primary" id="inviteWebCopy">${tr('Copia link ingegnere')}</button></div><p class="muted small">${tr('Si apre da PC, tablet o telefono e mostra il Muretto della squadra. Il programma serve solo a chi guida. Chi ha il link vede i dati: mandalo solo alla squadra.')}</p></div>`:`<div class="invitenote"><b>${tr('Prima collega una squadra')}</b><p>${tr('Puoi già condividere il programma. Per aggiungere il link al messaggio, crea una squadra o entra con un invito.')}</p><button type="button" class="btn" id="inviteCreate">${tr('Crea squadra')}</button><button type="button" class="btn" id="inviteJoin">${tr('Ho già un invito')}</button></div>`}
    <label class="invitemessage" for="inviteMessage">${tr('Messaggio per Discord o WhatsApp')}<textarea id="inviteMessage" readonly rows="7"></textarea></label>
    <div class="inviteactions"><span class="muted small">${tr('Include download e istruzioni di avvio.')}</span><button type="button" class="btn primary" id="inviteMessageCopy">${tr('Copia messaggio completo')}</button></div></div>`;
  $('#inviteMessage').value=txt;
  $('#inviteMessageCopy').onclick=()=>inviteCopy(txt,$('#inviteMessage'));
  const link=$('#inviteLinkCopy');if(link)link.onclick=()=>inviteCopy(url,$('#inviteUrl'));
  const wl=$('#inviteWebCopy');if(wl)wl.onclick=()=>inviteCopy(web,$('#inviteWeb'));
  const create=$('#inviteCreate');if(create)create.onclick=()=>{m.hidden=true;liveNewTeam();};
  const join=$('#inviteJoin');if(join)join.onclick=()=>{m.hidden=true;showView('live');$('#lvJoin')?.click();};
  openModal('#mInvite');m.querySelector('[data-close]').focus();
  m.onkeydown=e=>{if(e.key==='Escape'){m.hidden=true;$('#proInvite')?.focus();}if(e.key==='Tab'){const els=[...m.querySelectorAll('button,input,textarea')].filter(x=>!x.disabled);const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
}
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
