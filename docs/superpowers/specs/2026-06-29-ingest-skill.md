# H — `/ingest` 스킬 (raw 배치 동기화 + 승인 + 기록) 설계

- **작성일**: 2026-06-29
- **상태**: 설계 (이 대화에서 합의된 결정 박제)
- **상위 문서**: [`2026-06-25-llm-wiki-okf-si-harness-design.md`](2026-06-25-llm-wiki-okf-si-harness-design.md) §7 빌드 루프 / §9 운영 루프 (트리거 ②)
- **선행 완료**: spec-author(D') 정합 엔진 — eval 코어 8/8, PR #6. okf-lint supersession 토대 — PR #5.
- **공유 두뇌**: [`2026-06-27-spec-author-reconcile.md`](2026-06-27-spec-author-reconcile.md) (D' — 제안 JSON 생성)

---

## 1. 목적

사람이 `raw/<category>/` 아래에 떨궈둔 산출물들 중 **아직 wiki에 반영되지 않은 것**을 찾아, spec-author(D')로 증류 → **사람 승인** → wiki/index/log에 **원자적 기록**하는 얇은 오케스트레이터 스킬.

D'가 "원고를 쓰는 기자"라면, `/ingest`는 **"승인받아 인쇄하는 윤전기"** 다. 트리거 ②(불규칙 raw 산출물 ingest)의 실체이며, 트리거 ①(define-screen/on-confirm)은 이 일반 트리거의 화면 전용 특수화다.

핵심 트리거 UX (사람이 폴더에 넣고 호출):

> `/ingest` — raw/ 아래 파일들 넣어놨어. 아직 위키에 반영 안 된 거 판단해서 반영해줘.

## 2. 핵심 설계 결정 (이 대화에서 확정)

| # | 결정 | 근거 |
|---|---|---|
| HA1 | **/ingest는 배치 동기화 트리거.** 사람이 파일을 `raw/<폴더>/`에 직접 배치 → /ingest가 미반영분 전체를 훑어 처리. "넣어줘" 식 단건 요청이 아님 | 분류는 사람의 배치 행위로 이미 끝남 — /ingest가 1·2차 분류 안 함 |
| HA2 | **미반영 판정 = wiki `sources[].path` 스캔** (결정 1, 초기 단순화) | 진실의 원천(실제 wiki)에 근거 — index 테이블 드리프트에 안 휘둘림. 고도화는 백로그(§8) |
| HA3 | **pre-pass 분류 가드** — 배치 시작 시 1회, 파일 폴더 vs 내용 일치 점검. **불일치만** 한 번에 모아 보고, 사람이 결정. 강제 이동 ❌ (raw 불변) | spec-author 타입 매핑이 폴더 종속 → 오배치는 *증류 결과를 오염*. 증류 *전에* 잡아 낭비·오제안 방지 |
| HA4 | **승인은 파일 1건씩 순차** (결정 2): 제안 → 승인 → 기록 → 다음 | 사람이 하나씩 검토, 컨텍스트 명확. 일괄승인은 검토 부실 |
| HA5 | **기록은 D' 출력 재사용** — `operations`(content), `index_rows`, `log_entries`를 /ingest가 그대로 write. 발명하지 않음 | D'가 이미 산출 — 일관·중복로직 제거 (DA2 정신) |
| HA6 | **승인 단위 = 파일의 제안 전체** (그 파일에 딸린 operations 묶음 통째). operation별 부분 승인은 초기 비목표 | 단순화. 부분 승인은 백로그 |
| HA7 | **기록 후 okf-lint 게이트는 자기보고로 갈음 금지** — 실제 CLI 실행 결과가 진실 | RESULTS.md 발견 #1 (DA5 백스톱) |

## 3. 흐름

```
/ingest 호출 ("raw/에 새 파일 넣어놨어, 반영해줘")
   │
   ▼
[1] 스캔 (HA2)
    wiki/** 의 모든 sources[].path 수집 → 이미 반영된 raw 집합
    raw/** 파일 중 그 집합에 없는 것 = "미반영 raw" 목록
    (미반영 0건이면 "반영할 새 raw 없음" 보고하고 종료)
   │
   ▼
[2] pre-pass 분류 가드 (HA3)
    미반영 각 파일: 폴더(카테고리) vs 내용 일치?
    불일치 있으면 ── 한 번에 모아 보고:
       "raw/meetings-contracts/x.md → data-model로 보임"
       → 사람: 그대로 진행 / 중단하고 raw 정리 후 재호출
    (일치하면 조용히 통과 — 매번 OK 출력 안 함)
   │
   ▼
[3] 배치 루프 (HA4) — 미반영 raw 각각에 대해 순차:
       ├─ spec-author 호출 (raw 경로+카테고리 + 현 wiki 그래프) → 제안 JSON
       ├─ worthy:false → "concept 대상 아님(사유)" 보고, raw는 그대로 두고 다음 파일
       ├─ worthy:true → 제안 diff(생성/갱신/대체) 제시 (DA-Q1: 전체 content 아닌 변경내역)
       ├─ ★사람 승인★ ── 거절/수정 ──▶ 안 씀, 다음 파일
       └─ 승인 → 기록 (HA5):
              wiki/<type>/<id>.md  (operations[].content)
            + index.md 갱신       (index_rows: ingest 테이블 + 카탈로그 행)
            + log/<날짜>.md 추가   (log_entries)
   │
   ▼
[4] 게이트 (HA7)
    node tools/okf-lint/src/cli.js wiki → okf-lint: OK (exit 0) 확인
    실패 시 보고 — 머지 차단 (PR 동기 게이트와 동일)
```

## 4. 인터페이스

**입력**
- 사람의 호출 의도("미반영 raw 반영"). 인자 없음 — raw/ 전체를 스캔 대상으로.
- 읽기: `raw/**`(불변), `wiki/**`·`commons-wiki/**`·`index.md`

**호출하는 것**
- `spec-author` 에이전트 — raw 경로 + 확정 카테고리 + wiki 그래프를 넘기고 제안 JSON 수신 (계약은 spec-author spec §3 그대로).

**쓰는 것 (승인 후에만)**
- `wiki/<type>/<id>.md` — `operations[].op`(create/update)에 따라 신규 작성 또는 덮어쓰기
- `index.md` — ingest 기록 테이블 행 + 타입별 카탈로그 행 (`index_rows`)
- `log/<YYYY-MM-DD>.md` — append (`log_entries`)
- **`raw/`는 절대 안 씀** (불변규칙 1)

## 5. 경계 / 비목표

- raw 분류·배치·이동 ❌ — 사람이 함 (HA1). pre-pass는 *의심 보고*만, 이동 안 함 (HA3).
- concept 증류·worthy 판단 ❌ — spec-author 담당.
- 의미적 모순 탐지 ❌ — 야간 wiki-lint(F). /ingest는 구조 게이트(okf-lint)만.
- drift-check ❌ — 코드 동반 변경 시 별도(B). 순수 wiki ingest엔 트리거 안 됨.
- operation별 부분 승인 ❌ (HA6) — 백로그.
- **새 production 코드 없음** — 검증은 기존 okf-lint CLI 재사용. **TDD task 0개**, 프롬프트(스킬) 작업.

## 6. 검증 — eval + verify (TDD 아님)

`/ingest`는 디스크 쓰기·사람 승인이 끼어 완전 자동 eval이 어렵다. **결정적으로 검증 가능한 부분은 eval, 승인 UX는 수동 verify**로 나눈다.

**(A) eval — 결정적 부분** (`evals/ingest/`, spec-author eval과 동형: 시나리오 = 마크다운 1파일):

| # | 시나리오 | MUST | MUST NOT |
|---|---|---|---|
| H1 | 미반영 판정 | sources에 없는 raw만 목록에 | 이미 반영된 raw 재처리 |
| H2 | 미반영 0건 | "새 raw 없음" 보고 후 종료 | 헛 제안 |
| H3 | pre-pass 오배치 탐지 | 폴더≠내용을 보고 | raw 파일 이동 |
| H4 | pre-pass 정상 | 일치 시 조용히 통과 | 매 파일 "OK" 소음 |
| H5 | worthy:false 처리 | 보고 후 raw 보존하고 다음 | concept 억지 생성 |
| H6 | 승인 거절 | wiki 변경 0 | 거절분 기록 |
| H7 | 기록 후 정합성 | 기록 결과가 okf-lint OK | 자기보고로 게이트 갈음 |
| H8 | 배치 순차성 | 1건씩 제안→승인→기록 | 일괄 묶음 승인 |

채점 = (a) 루브릭 MUST/MUST NOT (judge sub-agent 또는 사람) + (b) 기록 결과 okf-lint 통과(결정적, HA7). 실패 모드 만날 때마다 추가하는 성장형.

**(B) verify — end-to-end 수동**: fixture raw 2~3건을 raw/에 두고 `/ingest` 실제 호출 → 미반영 탐지·pre-pass·승인·기록·게이트가 한 흐름으로 도는지 사람이 관찰 (`/verify` 흐름).

## 7. spec-author(D') 정렬 — 변경 필요한가?

거의 없음. D'는 이미 `worthy`·`operations`·`index_rows`·`log_entries`를 출력하고 경로를 분류·배치하지 않는다(spec §5 경계와 일치). /ingest는 D'가 받는 입력에 **확정 카테고리**를 함께 넘기기만 하면 된다(HA3 통과 후 확정된 폴더). D' 프롬프트 수정 불필요.

## 8. 열린 질문 / 백로그 (초기 기본값 채택)

- **HA-Q1 미반영 판정 고도화** (HA2 후속): sources 스캔은 단순·정확하나, raw 파일이 *갱신*됐는데 같은 경로면 "이미 반영"으로 놓침(내용 변경 미감지). → 초기엔 무시(신규 파일 위주). 추후 raw 해시/`last_verified` 대조로 *변경된 raw 재ingest* 지원. **해야 할 것 목록에 남김** (이 대화에서 합의).
- **HA-Q2 승인 형식** (DA-Q1 상속): 초기 대화창 inline diff(전체 content 아닌 변경내역). 규모 커지면 `wiki/.proposed/` 스테이징 파일 diff로 승급.
- **HA-Q3 operation별 부분 승인**(HA6): 한 파일 제안 중 일부 op만 채택. 초기 비목표 — 신뢰 축적 후.
- **HA-Q4 pre-pass 비용**: 미반영 파일이 많을 때 내용 스캔 비용. 초기엔 메인이 가볍게(헤더/앞부분) 판정. 정밀 분류 필요 시 별도 검토.

## 9. 후속

- **트리거 ① 정렬**: `define-screen`/`on-confirm`(C)을 이 일반 ingest 흐름의 화면 전용 특수화로 리팩터.
- **F (wiki-lint)**: 불규칙 ingest 지점이 의미 모순 최다 발생 → 야간 배치 우선도 상승 (D-INGEST-4).
- plan: 본 spec 확정 후 `docs/superpowers/plans/2026-06-29-ingest-skill-plan.md` (스킬 프롬프트 + eval 시나리오 작성 task).
