# TSD-FPV PR #2 — Cloudflare Workers Preview 실패 복구 절차 (2026-11-26)

**상태:** 재현 가능한 외부 오류 유형 및 안전한 복구 API 확인. **Cloudflare 계정 설정 자체는 아직 미변경** — 연결된 GitHub 도구에는 Cloudflare 계정 API 권한이 없음.

## 사실 확인
- GitHub PR #2 `review/tsd10-revs9-unify-preview → main`에서 자체 `validate` GitHub Actions는 성공.
- 검토 브랜치의 `Workers Builds: tsd-fpv`는 실패; 예: Cloudflare Build ID `d23808a8-331f-4ee7-ad29-01a568e736e5`.
- 생산 `main`의 같은 Worker 외부 체크는 성공; 예: Build ID `fa80c128-9485-421e-a00d-5d263869f9ca`.
- 현재 GitHub 검사 기록에는 Cloudflare 내부 build log 본문이 포함되지 않아, 정확한 원인 코드 확인 전 특정 원인을 사실로 단정할 수 없다.
- 저장소 자체는 GitHub Pages 정적 서비스이고, Worker는 별도 Cloudflare 빌드 통합. CAD 수정/메시 감사와 Worker Preview 빌드의 성공 여부는 별개이다.
- **병합 제한**: Cloudflare 실패와 TSD10 제조 승인 보류가 남아 있으므로 PR #2를 `main`에 자동 병합하거나 배포하지 않는다.

## 공식 문서에서 확인한 유력 원인 및 해결 경로
Cloudflare Workers Builds는 `main` 외 브랜치에서 별도 Preview를 빌드한다. Preview 설정이 없거나 Preview 빌드 설정이 잘못되면 `main`은 성공해도 PR 브랜치에서만 실패할 수 있다.
- Cloudflare 공식 Build branches: https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- Cloudflare 공식 Builds API: https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/
- 동일 현상의 독립 사례 및 검증된 우회: https://github.com/cloudflare/developer-platform/issues/75

**이 프로젝트의 목적:** TSD10 CAD 감사 전용 PR에는 Cloudflare Worker Preview가 필요하지 않다. Worker를 잘못 수정하거나 `wrangler.toml`을 임의로 생성해서 기존 인증·공역 API를 덮어써서는 안 된다.

### 권장 복구: 대상 Worker의 Preview 빌드만 OFF
Cloudflare API에서 정확히 `tsd-fpv`의 Worker tag를 찾고, GitHub 소스 연결이 `LWHFPV/TSD-FPV`, 생산 브랜치 `main`임을 재확인한 다음:
```http
PATCH /client/v4/accounts/{account_id}/builds/workers/{worker_tag}
Authorization: Bearer <USER_SCOPED_API_TOKEN>
Content-Type: application/json

{"previews_enabled": false}
```
수정 후 `GET`으로 `previews_enabled=false`를 확인하고 `production_settings` 변경 여부를 비교한다. 기존 `main`의 Worker 서비스/실행 코드는 변경하지 않는다.

**인증:** 공식 문서상 Workers Builds Configuration: Edit, Workers Scripts: Read 권한을 가진 **user-scoped** Cloudflare 토큰만 허용한다(빌드 토큰/공역 조회용 키와 다른 종류). 토큰·계정 ID는 저장소, PR 댓글, Actions 로그에 절대 출력하지 않는다.

### 실제 실행 스크립트 (로그인된 클라우드 환경에서만)
- 코드: `audit/cloudflare-tsd-fpv-preview-recovery.mjs`
- `CF_ACCOUNT_ID`, `CF_API_TOKEN`을 보호된 환경변수로 설정한다.
- 기본 실행은 Cloudflare 설정을 **읽기 전용**으로 진단:
  `node audit/cloudflare-tsd-fpv-preview-recovery.mjs`
- 대상 Worker/저장소/브랜치/생산 설정을 자동 대조한 뒤 실제 설정 변경:
  `node audit/cloudflare-tsd-fpv-preview-recovery.mjs --disable-previews`
- 적용 뒤 새로운 PR 커밋의 GitHub 체크 재검사. 과거 커밋의 실패 체크 기록은 소급 삭제되지 않을 수 있다.

**대안:** Worker Preview가 필수라면 OFF 대신 Preview 전용 `wrangler` 설정·바인딩·액세스 정책을 별도 구성하되, 메인 워커 코드 및 배포 설정을 변경하지 않는 검증이 선행되어야 한다. 인증이 필요한 서비스를 기본 public Preview로 노출하지 않는다.

## 배제해야 할 위험한 편법
- `[skip ci]`로 GitHub Actions까지 함께 건너뛰어 검증 없는 성공처럼 표시하지 않음.
- `main` 수정, Cloudflare Worker 생산 소스 교체, 임의 `wrangler.toml` 추가, 체크의 강제 성공 처리, 검증 전 PR 병합 금지.
- 사용자의 과거 Cloudflare 공역 API 키나 Access 인증키를 Workers Builds Configuration API용 토큰으로 오인하지 않는다.

## 해결 완료의 증빙 관문
1. Cloudflare 실제 GET/PATCH/GET `previews_enabled: false`, `production_settings` 변경 없음.
2. PR 새 커밋의 Github `validate` 성공 + Cloudflare Preview 자동 빌드 미발생 또는 실제 Preview 성공.
3. PR `mergeable_state` 재확인, 모든 타 시뮬레이터 SHA 보존.
4. TSD10 제작 승인과 별개의 상태로 유지; 원본 CAD/DB 미변경 및 사용자 붉은 후방 경계 미확정 상태에서는 PR 병합 보류.

**현회차 Cloudflare 설정 직접 변경: 미실행 (Cloudflare 계정 연결 도구 및 사용자 토큰 없음).**
