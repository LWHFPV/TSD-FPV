# TSD10 Cloudflare watch-path verification probe — 2026-11-26

Pre-probe PR #2 snapshot (GitHub connector):
- base: 38eae7931ba9cdb02bd521294b24f25c1e3a46c0
- head: 7dc93766ec6643cfa03166232d543c6fa49dd153
- open, unmerged, mergeable; 8 changed paths: seven under audit/ and one .github/workflows/tsd10-asset-audit.yml.
- Previous GitHub Actions run 45671982733 succeeded. Previous external Workers build failure is not a CAD validation result.

User-provided Cloudflare dashboard screenshot shows include `*` and exclusions including `audit/*` and `.github/workflows/tsd10-asset-audit.yml`. Persistence of account settings has not been independently verified.

This commit adds only this audit note. It is a non-empty one-file push under audit/ to test the configured exclusion without changing CAD, HTML, Worker, credentials, or main. Expected: Workers build skipped under the documented path matching rule; pull_request audit workflow may run. Observed outcome must be independently checked after push; absence of a visible status alone is not proof of a skip. No claim of root-cause repair or manufacturing approval.

Reference: https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/
