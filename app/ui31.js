// ================= TRAIETTORIE A CONFRONTO =================
// In the lap view the map can draw a second lap: the best lap or any other lap of the session.
// Zoom on a corner (wheel, buttons, or click its number) to see the two lines and how many metres apart they run.
function lapRefSel(){if($('#lapRef'))return $('#lapRef');const ch=$('#lapMapCh');if(!ch)return null;
  ch.insertAdjacentHTML('afterend',`<select id="lapRef" aria-label="${esc(tr('Confronta la traiettoria con'))}" title="${esc(tr('Confronta la traiettoria con'))}"></select>`);
  $('#lapRef').onchange=()=>{LS.set('lapRef',$('#lapRef').value);lapRefApply();};return $('#lapRef');}
function lapRefApply(){const sel=$('#lapRef');const C=lapCur;if(!sel||!C?.S||!lapMap)return;const v=sel.value;
  if(!v){lapMap.setOverlay(null);return;}const S=C.S;const ref=v==='best'?S.best:S.laps[+v];if(!ref||ref===C.lap){lapMap.setOverlay(null);return;}
  const g=lapGrid(S,ref,2,C.g.len);lapMap.setOverlay({lat:g.get('GPS Latitude'),lon:g.get('GPS Longitude')});}
(function(){const dl=drawLap;window.drawLap=drawLap=function(S,lap){dl(S,lap);const sel=lapRefSel();if(!sel)return;
  const laps=S.laps.map((l,i)=>[l,i]).filter(([l])=>l.complete&&l!==lap&&Number.isFinite(l.time));const want=LS.get('lapRef','best');
  sel.innerHTML=`<option value="">${tr('Traiettoria: nessun confronto')}</option>${S.best&&S.best!==lap?`<option value="best">${tr('Confronta con il miglior giro')} · ${fmtLap(S.best.time)}</option>`:''}${laps.map(([l,i])=>`<option value="${i}">${tr('Confronta con il giro')} ${l.num} · ${fmtLap(l.time)}</option>`).join('')}`;
  sel.value=[...sel.options].some(o=>o.value===want)?want:'';lapRefApply();};})();
