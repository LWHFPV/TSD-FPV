# RevS9 phase 1 — fastener axis and GPS follow-up (2026-11-28)
Actual CadQuery/OCP execution: independently imported four assembly STEP files, checked all 142 mapped solid bounding boxes within 0.0001 mm. Extracted reversed vertical cylindrical BRep faces and tested centerline material intervals by exact line/face intersections plus inside classification. Four assemblies, 72 joint positions, 168 cylindrical-face checks.
| joint | positions | faces checked | bore diameter mm | max axis offset mm | minimum ideal radial clearance mm | blocked centerlines |
|---|---:|---:|---|---:|---:|---:|
| central bushing |24|72|3.30,3.34,3.40|0|0.15|0|
| RX tray |16|32|3.00|0|0|0|
| FC adapter |16|32|3.30,3.40|0|0.15|0|
| RF/top plate |8|16|3.30|0|0.15|8|
| GPS/RF |8|16|2.50,2.80|0|0|0|
Hypothetical smooth shaft diameters 3.0 mm except GPS 2.5 mm; clearances are ideal nominal radius differences, not recommended fastener sizes or tolerance qualification. RF bracket centerline has material z=61.5–66.15 mm; lower bore z=46–49.6 mm, aligned top plate z=42–46 mm. Do not drill through automatically: mounting direction and access need investigation. RX nominal 3 mm bore with 1.5 mm gap under tray needs retention/support and dimensional tolerance review; do not assume positive clearance or automatically add material. FC adapter centerline clear, 3.4 mm cylindrical face z=7–7.9, not proof full shaft/head fits. GPS 2.5 mm nominal bore is not proof of tap/thread or real hardware size.
Completed two outstanding lower GPS tray–RF minimum-distance checks using OCP BRepExtrema_DistShapeShape multithreaded: lower XT60 0 mm (16 solutions), lower XT90 0 mm (16 solutions). Combined previous 50 and new 2 =52/52 nominal minimum distances measured, not all interfaces approved. Zero distance is not proof of full mating area.
Reproduction archive TSD10_RevS9_1단계_체결축_검증.zip (8434 bytes, SHA256 3b617e5717387611cde08d817c0ffbec02737e767c62d5977dbceeddb7a954a1, 9 payload hashes verified, CRC pass). Separate archive, original CAD unchanged.
Prewrite PR #2 head 0c474b95eb8c798c1d6f4170a19c0491c27375e4, base 38eae7931ba9cdb02bd521294b24f25c1e3a46c0, open, mergeable=true, unmerged. Actions 46086337331 success (existing RevS8 audit only). Combined status empty, Cloudflare not established. No production change. Remaining: actual tolerance/head/access analysis, red extension evidence, material/structural/print slicer and web tests. Stage 2 excluded; preprint ready=false, manufacturing approved=false.
