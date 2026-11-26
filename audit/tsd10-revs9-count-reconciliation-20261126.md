# RevS9 count reconciliation — 2026-11-26
Supersedes the aggregate count 140 in audit/tsd10-revs9-separated-glb-verification-20261126.md; original report preserved. Actual source ZIP SHA256 19ff38787e0152b3ca2f6d8c17c37c57af713c3ac6fdac927b48bfb2c90c968a and separated GLB ZIP SHA256 7a2c43d3094ddb1becd15c7d36cd01be59ad2e3178ff6a6d60b9f275cbc37277, CRC both pass. Reopened four STEP files with CadQuery/OCP, ran BRepCheck_Analyzer on every solid, compared report volumes within 0.00001 mm³, bounds against recorded mesh bounds, and verified source STEP and GLB SHA256s against each of four reports. Parsed actual GLB JSON chunks and counted mesh-bearing nodes, meshes and parts.
| Variant | STEP solids | GLB nodes | Valid and matched | Triangles |
|---|---:|---:|---:|---:|
| upper XT60 | 35 | 35 | 35 | 87412 |
| upper XT90 | 34 | 34 | 34 | 84692 |
| lower XT60 | 37 | 37 | 37 | 95232 |
| lower XT90 | 36 | 36 | 36 | 92496 |
| Total | 142 | 142 | 142 | 359832 |

Maximum independent STEP-to-recorded-mesh bounding-box difference: 0.016759228592917452 mm. Previous 0.0236035331 mm was the earlier tessellation-stage result, not superseded for its own procedure. The discrepancy 140 versus 142 was an arithmetic/reporting error; no count discrepancy in these four files. Semantic mapping not proven: only 4 common BOM rows defined in source CSV; assembly creation script identifies solid indices 0/2/3/6, but full mapping still pending. Do not treat this as physical fit, structural or manufacturing approval. No new geometry, no production changes.
PR #2 pre-commit head f8d6066d2fba7d81b25510d64b9427580e8d7aae, base 38eae7931ba9cdb02bd521294b24f25c1e3a46c0, open and unmerged; connector returned mergeable=true on this query. Prior Actions run 45762514261 success (RevS8 mesh/category audit, NOT RevS9 browser or structural validation); combined commit status empty, Cloudflare result unverified. Remaining: map semantic part names and BOM, convert existing web packed format, independently verify browser, then handle outstanding CAD design evidence. Manufacturing approval false.
