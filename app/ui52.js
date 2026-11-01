// ================= MURETTO: guided start for teammates, clear state, profiles, server check =================
// On top of the Muretto: three steps (program running → team → link working) with the state of app, game, team and
// data, and what to do when a step fails. renderLive (ui14.js) puts this panel at the top of #lvHelp.
// Profiles only choose the first screens and the alerts: they are not access control (whoever has the link or the
// code sees all the team's data). Codes and invite links are never written to the console or to logs.

const MU_PROF={pilota:{l:'Pilota',sub:'ov',notif:'class',d:'Panoramica della tua auto, avvisi su di te e i rivali di classe'},
  ingegnere:{l:'Ingegnere',sub:'str',notif:'all',d:'Strategia e classifica, avvisi su tutte le auto'}};
const muLocal=()=>/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&!!location.port;
// the freshest car data received, from this PC or from the team
function muAge(){let t=0;Object.values(LIVE.drivers||{}).forEach(D=>{if(D.carAt>t)t=D.carAt;});return t?(Date.now()-t)/1000:null;}
function muSteps(){const S=LIVE.status||{},team=teamParse(LS.get('live:team','')),local=muLocal();const me=LIVE.drivers?.[LIVE.myId||'local'];const age=muAge();const R=[];
  // 1. the program
  R.push(local?{k:'good',t:tr('Programma avviato su questo PC'),d:S.local==='on'?tr('il bridge risponde'):tr('il bridge non risponde: chiudi e riapri DataEngineerBridge.exe')}
    :{k:'bad',t:tr('Programma non avviato da qui'),d:tr('Apri DataEngineerBridge.exe sul PC con cui corri: la pagina giusta è http://localhost:8790. I link di invito funzionano solo con il programma avviato sul PC di chi li apre.')});
  // 2. the game
  const myFresh=me&&me.carAt&&Date.now()-me.carAt<8000;
  R.push(myFresh?{k:'good',t:tr('Le Mans Ultimate in pista'),d:tr('i dati della tua auto arrivano')}:local&&S.local==='on'?{k:'warn',t:tr('Gioco non in pista'),d:tr('avvia Le Mans Ultimate ed esci dai box: i dati partono da soli')}:{k:'muted',t:tr('Gioco'),d:tr('serve il programma avviato')});
  // 3. the team
  if(!team)R.push({k:'warn',t:tr('Nessuna squadra'),d:tr('apri il link di invito che ti hanno mandato (con il programma avviato) oppure crea una squadra'),act:'team'});
  else{const st=S.team;const host=team.r||LS.get('relay:url','')?tr('server della squadra'):team.h;
    R.push(st==='on'?{k:'good',t:`${tr('Squadra')} «${team.n||tr('senza nome')}»`,d:`${tr('collegata a')} ${host}`}
      :st==='refused'?{k:'bad',t:tr('Il server rifiuta l\'accesso'),d:`${host}: ${tr('utente o password del server sbagliati. Chiedi un nuovo invito a chi ha creato la squadra.')}`}
      :st==='blocked'?{k:'bad',t:tr('Server non raggiungibile'),d:`${host}: ${tr('la rete o il firewall bloccano il collegamento. Prova un\'altra rete; riprovo da solo ogni pochi secondi.')}`}
      :{k:'warn',t:tr('Collegamento alla squadra…'),d:tr('riprovo da solo: se resta così per più di un minuto controlla la connessione a internet')});}
  // 4. the link between PCs: proven only when another driver's data arrives
  if(team){const others=Object.values(LIVE.drivers||{}).filter(D=>D.id&&D.id!==LIVE.myId&&D.id!=='local'&&Date.now()-(D.seen||0)<60000);
    R.push(others.length?{k:'good',t:`${others.length} ${others.length===1?tr('compagno collegato'):tr('compagni collegati')}`,d:others.map(D=>(D.hi?.name||D.id).split(' ')[0]).join(', ')}
      :{k:'muted',t:tr('Nessun compagno visto'),d:tr('il collegamento tra PC è verificato solo quando arrivano i dati di un compagno')});}
  // 5. how fresh the data are
  if(age!=null)R.push(age<8?{k:'good',t:tr('Dati aggiornati'),d:`${tr('ultimo dato')} ${fx(age,0)} s ${tr('fa')}`}:age<60?{k:'warn',t:tr('Dati in ritardo'),d:`${tr('ultimo dato')} ${fx(age,0)} s ${tr('fa')}: ${tr('riconnessione automatica')}`}:{k:'bad',t:tr('Dati vecchi'),d:`${tr('ultimo dato')} ${fx(age/60,0)} min ${tr('fa')}: ${tr('quelli sotto non sono in diretta')}`});
  return R;}
