// Desktop regression flow: historical setup, technical tabs, comparison layout and invitation clipboard.
// node tools/smoke_desktop.js <bridge URL> <fixture.ld> [screenshot directory]
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const [url,fixture,screens]=process.argv.slice(2);
const version=/const APP_VERSION='([^']+)'/.exec(fs.readFileSync(path.join(__dirname,'../app/ui17.js'),'utf8'))[1];
if(!url||!fixture)throw new Error('Usage: node tools/smoke_desktop.js <bridge URL> <fixture.ld> [screenshots]');
const setup=(name,p)=>({name,mimeType:'text/plain',buffer:Buffer.from('VehicleClassSetting="Test Car"\n'+['FRONTLEFT','FRONTRIGHT','REARLEFT','REARRIGHT'].map(w=>'['+w+']\nPressureSetting=1//'+p+' kPa\nCamberSetting=5//-2.5 deg\nFastBumpSetting=5//5\nSlowReboundSetting=5//5\n').join(''))});
(async()=>{const browser=await chromium.launch();let checks=0;
try{for(const lang of ['it'])for(const [width,height] of [[1366,768],[1920,1080]]){
  const ctx=await browser.newContext({viewport:{width,height}});const p=await ctx.newPage();const errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(url).origin?r.continue():r.abort());
  await p.addInitScript(({l,v})=>{localStorage.setItem('pitwall:lang',JSON.stringify(l));localStorage.setItem('pitwall:seenVer',JSON.stringify(v));},{l:lang,v:version});
  await p.goto(url);await p.waitForFunction(()=>typeof store!=='undefined'&&document.querySelector('#proNav .pn[data-n="tech"]'));
  await p.evaluate(()=>document.querySelectorAll('.modal').forEach(m=>m.hidden=true));
  await p.setInputFiles('#fileIn',fixture);await p.waitForFunction(()=>lds().length>0);
  await p.setInputFiles('#fileIn',[setup('Desktop-A.svm',150),setup('Desktop-B.svm',180)]);
  await p.waitForFunction(()=>svms().length===2);
  await p.evaluate(()=>document.querySelectorAll('.modal').forEach(m=>m.hidden=true));
  await p.locator('#proNav .pn[data-n="tech"]').click();await p.waitForSelector('#techSetup');
  await p.selectOption('#techSetup','svm:Desktop-A.svm');await p.locator('[data-ses="ok"]').click();
  await p.waitForFunction(()=>sesSetupGet(active().S)?.st==='confermato');
  await p.selectOption('#techSetup','svm:Desktop-B.svm');
  await p.waitForFunction(()=>DIAG?.su?.snapshot&&setupVal(DIAG.su,'PressureSetting','FRONTLEFT')==='150 kPa');checks++;
  await p.locator('[data-ses="selected"]').click();
  await p.waitForFunction(()=>setupVal(DIAG.su,'PressureSetting','FRONTLEFT')==='180 kPa');checks++;
  await p.locator('[data-ses="saved"]').click();
  await p.waitForFunction(()=>setupVal(DIAG.su,'PressureSetting','FRONTLEFT')==='150 kPa');checks++;
  await p.setInputFiles('#fileIn',setup('Desktop-A.svm',220));
  await p.waitForFunction(()=>setupVal(byId('svm:Desktop-A.svm'),'PressureSetting','FRONTLEFT')==='220 kPa');
  assert.equal(await p.evaluate(()=>setupVal(DIAG.su,'PressureSetting','FRONTLEFT')),'150 kPa');checks++;
  await p.locator('#proNav .pn[data-n="setb"]').click();
  await p.locator('#pSetCar .pvr[data-id="svm:Desktop-B.svm"]').click();
  await p.waitForFunction(()=>setupVal(DIAG.su,'PressureSetting','FRONTLEFT')==='180 kPa');checks++;
  await p.locator('#setupContext [data-ses="saved"]').click();
  await p.waitForFunction(()=>setupVal(DIAG.su,'PressureSetting','FRONTLEFT')==='150 kPa');checks++;
  await p.locator('#proNav .pn[data-n="tech"]').click();await p.waitForSelector('#techSetup');
  for(const tab of ['q','damp','axle','plat','ev','diag']){
    await p.locator(`#techP .ttabs [data-tt="${tab}"]`).click();
    await p.waitForSelector(`#techP .ttabs [data-tt="${tab}"][aria-selected="true"]`);
    assert.equal(await p.locator('#techP>.warnbar').count(),0);checks++;
    if(screens){fs.mkdirSync(screens,{recursive:true});await p.screenshot({path:path.join(screens,`${lang}-${width}-${tab}.png`)});}
    const overflow=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('#techP *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right}))}));
    assert(overflow.scroll<=overflow.width+1,JSON.stringify({lang,width,tab,...overflow}));checks++;
  }
  if(screens){fs.mkdirSync(screens,{recursive:true});await p.screenshot({path:path.join(screens,`${lang}-${width}-technical.png`)});}
  await p.locator('#proNav .pn[data-n="tel"]').click();await p.waitForSelector('#twMap');
  assert.equal(await p.evaluate(()=>document.querySelector('#twMap').getBoundingClientRect().top<innerHeight),true);checks++;
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);checks++;
  if(screens)await p.screenshot({path:path.join(screens,`${lang}-${width}-telemetry.png`)});
  await p.locator('#proNav .pn[data-n="live"]').click();await p.waitForSelector('#lvInviteLink');
  await p.locator('#lvInviteLink').click();await p.waitForSelector('#mInvite:not([hidden])');
  assert.equal(await p.locator('#inviteUrl').count(),0);checks++;
  await p.locator('#mInvite [data-close]').click();
  // A browser-only team fixture. No real team is created and liveStart is never called with this code.
  await p.evaluate(()=>{LS.set('live:team',teamMake({name:'Desktop Test',host:'example.invalid',wp:443,tp:8883}));});
  await p.locator('#lvInviteLink').click();
  const link=await p.locator('#inviteUrl').inputValue();assert.match(link,/^http:\/\/localhost:8790\/#join&t=DE1-/);checks++;
  assert((await p.locator('#inviteMessage').inputValue()).includes(link));checks++;
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}}));
  await p.locator('#inviteLinkCopy').click();
  assert.equal(await p.evaluate(()=>window.__copied),link);checks++;
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}}));
  await p.locator('#inviteMessageCopy').click();
  assert.equal(await p.evaluate(()=>document.activeElement.id),'inviteMessage');checks++;
  assert((await p.locator('#toastStack').innerText()).includes('Ctrl+C'));checks++;
  if(screens)await p.screenshot({path:path.join(screens,`${lang}-${width}-invite.png`)});
  await p.keyboard.press('Escape');assert.equal(await p.locator('#mInvite').isVisible(),false);checks++;
  assert.deepEqual(errors,[]);checks++;
  await ctx.close();console.log(`${lang} ${width}×${height}: OK`);
}
console.log(`${checks} desktop checks passed`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
