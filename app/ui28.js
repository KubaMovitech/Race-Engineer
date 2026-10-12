// ================= LIBRERIA AUTOMATICA E CONSENSO DEI SETUP SHOP =================

// ---------- 1. the library follows the game's Settings folder by itself (only in the app opened by the bridge) ----------
// the bridge lists the .svm files with size and time; only the new or changed ones are downloaded, the deleted ones leave
const LIBSYNC={busy:false,last:0,n:0,err:''};
async function libSync(quiet){if(!isBridgeHost()||LIBSYNC.busy)return;LIBSYNC.busy=true;const first=!LIBSYNC.last;
  try{const r=await (await fetch('/svmlib',{cache:'no-store'})).json();if(!r.ok){LIBSYNC.err=r.error||'';return;}LIBSYNC.err='';
    const man=LS.get('lib:auto',{});const now=new Set();const todo=[];
    r.files.forEach(f=>{const id='lib/auto/'+f.p;now.add(id);if(man[f.p]!==f.t+':'+f.s||!SETLIB.some(e=>e.id===id))todo.push(f);});
    let added=0,i=0;const one=async()=>{while(i<todo.length){const f=todo[i++];try{const res=await fetch('/svmlib/file?p='+encodeURIComponent(f.p),{cache:'no-store'});if(!res.ok)continue;
        await addFile('lib/auto/'+f.p,await res.arrayBuffer(),{persist:true});man[f.p]=f.t+':'+f.s;added++;}catch(e){console.warn(f.p,e);}}};
    await Promise.all(Array.from({length:6},one));
    // gone from the game folder: gone from the library
    let removed=0;for(let k=SETLIB.length-1;k>=0;k--){const e=SETLIB[k];if(e.id.startsWith('lib/auto/')&&!now.has(e.id)){IDB.del(e.id);delete man[e.id.slice(9)];SETLIB.splice(k,1);removed++;}}
    // the same file imported by hand before: keep only the automatic copy
    const auto=new Set(SETLIB.filter(e=>e.id.startsWith('lib/auto/')).map(e=>e.text));
    for(let k=SETLIB.length-1;k>=0;k--){const e=SETLIB[k];if(!e.id.startsWith('lib/auto/')&&auto.has(e.text)){IDB.del(e.id);SETLIB.splice(k,1);removed++;}}
    LS.set('lib:auto',man);LIBSYNC.n=r.files.length;LIBSYNC.last=Date.now();
    if(added||removed)LIBLEARN=null;if(!quiet&&added)toast(`${added} ${tr('setup nuovi dal gioco nella libreria')}`);
    if((added||removed||first)&&curView()==='setup')renderGen();}
  catch(e){LIBSYNC.err=e.message;if(curView()==='setup')renderGen();}finally{LIBSYNC.busy=false;}}
if(isBridgeHost()){setTimeout(()=>libSync(true),3000);setInterval(()=>libSync(false),120000);}

// ---------- 2. who made a setup: from the file name or the notes ----------
const SHOPS=[['GO',/^go\b|go ?setups/i],['HYMO',/^hymo|hymo ?setup/i],['TRT',/^trt\b/i],['bA',/^ba\d?_/i],['VMS',/\bvms\b/i],['NERT',/^nert/i]];
function libShop(e){const notes=((e.su.sec.GENERAL||[]).find(x=>x.key==='Notes')?.raw||'');for(const [n,re] of SHOPS)if(re.test(e.name)||re.test(notes))return n;return '';}

// ---------- 3. consensus: the best setup of each shop for that car, track and use; per setting the median click ----------
// where the shops agree the value is a safe bet; where they split, it is a matter of driving style worth trying
function libConsensus(car,track,type,style){const per=new Map();
  libRank(car,track,type,style).filter(e=>e.track===track&&e.type===type).forEach(e=>{const s=libShop(e)||'?';if(s!=='?'&&!per.has(s))per.set(s,e);});
  if(per.size<2)return null;const E=[...per.entries()];const K=(libLearn()[car]||{}).keys||{};const keys=new Map();
  E.forEach(([shop,e])=>Object.entries(e.su.sec).forEach(([sec,it])=>it.forEach(x=>{const ix=parseInt(x.raw,10);if(!Number.isFinite(ix)||/N\/A|Non-adjustable/i.test(x.disp))return;
    const k=sec+'|'+x.key;(keys.get(k)||keys.set(k,[]).get(k)).push({shop,ix,disp:x.disp});})));
  const rows=[];keys.forEach((v,k)=>{if(v.length<2)return;const s=v.map(x=>x.ix).sort((a,b)=>a-b);const med=s[Math.floor((s.length-1)/2)];const spread=s[s.length-1]-s[0];const L=K[k];
    const range=L?Math.max(1,L.max-L.min):Math.max(1,spread);rows.push({k,sec:k.split('|')[0],key:k.split('|')[1],med,spread,rel:spread/range,v});});
  return {shops:E.map(([s,e])=>({shop:s,e})),rows};}

function consensusHTML(C){if(!C)return'';const skip=/^(Fuel|FuelCapacity|VirtualEnergy|NumPitstops|Pitstop\d|Compound|BrakeDisc|BrakePad|SteerLock|RevLimit|Gear\d|Reverse|RatioSet)Setting$/;
  const split=C.rows.filter(r=>r.spread>0&&!skip.test(r.key)&&!(GEN_SECS.includes(r.sec)&&r.sec!=='FRONTLEFT'&&r.sec!=='REARLEFT')).sort((a,b)=>b.rel-a.rel);
  const agree=C.rows.filter(r=>r.spread===0&&!skip.test(r.key)).length;const lab=r=>`${esc(SETUP_LABELS[r.key]||r.key)}${GEN_SECS.includes(r.sec)?` <span class="muted small">${r.sec.startsWith('FRONT')?tr('ant.'):tr('post.')}</span>`:''}`;
  return `<div class="consbox"><p class="small" style="margin:10px 0 6px"><b>${tr('Cosa dicono i setup shop')}</b> <span class="muted">(${C.shops.map(s=>esc(s.shop)).join(', ')})</span>: ${tr('d\'accordo su')} <b>${agree}</b> ${tr('regolazioni')}, ${tr('diversi su')} <b>${split.length}</b>.</p>
    ${split.length?`<div class="tw"><table class="lbt"><thead><tr><th class="l">${tr('Regolazione')}</th>${C.shops.map(s=>`<th class="l">${esc(s.shop)}</th>`).join('')}<th class="l">${tr('Quanto')}</th></tr></thead><tbody>${split.slice(0,12).map(r=>`<tr><td class="l">${lab(r)}</td>${C.shops.map(s=>{const x=r.v.find(y=>y.shop===s.shop);return `<td class="l mono">${x?esc(x.disp||('#'+x.ix)):'—'}</td>`;}).join('')}<td class="l"><span class="consbar"><i style="width:${Math.round(Math.min(1,r.rel)*100)}%"></i></span></td></tr>`).join('')}</tbody></table></div>
    <p class="muted small" style="margin:6px 0 0">${tr('Dove sono d\'accordo è la scelta sicura per questa pista. Dove sono diversi conta lo stile di guida: è lì che vale la pena provare, partendo dal valore di mezzo (il consenso).')}</p>`:''}</div>`;}

(function(){const st=document.createElement('style');st.textContent=`.consbar{display:inline-block;width:70px;height:6px;border-radius:3px;background:var(--line,#8883);vertical-align:middle;overflow:hidden}.consbar i{display:block;height:100%;background:var(--warn,#d90)}`;document.head.appendChild(st);})();
