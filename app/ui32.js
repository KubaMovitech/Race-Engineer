// ================= VE E BENZINA IN CLASSIFICA =================
// Next to the bars of virtual energy and fuel left, how much each car uses per lap (median of its last clean laps
// of the stint) and how many laps that leaves.
(function(){const ec=energyCell;window.energyCell=energyCell=function(r){const base=ec(r);if(!r||!r.veh||typeof carStats!=='function')return base;let s;try{s=carStats(r.veh,r);}catch(e){return base;}
  const per=(v,left)=>Number.isFinite(v)&&v>0?`<small class="egpl" title="${esc(tr('consumo per giro · giri che restano'))}">−${(v*100).toFixed(1)}${Number.isFinite(left)?` · ${left<10?left.toFixed(1):Math.floor(left)}${tr('g')}`:''}</small>`:'';
  return base.replace(/(<span class="eg ve[^]*?<\/b>)(<\/span>)/,`$1${per(s.vpl,s.lv)}$2`).replace(/(<span class="eg fu[^]*?<\/b>)(<\/span>)/,`$1${per(s.fpl,s.lf)}$2`);};})();
(function(){const st=document.createElement('style');st.textContent=`td.egc{width:210px;min-width:210px}.egc .eg{grid-template-columns:20px minmax(44px,1fr) 26px 76px}.egc .eg .t{min-width:44px}.egc .egpl{font-family:var(--f-mono);font-size:.7rem;color:var(--muted);white-space:nowrap;text-align:left;padding-left:4px}.egc .eg.ve .egpl{color:color-mix(in srgb,var(--cyan) 75%,var(--muted))}`;document.head.appendChild(st);})();
