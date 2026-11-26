import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const engine=process.env.ENGINE;
const profile=engine==='chromium'?'Pixel 7':'iPhone 13';
const device=devices[profile];
if(!device)throw Error('Missing Playwright device profile: '+profile);
const browser=await (engine==='chromium'?chromium:webkit).launch({headless:true});
const root='http://127.0.0.1:8765/';
const paths=['TSD_EOIR_V24_Mission.html','blackbox-analyzer.html','contact.html','drone-design.html','education.html','equipment-lab.html','flight-safety.html','fpv-flight-lab.html','link-budget.html','long-range-calculator.html','simulator.html','tsd-qgc-mission-lab.html','prop-vibration-lab.html'];
const dir='/tmp/tsd-mobile-'+engine;fs.mkdirSync(dir,{recursive:true});
const results=[];
const checkedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
async function header(page,file){
 const h=page.locator('[data-tsd-common-header]:visible').first();
 if(file==='tsd-qgc-mission-lab.html'&&!await h.count()){
   await page.locator('#menuButton:visible').tap({timeout:12000});
   await page.locator('#menuCourse:visible').tap({timeout:12000});
 }
 await h.waitFor({state:'visible',timeout:15000});
 return h.evaluate(el=>{
  const r=el.getBoundingClientRect(),w=innerWidth,links=[...el.querySelectorAll('a')].map(a=>{const b=a.getBoundingClientRect();return {label:a.textContent.trim(),href:a.getAttribute('href'),width:b.width,height:b.height,left:b.left,right:b.right};});
  return {width:w,height:innerHeight,screen:[screen.width,screen.height],landscape:matchMedia('(orientation: landscape)').matches,touchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer:coarse)').matches,headerHeight:r.height,headerOverflow:el.scrollWidth>el.clientWidth+1||r.left<-1||r.right>w+1,pageOverflow:document.documentElement.scrollWidth>w+1,links,pass:r.width>0&&el.scrollWidth<=el.clientWidth+1&&r.left>=-1&&r.right<=w+1&&links.length>=6&&links.every(a=>a.width>0&&a.height>0&&a.left>=-1&&a.right<=w+1)};
 });
}
async function measure(page){
 return page.evaluate(async()=>{
  const frames=[];const start=performance.now();
  await new Promise(resolve=>{function f(t){frames.push(t);if(performance.now()-start>=1800)resolve();else requestAnimationFrame(f);}requestAnimationFrame(f);});
  const deltas=frames.slice(1).map((v,i)=>v-frames[i]).sort((a,b)=>a-b);
  return {kind:'requestAnimationFrame cadence, not hardware/GPU frame rate',samples:frames.length,elapsedMs:Math.round(performance.now()-start),fps:frames.length>1?+(1000*(frames.length-1)/(frames.at(-1)-frames[0])).toFixed(1):null,p95FrameMs:deltas.length?+deltas[Math.floor((deltas.length-1)*.95)].toFixed(1):null,longFramesOver50ms:deltas.filter(x=>x>50).length,jsHeapBytes:performance.memory?.usedJSHeapSize??null,deviceMemoryGiB:navigator.deviceMemory??null,canvas:[...document.querySelectorAll('canvas')].map(c=>({id:c.id,width:c.width,height:c.height,displayWidth:Math.round(c.getBoundingClientRect().width)}))};
 });
}
async function prop(page,context,orientation,errors){
 const out={checks:{},diagnostics:{},failures:[]};
 async function check(name,fn){try{const v=await fn();out.checks[name]=!!v;if(!v)out.failures.push(name);}catch(e){out.checks[name]=false;out.failures.push(name+': '+String(e).slice(0,400));}}
 const tap=async id=>{const l=page.locator(id);await l.scrollIntoViewIfNeeded({timeout:10000});await l.tap({timeout:10000});return l;};
 const pressed=async(id,v)=>{const l=await tap(id);return await l.getAttribute('aria-pressed')===String(v);};
 await check('fourMotors',async()=>await page.locator('#motors button').count()===4);
 await check('canvasDimensions',()=>page.evaluate(()=>['airframe3d','drone','track','spectrum'].every(id=>{const c=document.getElementById(id);return c instanceof HTMLCanvasElement&&c.width>0&&c.height>0&&c.getBoundingClientRect().width>0;})));
 await check('resetAtStart',async()=>{await tap('#reset');return await page.locator('#throttle').inputValue()==='0';});
 for(const [id,output,fraction] of [['throttle','power',.72],['roll','rollValue',.78],['pitch','pitchValue',.24],['yaw','yawValue',.78],['volume','volumeValue',.75]]){
  await check('touchRange_'+id,async()=>{
   const l=page.locator('#'+id);await l.scrollIntoViewIfNeeded({timeout:10000});
   const old=await l.inputValue(),box=await l.boundingBox(),before=await page.locator('#'+output).innerText();
   if(!box)return false;
   await page.touchscreen.tap(box.x+box.width*fraction,box.y+box.height/2);
   await page.waitForTimeout(200);
   const value=await l.inputValue(),label=await page.locator('#'+output).innerText();
   out.diagnostics[id]={old,value,before,label,rect:box};
   return value!==old&&label!==before;
  });
 }
 await check('rpmUpdates',async()=>{const s=await page.locator('#rpm').innerText();return Number(s.replace(/[^0-9]/g,''))>2522;});
 await check('motorTap',()=>pressed('#motors button:nth-child(3)',true));
 await check('bladeTap',()=>pressed('#blades button[data-value="4"]',true));
 await check('slowTap',()=>pressed('#speed button[data-value="0.1"]',true));
 await check('pulseTap',()=>pressed('#pulses',false));
 await check('vibrationTap',()=>pressed('#vibrationExample',true));
 await check('pauseTap',()=>pressed('#pause',true));
 await check('resumeTap',()=>pressed('#pause',false));
 await check('soundTap',async()=>{
  await tap('#sound');
  await page.waitForTimeout(700);
  out.diagnostics.audio=await page.evaluate(()=>{try{const ac=typeof flightAudio!=='undefined'?flightAudio?.ac:null;return {pressed:document.getElementById('sound').getAttribute('aria-pressed'),status:document.getElementById('audioStatus').textContent,state:ac?.state??null,sampleRate:ac?.sampleRate??null,baseLatencySeconds:ac?.baseLatency??null,outputLatencySeconds:ac?.outputLatency??null};}catch(e){return {error:String(e)};}});
  return out.diagnostics.audio.pressed==='true'&&out.diagnostics.audio.state==='running';
 });
 // Native two-contact dispatch is Chromium-specific. This tests the event path, not simultaneous independent slider control.
 if(engine==='chromium'){
  await check('nativeTwoContactEvent',async()=>{
   const l=page.locator('#airframe3d');await l.scrollIntoViewIfNeeded({timeout:10000});const b=await l.boundingBox();
   if(!b)return false;
   const y=Math.max(5,Math.min(b.y+b.height*.5,(await page.evaluate(()=>innerHeight))-5)),x=b.x+b.width*.4;
   await page.evaluate(()=>{window.__mobileMaxTouches=0;document.addEventListener('touchstart',e=>{window.__mobileMaxTouches=Math.max(window.__mobileMaxTouches,e.touches.length);},{passive:true});});
   const c=await context.newCDPSession(page);
   try{await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0},{x:x+25,y:y+5,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});out.diagnostics.nativeTouchCount=await page.evaluate(()=>window.__mobileMaxTouches);return out.diagnostics.nativeTouchCount>=2;}finally{await c.detach();}
  });
 }else out.diagnostics.nativeTwoContactEvent='not run: Playwright WebKit exposes single touchscreen tap only';
 await check('frameCadenceSample',async()=>{out.diagnostics.render=await measure(page);return out.diagnostics.render.samples>1&&out.diagnostics.render.fps!==null;});
 if(engine==='chromium'){try{const c=await context.newCDPSession(page);await c.send('Performance.enable');const m=await c.send('Performance.getMetrics');out.diagnostics.cdpMemory=Object.fromEntries(m.metrics.filter(x=>['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents'].includes(x.name)).map(x=>[x.name,x.value]));await c.detach();}catch(e){out.diagnostics.cdpMemoryError=String(e);}}
 await check('axesCenterTap',async()=>{await tap('#axesCenter');return await page.evaluate(()=>['roll','pitch','yaw'].every(id=>document.getElementById(id).value==='0'));});
 await check('resetTap',async()=>{await tap('#reset');return await page.evaluate(()=>document.getElementById('throttle').value==='0'&&document.getElementById('sound').getAttribute('aria-pressed')==='false'&&document.getElementById('vibrationExample').getAttribute('aria-pressed')==='false');});
 await check('noPageErrors',()=>errors.length===0);
 await page.evaluate(()=>scrollTo(0,0));
 try{await page.screenshot({path:dir+'/prop-'+orientation+'.png',timeout:20000,animations:'disabled'});}catch(e){out.diagnostics.screenshotError=String(e);}
 out.pass=out.failures.length===0;return out;
}
try{
 for(const file of paths){
  const context=await browser.newContext({...device});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  let http=null;
  try{http=(await page.goto(root+file,{waitUntil:'domcontentloaded',timeout:45000}))?.status();}catch(e){errors.push(String(e));}
  for(const orientation of ['portrait','landscape']){
   const entry={engine,profile,file,orientation,http,checkedCommit};
   try{
    if(orientation==='landscape'){await page.setViewportSize({width:device.viewport.height,height:device.viewport.width});await page.waitForTimeout(400);}
    entry.header=await header(page,file);
    entry.orientationPass=entry.header.landscape===(orientation==='landscape');
    // Headless WebKit can report maxTouchPoints=0 while trusted touch input works.
    // Probe actual browser-delivered touch input rather than treating a capability hint as proof.
    entry.touchProbe=await (async()=>{
      await page.evaluate(()=>{const b=document.createElement('button');b.id='tsd-qa-touch-probe';b.type='button';b.textContent='QA touch';b.style.cssText='position:fixed;top:4px;left:4px;width:76px;height:40px;z-index:2147483647;touch-action:manipulation;';window.__tsdTouchProbe=[];for(const type of ['touchstart','pointerdown','click'])b.addEventListener(type,e=>window.__tsdTouchProbe.push({type:e.type,trusted:e.isTrusted,pointerType:e.pointerType??null,touches:e.touches?.length??null}));document.body.append(b);});
      try{const target=await page.evaluate(()=>{const b=document.getElementById('tsd-qa-touch-probe');const r=b.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)===b,inside:x>=0&&y>=0&&x<innerWidth&&y<innerHeight};});if(!target.hit||!target.inside)throw Error('QA touch target is not hittable in current orientation');await page.touchscreen.tap(target.x,target.y);await page.waitForFunction(()=>window.__tsdTouchProbe.some(e=>e.trusted&&e.type==='click'),undefined,{timeout:10000});const events=await page.evaluate(()=>window.__tsdTouchProbe);return {events,pass:events.some(e=>e.trusted&&(e.type==='touchstart'||e.pointerType==='touch'))&&events.some(e=>e.trusted&&e.type==='click')};}
      finally{await page.evaluate(()=>{document.getElementById('tsd-qa-touch-probe')?.remove();delete window.__tsdTouchProbe;});}
    })();
    entry.touchProfile=entry.touchProbe.pass;
    if(entry.header.pageOverflow){entry.overflowDetails=await page.evaluate(()=>[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'',right:Math.round(e.getBoundingClientRect().right),left:Math.round(e.getBoundingClientRect().left)})).filter(e=>e.right>innerWidth+2||e.left<-2).slice(0,30));}
    if(file==='prop-vibration-lab.html')entry.prop=await prop(page,context,orientation,errors);
    entry.errors=[...errors];
    entry.pass=http===200&&entry.header.pass&&entry.orientationPass&&entry.touchProfile&&entry.errors.length===0&&(!entry.prop||entry.prop.pass);
   }catch(e){entry.failure=String(e);entry.errors=[...errors];entry.pass=false;}
   results.push(entry);console.log('MOBILE_RESULT '+JSON.stringify(entry));
  }
  await context.close();
 }
 // Real single touch navigation from simulator card into the internal PropLab page.
 const context=await browser.newContext({...device});const page=await context.newPage();
 let navigation={};
 try{await page.goto(root+'simulator.html',{waitUntil:'domcontentloaded',timeout:45000});const link=page.locator('#prop-vibration-lab a.cardLink');await link.scrollIntoViewIfNeeded();await Promise.all([page.waitForURL('**/prop-vibration-lab.html',{timeout:15000}),link.tap({timeout:15000})]);navigation={pass:true,url:page.url()};}catch(e){navigation={pass:false,error:String(e)};}await context.close();
 // Compare the existing main implementation under the same origin and WebKit profile.
 let baselineDiagnostic=null;
 if(engine==='webkit'&&results.some(x=>x.file==='flight-safety.html'&&!x.pass)){
   try{
     execFileSync('git',['fetch','--no-tags','--depth=1','origin','refs/heads/main:refs/remotes/origin/main'],{encoding:'utf8'});
     const baselineCommit=execFileSync('git',['rev-parse','refs/remotes/origin/main'],{encoding:'utf8'}).trim();
     const baselineHtml=execFileSync('git',['show',baselineCommit+':flight-safety.html'],{encoding:'utf8',maxBuffer:20*1024*1024});
     const tests=[];
     for(const mode of ['main','candidate']){
       const c=await browser.newContext({...device});const p=await c.newPage();
       const errors=[],requests=[];
       p.on('pageerror',e=>errors.push(String(e)));
       p.on('requestfailed',r=>{if(r.url().includes('workers.dev'))requests.push({url:r.url(),failure:r.failure()?.errorText});});
       p.on('response',r=>{if(r.url().includes('workers.dev'))requests.push({url:r.url(),status:r.status(),cors:r.headers()['access-control-allow-origin']??null});});
       try{
         if(mode==='main')await p.route(root+'flight-safety.html',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:baselineHtml}));
         await p.goto(root+'flight-safety.html',{waitUntil:'domcontentloaded',timeout:45000});
         await p.setViewportSize({width:device.viewport.height,height:device.viewport.width});
         await p.waitForTimeout(5000);
       }catch(e){errors.push(String(e));}
       finally{await c.close();}
       tests.push({mode,errors,requests});
     }
     baselineDiagnostic={baselineCommit,checkedCommit,tests};
   }catch(e){baselineDiagnostic={failure:String(e)};}
   fs.writeFileSync(dir+'/flight-safety-baseline.json',JSON.stringify(baselineDiagnostic,null,2));
   console.log('MOBILE_BASELINE_DIAGNOSTIC '+JSON.stringify(baselineDiagnostic));
 }
 // Distinguish an inherited remote CORS failure from a new header regression.
 const base=baselineDiagnostic?.tests?.find(x=>x.mode==='main');
 const candidate=baselineDiagnostic?.tests?.find(x=>x.mode==='candidate');
 const inheritedErrors=base&&candidate?base.errors.filter(e=>candidate.errors.includes(e)&&/^Fetch API cannot load https: \/(?:jolly-dawn-3ee1tsd-flight-airspace-api\.flydragon103\.workers\.dev\/health|spaceweather\.kasa\.go\.kr\/api\/kindex) due to access control checks\.$/.test(e)):[];
 for(const entry of results){
   entry.inheritedExternalOnly=entry.file==='flight-safety.html'&&!entry.pass&&!entry.failure&&entry.http===200&&entry.header?.pass===true&&entry.orientationPass===true&&entry.touchProfile===true&&entry.errors?.length>0&&entry.errors.every(e=>inheritedErrors.includes(e));
   entry.headerRegressionPass=entry.pass||entry.inheritedExternalOnly;
 }
 const regressionPass=results.filter(x=>x.headerRegressionPass).length;
 const inheritedExternalFailures=results.filter(x=>x.inheritedExternalOnly).map(x=>({file:x.file,orientation:x.orientation,errors:x.errors}));
 const summary={checkedCommit,engine,profile,pass:results.filter(x=>x.pass).length,total:results.length,headerPass:results.filter(x=>x.header?.pass).length,navigation,baselineDiagnostic,regressionPass,inheritedExternalFailures,physicalDevice:false};
 fs.writeFileSync(dir+'/results.json',JSON.stringify({summary,results},null,2));
 console.log('MOBILE_SUMMARY '+JSON.stringify(summary));
 if(results.some(x=>!x.pass)||!navigation.pass)process.exitCode=1;
}finally{await browser.close();}
