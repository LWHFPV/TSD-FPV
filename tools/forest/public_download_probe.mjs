import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const source='https://www.data.go.kr/data/15120580/fileData.do';
const dir='forest-download-evidence';
await fs.mkdir(dir,{recursive:true});
const status={source,checkedAt:new Date().toISOString(),downloadStatus:'not_collected',sourceCrsVerified:false,coverageComplete:false,asOf:null};
let browser;
try {
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({acceptDownloads:true});
  const page=await ctx.newPage();
  const res=await page.goto(source,{waitUntil:'domcontentloaded',timeout:45000});
  status.httpStatus=res?.status();
  const u=new URL(page.url());
  if(u.protocol!=='https:'||u.hostname!=='www.data.go.kr'||u.pathname!=='/data/15120580/fileData.do'||!res?.ok()) throw Error('Unexpected official page response');
  await page.getByText(/산림병해충방제.*병해충발생관리정보/).first().waitFor({timeout:20000});
  const controls=page.getByRole('button',{name:/^(파일\s*)?다운로드$/}).or(page.getByRole('link',{name:/^(파일\s*)?다운로드$/}));
  const count=await controls.count();
  status.exactDownloadControls=count;
  if(count!==1) throw Error('No unique public download control; review source markup');
  const control=controls.first();
  if(!await control.isVisible()||!await control.isEnabled()) throw Error('Public download control unavailable');
  const download=await Promise.all([page.waitForEvent('download',{timeout:30000}),control.click({timeout:10000})]).then(v=>v[0]);
  const downloadUrl=new URL(download.url());
  if(downloadUrl.protocol!=='https:'||!(downloadUrl.hostname==='www.data.go.kr'||downloadUrl.hostname.endsWith('.data.go.kr'))) throw Error('Unverified file origin');
  const filename=download.suggestedFilename();
  status.filename=filename.slice(0,300);
  status.downloadHost=downloadUrl.hostname;
  const local=path.join(dir,'temporary-download.bin');
  try {
    await download.saveAs(local);
    const {size}=await fs.stat(local);
    status.size=size;
    if(size===0||size>200*1024*1024) throw Error('Unexpected file size');
    const handle=await fs.open(local,'r');
    try {const head=Buffer.alloc(8);const {bytesRead}=await handle.read(head,0,8,0);status.magicHex=head.subarray(0,bytesRead).toString('hex');} finally {await handle.close();}
    const result=spawnSync('python3',['tools/forest/inspect_download.py',local],{encoding:'utf8',timeout:90000,maxBuffer:65536});
    if(result.error) throw result.error;
    const info=JSON.parse(result.stdout);
    if(result.status!==0||info.schemaVerified!==true) throw Error(info.inspectionError||'CSV content inspection failed');
    Object.assign(status,info,{downloadStatus:'raw_csv_obtained',sourceCrsVerified:false});
  } finally {await fs.rm(local,{force:true});}
} catch(e) {
  status.error=String(e.message).slice(0,500);
  process.exitCode=1;
} finally {
  if(browser) await browser.close();
  await fs.writeFile(path.join(dir,'status.json'),JSON.stringify(status,null,2));
  console.log(JSON.stringify(status));
}
