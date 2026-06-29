# F — `wiki-lint` 야간 진단 스킬 (의미적 모순·orphan·출처무결성) 설계

- **작성일**: 2026-06-29
- **상태**: 설계 (이 대화에서 합의된 결정 박제)
- **상위 문서**: [`2026-06-25-llm-wiki-okf-si-harness-design.md`](2026-06-25-llm-wiki-okf-si-harness-design.md) §6 검증(하이브리드) / 야간 배치 블록 §284-288 / 열린 질문 OQ#5 §317
- **선행 완료**: okf-lint(결정적 구조 게이트) — PR #1·#5. spec-author(D') — PR #6. `/ingest`(H) — PR #7.
- **해소하는 열린 질문**: **OQ#5**(야간 wiki-lint 모순 탐지 알고리즘) — 방향을 "링크 그래프 순회 LLM 크롤러"로 확정.

---

## 1. 목적

okf-lint가 **구조**(필수 frontmatter·enum·폴더↔타입·깨진 링크)를 PR에서 결정적으로 차단한다. 그러나 기계가 못 잡는 것이 남는다 — **링크된 문서끼리 의미가 상충**하거나, **아무도 안 가리키는 고립 concept**이 생기거나, **sources가 가리키는 raw가 사라진** 경우. `wiki-lint`는 이 **의미·판단 계층**을 보는 **비동기·비차단(advisory) LLM 진단 스킬**이다.

설계 spec §6의 하이브리드 검증을 완성한다: 기계적 판정 = okf-lint(머지 차단), 판단·해석 = wiki-lint(야간 리포트, 비차단). wiki-lint는 wiki/raw/index/log를 **쓰지 않고 리포트만** 낸다. 발견된 문제는 다음날 사람/AI가 `/ingest`(H)나 operate(G) 루프로 처리한다.

핵심 트리거 UX(야간 배치 또는 수동 호출):

> `wiki-lint` — wiki 그래프를 돌며 의미적 모순·고립·출처누락을 진단해 리포트로 남겨줘.

## 2. 역할 / okf-lint와의 경계

| | okf-lint | wiki-lint |
|---|---|---|
| 성격 | 결정적 스크립트 | LLM 스킬 |
| 시점 | PR 동기 게이트 | 야간 배치(비동기) |
| 차단 | 머지 차단 | **비차단**(advisory 리포트) |
| 검사 | 구조: 필수필드·enum·폴더매핑·**깨진 링크**(대상 존재) | **의미**: 모순·orphan·출처무결성 |
| 출력 | exit code + findings | `reports/wiki-lint/<날짜>.md` |
| 전제 | — | **okf-lint 통과(구조 clean) 가정** |

wiki-lint는 okf-lint가 잡는 것을 **중복하지 않는다**. 깨진 링크·필수필드 누락은 이미 머지 단계에서 걸러졌다고 보고, 그 위의 의미 계층만 본다.

## 3. 핵심 설계 결정 (이 대화에서 확정)

