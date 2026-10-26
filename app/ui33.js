// ================= SKINS: workstation for the analysis, timing wall for the Muretto =================
// The look follows the section (see skin.css); nothing is moved or hidden, so every number stays where it was.
document.documentElement.dataset.look='carbon';
function applySkin(){const v=curView();document.documentElement.dataset.skin=v==='live'?'wall':'ws';rcBar();}
(function(){const sv=showView;window.showView=showView=function(v){document.documentElement.dataset.skin=v==='live'?'wall':'ws';sv(v);rcBar();};})();
setTimeout(applySkin,0);

// ---------- race control: the last events of the Muretto run along the bottom ----------
const strip=h=>{const d=document.createElement('div');d.innerHTML=String(h).replace(/<(div|br)\b[^>]*>/gi,' · ');return d.textContent.replace(/\s+/g,' ').replace(/^( · )+|( · )+$/g,'').replace(/( · )+/g,' · ').trim();};
function rcBar(){let b=$('#rcBar');const on=curView()==='live';
  if(!on){if(b)b.hidden=true;return;}
  if(!b){b=document.createElement('div');b.id='rcBar';b.innerHTML=`<div class="rcl" title="${esc(tr('Eventi'))}">${tr('Direzione gara')}</div><div class="rct"><div class="rcs"></div></div>`;document.body.appendChild(b);
    b.querySelector('.rcl').onclick=()=>$('#v-live .lvtabs button[data-sub="ev"]')?.click();}
  b.hidden=false;const N=typeof NOTIF!=='undefined'?NOTIF.slice(0,10):[];
  // the pop-up notices first; before any arrives, the event list the Muretto already shows
  const L=N.length?[]:[...$$('#lvEvShort .lve, #lvEv .lve')].slice(0,10);
  const html=N.length?N.map(n=>`<span class="${esc(n.k||'info')}"><i>${new Date(n.at).toTimeString().slice(0,5)}</i><b>${esc(strip(n.t))}</b> · ${esc(strip(n.s||''))}</span>`).join('')
    :L.length?L.map(e=>`<span class="${esc([...e.classList].find(c=>c!=='lve')||'info')}"><i>${esc(strip(e.querySelector('.t')?.innerHTML||''))}</i>${esc(strip(e.lastElementChild?.innerHTML||''))}</span>`).join('')
    :`<span><i>—</i>${tr('Nessun evento per ora.')}</span>`;
  const s=b.querySelector('.rcs');if(s.dataset.h!==html){s.dataset.h=html;s.innerHTML=html;s.style.setProperty('--rcdur',Math.max(25,strip(html).length/7)+'s');}}
setInterval(()=>{if(curView()==='live')rcBar();},3000);
