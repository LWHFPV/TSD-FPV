'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const http=require('node:http');
const html=fs.readFileSync('tsd-qgc-mission-lab.html','utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
assert.equal(scripts.length,14);
scripts.forEach((m,i)=>new vm.Script(m[2],{filename:'qgc-inline-'+i+'.js'}));
console.log('Inline syntax: 14/14');
const migration=scripts.find(m=>m[1].includes('id="bj-storage-migration"'))[2];
const keys=['tsd-qgc515-settings','mission-lab-display-v2','tsd-course-v3','tsd-qgc515-practice-v1','tsd-qgc515-onboard','tsd-qgc-aq-layout-v1'];
let count=0;
for(const k of keys){
  const d='tsd-qgc-prod-v1:'+k,r='review-bi-'+k;
  const arr=k==='tsd-course-v3'||k==='tsd-qgc515-onboard';
  const a=arr?'[1,2]':'{"a":1}',b=arr?'[3]':'{"b":2}';
  for(const [name,initial,expected] of [
    ['legacy',[[k,a]],a],['BI',[[r,b]],b],['both',[[k,a],[r,b]],b],
    ['destination wins',[[k,a],[r,b],[d,a]],a],
    ['bad JSON',[[k,a],[r,'broken']],a],
    ['wrong shape',[[k,a],[r,arr?'{}':'[]']],a],
    ['empty',[],undefined],['invalid only',[[k,'null']],undefined]
  ]){
    const data=new Map(initial);
    const window={localStorage:{getItem:key=>data.get(key)??null,setItem:(key,v)=>data.set(key,v)}};
    vm.runInNewContext(migration,{window});vm.runInNewContext(migration,{window});
    assert.equal(data.get(d),expected,k+' '+name);
    initial.forEach(([key,value])=>assert.equal(data.get(key),value,'source overwritten '+key));
    count++;
  }
}
vm.runInNewContext(migration,{window:{get localStorage(){throw Error('denied')}}});
console.log('Actual embedded migration: '+(count+1)+'/'+(count+1));
if(!process.argv.includes('--browser'))process.exit(0);
(async()=>{
 const {chromium}=require('playwright');
 const server=http.createServer((req,res)=>{if(req.url.split('?')[0]!=='/tsd-qgc-mission-lab.html'){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  for(const mode of [{width:1366,height:768,mobile:false},{width:390,height:844,mobile:true},{width:844,height:390,mobile:true}]){
   const context=await browser.newContext({viewport:{width:mode.width,height:mode.height},isMobile:mode.mobile,hasTouch:mode.mobile});
   await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(()=>{localStorage.setItem('tsd-course-v3','[0,1]');localStorage.setItem('tsd-qgc515-settings','{"defaultAlt":123}');});
   await page.goto(origin+'/tsd-qgc-mission-lab.html',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('#aqTop').waitFor({state:'visible'});
   const state=await page.evaluate(()=>({course:localStorage.getItem('tsd-qgc-prod-v1:tsd-course-v3'),settings:JSON.parse(localStorage.getItem('tsd-qgc-prod-v1:tsd-qgc515-settings')||'{}'),old:localStorage.getItem('tsd-course-v3')}));
   assert.equal(state.course,'[0,1]');assert.equal(state.old,'[0,1]');assert.equal(state.settings.defaultAlt,123);
   for(const id of ['aqCourse','aqQuick','aqQuickCurrent','aqRegion','aqEmergency','aqManual','aqExam','aqLayout','aqResetLayout','tsdPhoneLink'])assert.equal(await page.locator('#'+id).count(),1,'missing or duplicate '+id);
   await page.locator('#aqCourse').click();await page.locator('#stage6CourseProgress').waitFor({state:'visible'});
   await page.locator('#bdMobileHelp').click();await page.locator('#dialog').waitFor({state:'visible'});await page.evaluate(()=>document.getElementById('dialog').close());
   await page.locator('#aqQuick').click();await page.waitForTimeout(800);
   assert.deepEqual(errors,[],'Uncaught JavaScript errors '+JSON.stringify(mode));
   console.log('Browser startup, storage, course, mobile help, quick practice: '+mode.width+'x'+mode.height);
   await page.screenshot({path:'qgc-bj-'+mode.width+'x'+mode.height+'.png'});
   await context.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
