# RevS9 phase 1 follow-up — 2026-11-28
Source: TSD10_RevS9_1단계_출력준비_중간검토_비승인.zip SHA256 d86b696c5f364581a70e41ff6617610b587f49d70f660a8cdbb003dde34e4689. ZIP CRC passed, 213/213 internal manifest hashes match. No geometry changed.
## 1-6000: bed screening
Executed Python/trimesh/NumPy/SciPy convex hull XY projection for all 124 STL files, original Z axis retained, sampled 0..90 deg every 0.25 deg, assumed 5 mm clearance on each bed edge. Square beds with equal nominal Z capacity:
| bed mm | 50% files | 100% files |
|---|---:|---:|
|220|62/62|58/62|
|256|62/62|58/62|
|300|62/62|58/62|
|350|62/62|58/62|
|400|62/62|62/62|
All four exclusions are p00 common lower plate, largest XY 350.1269836425781 mm, Z 13.699999809265137 mm, best sampled rotation 0 deg, required 360.1269836425781 mm square bed under stated margin. Largest 50% candidate needs 185.06349182128906 mm. No slicer, no actual printer verification, supports or adhesion verification. No split or geometry modification.
## 1-7000: assembly reference register
142 assembly instances: 82 matched candidate manufacturing sources, 60 equipment/reference shapes based on existing position-matched display labels: camera 4, electronics 12, battery 4, propulsion 32, power 4, GPS 4. These 60 are not missing manufacturing STL requirements; manufacturer identity and actual dimensions remain unverified. Each variant 15 reference entries. Created 142-row assembly_reference_register.csv and 124-row bed_fit_screen.csv in separate follow-up ZIP (not uploaded to repo); result.json and reproducible audit.py included. 8/8 groups of common p00/p02/p03/p06 at scales 0.5 and 1 each have 4 variants with exactly one SHA256; 32 files checked. This proves identical exported STL bytes in each group, not final approved geometry. Source names and earlier candidate status preserved.
## CI
Pre-write PR head 27b4c8bdff56fe20a8816ec5cafb2bf49e851d16, base 38eae7931ba9cdb02bd521294b24f25c1e3a46c0; open, unmerged, get_pr_info mergeable=false; no merge attempted. Actual GitHub Actions 45841771578 success (RevS8 mesh audit only). Combined commit statuses empty, Cloudflare external check not established. Production unchanged. Manufacturing approved=false, preprint ready=false. Remaining: red-extension evidence, local C-cover samples, tolerances, structural screening, independent Fusion audit, slicer and web integration. Stage 2-0000 excluded.
