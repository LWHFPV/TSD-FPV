# Forest V10 integration audit — 2026-11-26

Scope: forest only. Preserve the existing Uijeongbu V10, EO/IR location DB, camera/terrain/weather functions, and production authentication. No agricultural feature or production deployment.

## Verified evidence
- Local V10 original: 2,720,039 bytes; SHA256 74be72fce9d5a23c6b8fe54152e9f5506cd2d20cac70a23dd4cb439693f0fb81. Two executable JS script blocks passed node --check.
- Main tree contains cloudflare/tsd-flight-airspace-api-v3.0.3.mjs and airspace diagnostic documents. No .github workflow or forest ingestion service found in inspected main tree.
- System Chromium launches with Playwright using /usr/bin/chromium; file URL and HTTP localhost navigation both failed ERR_BLOCKED_BY_ADMINISTRATOR. Bundled Playwright browsers unavailable. Browser E2E NOT passed.
- V10 is not yet registered as a file in this review branch. Do not deploy the earlier standalone forest-patrol-planning.html in its place.

## Official data
- https://www.data.go.kr/data/15120580/fileData.do — annual CSV, catalog modified 2026-09-04; alternate dataset title includes 20250902. These dates must not be conflated with observation dates.
- https://www.data.go.kr/catalog/15120580/fileData.json — machine-readable dataset ID, modified date, format, license. Verified public response in research, metadata only; no occurrence records or CSV download URL verified.
- https://bigdata-forest.kr/product/FRT003901 — separate 2021 shapefile product documents EPSG:5179. NOT proof of CRS for dataset 15120580.
- https://www.korea.kr/news/policyNewsView.do?newsId=148926133 — monthly risk forecast program. Distinguish risk, report, confirmed infection and historical observation.
- Actual CSV, its CRS/axis order, category codes, and observation date semantics remain unverified. No fake coordinates, no false empty success, no access-control circumvention.

## V10 API contract from original script
GET /api/forest/occurrences?lat=...&lon=...&radiusKm=15
FeatureCollection; datasetId string 15120580; source exact official detail URL; coordinateSystem EPSG:4326; sourceCrsVerified true; status verified; asOf YYYY-MM-DD; fetchedAt parseable timestamp; coverageComplete true; Point features <=5000; coordinates within requested radius plus 100 m. For over-limit or incomplete coverage return explicit non-success; preserve last valid snapshot for same region only. Never label publication date as observation date.

## Implementation decision
1. Probe official catalog and authorized downloadable data; record ETag/hash, actual raw source and verified CRS. Use Python csv + pyproj (https://github.com/pyproj4/pyproj), GDAL as independent check. For large datasets use spatial partitioning and immutable snapshot IDs; do not copy large raw datasets to main.
2. Use a separate review service or static snapshot approach for first verification; compare D1/R2 after record count and quota analysis. Do not modify existing Access or airspace worker.
3. Transfer V10 via verified small chunks or separate assets and reassemble byte-identical original before changing. Record hashes. No placeholder substitution.
4. Use https://github.com/microsoft/playwright and documented GitHub CI browser installation. Run push on review branch; GitHub scheduled workflows require default branch (https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax). No schedule until authorized production integration. Store screenshots, trace, failed network response and test results. Distinguish fixtures from live checks.
5. Preview only after CI checks. Official docs https://developers.cloudflare.com/workers/previews/get-started/ and https://github.com/cloudflare/wrangler-action. Verify actual Cloudflare permission and protected preview URL before claiming deployment.

Status: research and static validation only; production unchanged; real occurrence ingestion, browser E2E, and deployment not completed.
