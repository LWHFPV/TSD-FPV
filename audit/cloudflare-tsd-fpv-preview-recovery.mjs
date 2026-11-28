#!/usr/bin/env node
/**
 * Safe, account-scoped Cloudflare Workers Builds preview diagnosis/recovery.
 * Target exactly: LWHFPV/TSD-FPV, main, Worker tsd-fpv.
 *
 * node audit/cloudflare-tsd-fpv-preview-recovery.mjs              # read only
 * node audit/cloudflare-tsd-fpv-preview-recovery.mjs --disable-previews
 *
 * Requires an authorized *user-scoped* Cloudflare API token with:
 * Workers Builds Configuration: Edit, Workers Scripts: Read.
 * Environment: CF_ACCOUNT_ID, CF_API_TOKEN.
 * Neither account ID nor token is saved to git or printed.
 *
 * Disabling branch Previews does NOT change the production Worker deployment.
 * It will not alter historical failing GitHub check runs.
 */
'use strict';

const account = process.env.CF_ACCOUNT_ID;
const token = process.env.CF_API_TOKEN;
const change = process.argv.includes('--disable-previews');
const args = new Set(process.argv.slice(2));
if ([...args].some(v => v !== '--disable-previews')) {
  throw new Error('Only --disable-previews is supported');
}
if (!account || !token) {
  console.error('NOT_APPLIED: CF_ACCOUNT_ID and CF_API_TOKEN must be provided through a secure environment.');
  process.exitCode = 2;
} else {
  await run().catch(err => {
    console.error('NOT_APPLIED:', err.message);
    process.exitCode = 1;
  });
}

async function request(path, method='GET', data) {
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/'+path,{
    method,headers:{
      'Authorization':'Bearer '+token,
      'Content-Type':'application/json',
    },
    ...(data===undefined?{}:{body:JSON.stringify(data)})
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok || result?.success!==true){
    const codes=(result?.errors||[]).map(e=>e.code).filter(Boolean);
    throw new Error('Cloudflare API '+method+' '+path.split('/').slice(0,2).join('/')+
      ' HTTP '+response.status+' error codes '+JSON.stringify(codes));
  }
  return result.result;
}

function canonical(x) {
  if(Array.isArray(x)) return x.map(canonical);
  if(x && typeof x==='object') return Object.fromEntries(
    Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])
  );
  return x;
}

async function run(){
  const workers=await request('workers/scripts');
  if(!Array.isArray(workers)) throw new Error('Unexpected Workers Scripts listing');
  const matches=workers.filter(w=>w.id==='tsd-fpv' && typeof w.tag==='string');
  if(matches.length!==1) throw new Error('Expected exactly one tsd-fpv Worker with a tag; found '+matches.length);
  const tag=matches[0].tag;
  const endpoint='builds/workers/'+encodeURIComponent(tag);
  const before=await request(endpoint);
  if(!before || typeof before!=='object') throw new Error('Missing Worker Builds settings');
  const repo=before.git_repository;
  if(repo?.provider_type!=='github' || repo?.repo_name!=='TSD-FPV' ||
      String(repo?.provider_account_name||'').toLowerCase()!=='lwhfpv' ||
      repo?.branch!=='main') {
    throw new Error('Worker is NOT connected to LWHFPV/TSD-FPV main; refuse mutation');
  }
  if(typeof before.previews_enabled!=='boolean') throw new Error('Missing previews_enabled boolean');
  console.log(JSON.stringify({worker:'tsd-fpv',repo:'LWHFPV/TSD-FPV',productionBranch:'main',
    previewsEnabled:before.previews_enabled,action:change?'check-and-disable':'read-only'},null,2));
  if(!change) return;
  if(before.previews_enabled===false){
    console.log('ALREADY_DISABLED: no settings changed');
    return;
  }
  const prodBefore=JSON.stringify(canonical(before.production_settings));
  await request(endpoint,'PATCH',{previews_enabled:false});
  const after=await request(endpoint);
  if(after?.previews_enabled!==false) throw new Error('PATCH returned but Previews are not disabled');
  if(JSON.stringify(canonical(after.production_settings))!==prodBefore)
    throw new Error('WARNING: unexpected production build configuration change after PATCH');
  if(after.git_repository?.branch!=='main') throw new Error('WARNING: production branch changed unexpectedly');
  console.log('VERIFIED: tsd-fpv preview builds disabled; production build configuration unchanged');
}
