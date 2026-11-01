// ================= SOSPENSIONI E AMMORTIZZATORI: the names other parts of the app call =================
// The analysis is in vdyn.js (vdSusp, vdAxles, vdPlatform) and the page is «Analisi tecnica» (ui51.js).
// Up to 2.17 this file drew its own panel and judged the dampers from the symmetry of the histograms:
// that judgement is gone (a histogram describes, it does not diagnose). These two functions keep the debrief
// (ui23.js) and Race Engineer (ui38.js) working with the new analysis.
// the suspension analysis of these laps (cached per session)
function susAnalyse(S,laps){return techData(S,laps);}
// the setup cards (fenomeno → verifica) in the short form the debrief uses: {k, t, d, f:[{label, dir, now, sec}]}
function susHints(X,su,D){const S=D?.S||active()?.S;if(!S)return [];
  return techCards(S,X.laps,su,X).filter(c=>c.s>0).map(c=>({k:c.s===2?'bad':'warn',t:c.t,d:`${c.where.txt} · ${c.ev.join(' · ')} · ${c.rep.txt}`,card:c,
    f:c.fx?[{label:c.fx.label,dir:c.fx.dir,now:c.fx.now,sec:c.fx.sec}]:[]}));}
