# `wiki-lint` eval 결과 (2026-06-29)

채점: 결정적 트랙(리포트 경로·형식 + F4 출처무결성 디스크 존재) + 루브릭 트랙(전용 judge sub-agent, `judge-prompt.md`). **코어 4/4 통과.**

실행은 각 시나리오의 `사전 wiki`·`raw 배치`를 스크래치패드 샌드박스 번들에 펼치고, **fresh executor sub-agent가 실제 `wiki-lint` 스킬을 블라인드로 실행**해 리포트를 생성(컨트롤러가 기대값을 흘리지 않음). 생성 리포트를 독립 judge sub-agent가 시나리오 MUST/MUST NOT와 대조.

| 시나리오 | 생성 리포트 요약 | 결정적 | 루브릭(judge) | 종합 |
|---|---|---|---|---|
| F1 모순 탐지 | 모순 1 · orphan 0 · 출처누락 0 | ✅ 형식 OK | ✅ PASS | ✅ |
| F2 false-positive 회피 | 모순 0 · orphan 0 · 출처누락 0 | ✅ 형식 OK | ✅ PASS | ✅ |
| F3 orphan | 모순 0 · orphan 1 · 출처누락 0 | ✅ 형식 OK | ✅ PASS | ✅ |
| F4 출처 무결성 | 모순 0 · orphan 2 · 출처누락 1 | ✅ dangling member 보고, order 제외 | ✅ PASS | ✅ |

## 시나리오별 근거

- **F1**: `entities/order` status enum(`pending/paid/shipped/cancelled`)에 `refunded` 부재 ↔ `policies/refund-rule`이 환불 시 `status=refunded` 전이 전제 → 모순 1건을 **근거 인용과 함께** 보고. orphan·출처 0(양방향 related, 출처 존재). FA2 정확.
- **F2**: 일관 쌍(`member`↔`login-rule`, accountStatus enum 일관)·supersession 쌍(`auth-v1`↔`auth-v2`, `superseded_by`/`supersedes` 엣지)을 **둘 다 모순으로 보고하지 않음**(`모순 0`). FA3 supersession 제외 작동, false-positive 0.
- **F3**: `queries/legacy-report`(인바운드 0, type=query)만 orphan 보고. `capabilities/payment`(type=capability 허브=정당 root)·`entities/order`(payment 본문 `[[entities/order]]` 링크로 인바운드 1) 정확히 제외. **본문 `[[ ]]` 링크 순회 작동 입증**(Task 1 리뷰 우려 해소). FA4 정확.
- **F4**: `entities/member`의 `sources[0].path=raw/data-models/member.md`(디스크 부재)를 출처누락으로 보고, `entities/order`(존재)는 제외. 결정적 트랙 통과. (orphan 2건은 격리된 최소 fixture 아티팩트 — F4 루브릭 범위 밖이라 위반 아님.)

## 발견

1. **본문 + frontmatter 양쪽 엣지 순회 작동** — F3에서 payment의 본문 `[[entities/order]]`를 인바운드로 집계해 order를 orphan에서 제외. `extractLinks` 선례와 일치(Task 1 리뷰 Important 2건 = 설계로 해소됨을 실증).
2. **false-positive 회피 견고** — F2의 일관 쌍·supersession 쌍 모두 침묵. "확신 없으면 보고 안 함" + FA3 제외 규칙이 작동.
3. **결정적/판단 분리 정확** — 출처무결성(디스크 존재)은 결정적으로 정확, 모순/orphan은 근거 기반 판단.

## Task 2 리뷰 보강 (FA4)

Task 2 리뷰에서 orphan false-positive 관련 Important 2건을 수정(커밋 `ce5a4d9`): ① commons-wiki→project wiki 인바운드도 집계, ② index.md 직접 링크 노드를 정당 root로 명시. e2e/F3에서 인바운드 제외 정확 작동 확인.

## e2e verify (plan Task3 Step2) — ✅ 완료 (2커밋 보존)

실제 repo(빈 wiki에서 시작)에 fixture 그래프(모순 1·orphan 1·출처누락 1, **okf-lint: OK 선확인**)를 두고 `wiki-lint` 라이브 1회 실행:

- fixture: payment(허브)→order·member 링크, order↔refund-rule(refunded 모순), member 출처 dangling, legacy-report 고립.
- **okf-lint 선확인**: `okf-lint: OK` (dangling source가 있어도 구조는 clean — okf-lint는 sources 디스크 존재를 안 봄 = 정확히 wiki-lint의 가치 영역).
- **라이브 리포트**: `reports/wiki-lint/2026-06-29.md` = `요약: 모순 1 · orphan 1 · 출처누락 1`.
  - 모순 1: order↔refund-rule (근거 인용). orphan 1: legacy-report만(payment 허브·member 인바운드 제외 정확). 출처누락 1: member만(나머지 출처 존재).
  - 쓰기 대상은 `reports/`뿐 — wiki/raw/index/log 불변(FA6).
- **2커밋 보존**: 스냅샷 `cf1343a`(fixture·리포트·`runs/2026-06-29.md` 박제) → 원복 `eca8431`(작업트리 clean). 원복 후 재-lint `okf-lint: OK`(찌꺼기 0). `git show cf1343a`로 산출물 영구 확인 가능.

## 후속 (비차단)

- 성장 backlog 시나리오: **F5**(클린 그래프 0·0·0)·**F6**(다중 hop 전이 모순)·**F7**(심각도 등급) — 실패 모드 만날 때 추가.
- **고도화(OQ#5 후속)**: 1-hop 링크 이웃을 넘어선 후보 선정을 QMD/임베딩 유사도로 확장 — 링크 안 된 숨은 모순 탐지.
- **cron 야간 배선**(FA1): settings.json schedule 또는 CronCreate로 야간 자동 실행.
