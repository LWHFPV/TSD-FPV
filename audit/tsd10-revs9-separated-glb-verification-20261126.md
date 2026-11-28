# RevS9 separated GLB execution — 2026-11-26

Actual library source ZIP SHA256: 19ff38787e0152b3ca2f6d8c17c37c57af713c3ac6fdac927b48bfb2c90c968a; CRC OK. Used CadQuery STEP Solids(), BRepCheck_Analyzer and tessellate(0.085,0.17), trimesh GLB export and reimport. Each solid retained its separate mesh and node, finite coordinates and triangle indices verified, per-part bounds within 0.15 mm of STEP, reimport triangle counts identical and bounds within 0.001 mm. No original STEP modified.

| Configuration | Solids/nodes | Triangles | GLB SHA256 |
|---|---:|---:|---|
| upper XT60 | 35 | 87412 | e3c2cab1e44eebc02a51787c4f5ac5605f806ec75c6a30a621b3d3112e1ccaf5 |
| upper XT90 | 34 | 84692 | dffa830dc9d31b1fa652f1b05e63a10db80075e33d31dcfd6af5eed9c6ca1c13 |
| lower XT60 | 37 | 95232 | 6ead75aed8d2a2ff6ce5c0421cbacc3b090023cb73db4a8ac697c5343bfe0ce1 |
| lower XT90 | 36 | 92496 | e5d6c2fecb126316011db9b283df3a3e484e6e83e88a3b84149f7c11ec0c44a8 |

140 solid instances / 140 separate nodes; 359832 triangles total. Maximum per-solid STEP-to-mesh bounds deviation 0.0236035331 mm. Four candidate common parts p00/p02/p03/p06 have identical rounded 0.01 mm vertex sets across all four scenes (unique vertices 14959/762/762/5386 respectively), corresponding STEP volumes 283141.324781/19667.660063/19667.660065/9082.700036 mm³, respectively. This is a mesh result, not dimensional tolerance or structural approval.

Output ZIP TSD10_RevS9_부품분리_웹검토용.zip, 2468122 bytes, CRC OK, SHA256 7a2c43d3094ddb1becd15c7d36cd01be59ad2e3178ff6a6d60b9f275cbc37277; includes four GLB, four per-solid JSON and reproduction script. Binary ZIP not uploaded to GitHub in this run. Node IDs are solid indices; full semantic category mapping and existing viewer packed format conversion remain pending. Red extension not added; manufacturing_approved=false. No main deployment or Cloudflare change. Latest pre-commit GitHub Actions 45731266855 success; combined status list empty; external Cloudflare check not available. PR connector mergeable snapshots disagree (false and true), not an established conflict.
