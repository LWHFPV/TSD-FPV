"""RevS9 RX support trial — internal, NOT production or final output release.
Source recovery:
- RevS8 full archive / 00_RevS8_통합재설계_검증보고.md / RX section.
- RevS8 full archive / 검증재현_코드/tsd10_rx_tray_trial.py:
  M2.5 clearance, bore diameter 3.0, original legs radius 3.3,
  original leg start Z=8.5; frame mounting surface Z=7.
- RevZ1 2026-11-23 1-5_10차_사전검증_판정보고.md:
  GPS-RF 2.5 mm tap-pilot candidate, M3 thread not physically modeled.
- RevZ1 1-5_9차 / 1-5_11차 reports: GPS 2.8 mm original,
  3.2 mm candidate and tool access trials; do not imply approved change.
Supersedes use of M3 for RX in phase1-fastener-axis and tolerance-inertia.
New independent local BRep checks: one RX joint per variant, both actual
parts and nominal/+0.2 mm lateral M2.5 smooth-cylinder offsets:
16/16 zero intersection. All 32 measured bore radii from 16 original
positions are 1.5 mm. Ideal radial margin .25 mm; prior A/B/C assumptions
give .165/.09/-.01 mm. RX support gap itself was a genuine design issue.
Below is the executed support-trial generator (local scratch inputs).
For each of 4 variants: 4 annular leg extensions, 1.5 mm gap,
existing holes preserved; 162.86016316210907 mm3 added, 0 original
material lost, 16 AABB-positive new-material pair checks total,
0 positive intersections; 16 base minimum distances zero.
Separate executed verification: exact coplanar common face area
108.57344210806325 mm2 per variant, expected 108.57344210806323,
all 4 STEP exports reimported valid; all 4 STL watertight and
consistent winding, max STEP/STL volume discrepancy 0.025561714029842645%.
Trial geometry is not yet incorporated into assembly STEP/STL/GLB,
print package, or production viewer. No public binary or production update.
Original CAD unchanged. Red rear extension evidence not recovered:
the mounted Nov 26 screenshot inspected is Cloudflare settings, not
the red-marked CAD photo. Do not infer missing boundary.
Chromium retest with ANGLE SwiftShader and SwiftShader-WebGL flags
returned false for both WebGL and WebGL2; UI rendering not certified.
PR #2 prior head 8414a514d0ce4b25c0b54440cbea27bf34d3d927,
base 38eae7931ba9cdb02bd521294b24f25c1e3a46c0, unmerged,
get_pr_info mergeable=false, fetch_pr mergeable=true;
prior run 46135599130 success (RevS8 mesh audit only),
combined status empty, Cloudflare unverified. No merge.
"""
import zipfile,json,hashlib,tempfile
from pathlib import Path
import cadquery as cq
from concurrent.futures import ProcessPoolExecutor
root=Path('/mnt/data'); work=root/'tsd10_reconcile_work'; src=root/'files/TSD10_RevS9_공통형상_STEP_STL_GLB_4조합_비승인.zip'; variants=['상부_XT60','상부_XT90','하부_XT60','하부_XT90']; old=root/'TSD10_RevS9_1단계_체결축_검증.zip'
def overlaps(a,b,eps=1e-6):
 x=a.BoundingBox();y=b.BoundingBox();return all(min(getattr(x,d+'max'),getattr(y,d+'max'))-max(getattr(x,d+'min'),getattr(y,d+'min'))>eps for d in 'xyz')
def run(v):
 with zipfile.ZipFile(src) as z, tempfile.TemporaryDirectory() as t:
  n=next(n for n in z.namelist() if v in n and n.endswith('시험조립.step'));f=Path(t)/'a.step';f.write_bytes(z.read(n));parts=cq.importers.importStep(str(f)).val().Solids()
 with zipfile.ZipFile(old) as z: j=json.loads(z.read(v+'_joints.json'))['joints']
 rx=[x for x in j if x['joint']=='rx'];idx=int(rx[0]['checks'][1]['part'][1:]);base=parts[0];original=parts[idx];assert original.isValid();rings=[];s=original
 for r in rx:
  x,y=r['xy']; a=cq.Solid.makeCylinder(3.3,1.5,cq.Vector(x,y,7)); b=cq.Solid.makeCylinder(1.5,1.5,cq.Vector(x,y,7));ring=a.cut(b);rings.append(ring);s=s.fuse(ring)
 s=s.clean();assert s.isValid() and len(s.Solids())==1
 loss=original.cut(s).Volume();delta=s.Volume()-original.Volume();contacts=[];hits=[];tested=0
 for k,ring in enumerate(rings):
  for i,p in enumerate(parts):
   if i==idx or not overlaps(ring,p):continue
   tested+=1; vol=ring.intersect(p).Volume()
   if vol>1e-6:hits.append([k,i,vol])
  contacts.append(ring.distance(base))
 assert abs(delta-4*3.141592653589793*(3.3**2-1.5**2)*1.5)<1e-4
 print(v,'delta',delta,'loss',loss,'hits',hits,'contacts',contacts,'candidates',tested,flush=True)
 if not hits and loss<1e-6 and max(contacts)<1e-6:
  p=work/(v+'_RX_support_trial.step');cq.exporters.export(s,str(p)); reread=cq.importers.importStep(str(p)).val();assert reread.isValid() and abs(reread.Volume()-s.Volume())<1e-5
 return {'variant':v,'index':idx,'added_mm3':delta,'original_loss_mm3':loss,'candidate_pair_tests':tested,'positive_intersections':hits,'ring_base_min_distance_mm':contacts,'candidate_valid':not hits and loss<1e-6 and max(contacts)<1e-6}
if __name__=='__main__':
 work.mkdir(exist_ok=True)
 with ProcessPoolExecutor(max_workers=4) as p:r=list(p.map(run,variants))
 (work/'rx_support_trial.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
