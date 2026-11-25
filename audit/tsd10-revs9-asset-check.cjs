#!/usr/bin/env node
/* TSD10 RevS8 mesh source audit, read-only: no CAD modification.
 * Run: node audit/tsd10-revs9-asset-check.cjs
 * It checks four packed CAD visualization variants and reports geometric drift.
 * WARNING: visual mesh audit is NOT manufacturing/BRep or physical fit approval.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const combos=['상부_XT60','상부_XT90','하부_XT60','하부_XT90'];
const knownCategories=new Set(['frame','rear','gps','camera','electronics','wiring','battery','power','propulsion','propfastener']);
const audit={date:new Date().toISOString(),source:'tsd10-revs8-preview.html',revision:'RevS8 (read-only review)',variants:{},errors:[],warnings:[],comparisons:[],manufacturingApproved:false,commonBOMValidated:false};
// Load the same two pure display functions as the live viewer to prevent BOM drift.
const viewer=fs.readFileSync(path.join(root,'tsd10-revs8-preview.html'),'utf8');
const helpers=['isRearRfBracket','displayPartName'].map(fn=>{
  const begin=viewer.indexOf('function '+fn+'(p){');
  const finish=viewer.indexOf(String.fromCharCode(10)+'}',begin);
  if(begin<0||finish<0)throw Error('viewer common BOM helper missing: '+fn);
  return viewer.slice(begin,finish+2);
}).join(String.fromCharCode(10));
const isRearRfBracket=vm.runInNewContext(helpers+';isRearRfBracket');
const displayPartName=vm.runInNewContext(helpers+';displayPartName');

function problem(where,message,severity='error'){audit[severity==='error'?'errors':'warnings'].push({where,message})}
function readCombo(combo){
  const base=path.join(root,'tsd10-revs8-assets');
  const chunks=[];
  for(let n=1;n<=4;n++){
    const filepath=path.join(base,combo+'_'+String(n).padStart(2,'0')+'.b64');
    if(!fs.existsSync(filepath))throw Error('missing asset '+filepath);
    chunks.push(fs.readFileSync(filepath,'utf8').trim());
  }
  const encoded=chunks.join('');
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw Error('invalid base64 characters '+combo);
  const data=zlib.gunzipSync(Buffer.from(encoded,'base64'));
  if(data.length<8)throw Error('truncated gzip '+combo);
  const hlen=data.readUInt32LE(0);
  if(hlen<2||hlen>data.length-4)throw Error('invalid header length '+combo);
  const header=JSON.parse(data.subarray(4,hlen+4).toString('utf8'));
  if(!Array.isArray(header.parts)||!Number.isInteger(header.triangles))throw Error('invalid header '+combo);
  const meshBase=hlen+4;
  const usedIds=new Set(); let triangles=0;
  const parts=[];
  for(let i=0;i<header.parts.length;i++){
    const p=header.parts[i],at=combo+'/'+(p.name||p.id||i);
    if(typeof p.id!=='string'||typeof p.name!=='string'||!p.id)problem(at,'invalid part identity');
    if(usedIds.has(p.id))problem(at,'duplicate part ID'); usedIds.add(p.id);
    if(!knownCategories.has(p.category))problem(at,'unexpected category '+p.category);
    if(!Number.isInteger(p.offset)||!Number.isInteger(p.length)||p.offset<0||p.length<0||p.length%72!==0||meshBase+p.offset+p.length>data.length)problem(at,'invalid geometry slice');
    if(!Number.isInteger(p.triangleCount)||p.triangleCount*72!==p.length)problem(at,'triangle/byte length mismatch');
    if(!Array.isArray(p.bounds)||p.bounds.length!==2||p.bounds.some(v=>!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isFinite(x))))problem(at,'invalid bounds');
    if(audit.errors.some(e=>e.where===at))continue;
    triangles+=p.triangleCount;
    const blob=data.subarray(meshBase+p.offset,meshBase+p.offset+p.length);
    const digest=crypto.createHash('sha256').update(blob).digest('hex');
    let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],finite=true;
    const vertexCoordinates=new Set();
    for(let j=0;j<blob.length;j+=24){
      const xyz=[];
      for(let k=0;k<3;k++){
        const x=blob.readFloatLE(j+4*k);
        if(!Number.isFinite(x)){finite=false;break}
        xyz.push(x);min[k]=Math.min(min[k],x);max[k]=Math.max(max[k],x);
      }
      if(!finite)break;
      vertexCoordinates.add(xyz.map(x=>Math.round(x*1000)).join(','));
    }
    if(!finite)problem(at,'non-finite 3D vertex position');
    for(let k=0;k<3;k++){
      if(Math.abs(min[k]-p.bounds[0][k])>.15||Math.abs(max[k]-p.bounds[1][k])>.15)
        problem(at,'mesh vertex min/max differs from header bounds axis '+k);
    }
    const vertexHash=crypto.createHash('sha256').update([...vertexCoordinates].sort().join(';')).digest('hex');
    const center=p.bounds[0].map((x,k)=>(x+p.bounds[1][k])/2);
    parts.push({id:p.id,name:p.name,category:p.category,triangles:p.triangleCount,
      bounds:p.bounds,center,vertexHash,digest});
  }
  if(triangles!==header.triangles)problem(combo,'header total triangle mismatch '+triangles+'/'+header.triangles);
  if(parts.length===0)problem(combo,'empty part list');
  for(const k of ['frame','rear','gps'])if(!parts.some(p=>p.category===k))problem(combo,'missing '+k+' category','warning');
  const frame=parts.filter(p=>p.category==='frame');
  if(!frame.some(p=>/상판|top.?deck|upper.?plate/i.test(p.name)))problem(combo,'frame list lacks recognizable upper deck','warning');
  if(!frame.some(p=>/하판|lower.?frame|bottom.?plate/i.test(p.name)))problem(combo,'frame list lacks recognizable lower deck','warning');
  if(parts.some(p=>p.category==='electronics'&&/하판|lower.?frame|bottom.?plate/i.test(p.name)))problem(combo,'lower deck miscategorized as electronics');
  if(parts.some(p=>p.category==='rear'&&/상판|top.?deck|upper.?plate/i.test(p.name)))problem(combo,'upper deck miscategorized as rear');
  audit.variants[combo]={partCount:parts.length,triangleCount:triangles,categoryCounts:Object.fromEntries([...knownCategories].map(k=>[k,parts.filter(p=>p.category===k).length])),antennaBrackets:parts.filter(p=>/안테나.*(?:브라켓|브래킷)|antenna.*bracket|rf.*bracket/i.test(p.name)).map(p=>p.name),
    commonRearBracketBOM:parts.filter(isRearRfBracket).map(p=>({sourceId:p.id,sourceName:p.name,displayName:displayPartName(p)})),
    frameNames:frame.map(p=>p.name),
    gpsParts:parts.filter(p=>p.category==='gps').map(p=>({name:p.name,center:p.center})),parts};
}
for(const combo of combos)try{readCombo(combo)}catch(e){problem(combo,String(e.message||e))}
let commonBOMCount=0;
for(const combo of combos){
  const v=audit.variants[combo]; if(!v)continue;
  const count=v.commonRearBracketBOM.length;
  if(count!==1)problem(combo,'rear RF antenna bracket must have one BOM item per assembly; found '+count);
  else commonBOMCount++;
  const g=v.gpsParts;
  if(g.length===2){
    const distance=Math.hypot(...g[0].center.map((x,k)=>x-g[1].center[k]));
    v.gpsCenterGapMm=+distance.toFixed(3);
    if(distance>30)problem(combo,'GPS body/tray center separation exceeds 30mm: '+distance.toFixed(2)+'mm','warning');
  }else problem(combo,'expected two separated GPS model/tray parts; found '+g.length,'warning');
}
audit.commonBOMValidated=commonBOMCount===4;
for(const connector of ['XT60','XT90']){
  const upper=audit.variants['상부_'+connector],lower=audit.variants['하부_'+connector];
  if(!upper||!lower)continue;
  const used=new Set();
  for(const p of upper.parts){
    if(!['frame','rear'].includes(p.category))continue;
    const matches=lower.parts.filter(q=>q.name===p.name&&q.category===p.category&&!used.has(q.id));
    if(!matches.length)continue;
    // Repeated standoffs have the same name; match by actual XYZ position, not last name in a Map.
    matches.sort((a,b)=>Math.hypot(...p.center.map((v,k)=>v-a.center[k]))-Math.hypot(...p.center.map((v,k)=>v-b.center[k])));
    const q=matches[0];used.add(q.id);
    const boundsDrift=Math.max(...[0,1].flatMap(t=>[0,1,2].map(k=>Math.abs(p.bounds[t][k]-q.bounds[t][k]))));
    const sameVertices=p.vertexHash===q.vertexHash;
    const sameTriangleCount=p.triangles===q.triangles;
    audit.comparisons.push({connector,part:p.name,upperId:p.id,lowerId:q.id,category:p.category,
      sameVertexCoordinates:sameVertices,sameTriangleCount,boundsDriftMm:+boundsDrift.toFixed(6)});
    if(boundsDrift>0.01)problem(connector+'/'+p.name,'bounding box differs between upper and lower common part by '+boundsDrift.toFixed(3)+'mm','warning');
    else if(!sameVertices)problem(connector+'/'+p.name,'vertex-coordinate sets differ, although bounding boxes agree; BRep comparison needed','warning');
  }
  if(upper.commonRearBracketBOM.map(p=>p.displayName).join('|')!==lower.commonRearBracketBOM.map(p=>p.displayName).join('|'))
    problem(connector,'common rear RF bracket BOM label still differs between variants');
}
for(const combo of combos)if(audit.variants[combo]){
  const v=audit.variants[combo];
  delete v.parts; // report compact; full geometry hashes are used only in comparisons
}
const report=path.join(__dirname,'tsd10-revs9-asset-audit-result.json');
fs.writeFileSync(report,JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({source:audit.source,variants:Object.keys(audit.variants),errors:audit.errors.length,warnings:audit.warnings.length,comparisons:audit.comparisons.length,report},null,2));
console.log('ASSEMBLY_CONTRACTS',JSON.stringify({commonBOMValidated:audit.commonBOMValidated,
  variantContracts:Object.fromEntries(combos.filter(c=>audit.variants[c]).map(c=>[c,{
    frameCount:audit.variants[c].categoryCounts.frame,
    upperDecks:audit.variants[c].frameNames.filter(n=>/상판|top.?deck|upper.?plate/i.test(n)).length,
    lowerDecks:audit.variants[c].frameNames.filter(n=>/하판|lower.?frame|bottom.?plate/i.test(n)).length,
    rearBracket:audit.variants[c].commonRearBracketBOM,
    gpsCenterGapMm:audit.variants[c].gpsCenterGapMm
  }]))}));
console.log('AUDIT_WARNINGS',JSON.stringify(audit.warnings));
console.log('AUDIT_ERRORS',JSON.stringify(audit.errors));
if(audit.errors.length)process.exitCode=1;