function muGuideHTML(){if(LIVE.rec)return '';const R=muSteps();const ok=R.every(r=>r.k==='good');const prof=LS.get('mu:prof','');const open=LS.get('mu:open',null);const isOpen=open==null?R.some(r=>r.k==='bad'):open;  // open by itself only when something blocks
  return `<details class="muguide"${isOpen?' open':''}><summary><b>${tr('Stato del Muretto')}</b>${R.map(r=>`<i class="mud ${r.k}" title="${esc(r.t)}"></i>`).join('')}<span class="muted small">${ok?tr('tutto collegato'):tr('apri per vedere cosa manca')}</span></summary>
    <ol class="musteps">${R.map(r=>`<li class="${r.k}"><b>${esc(r.t)}</b><span>${esc(r.d)}</span>${r.act==='team'?`<span class="mubt"><button type="button" class="btn" data-mu="join">${tr('Entra con codice')}</button><button type="button" class="btn" data-mu="new">${tr('Crea squadra')}</button></span>`:''}</li>`).join('')}</ol>
    <div class="muprof"><span>${tr('Profilo')}</span>${Object.entries(MU_PROF).map(([k,p])=>`<label class="chk"><input type="radio" name="muprof" value="${k}"${prof===k?' checked':''}> <b>${tr(p.l)}</b> <small class="muted">${tr(p.d)}</small></label>`).join('')}
      <small class="muted">${tr('Il profilo sceglie solo schermate e avvisi iniziali: non è un controllo degli accessi. Chi ha il link o il codice vede tutti i dati della squadra.')}</small></div></details>`;}
function muBind(){const h=$('#lvHelp');if(!h||h.dataset.mu)return;h.dataset.mu=1;
  h.addEventListener('click',e=>{const b=e.target.closest('[data-mu]');if(!b)return;if(b.dataset.mu==='new')liveNewTeam();if(b.dataset.mu==='join')$('#lvJoin')?.click();});
  h.addEventListener('toggle',e=>{if(e.target.classList?.contains('muguide'))LS.set('mu:open',e.target.open);},true);
  h.addEventListener('change',e=>{if(e.target.name!=='muprof')return;const p=MU_PROF[e.target.value];if(!p)return;LS.set('mu:prof',e.target.value);LS.set('live:notif',p.notif);const n=$('#lvNotif');if(n)n.value=p.notif;
    $(`#v-live .lvtabs [data-sub="${p.sub}"]`)?.click();toast(tr('Profilo')+': '+tr(p.l));});}

