# TSD 공역정보 복구 — 23개 실행시험 및 연결구조 비교 결과

검증일: 2026-11-26 | 대상: LWHFPV/TSD-FPV

## 1. 입력·소스 고정
- 운영 Worker: `cloudflare/tsd-flight-airspace-api-v3.0.3.mjs`
- 해당 파일 blob SHA: `209de419b343de1b3f04646e960c92a2a08b4da1`
- 로컬 동일본의 Git blob SHA 계산값도 일치.
- 이전 원본: `TSD_비행안전정보센터_v2_7_좌표별공역자동표시.zip`, `TSD_v2_8_5_공역WFS_이중조회_오류진단.zip`, `TSD_v2_9_1_지도정렬_관할항공청자동선택.zip`, `tsd-fpv-airspace-Rev1-verified.zip`
- 실제 운영 사용자 조회: `/health` 정상, 익산 `/api/airspace` 5개 공역 모두 520, `checked_layers:[]`. 실제 Provider 성공을 보장하지 않음.
- 마스킹된 과거 이벤트: `api.vworld.kr /req/wfs HTTP 520 ...-LAX`.

## 2. 수행된 실제 코드 기반 모의검증 23/23
Node v22에서 Worker v3.0.3 원본을 모듈로 불러오고 `fetch`만 시험응답으로 교체하여 19개 조건을 실행. API 키는 무작위 더미 문자열이며 실제 서버 호출 없음.

| 번호 | 조건 | 기대 응답 | 결과 |
|---:|---|---|---|
| 1 | DATA+WFS 모두 HTTP 520 | unavailable, 0/5 | PASS |
| 2 | DATA 5종 정상, 중첩 없음 | ok, 5/5 | PASS |
| 3 | DATA 5종 정상, 다각형 중첩 | ok, 5/5 | PASS |
| 4 | DATA 5종 NOT_FOUND | ok, 5/5 (추가 실확인 필수) | PASS |
| 5 | DATA 520, WFS는 5종 유효 GeoJSON | ok, 5/5 | PASS |
| 6 | DATA 520, WFS 빈 결과 (축 불확실) | unavailable | PASS |
| 7 | DATA+WFS 모두 520 반복 | unavailable | PASS |
| 8 | 인증/도메인 오류 | unavailable | PASS |
| 9 | 존재하지 않는 레이어 | unavailable | PASS |
| 10 | XML 예외 반환 | unavailable | PASS |
| 11 | 기관 403 제한 | unavailable | PASS |
| 12 | 네트워크 접속 실패 | unavailable | PASS |
| 13 | API 반환 100건 절단 위험 | unavailable | PASS |
| 14 | 5종 중 하나만 520 | partial, 4/5 | PASS |
| 15 | 공급기관 429 과다요청 | unavailable | PASS |
| 16 | 깨진 JSON | unavailable | PASS |
| 17 | 인증키 누락 | unavailable | PASS |
| 18 | 대한민국 범위 밖 좌표 | BAD_COORDS | PASS |
| 19 | 허용되지 않은 브라우저 Origin | ORIGIN_NOT_ALLOWED | PASS |

Python v2.9.1 데모 원본 `AirspaceLookup`의 로컬 파일 경로에 비실제 시험용 Polygon 제공: 내부 중첩, 외부 비중첩, 경계선 중첩, 손상 JSON 거부 등 4/4 PASS. 출처 `TSD_AIRSPACE_GEOJSON`이며 결과는 `partial`, `complete:false`로 표시됨.

**주의:** 시험에 사용한 GeoJSON은 실공역이 아니며, 실제 VWorld 연결에 성공했다고 표시해서는 안 된다. `NOT_FOUND` 응답 자체가 공역 부재의 법적 충분조건인지는 제공기관의 문서·실측과 별도 교차검증해야 한다.

## 3. 연결구조 수단별 현실 판정

