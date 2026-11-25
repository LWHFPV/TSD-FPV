/**
 * TSD independent Flight Safety API — Cloudflare Worker.
 * Private Worker accessed via a Pages Function service binding (TSD_API).
 * Ported from TSD v2.9.1 Python, preserving client JSON shapes and conservative
 * no-clearance-on-failure behavior. Requires authorized VWorld service key.
 * Do not put credentials into Pages' public assets.
 */
const VW='https://api.vworld.kr';
const KASA='https://spaceweather.kasa.go.kr';
const NOAA='https://services.swpc.noaa.gov';
const OPEN_METEO='https://api.open-meteo.com/v1/forecast';
const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
const LAYERS={lt_c_aisprhc:'비행금지구역',lt_c_aisresc:'비행제한구역',lt_c_aisctrc:'관제권',lt_c_aisdngc:'위험구역',lt_c_aismoac:'군작전구역'};
const NAME_FIELDS=['name','airspace_name','ais_name','zone_name','zone_nm','area_name','prh_nm','res_nm','ctr_nm','dng_nm','moa_nm','nam','nm','full_name','designation','title'];
const CODE_FIELDS=['code','airspace_code','zone_code','area_code','designator','ident','identifier','ais_code','airspace_id','airspace_cd','prh_cd','res_cd'];
const LOWER_FIELDS=['lower','lower_limit','lower_alt','lower_hgt','lower_height','min_alt','lowerlimit'];
const UPPER_FIELDS=['upper','upper_limit','upper_alt','upper_hgt','upper_height','max_alt','upperlimit'];
const WEATHER_HOURLY='temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,showers,snowfall,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover,weather_code,uv_index';
const KNOWN_PROVINCES=['강원특별자치도','세종특별자치시','제주특별자치도','전북특별자치도','전남광주통합특별시','서울특별시','경기도','인천광역시','강원도','대전광역시','충청남도','충청북도','전라북도','부산광역시','대구광역시','울산광역시','광주광역시','전라남도','경상남도','경상북도'];
const APP_VERSION='3.0.3-cloudflare-recovery';
const imageStats={success:0,failure:0,last_error:null,last_success:null};
class ApiError extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'}});}
function fail(e){if(e instanceof ApiError)return json({error:e.code,message:e.message},e.status);return json({error:'INTERNAL',message:'데이터 조회 처리 중 오류가 발생했습니다.'},500);}
function bounded(n,min,max){return typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;}
function coords(query){
 const qs=new URLSearchParams(query);const a=qs.getAll('latitude'),b=qs.getAll('longitude');
 if(a.length!==1||b.length!==1||a[0]===''||b[0]==='')throw new ApiError(400,'BAD_COORDS','위도·경도를 각각 하나만 입력하세요.');
 const lat=Number(a[0]),lon=Number(b[0]);
 if(!bounded(lat,32,39.9)||!bounded(lon,123,133))throw new ApiError(400,'BAD_COORDS','국내 조회좌표 범위(위도 32~39.9, 경도 123~133)를 벗어났습니다.');
 return {lat:Math.round(lat*1e5)/1e5,lon:Math.round(lon*1e5)/1e5};
}
function configuredKey(env){return (env.TSD_AIRSPACE_WFS_KEY||env.TSD_VWORLD_API_KEY||'').trim();}
function domain(env){const value=(env.TSD_VWORLD_DOMAIN||'').trim();return /CHANGE-TO|EXAMPLE|YOUR-DOMAIN/i.test(value)?'':value;}
function urlFor(base,params){let u=new URL(base);for(const [k,v]of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));return u;}
const cache=new Map();
async function cached(key,ttl,fn){const found=cache.get(key);if(found&&found.expires>Date.now())return found.data;const result=await fn();if(cache.size>250)cache.clear();const seconds=typeof ttl==='function'?ttl(result):ttl;cache.set(key,{expires:Date.now()+Math.max(0,seconds)*1000,data:result});return result;}
async function upstream(url,{timeout=9000,maxBytes=2_500_000,accept='application/json',method='GET',headers={}}={}){
 const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeout);
 try{
  // The request URL is always assembled by this code from fixed allowlisted services.
  const res=await fetch(url,{method,headers:{Accept:accept,...headers},signal:ctl.signal,redirect:'manual'});
  if(!res.ok){
   // Do not log URL parameters, API key, DOMAIN, Referer, IP, or response body.
   const dest=new URL(url);
   console.warn('[TSD_VWORLD_UPSTREAM]', JSON.stringify({host:dest.hostname,path:dest.pathname,status:res.status,cfRay:res.headers.get('cf-ray')||null,server:res.headers.get('server')||null,contentType:res.headers.get('content-type')||null}));
   throw new ApiError(res.status===429?503:502,res.status===520?'PROVIDER_UPSTREAM_520':'PROVIDER_HTTP_'+res.status,'외부 자료 제공기관 HTTP '+res.status);
  }
  const bytes=await res.arrayBuffer();if(bytes.byteLength>maxBytes)throw new ApiError(502,'PROVIDER_OVERSIZE','외부 자료 크기 초과');
  return {bytes,contentType:(res.headers.get('Content-Type')||'').toLowerCase(),text:new TextDecoder('utf-8').decode(bytes)};
 }catch(e){if(e.name==='AbortError')throw new ApiError(504,'PROVIDER_TIMEOUT','자료 제공기관 응답 시간 초과');if(e instanceof ApiError)throw e;throw new ApiError(502,'PROVIDER_NETWORK','외부 자료 제공기관 연결 실패');}finally{clearTimeout(timer);}
}
async function upstreamJSON(url,options){const r=await upstream(url,options);try{return JSON.parse(r.text);}catch{throw new ApiError(502,'PROVIDER_JSON','자료 제공기관 응답 JSON 형식 오류');}}
function pointInRing(x,y,ring){
 if(!Array.isArray(ring)||ring.length<4)return false;let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i];if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2)throw new Error('Bad polygon');
  const [ax,ay]=a,[bx,by]=b;if(![ax,ay,bx,by].every(Number.isFinite))throw new Error('Bad polygon');
  const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
  if(Math.abs(cross)<1e-9&&x>=Math.min(ax,bx)-1e-9&&x<=Math.max(ax,bx)+1e-9&&y>=Math.min(ay,by)-1e-9&&y<=Math.max(ay,by)+1e-9)return true;
  if((ay>y)!==(by>y)&&x<((bx-ax)*(y-ay))/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
function contains(g,lon,lat){
 if(!g||typeof g!=='object')throw new Error('No geometry');
 if(g.type==='Polygon'){if(!Array.isArray(g.coordinates)||!g.coordinates.length)throw new Error('Bad polygon');return pointInRing(lon,lat,g.coordinates[0])&&!g.coordinates.slice(1).some(r=>pointInRing(lon,lat,r));}
 if(g.type==='MultiPolygon'){if(!Array.isArray(g.coordinates))throw new Error('Bad multipolygon');return g.coordinates.some(p=>contains({type:'Polygon',coordinates:p},lon,lat));}
 if(g.type==='GeometryCollection'){if(!Array.isArray(g.geometries))throw new Error('Bad collection');return g.geometries.some(x=>contains(x,lon,lat));}
 throw new Error('Unsupported geometry');
}
function featureMeta(feat,category){
 const o={};for(const [key,v]of Object.entries(feat.properties||{}))if(typeof v==='string'||typeof v==='number')o[key.toLowerCase()]=String(v).trim();
 const safe=t=>String(t||'').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,100);
 const codeOf=t=>{const m=String(t||'').match(/(?:^|[^A-Z\d])(?:RK\s*[- ]?)?([PRD])\s*[- ]?(\d{1,4}[A-Z]?)(?![A-Z\d])/i);return m?m[1].toUpperCase()+m[2].toUpperCase():'';};
 let code='';for(const k of [...CODE_FIELDS,...NAME_FIELDS])if(o[k]&&(code=codeOf(o[k])))break;if(!code)for(const v of Object.values(o))if((code=codeOf(v)))break;
 let name='';for(const k of NAME_FIELDS){const v=safe(o[k]);if(v&&v.toLowerCase()!==category.toLowerCase()){name=v;break;}}
 if(!name)for(const [k,v]of Object.entries(o))if(/name|_nm|area_nm|zone_nm/.test(k)&&safe(v)&&safe(v).toLowerCase()!==category.toLowerCase()){name=safe(v);break;}
 if(code&&name&&[code,'RK'+code].includes(name.toUpperCase().replace(/[ -]/g,'')))name='';
 const lim=fields=>{for(const k of fields)if(o[k])return safe(o[k]).slice(0,60);return'';};
 return {name,code,lower_limit:lim(LOWER_FIELDS),upper_limit:lim(UPPER_FIELDS)};
}
function xmlCode(text){
 const lower=String(text).slice(0,12000).toLowerCase();
 if(!/<(?:\w+:)?(?:exceptionreport|serviceexceptionreport|exception|serviceexception)/.test(lower))return 'WFS_XML_UNEXPECTED';
 if(/apikey|api key|auth|permission|domain|referer|access denied|invalid key|인증|접근권한/.test(lower))return 'WFS_XML_AUTH_DOMAIN';
 if(/typename|layer|featuretype|unknown type|레이어/.test(lower))return 'WFS_XML_LAYER';
 if(/bbox|srs|crs|coordinate|좌표/.test(lower))return 'WFS_XML_COORDS';
 if(/output|format/.test(lower))return 'WFS_XML_OUTPUT';
 if(/version|operation|request/.test(lower))return 'WFS_XML_REQUEST';
 return 'WFS_XML_UNKNOWN';
}
async function dataLayer(layer,lat,lon,key,env){
 const params={key,domain:domain(env),service:'data',version:'2.0',request:'getfeature',format:'json',errorformat:'json',data:layer.toUpperCase(),geomFilter:`POINT(${lon.toFixed(6)} ${lat.toFixed(6)})`,crs:'EPSG:4326',geometry:'true',attribute:'true',size:'100',page:'1'};
 const {text}=await upstream(urlFor(VW+'/req/data',params),{timeout:9000,headers:{Referer:domain(env)}});
 if(text.trimStart().startsWith('<'))throw new ApiError(502,'DATA_XML','2D 데이터 API에서 XML 오류 반환');
 let d;try{d=JSON.parse(text);}catch{throw new ApiError(502,'DATA_NONJSON','2D 데이터 API JSON 형식 오류');}
 const r=d?.response;if(!r||typeof r!=='object')throw new ApiError(502,'DATA_RESPONSE','2D 데이터 API 응답 누락');
 const status=String(r.status||'').toUpperCase();
 if(status==='NOT_FOUND'&&!r.error)return {features:[],_tsd_method:'DATA'};
 if(status==='ERROR'){
  const ec=String(r.error?.code||'').toUpperCase();let code='DATA_ERROR';if(/KEY|AUTH|PERMISSION|DOMAIN|ACCESS/.test(ec))code='DATA_AUTH_DOMAIN';else if(/DATA|TYPE|LAYER|NOT_EXIST/.test(ec))code='DATA_LAYER';
  throw new ApiError(502,code,'브이월드 2D 공역 데이터 API 오류');
 }
 if(status!=='OK')throw new ApiError(502,'DATA_STATUS','2D API 상태 확인 불가');
 const fc=r.result?.featureCollection;
 if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features))throw new ApiError(502,'DATA_FORMAT','공역 GeoJSON 구조 오류');
 if(fc.features.length>=100)throw new ApiError(502,'DATA_TRUNCATED','공역 응답 100건 경계에 도달해 완전 조회 불가');
 if(fc.features.some(f=>!f||!f.geometry||typeof f.geometry!=='object'))throw new ApiError(502,'DATA_GEOMETRY','공역 경계 누락');
 return {features:fc.features,_tsd_method:'DATA'};
}
async function wfsLayer(layer,lat,lon,key,env){
 const d=0.008;
 const params={KEY:key,DOMAIN:domain(env),SERVICE:'WFS',VERSION:'1.1.0',REQUEST:'GetFeature',TYPENAME:layer.toUpperCase(),SRSNAME:'EPSG:4326',OUTPUT:'application/json',BBOX:`${(lon-d).toFixed(6)},${(lat-d).toFixed(6)},${(lon+d).toFixed(6)},${(lat+d).toFixed(6)},EPSG:4326`,MAXFEATURES:'100'};
 const {text}=await upstream(urlFor(VW+'/req/wfs',params),{timeout:9000,accept:'application/json,application/geo+json,application/xml;q=0.5',headers:{Referer:domain(env)}});
 if(text.trimStart().startsWith('<'))throw new ApiError(502,xmlCode(text),'공역 WFS XML 오류');
 let djson;try{djson=JSON.parse(text);}catch{throw new ApiError(502,'WFS_NONJSON','WFS JSON 파싱 오류');}
 if(djson?.type!=='FeatureCollection'||!Array.isArray(djson.features))throw new ApiError(502,'WFS_RESPONSE','WFS 응답 형식 오류');
 if(!djson.features.length)throw new ApiError(502,'WFS_EMPTY_UNCONFIRMED','WFS 좌표축 미검증으로 빈 결과가 공역 미지정 근거가 되지 않음');
 if(djson.features.length>=100)throw new ApiError(502,'WFS_TRUNCATED','WFS 반환 100건 도달');
 return {features:djson.features,_tsd_method:'WFS'};
}
async function queryLayer(layer,lat,lon,key,env){
 try{return await dataLayer(layer,lat,lon,key,env);}catch(de){
  try{return await wfsLayer(layer,lat,lon,key,env);}catch(we){throw new ApiError(502,`${de.code||'DATA_ERROR'}|${we.code||'WFS_ERROR'}`,'공역 2D/WFS 조회 실패');}
 }
}
async function airspace(query,env){
 const {lat,lon}=coords(query),key=configuredKey(env);
 if(!key)return {status:'unavailable',source:'미연결',partial:true,matches:[],message:'Cloudflare Worker의 VWorld 인증키가 설정되지 않았습니다. Worker 비밀변수 TSD_AIRSPACE_WFS_KEY와 서비스 URL 등록을 확인하세요.'};
 if(!domain(env))return {status:'unavailable',source:'미연결',partial:true,matches:[],message:'Worker TSD_VWORLD_DOMAIN 설정이 없습니다. 실제 Pages 서비스 주소로 등록해야 합니다.'};
 const queryKey=`air:${lat},${lon}:${key.slice(0,3)}:${domain(env)}`;
 return cached(queryKey,result=>result.status==='unavailable'?25:result.partial?60:600,async()=>{
  const entries=await Promise.all(Object.keys(LAYERS).map(async layer=>{try{return {layer,data:await queryLayer(layer,lat,lon,key,env)};}catch(e){return {layer,error:e instanceof ApiError?e.code:'AIRSPACE_UNKNOWN'};}}));
  let features=[],checked=[],failures=[],methods=[],categories=[],partial=false;
  for(const e of entries){if(e.error){partial=true;failures.push(LAYERS[e.layer]+': '+e.error);continue;}
   checked.push(e.layer);categories.push(LAYERS[e.layer]);methods.push(e.data._tsd_method);
   for(const f of e.data.features)features.push({...f,_tsd_category:LAYERS[e.layer]});
  }
  const source='국토교통부 VWorld 항공정보도 2D 데이터 API·WFS · 주요 정기 공역 5종';
  if(!checked.length){const up520=failures.some(x=>/PROVIDER_(?:HTTP_|UPSTREAM_)520/.test(x));return {status:'unavailable',source,partial:true,complete:false,matches:[],checked_layers:[],failure_codes:failures,provider_error:up520?'HTTP_520':null,message:up520?'브이월드 공역 제공 경로에서 HTTP 520이 발생하여 5개 공역 레이어를 확인하지 못했습니다. 이 결과는 비행 허용을 의미하지 않습니다. 공역·NOTAM을 공식 경로로 별도 확인하세요.':'공식 공역조회 실패 ('+failures.join(' / ').slice(0,450)+'). 제공기관 응답·서비스 URL·WFS 권한을 확인하세요.'};}
  const matches=[],seen=new Set();for(const f of features){try{
   if(!contains(f.geometry,lon,lat))continue;
   const category=f._tsd_category,meta=featureMeta(f,category),identity=[category,meta.code.toLowerCase(),meta.name.toLowerCase()].join('|');
   if(seen.has(identity))continue;seen.add(identity);matches.push({category,...meta});
  }catch{partial=true;failures.push('GEOMETRY_INVALID');}}
  const all=checked.length===Object.keys(LAYERS).length;
  return {status:partial?'partial':'ok',source,partial,checked_at:new Date().toISOString(),matches:matches.slice(0,16),checked_layers:checked,checked_categories:categories,coverage:'primary_5_only',complete:!partial&&all,used_methods:methods,failure_codes:failures,message:'선택 좌표의 주요 정기 공역 5종 결과입니다. CTA·NOTAM·고도·시간 및 지상시설 제한은 별도 확인해야 합니다.'};
 });
}
async function weather(query){
 const {lat,lon}=coords(query);
 return cached(`weather:${lat},${lon}`,600,async()=>{
  const u=urlFor(OPEN_METEO,{latitude:lat.toFixed(5),longitude:lon.toFixed(5),hourly:WEATHER_HOURLY,daily:'sunrise,sunset',timezone:'Asia/Seoul',forecast_days:'7',wind_speed_unit:'ms'});
  const d=await upstreamJSON(u,{timeout:13000});const h=d?.hourly,ts=h?.time;
  if(!Array.isArray(ts)||ts.length<1||ts.length>200)throw new ApiError(502,'WEATHER_FORMAT','예보 시각 목록 오류');
  for(const k of ['temperature_2m','relative_humidity_2m','precipitation_probability','wind_speed_10m','wind_gusts_10m','visibility'])if(!Array.isArray(h[k])||h[k].length!==ts.length)throw new ApiError(502,'WEATHER_FORMAT','예보 필수 변수 누락 '+k);
  return d;
 });
}
function fresh(t,hours=12){const n=Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(t)?t:t.replace(' ','T')+'Z');return Number.isFinite(n)&&Math.abs(Date.now()-n)<=hours*3600000;}
async function kasaIndex(){
 const d=await upstreamJSON(KASA+'/api/kindex',{timeout:6500});const k=d?.Kindex||d?.kindex;
 if(!k||d.Error===true||!bounded(Number(k.CurrentP),0,9)||!bounded(Number(k.CurrentK),0,9))throw new ApiError(502,'KASA_INDEX_FORMAT','국내 지자기 Kp/Kk 값 형식 오류');
 return {Error:false,Kindex:{CurrentP:Number(k.CurrentP),CurrentK:Number(k.CurrentK),Time:k.Time||null}};
}
async function kasaWarn(){
 const d=await upstreamJSON(KASA+'/api/warn',{timeout:6500});const w=d?.warn||d?.Warn;
 if(d?.Error===true||!w||typeof w!=='object')throw new ApiError(502,'KASA_WARN_FORMAT','우주기상 경보 누락');
 const out={};for(const k of ['G','R','S']){const grade=w[k]?.v0;if(!new RegExp('^'+k+'[0-5]$').test(String(grade)))throw new ApiError(502,'KASA_WARN_FORMAT','우주기상 경보등급 누락');out[k]={v0:grade};}
 return {Error:false,warn:out,LastUpdate:d.LastUpdate||null};
}
async function noaaIndex(){
 const d=await upstreamJSON(NOAA+'/products/noaa-planetary-k-index.json',{timeout:8500});
 if(!Array.isArray(d))throw new ApiError(502,'NOAA_FORMAT','NOAA Kp 응답 구조 오류');
 const rows=d.filter(x=>x&&fresh(String(x.time_tag))&&bounded(Number(x.Kp),0,9)).sort((a,b)=>String(a.time_tag).localeCompare(String(b.time_tag)));
 if(!rows.length)throw new ApiError(503,'NOAA_STALE','NOAA 최근 지자기 지수 없음');const rec=rows[rows.length-1];
 return {Error:false,Source:'NOAA SWPC (국내 Kk 없음)',Kindex:{CurrentP:Number(rec.Kp),CurrentK:null,Time:rec.time_tag}};
}
async function noaaWarn(){
 const d=await upstreamJSON(NOAA+'/products/noaa-scales.json',{timeout:8500});const r=d?.['0'];
 if(!r||!fresh(String(r.DateStamp)+'T'+String(r.TimeStamp)))throw new ApiError(503,'NOAA_STALE','NOAA 경보 최신성 확인 실패');
 const warn={};for(const k of ['G','R','S']){const v=Number(r[k]?.Scale);if(!Number.isInteger(v)||v<0||v>5)throw new ApiError(502,'NOAA_FORMAT','NOAA 경보 형식 오류');warn[k]={v0:k+v};}
 return {Error:false,Source:'NOAA SWPC (우주항공청 장애 시 보조)',warn,LastUpdate:String(Date.parse(r.DateStamp+'T'+r.TimeStamp+'Z'))};
}
async function space(kind){return cached('space:'+kind,600,async()=>{try{return await(kind==='index'?kasaIndex():kasaWarn());}catch{return await(kind==='index'?noaaIndex():noaaWarn());}});}
async function geocode(query,env){
 const k=(env.TSD_VWORLD_API_KEY||env.TSD_AIRSPACE_WFS_KEY||'').trim();if(!k)throw new ApiError(503,'SEARCH_NOT_CONFIGURED','공식 장소검색 키 미설정');
 const qs=new URLSearchParams(query),all=qs.getAll('q'),q=all[0]?.normalize('NFKC').trim().replace(/\s+/g,' ');
 if(all.length!==1||!q||q.length<2||q.length>80||/\p{Cc}/u.test(q))throw new ApiError(400,'BAD_QUERY','검색어는 2~80자만 입력하세요.');
 return cached('geocode:'+q,1200,async()=>{
  const tasks=[['PLACE',''],['ADDRESS','ROAD'],['ADDRESS','PARCEL']];
  const entries=await Promise.all(tasks.map(async([type,category])=>{
   const u=urlFor(VW+'/req/search',{service:'search',request:'search',version:'2.0',crs:'EPSG:4326',size:8,page:1,query:q,type,category,format:'json',errorformat:'json',key:k,domain:domain(env)});
   try{const data=await upstreamJSON(u,{timeout:7500,maxBytes:350000});const r=data?.response,status=String(r?.status||'').toUpperCase();if(status==='NOT_FOUND')return {type:category||'PLACE',ok:true,items:[]};if(status!=='OK'||!Array.isArray(r?.result?.items))throw new Error('bad provider');return {type:category||'PLACE',ok:true,items:r.result.items};}catch{return {type:category||'PLACE',ok:false,items:[]};}
  }));
  if(entries.every(e=>!e.ok))throw new ApiError(502,'GEOCODE_UNAVAILABLE','VWorld 공식 장소검색에 연결하지 못했습니다.');
  const groups={PLACE:[],ROAD:[],PARCEL:[]};for(const e of entries){for(const item of e.items){const lat=Number(item?.point?.y),lon=Number(item?.point?.x);if(!bounded(lat,32,39.9)||!bounded(lon,123,133))continue;
   const address=item.address||{},name=String(item.title||address.road||address.parcel||q).slice(0,160),extra=String(address.road||address.parcel||'').slice(0,160);groups[e.type].push({lat,lon,label:extra&&!name.includes(extra)?name+' · '+extra:name,provider:'국토교통부 VWorld'});
  }}
  const priority=/\d/.test(q)?['ROAD','PARCEL','PLACE']:['PLACE','ROAD','PARCEL'];let list=[];for(const type of priority)list.push(...groups[type].slice(0,type===priority[0]?2:1));for(const type of priority)list.push(...groups[type]);
  const seen=new Set(),results=[];for(const item of list){const key=[item.lat.toFixed(5),item.lon.toFixed(5),item.label.split(' · ')[0].toLowerCase()].join('|');if(seen.has(key))continue;seen.add(key);results.push(item);if(results.length>=8)break;}
  return {results,partial:entries.some(e=>!e.ok),checked_types:entries.filter(e=>e.ok).length,provider:'국토교통부 VWorld'};
 });
}
async function jurisdiction(query,env){
 const {lat,lon}=coords(query),key=configuredKey(env);if(!key)return {status:'unavailable',province:'',message:'주소 역조회 인증키 미설정 · 항공청 직접 선택'};
 const p={service:'address',request:'getAddress',version:'2.0',crs:'EPSG:4326',point:`${lon.toFixed(6)},${lat.toFixed(6)}`,format:'json',type:'BOTH',key,domain:domain(env)};
 try{const d=await upstreamJSON(urlFor(VW+'/req/address',p),{timeout:7000,maxBytes:130000,headers:{Referer:domain(env)}});
  if(String(d?.response?.status).toUpperCase()!=='OK')throw new Error('No address');const results=d.response.result;const array=Array.isArray(results)?results:[results];
  for(const row of array){const t=String(row?.text||'');const province=KNOWN_PROVINCES.find(p=>t===p||t.startsWith(p+' '));if(province)return {status:'ok',province,source:'VWorld 공식 주소 역조회'};}
 }catch{}return {status:'unavailable',province:'',message:'행정구역 자동 확인 실패 · 지방항공청 직접 선택'};
}
async function tile(z,x,y,env){
 if(String(env.TSD_TILE_PROXY_ENABLED||'false')!=='true')throw new ApiError(503,'TILE_DISABLED','지도 타일 중계가 비활성화되어 있습니다. 브라우저 직접 영상을 사용합니다.');
 if(![z,x,y].every(Number.isSafeInteger)||z<0||z>19||x<0||y<0||x>=2**z||y>=2**z)throw new ApiError(400,'BAD_TILE','지도 타일 좌표 오류');
 // Provider ToS must be independently checked before enabling imagery relay.
 const provider=env.TSD_IMAGERY_PROVIDER==='vworld'?'vworld':'esri';const key=(env.TSD_VWORLD_WMTS_KEY||env.TSD_VWORLD_API_KEY||'').trim();
 if(provider==='vworld'&&!key)throw new ApiError(503,'VWORLD_KEY_MISSING','위성 타일 인증키 미설정');
 const url=provider==='vworld'?`${VW}/req/wmts/1.0.0/${encodeURIComponent(key)}/Satellite/${z}/${y}/${x}.jpeg`:`${ESRI}/${z}/${y}/${x}`;
 const r=await upstream(url,{timeout:9000,maxBytes:1000000,accept:'image/jpeg,image/png,image/webp'});
 if(!/^image\/(jpeg|png|webp)/.test(r.contentType)||r.bytes.byteLength<100)throw new ApiError(502,'BAD_TILE','지도 제공기관 이미지 수신 실패');
 imageStats.success++;imageStats.last_success=new Date().toISOString();
 return new Response(r.bytes,{headers:{'Content-Type':r.contentType.split(';')[0],'Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'}});
}
export async function handler(request,env){
 const u=new URL(request.url),path=u.pathname;
 if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
 try{
  if(path==='/health')return json({status:'ok',search_configured:Boolean(configuredKey(env)),weather_proxy:true,space_proxy:true,space_index_proxy:true,space_fallback:'NOAA SWPC (Kk not provided)',airspace_provider_configured:Boolean(configuredKey(env)&&domain(env)),tile_proxy_available:String(env.TSD_TILE_PROXY_ENABLED||'false')==='true',imagery_provider:env.TSD_IMAGERY_PROVIDER==='vworld'?'vworld':'esri',vworld_wmts_key_configured:Boolean(env.TSD_VWORLD_WMTS_KEY||env.TSD_VWORLD_API_KEY),tsd_version:APP_VERSION,note:'Worker 연결 확인만으로 외부 API 실제 성공을 보장하지 않습니다.'});
  if(path==='/api/forecast')return json(await weather(u.search));
  if(path==='/api/space-index')return json(await space('index'));
  if(path==='/api/space-weather')return json(await space('warn'));
  if(path==='/api/airspace')return json(await airspace(u.search,env));
  if(path==='/api/jurisdiction')return json(await jurisdiction(u.search,env));
  if(path==='/api/geocode')return json(await geocode(u.search,env));
  if(path==='/api/map-status')return json({...imageStats,provider:env.TSD_IMAGERY_PROVIDER==='vworld'?'vworld':'esri',tile_proxy_enabled:String(env.TSD_TILE_PROXY_ENABLED||'false')==='true',live_provider_verified:Boolean(imageStats.last_success)});
  if(path==='/api/map-diagnostics'){
   const t=new URLSearchParams(u.search),{lat,lon}=coords('?'+new URLSearchParams({latitude:t.get('lat')||'',longitude:t.get('lon')||''}).toString());
   if(String(env.TSD_TILE_PROXY_ENABLED||'false')!=='true')return json({status:'disabled',verified:false,provider:'browser-direct',message:'영상 중계 비활성화 · 브라우저에서 타일 직접 수신'},200);
   const z=10,x=Math.floor((lon+180)/360*2**z),y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**z);
   try{const img=await tile(z,x,y,env);return json({status:'ok',verified:img.ok,provider:env.TSD_IMAGERY_PROVIDER||'esri',z,x,y});}catch(e){return json({status:'failed',verified:false,error:e.code||'TILE_ERROR'},502);}
  }
  const m=path.match(/^\/api\/map-tiles\/sat\/(\d+)\/(\d+)\/(\d+)$/);if(m)return await tile(Number(m[1]),Number(m[2]),Number(m[3]),env);
  return json({error:'NOT_FOUND',message:'지원하지 않는 API 경로'},404);
 }catch(e){return fail(e);}
}
/**
 * CORS for the public TSD GitHub Pages origin. API keys remain server-side.
 * Do not attach this Worker to the existing authentication/Access Worker.
 */
const BROWSER_ORIGIN='https://lwhfpv.github.io';
function corsHeaders(origin){
 return {
  'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Methods':'GET, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Max-Age':'600',
  'Vary':'Origin'
 };
}
export default {
 async fetch(request,env,ctx){
  const origin=request.headers.get('Origin');
  if(origin&&origin!==BROWSER_ORIGIN){
   return json({error:'ORIGIN_NOT_ALLOWED',message:'이 홈페이지에서는 이용할 수 없습니다.'},403);
  }
  if(request.method==='OPTIONS'){
   return new Response(null,{status:204,headers:origin?corsHeaders(origin):{'Allow':'GET, OPTIONS'}});
  }
  const result=await handler(request,env);
  if(!origin)return result;
  const headers=new Headers(result.headers);
  for(const [k,v]of Object.entries(corsHeaders(origin)))headers.set(k,v);
  return new Response(result.body,{status:result.status,statusText:result.statusText,headers});
 }
};
export const __test={coords,pointInRing,contains,featureMeta,xmlCode,airspace,weather,space,jurisdiction,geocode,queryLayer};
