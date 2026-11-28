# RevS9 1-4007 / 1-5000 — 2026-11-28
Reopened actual local RevS8 and RevS9 STEP ZIPs and previous measured 72-axis JSON archive; all 3 ZIP CRCs passed. No CAD geometry modified.
## 1-4007
288 arithmetic cases, 72 joint locations x 4 assumptions. Shaft center offset e, diameter undersize of bore u, diameter oversize of shaft o; margin=min measured ideal radial clearance - e -(u+o)/2. RF blocked centerline classified separately.
|Case|e,u,o mm|positive|zero/negative|blocked|
|---|---|---:|---:|---:|
|nominal|0,0,0|40|24|8|
|A|.05,.05,.02|40|24|8|
|B|.10,.10,.02|8|56|8|
|C|.20,.10,.02|0|64|8|
Hypothetical envelope only, not manufacturing tolerance specifications. Nominal zero: RX 16, GPS 8.
Independent actual OCP BRepAlgoAPI_Common on upper XT60 limiting bore segment of one location from each of 5 types, nominal shaft diameter, X offset 0/.05/.20 mm, 15 completed, intersection positive 7, zero 8. At .05 mm, RX 1.0496514008 mm3, GPS .4997166813 mm3, other 3 zero. At .20 mm all five positive. Tested finite bore segments, not screw heads, threads, full insertion or 4-combination perturbed assemblies. Do not enlarge holes without distinguishing threaded/pilot/clearance function. RF blocked pathway unresolved.
## 1-5000
Actual BRep volume properties of 8 valid single solids, RevS8 upper XT60 vs RevS9 common trial. Unit-density geometric inertia tensor about centroid, principal eigenvalues compared in sorted order. Volume change %, centroid shift mm, principal geometric inertia changes %:
- lower plate: -.03602384, .03609989, [-.00149488,-.04129706,-.02337984]
- left C: -.07404847, .06765465, [-.21407379,-.17611001,-.17479539]
- right C: -.07404847, .06765465, [-.21407379,-.17611001,-.17479539]
- RF: -1.11092077, .12804364, [-.81733830,-1.24734382,-.92453789]
These are volume inertia metrics (mm5), not sectional stiffness, safety factor, fatigue or FEA; local stress and load/material/boundary conditions unresolved. 
Reproduction ZIP TSD10_RevS9_공차_형상관성_검증.zip, 8227 bytes, SHA256 5a47f7e890e7a17be0997338b3a1a76c8577370c4c870e70969aa8ffb4f1078a; 5 payload hashes verified, CRC pass. Includes scripts, CSV, and JSON. Archive not uploaded to repository.
Pre-write PR #2 head 3295ff409d01f6586cca90c168db2bfea9c863c2, base 38eae7931ba9cdb02bd521294b24f25c1e3a46c0, unmerged, get_pr_info returned mergeable=false (cause not determined); no merge attempted. Actions 46097323986 success (RevS8 audit only), combined statuses empty, Cloudflare unverified. No main changes. Manufacturing approved=false, preprint ready=false. Stage 2-0000 excluded. Next: resolve CAD fastener function from original design evidence, targeted clearance checks, material-boundary inputs and print/web tests.