| 방안 | 코드 실행 및 검토 | 실제 데이터 수신 | 판정 |
|---|---|---|---|
| A. 현재 Cloudflare → VWorld DATA/WFS 직접 | 19조건 주입시험; 연결 시 520 재현 | 실운영 0/5 | **운영판 단독 사용 부적합** |
| B. WFS 우선/재시도/파라미터 수정 | DATA 520 → WFS 성공 시 복구됨을 모의검증 | 현재 2경로 모두 520 | **네트워크 차단이면 미해결** |
| C. 공공데이터포털 다른 공역 항목 | 15057007, 15101073, 15101074 제공형태 모두 LINK 확인 | 독립 API 원본 미확인 | **즉시 우회책 아님** |
| D. 사용자 브라우저 → VWorld 직접 | 네트워크 국외 문제를 피할 가능성은 있으나 키 노출·허용 도메인 문제 | 실호출 미검증 | **공개 운영 비권장** |
| E. 승인된 국내 실행환경 → VWorld 직접 | Python 데모 소스 확보, 모의검증 완료 | 해당 환경의 실제 인증키 조회는 아직 불가 | **최우선 실연결 확인 경로** |
| F. 승인된 국내 백엔드 + TSD 홈페이지 | 백엔드 API 계약과 Worker 응답 처리 확인 | 국내 호스트·제공기관 이용허락 필요 | **자동 운영 최적 후보** |
| G. 관리자가 출처 확인한 GeoJSON 보조 표시 | Python 4/4 및 브라우저 지도 시연 확인 | 이 파일 자체는 신규 실시간 공역정보가 아님 | **참고 시각화에만 사용** |
| H. 공식 eAIP/드론원스톱 링크 | 외부 공식 참조 페이지 존재 확인 | TSD 내 실시간 구조화 조회 아님 | **실시간 조회 장애 시 병행 안내** |

## 4. 결론 및 최적 조건
1. 가장 먼저 **이용이 허용된 국내 서버/PC에서** `TSD_VWORLD_DOMAIN`을 실제 인증키의 등록 URL과 정확히 일치시키고 VWorld DATA 및 WFS 5종의 HTTP 상태/공간정보 JSON을 검증한다. 현재 로그인/Secret 접근 없이 제3자 환경의 국내 네트워크 실통신을 실행했다고 보고할 수 없다.
2. 국내에서도 520이면 제공기관의 오류 응답/정책 및 키·서비스 URL·레이어 사용권한 확인이 우선.
3. 국내에서만 정상이라면, 기관 허가를 확인한 **국내 공역 조회 백엔드**를 1차 제공처로 하고, 기존 GitHub Pages 화면은 유지한다. Cloudflare Worker는 기상 등 별도 기능을 유지할 수 있다. 임의 해외 프록시 우회 구현은 금지.
4. 공역 API가 실패하면 공역 결과는 `unavailable` 및 `checked_layers:[]` 유지. 출처·기준시점·라이선스를 확인한 기존 공역 파일은 **참고용**으로만 병행 표시.
5. 실제 폴리곤 중첩, 공역 5종, 고도/시간/NOTAM, 현지 규정 검증 없이 `비행 가능` 출력 금지.

현재 결론: **Worker의 장애 처리 로직 정상(모의 19/19); Python 원본 파일 경로 정상(모의 4/4); 실제 Cloudflare→VWorld 연결 장애 미복구**. 외부 기관 네트워크 접속을 재현하지 못해 원인(국외 클라우드 차단 vs 기관 서비스 장애)을 확정하지 않음.

## 근거 URL
- VWorld 국외 클라우드 제한 공지 인용: https://repost.aws/zh-Hant/questions/QURF8FyYBjQkG0PzncVrwGpA/
- 공공데이터포털 항공정보도: https://www.data.go.kr/data/15057007/openapi.do
- 비행금지구역: https://www.data.go.kr/data/15101073/openapi.do
- 비행제한구역: https://www.data.go.kr/data/15101074/openapi.do
- 공식 eAIP: https://aim.koca.go.kr/eaipPub/
- 드론원스톱: https://drone.onestop.go.kr/common/flightArea_chk

기존 `flight-safety.html`, Cloudflare 공역 Worker 및 인증 Worker는 이 검증에서 변경하지 않았다.