// ---------- race view: the followed car in one line ----------
// Uses what the Muretto already computes (liveRows, carStats, liveStrat): nothing new is estimated here. The next stop is
// the current lap plus the laps the fuel or the virtual energy still allow, whichever ends first.
function lvRaceBar(x,al){const {sc,kind,c,S2,me,rec,now}=x;if(rec||!sc||kind!=='race'||!me)return '';
  const rows=x.rows;const cl=rows.filter(r=>r.cls===me.cls).sort((a,b)=>a.pos-b.pos);const i=cl.indexOf(me);const ah=cl[i-1],bh=cl[i+1];
  const cs=typeof carStats==='function'?carStats(me.veh,me):null;const lt=cs?.pace5||me.estL;
  const gap=o=>o&&Number.isFinite(lt)?Math.abs((me.gapL+me.lapsL*lt)-(o.gapL+o.lapsL*lt)):NaN;
  const left=S2&&Number.isFinite(S2.left)?S2.left:NaN;const next=Number.isFinite(left)&&Number.isFinite(me.laps)?me.laps+Math.floor(left):NaN;
  const age=LIVE.scAt?(now-LIVE.scAt)/1000:NaN;const old=age>8;
  const cell=(l,v,s,cls='')=>`<div class="lrb ${cls}"><span>${l}</span><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
  return `<div class="panel lvrace${old?' lvold':''}">${cell(tr('Auto seguita'),esc((c?.drv||me.drv||'').split(' ').slice(-1)[0]||me.veh),esc(me.cls||''))}
    ${cell(tr('Posizione'),'P'+me.pic,'P'+me.pos+' '+tr('assoluto'))}
    ${cell(tr('Davanti'),ah?'+'+fx(gap(ah),1)+' s':'—',ah?esc(ah.drv):tr('in testa'))}${cell(tr('Dietro'),bh?'−'+fx(gap(bh),1)+' s':'—',bh?esc(bh.drv):'')}
    ${cell(tr('Autonomia'),Number.isFinite(left)?fx(left,1)+' '+tr('giri'):'—',S2?.lim==='ve'?tr('limite: energia'):S2?.lim?tr('limite: carburante'):'',Number.isFinite(left)&&left<2.2?'bad':Number.isFinite(left)&&left<4?'warn':'')}
    ${cell(tr('Prossima sosta'),Number.isFinite(next)?tr('giro')+' '+next:'—',Number.isFinite(left)?tr('se il consumo resta questo'):'')}
    ${cell(tr('Avvisi'),al.length?String(al.length):'0',al[0]?esc(al[0][1]):tr('nessuno'),al.some(a=>a[0]==='bad')?'bad':al.length?'warn':'')}
    ${old?`<div class="lrbold">${tr('Dati vecchi di')} ${fx(age,0)} s: ${tr('non sono in diretta')}</div>`:''}</div>`;}

// ---------- the server of a new team: checked from this PC before using it ----------
// connects with MQTT over WebSocket and waits for the server's answer (CONNACK); nothing is sent to any topic
function mqttProbe({host,wp,tls=true,user,pass},ms=6000){return new Promise(res=>{let ws,fin=false;const done=r=>{if(fin)return;fin=true;clearTimeout(to);try{ws&&ws.close();}catch(e){}res(r);};
  const to=setTimeout(()=>done({ok:false,why:tr('nessuna risposta in 6 s')}),ms);
  try{ws=new WebSocket((tls===false?'ws://':'wss://')+host+':'+wp+'/mqtt',['mqtt']);}catch(e){done({ok:false,why:e.message});return;}
  const te=new TextEncoder(),str=s=>{const b=te.encode(s);return [b.length>>8,b.length&255,...b];};ws.binaryType='arraybuffer';
  ws.onopen=()=>{let fl=2;const pl=[...str('de-probe-'+Math.random().toString(36).slice(2,8))];if(user){fl|=128;pl.push(...str(user));if(pass){fl|=64;pl.push(...str(pass));}}const body=[...str('MQTT'),4,fl,0,30,...pl];ws.send(new Uint8Array([0x10,body.length,...body]));};
  ws.onmessage=e=>{const d=new Uint8Array(e.data);if(d[0]>>4===2)done(d[3]===0?{ok:true}:{ok:false,why:tr('accesso rifiutato dal server')+` (${d[3]})`});};
  ws.onclose=()=>done({ok:false,why:tr('server non raggiungibile da questa rete')});ws.onerror=()=>{};});}
setTimeout(()=>{const m=$('#mLive');if(!m||$('#lvProbe'))return;const sel=$('#lvBroker');
  // the server choice is an advanced setting: the free public servers are not run by Data Engineer, so they are checked here first
  const g=sel?.closest('.setgrid');const box=document.createElement('details');box.className='muadv';box.innerHTML=`<summary>${tr('Impostazioni avanzate: server della squadra')}</summary><p class="muted small">${tr('I server pubblici gratuiti non sono gestiti da Data Engineer e possono essere lenti o non raggiungibili: prima di creare la squadra il collegamento viene provato da questo PC.')}</p>`;
  if(g&&sel){const lab=sel.closest('label');box.append(lab);box.append($('#lvCustom'));g.after(box);}
  const row=$('#lvMake')?.parentElement;row?.insertAdjacentHTML('afterbegin',`<button type="button" class="btn" id="lvProbe">${tr('Prova il server')}</button><span id="lvProbeR" class="small" aria-live="polite"></span>`);
  const cur=()=>{if(sel.value==='c')return {host:$('#lvH').value.trim(),wp:+$('#lvWP').value||8884,user:$('#lvU').value.trim(),pass:$('#lvP').value};const b=BROKERS[+sel.value]||BROKERS[0];return {host:b[1],wp:b[2]};};
  const probe=async()=>{const o=cur();const r=$('#lvProbeR');if(!o.host){r.textContent=tr('Inserisci l\'indirizzo del server');return null;}r.className='small muted';r.textContent=tr('Provo il collegamento…');const x=await mqttProbe(o);
    r.className='small '+(x.ok?'pos':'w');r.textContent=x.ok?`✓ ${o.host}: ${tr('risponde da questo PC')}`:`✗ ${o.host}: ${x.why}`;return x;};
  $('#lvProbe').onclick=probe;
  // creating the team: check the server first; if it does not answer, say so and ask
  const mk=$('#lvMake');if(mk){mk.addEventListener('click',async e=>{if(mk.dataset.ok==='1'){mk.dataset.ok='';return;}e.stopImmediatePropagation();e.preventDefault();const x=await probe();
      if(!x)return;if(!x.ok&&!confirm(tr('Il server non risponde da questo PC. Creare comunque la squadra?')))return;mk.dataset.ok='1';mk.click();},true);}},0);

(function(){const st=document.createElement('style');st.textContent=`
.muguide{border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:8px 0}.muguide summary{cursor:pointer;display:flex;gap:8px;align-items:center;list-style:none}.muguide summary::-webkit-details-marker{display:none}
.mud{width:10px;height:10px;border-radius:50%;background:var(--muted)}.mud.good{background:var(--good)}.mud.warn{background:var(--warn)}.mud.bad{background:var(--bad)}.mud.muted{background:#555}
.musteps{margin:10px 0 6px;padding-left:22px;display:grid;gap:6px}.musteps li{padding-left:4px}.musteps li b{display:block;font-weight:600}.musteps li span{color:var(--psil,#C9CDD3);font-size:.88rem}
.musteps li.good::marker{color:var(--good)}.musteps li.warn::marker{color:var(--warn)}.musteps li.bad::marker{color:var(--bad)}.musteps li.bad b{color:var(--bad)}.musteps li.warn b{color:var(--warn)}
.mubt{display:flex!important;gap:6px;margin-top:4px}.mubt .btn{height:30px}
.muprof{display:flex;gap:6px 14px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--line);padding-top:8px;margin-top:6px}.muprof>span{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.muprof>small{flex-basis:100%}
.lvrace{display:flex;flex-wrap:wrap;gap:0;padding:0!important;margin-bottom:10px;overflow:hidden}.lrb{flex:1 1 130px;padding:10px 14px;border-right:1px solid var(--line);min-width:0}.lrb:last-of-type{border-right:0}
.lrb span{display:block;font-size:.74rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.lrb b{display:block;font:600 1.35rem var(--f-mono);color:#fff;white-space:nowrap}.lrb small{display:block;color:var(--psil,#C9CDD3);font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lrb.warn b{color:var(--warn)}.lrb.bad b{color:var(--bad)}.lvrace.lvold .lrb b{opacity:.55}.lrbold{flex-basis:100%;padding:6px 14px;background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn);font-size:.86rem}
.muadv{margin:10px 0}.muadv summary{cursor:pointer;color:var(--psil,#C9CDD3)}#lvProbeR{align-self:center;margin:0 8px}
`;document.head.appendChild(st);})();
