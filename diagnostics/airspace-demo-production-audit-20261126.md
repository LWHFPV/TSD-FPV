# TSD 비행안전정보센터 — 배포 전 데모/운영 공역조회 원인 조사 (2026-11-26)

## 범위와 판정
- 대상: LWHFPV/TSD-FPV flight-safety.html, Cloudflare Worker v3.0.3-cloudflare-recovery
- 기존 인증·로그인 Worker, 지도 및 지방항공청 동작을 변경하지 않음
- 결론: 원인 후보 1순위는 브이월드의 국외 클라우드/IP 접속 제한과 Cloudflare 외부 요청 경로 차이. 실제 원인 확정은 허가받은 국내 네트워크에서 동일 API/key/domain으로 대조 조회 필요.

## 1. 과거 원본 검증
- 2026-11-23 v2.8.5 ZIP: `TSD_v2_8_5_공역WFS_이중조회_오류진단.zip`.
  `사용방법_공역_API_보완.txt`는 5종 공역 WFS 모두 `WFS_EXCEPTION_XML`이 발생했음을 기록. 이중 호출(DATA 우선, WFS 재시도) 추가.
- v2.9.1 ZIP: `TSD_v2_9_1_지도정렬_관할항공청자동선택.zip`.
  Python `TSD_검색서버_v2_8.py` 627~639행: `/req/data`, `/req/wfs`, 환경변수 `TSD_AIRSPACE_GEOJSON`, 로컬 `airspace.geojson` 자동발견.
  862~872행: 로컬 GeoJSON 파일이 설정돼 있으면 실 API 대신 이 파일로 조회하고 결과는 `partial`/최신성 미보증 표시.
  보관한 데모 ZIP 내부에는 `airspace.geojson` 자체가 없음. 당시 사용자 PC에 별도 파일이 있었는지는 미확인.
- v3.0 검증보고: 실제 국토교통부/VWorld API 실조회 미검증, 15/15는 모의 응답 검증.
- 2026-11-23 `tsd-fpv-airspace-Rev1-verified.zip`:
  `worker/README.md`에 VWorld 해외 IP 제한 대응을 명시. `worker/src/index.js`의 `vworldBase(env)`가 `VWORLD_PROXY_URL || https://api.vworld.kr` 사용.
  이 Rev1도 배포 및 국내 중계 서버 수신은 미검증.
- Rev1 공역 다섯 번째 레이어는 `LT_C_AISUAC`(초경량비행장치공역), 현재 v3.0.3은 `LT_C_AISMOAC`(군작전구역)으로 다름. 다른 코드로 무검증 교체하면 안 됨.

## 2. 운영 장애 증거
- /health 응답 `status:ok`, `tsd_version:3.0.3-cloudflare-recovery`, `airspace_provider_configured:true`는 실행/설정 인식만 확인.
- 익산 좌표 `35.9483,126.9576` 실조회: `status:unavailable`, `checked_layers:[]`, 공역 5종 모두 `PROVIDER_UPSTREAM_520`.
- Cloudflare 경고 로그: `host:api.vworld.kr`, `path:/req/wfs`, `status:520`, `server:cloudflare`, `cfRay:...-LAX`. 로그는 사용자가 제공했고 민감정보 키는 기록하지 않음.
- VWorld 공식 공지(국외 클라우드 서비스 접속 제한 안내, 공지번호 23353)의 인용이 다른 공개 자료에 확인됨. 브이월드 사이트 직접 열람은 현재 환경에서 제한됨.
- 따라서 클라우드 해외 출구 IP가 원인이라는 가설의 근거는 강하나 VWorld가 해당 요청을 IP 때문에 차단했다는 원인 확정은 아직 불가.

## 3. 코드 비교와 복구 기준
1. Python 데모 로컬 파일 경로와 VWorld API 실조회는 서로 다른 데이터 출처. 데모에서 화면 표시가 됐어도 실제 WFS 통신 성공으로 단정하지 말 것.
2. Python 서버는 사용자 국내 PC에서 실행할 수 있었고, Cloudflare 요청 로그는 LAX를 보여줌. 동일 등록서비스URL/키를 사용하는 승인된 국내 실행환경에서 `/req/data`와 `/req/wfs`를 각각 테스트해 HTTP 상태 및 비밀을 제외한 서비스 오류 코드 비교.
3. VWorld 제공기관의 접속 정책과 이용허락 범위 확인 후 국내 서버에서 공역 API를 직접 실행하거나 허가된 연결방식으로 운영. 해외 중계/캐싱/재배포를 임의로 구현하지 않을 것.
4. 기존 Worker v3.0.3의 공역 5종, 공역 경계 포함 여부, 고도/NOTAM 별도 판정 유지. Rev1 전체 덮어쓰기 금지.
5. 공식 공역 수신 확인 전까지 `공역 미확인` 및 `checked_layers:[]` 유지. 비행 가능 표시 금지.

## 4. 검증 미완료
- 당시 데모 화면의 실제 API JSON 응답/클라이언트 캐시/사용자 PC의 로컬 `airspace.geojson` 유무 미확인
- VWorld 측 520 원인 확인 및 국내 허가 경로 실통신 미완료
- 이번 조사는 자료·소스 정밀대조이며 운영 Worker 배포/변경을 수반하지 않음

## 참고
- VWorld 해외 클라우드 접속 제한 공지 인용 출처: https://repost.aws/ko/questions/QURF8FyYBjQkG0PzncVrwGpA/aws-lightsail-%EC%9D%B8%EC%8A%A4%ED%84%B4%EC%8A%A4%EC%97%90%EC%84%9C-%EC%99%B8%EB%B6%80-%EC%9D%B8%ED%84%B0%EB%84%B7-%EB%A7%9D%EC%9C%BC%EB%A1%9C-%EB%84%A4%ED%8A%B8%EC%9B%8C%ED%81%AC-%EC%A0%91%EA%B7%BC%EC%9D%B4-%EC%95%88%EB%90%98%EB%8A%94-%EB%AC%B8%EC%A0%9C%EA%B0%80-%EB%B0%9C%EC%83%9D%ED%95%98%EB%8B%88%EB%8B%A4
- 공공데이터포털 항공정보도: https://www.data.go.kr/data/15057007/openapi.do