| # | 결정 | 근거 |
|---|---|---|
| FA1 | **산출물 = 스킬 + eval만.** cron 야간 배선(settings.json/schedule/CronCreate)은 후속 얇은 단계로 분리 | D·H 패턴 정합(두뇌+eval 산출, 배선은 별도). 스킬 자체를 먼저 견고화 |
| FA2 | **모순 탐지 = 링크 그래프 순회 LLM 크롤러.** 각 노드 + 1-hop 이웃만 LLM 컨텍스트에 올려 "이웃 간 상충?" 판정 | 국소 컨텍스트라 LLM 창에 맞고, 엣지 단위로 스케일. 새 외부 의존 0. "링크=등뼈" 원칙과 정합 (OQ#5 해소) |
| FA3 | **supersession 체인은 모순에서 제외.** `superseded_by`/`supersedes`로 연결된 쌍은 의도된 old↔new 대체 | 대체는 설계상 "상충이 정상" — 모순으로 오보하면 안 됨 |
| FA4 | **orphan은 LLM 판단.** 인바운드 `[[ ]]` 0인 candidate를 결정적으로 추린 뒤, capability 허브·index 진입점 같은 **정당한 root는 LLM이 제외** | 모든 무인바운드가 문제는 아님. 허브는 SPINE 설계상 root |
| FA5 | **출처 무결성 = sources[].path 디스크 존재 점검(결정적).** 없으면 dangling 보고 | okf-lint는 sources 비었는지만 봄. raw 이동·삭제로 끊긴 출처는 미검출 → wiki-lint가 메움 |
| FA6 | **리포트만, 자동 수정 ❌.** wiki/raw/index/log 안 씀. `reports/wiki-lint/<날짜>.md`에만 기록 | 비차단 advisory. raw 불변·사람 승인 원칙. 수정은 /ingest·operate 소관 |
| FA7 | **리포트 위치 = `reports/wiki-lint/<YYYY-MM-DD>.md` (log/와 형제, 별도 최상위)** | log/는 append-only "변경 이력"(날짜 정렬=인덱스). 리포트는 매 실행 진단 스냅샷 — 생명주기가 달라 log/ 의미를 흐리면 안 됨. 형제로 두면 트리상 인접해 공존도 쉬움 |
| FA8 | **eval/verify 중간 산출물 = 2커밋 보존.** 스냅샷 커밋(박제)→원복 커밋(작업트리 clean) | H에서 검증된 패턴(RESULTS.md). "뭐가 나왔나"는 히스토리에, 작업트리엔 찌꺼기 0 |

## 4. 세 가지 탐지기

### 4.1 의미적 모순 (contradiction) — 순수 LLM
링크로 이어진 문서들이 **상충하는 사실/규칙**을 주장하는가. 예:
- `entities/order`의 `status` enum = `{pending, paid, shipped, cancelled}` 인데, 링크된 `policies/refund-rule`이 `refunded` 상태를 전제 → 모순.
- 두 policy가 같은 규칙에 다른 수치(예: 환불 기한 7일 vs 14일)를 명시 → 모순.

보고 단위 = **상충 쌍 + 근거 인용**. supersession 체인(FA3)은 제외.

### 4.2 orphan — LLM 판단
인바운드 `[[ ]]` 링크가 **0**인 concept을 결정적으로 추린다(candidate). 그중:
- **정당한 root**(capability 허브, index.md에서만 닿는 최상위 진입점) → 제외.
- 그 외 진짜 고립 → 보고.

### 4.3 출처 무결성 (source integrity) — 결정적
각 concept의 `sources[].path`가 가리키는 raw 파일이 **디스크에 실제 존재**하는가. 없으면(raw 이동·삭제로 dangling) 보고. (sources 비어있음은 okf-lint가 이미 차단.)

## 5. 알고리즘 — 링크 그래프 순회 (FA2)

```
[1] 그래프 구성
    wiki/** 의 각 .md = 노드
    frontmatter(related/supersedes/superseded_by) + 본문의 [[폴더/id]] = 엣지
    (commons-wiki/** 는 링크 해소 컨텍스트로만, 1차 스캔 대상은 프로젝트 wiki/)

[2] 탐지기 순회
    · 모순: 각 노드 N에 대해 N + 1-hop 이웃을 컨텍스트에 올려 상충 판정
            (supersession 엣지로 이어진 쌍은 건너뜀 — FA3)
    · orphan: 인바운드 0 노드를 모아 LLM이 "정당 root인가?" 판정 (FA4)
    · 출처: 각 노드의 sources[].path 디스크 존재 확인 (FA5, 결정적)

[3] 리포트 작성
    reports/wiki-lint/<YYYY-MM-DD>.md 에 요약 + 카테고리별 findings(근거 인용)
    클린이면 "요약: 0·0·0" 리포트 (통과 확인용)

[4] 비차단 종료
    리포트만 남기고 끝. wiki/raw/index/log 안 씀 (FA6). 머지 차단 없음.
```

**후속(고도화, 이번 비목표):** 1-hop 링크 이웃을 넘어선 후보 선정은 **QMD(Quick Markdown Search)/임베딩 유사도**로 확장 — 링크 안 된 숨은 모순까지 탐지. backlog(§9).

## 6. 리포트 형식 — `reports/wiki-lint/<YYYY-MM-DD>.md`

```
# wiki-lint 리포트 — 2026-06-29
## 요약: 모순 1 · orphan 1 · 출처누락 1

## 모순 (contradiction)
- [[entities/order]] ↔ [[policies/refund-rule]]
  order.status enum에 'refunded' 부재, 그런데 refund-rule은 환불 상태를 전제.
  근거: order "status: pending/paid/shipped/cancelled" ↔ refund-rule "환불 시 status=refunded"

## orphan
- [[queries/legacy-batch]] — 인바운드 0, capability 허브 아님 → 고립

## 출처 누락 (source integrity)
- [[entities/member]] — sources[0].path=raw/data-models/member.md 디스크에 없음

## 처리 안내
다음날 사람/AI가 /ingest(반영) 또는 operate 루프로 처리. wiki-lint는 비차단 진단만.
```

## 7. 인터페이스

**입력**
- 호출 의도(인자 없음 — wiki/ 전체를 스캔 대상으로). 야간 cron 또는 수동 호출.
- 읽기: `wiki/**`, `commons-wiki/**`(링크 해소 컨텍스트), `raw/**`(sources 존재 확인용), `index.md`.

**쓰는 것**
- `reports/wiki-lint/<YYYY-MM-DD>.md` — **유일한 쓰기 대상**.
- `wiki/`·`raw/`·`index.md`·`log/` 안 씀(FA6, 불변규칙).

**호출하지 않는 것**
- spec-author·okf-lint를 강제 호출하지 않음(독립 진단). 단 "okf-lint 통과" 전제는 운영상 가정.

## 8. 검증 — eval + verify (TDD 아님, 새 production 코드 0)

spec-author·ingest와 동형. 시나리오 = 자기완결 마크다운 1파일(사전 wiki 그래프 + 기대 findings).

**(A) eval — 코어 시나리오** (`evals/wiki-lint/scenarios/`):

| # | 시나리오 | MUST | MUST NOT |
|---|---|---|---|
| F1 | 모순 탐지 | 상충 쌍을 근거 인용과 함께 보고 | 근거 없는 모호 보고 |
| F2 | 모순 false-positive 회피 | 링크됐지만 일관된 쌍·supersession 체인은 조용히 통과 | 정상 쌍을 모순으로 오보 |
| F3 | orphan | 인바운드 0 고립을 보고 | capability 허브(정당 root)를 orphan으로 오보 |
| F4 | 출처 누락 | dangling sources path를 보고 | 존재하는 raw를 누락으로 오보 |

채점 = (a) 루브릭 MUST/MUST NOT(judge sub-agent 또는 사람) + (b) 리포트가 `reports/wiki-lint/<날짜>.md`에 올바른 형식으로 생성됐는지 결정적 확인. 실패 모드 만날 때마다 추가하는 성장형. 성장 backlog: F5 클린 그래프(0·0·0 리포트)·F6 다중 hop 모순·F7 심각도 등급.

**(B) verify — end-to-end, 2커밋 보존(FA8):** fixture wiki 그래프(모순 1·orphan 1·출처누락 1 포함)를 실제 `wiki/`에 두고 `wiki-lint` 실제 호출 → 리포트 생성 관찰. 중간 산출물(생성 리포트 + `evals/wiki-lint/runs/*`)을 **스냅샷 커밋**으로 히스토리에 박제 → **원복 커밋**으로 작업트리 clean → 원복 후 `okf-lint: OK` 회귀 확인. RESULTS.md에 스냅샷 커밋 해시 기록.

**남는 것/버리는 것:** `scenarios/`·`README.md`·`RESULTS.md`는 영구(커밋). verify 실행 산출물(fixture wiki·생성 리포트·`runs/*`)은 스냅샷 커밋으로 히스토리에만 보존하고 원복.

## 9. 경계 / 비목표

- 구조 검사(깨진 링크·필수필드·enum·폴더매핑) ❌ — okf-lint 소관(통과 전제).
- wiki/raw/index/log 쓰기·자동 수정 ❌ — 리포트만(FA6).
- cron 야간 배선 ❌ — 후속 얇은 단계(FA1).
- 코드 drift-check ❌ — 코드 동반 변경 별도(B).
- **새 production 코드 없음** — 검증은 eval(루브릭+리포트 형식) + 수동 verify. TDD task 0개.

## 10. 후속 / 백로그

- **QMD/임베딩 후보 선정**(FA2 고도화): 1-hop 링크 이웃을 넘어 링크 안 된 숨은 모순까지. QMD 도구 도입 시 임베딩 유사도로 후보군 확장.
- **다중 hop·전이 모순**: A→B→C 전이적 상충.
- **심각도 등급**: 모순/orphan/출처누락에 우선순위.
- **commons-wiki 교차 모순**: 프로젝트 wiki ↔ 사내 공통 번들 간 상충.
- **cron 야간 배선**(FA1): settings.json schedule 또는 CronCreate로 야간 자동 실행.

## 11. spec-author·okf-lint 정렬 — 변경 필요한가?

없음. wiki-lint는 둘을 강제 호출하지 않는 독립 진단이다. okf-lint 코드·spec-author 프롬프트를 건드리지 않는다. 리포트 발견이 후속 처리(/ingest·operate)의 입력이 될 뿐이다.

## 12. 후속

- plan: 본 spec 확정 후 `docs/superpowers/plans/2026-06-29-wiki-lint-plan.md` (스킬 프롬프트 + eval 시나리오 + 2커밋 verify task).
- operate(G)·cron 배선이 이 리포트를 소비/자동화하는 지점.
