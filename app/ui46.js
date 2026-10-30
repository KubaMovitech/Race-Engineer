// ================= MOTION: page entry, scroll reveal, loading skeleton, toast kinds =================
// Only transform and opacity move, 150–400 ms, and nothing moves with prefers-reduced-motion (see pro.css «motion»).
// The Muretto refreshes every second: it never gets entry animations, so live numbers do not flicker.
const MOTION_OK=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- page entry: the panels of the new page come in one after the other ----------
let pvTimer=0,pvIO=null;
function pvEnter(v){const sec=$('#v-'+v);if(!sec||v==='live'||!MOTION_OK())return;
  clearTimeout(pvTimer);sec.classList.remove('pv-enter');void sec.offsetWidth;   // restart the animation on the same page
  const kids=[...sec.querySelectorAll(':scope>.panel,:scope>div>.panel,:scope>div>div>.panel')].slice(0,12);
  kids.forEach((k,i)=>k.style.setProperty('--pv-i',Math.min(i,8)));
  sec.classList.add('pv-enter');pvTimer=setTimeout(()=>sec.classList.remove('pv-enter'),700);
  // further down the page: shown when they scroll into view, once
  pvIO?.disconnect();$$('.panel.pr-wait').forEach(p=>p.classList.remove('pr-wait'));pvIO=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('pr-in');e.target.classList.remove('pr-wait');pvIO.unobserve(e.target);}}),{rootMargin:'0px 0px -40px 0px'});
  requestAnimationFrame(()=>[...sec.querySelectorAll('.panel')].forEach(p=>{if(p.offsetParent!==null&&p.getBoundingClientRect().top>innerHeight&&!p.parentElement.closest('.pr-wait')){p.classList.add('pr-wait');pvIO.observe(p);}}));}
(function(){const sv=showView;window.showView=showView=function(v){sv(v);try{pvEnter(v);}catch(e){}};})();

// ---------- loading: a skeleton of the session strip while the files are read ----------
(function(){const hf=window.handleFiles;if(typeof hf!=='function')return;window.handleFiles=handleFiles=async function(files){
  const main=$('main');let sk=null;
  if(main&&files&&files.length){sk=document.createElement('div');sk.className='pskel';sk.setAttribute('aria-busy','true');sk.setAttribute('aria-label',tr('Carico i file…'));
    sk.innerHTML=`<div class="sk sk-t"></div><div class="skr"><div class="sk sk-b"></div><div class="sk sk-b"></div><div class="sk sk-b"></div></div><div class="sk sk-l"></div>`;
    const at=$('#hero');if(at)at.before(sk);else main.prepend(sk);document.body.classList.add('is-loading');}
  try{return await hf.apply(this,arguments);}finally{sk?.remove();document.body.classList.remove('is-loading');}};})();

// ---------- toasts: success, error or plain information, from the words of the message ----------
(function(){const t0=window.toast;if(typeof t0!=='function')return;window.toast=toast=function(m,...a){t0(m,...a);const el=$('#toastStack')?.lastElementChild;if(!el||el.dataset.kind)return;const s=String(m);
  const kind=/errore|non riesco|impossibile|non valid|fallit|non trovat|rifiutat|error|failed|invalid|not found/i.test(s)?'err':/^(caricat|salvat|copiat|inviat|aggiornat|fatto|✓|loaded|saved|copied|sent|updated|done)/i.test(s)?'ok':'info';
  el.dataset.kind=kind;el.insertAdjacentHTML('afterbegin',`<i class="tk" aria-hidden="true">${kind==='ok'?'✓':kind==='err'?'!':'i'}</i>`);if(kind==='err')el.setAttribute('role','alert');};})();
