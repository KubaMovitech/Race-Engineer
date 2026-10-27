// Automatic test of the app: opens every screen in a real browser and fails on any JavaScript error.
// usage: node tools/smoke.js <app url> <fixture.ld>
// In CI the app is served by the bridge in demo mode (so the Muretto has live data) and the .ld is the
// synthetic one made by tools/make_fixture_ld.py.
const {chromium}=require('playwright');
const [url,ld]=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const errs=[];let ok=true;
  for(const lang of ['it','en'])for(const [w,h] of [[1600,950],[390,844]]){
    const p=await (await b.newContext({viewport:{width:w,height:h}})).newPage();const tag=`${lang} ${w}px`;
    p.on('pageerror',e=>errs.push(`${tag}: ${e.message}`));
    await p.addInitScript(l=>{try{localStorage.setItem('pitwall:seenVer',JSON.stringify('9.9.9'));localStorage.setItem('pitwall:lang',JSON.stringify(l));}catch(e){}},lang);
    await p.goto(url);await p.waitForTimeout(1500);
    await p.setInputFiles('#fileIn',[ld]);await p.waitForTimeout(3000);
    await p.evaluate(()=>document.querySelectorAll('.modal').forEach(m=>m.hidden=true));
    for(const v of ['stint','tele','lap','cmp','coach','setup','diary','bop','prog']){await p.evaluate(v=>showView(v),v);await p.waitForTimeout(700);}
    for(const t of ['eng','det','set','gen','gui']){await p.evaluate(t=>{LS.set('su:tab',t);showView('setup');},t);await p.waitForTimeout(400);}
    for(const s of ['ov','lb','car','str','riv','wx','ev']){await p.evaluate(s=>{LS.set('live:sub',s);showView('live');document.querySelector(`#v-live .lvtabs [data-sub="${s}"]`)?.click();},s);await p.waitForTimeout(1500);}
    const checks=await p.evaluate(()=>{showView('tele');return {tele:!!document.querySelector('#twMap'),lap:lds().some(S=>S.laps.some(l=>l.complete)),overflow:document.documentElement.scrollWidth>innerWidth+1};});
    if(!checks.tele||!checks.lap){ok=false;console.log(`${tag}: screen missing`,checks);}
    if(checks.overflow&&w<500){ok=false;console.log(`${tag}: horizontal scroll on the phone`);}
    await p.close();}
  await b.close();
  const real=errs.filter(e=>!/ServiceWorker|Failed to fetch|NetworkError/.test(e));
  real.forEach(e=>console.log('ERRORE',e));
  if(real.length||!ok){console.log('TEST FALLITO');process.exit(1);}console.log('Tutte le schermate aperte senza errori.');})();
