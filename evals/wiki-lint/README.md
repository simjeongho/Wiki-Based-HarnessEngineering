# `wiki-lint` eval 스위트

`wiki-lint` 스킬이 **의미적 모순·orphan·출처누락**을 올바르게 진단하는지 고정하는 eval.
spec-author·ingest eval과 **동형** — 시나리오 = 자기완결 마크다운 1파일. 디렉터리 트리 만들지 않는다.

> 전제: okf-lint(결정적 구조 게이트)는 이미 통과했다고 가정. wiki-lint는 그 위의 의미·판단 계층만 본다.

---

## 시나리오 형식

각 시나리오 = `scenarios/<id>.md` **파일 하나**. 아래 섹션을 fenced 블록으로:

- `## 사전 wiki (path: wiki/<폴더>/<id>.md)` — 사전 wiki 상태(frontmatter + 본문). concept당 하나, 여러 개 가능.
- `## raw 배치` — (선택) 출처 무결성(F4) 시나리오용. raw/ 에 존재하는 파일 목록.
- `## 호출` — `wiki-lint` 호출 의도.
- `## 기대 (rubric)` — `### MUST` / `### MUST NOT`.

> 디렉터리 트리를 만들지 않는다(파일 폭발 방지). 실행 시 블록 내용을 스크래치패드 임시 번들에 펼친다.

---

## 실행 절차

### 셋업(흉내)

시나리오의 `사전 wiki`·`raw 배치` 블록을 스크래치패드 **임시 번들**에 펼친다(실제 `wiki/` 안 건드림). `wiki-lint` 흐름을 그 임시 번들 기준으로 수행하고, 리포트는 임시 번들의 `reports/wiki-lint/<YYYY-MM-DD>.md`에 쓴다.

### 채점 — 결정적 트랙

두 가지를 기계적으로 확인한다:

**(a) 리포트 파일 생성 및 형식**
리포트가 `reports/wiki-lint/<날짜>.md` 경로에 생성됐는가? 형식이 spec §6에 맞는가:
- 요약 줄: `## 요약: 모순 N · orphan M · 출처누락 K`
- 카테고리 섹션: `## 모순 (contradiction)` / `## orphan` / `## 출처 누락 (source integrity)` / `## 처리 안내`

**(b) 출처 무결성(F4) — 결정적**
dangling raw path(디스크에 없는 `sources[].path`)가 보고됐는가? 이것은 파일 존재 여부라 LLM 판단 없이 결정적으로 채점한다.

### 채점 — 루브릭 트랙

`evals/wiki-lint/judge-prompt.md`(이 폴더 전용)의 judge sub-agent(또는 사람)로 MUST/MUST NOT 채점. spec-author judge-prompt는 형식만 참고하고, 채점 대상은 wiki-lint 리포트로 wiki-lint 전용 방식으로 진행한다.

### 결과 기록

결과를 `RESULTS.md`에 1행 기록.

---

## 원칙

- `wiki-lint`는 `reports/wiki-lint/<날짜>.md`에만 쓴다. **`wiki/`·`raw/`·`index.md`·`log/` 불변**.
- eval 중간 산출물(임시 번들·리포트·judge 채점)은 스크래치패드에서 버린다. 영구 보존은 `scenarios/`·`RESULTS.md`뿐.
- okf-lint가 잡는 구조 문제(깨진 링크·필수필드 누락·enum·폴더매핑)는 **중복 검사하지 않는다** — wiki-lint는 그 위의 의미 계층만.

---

## 코어 시나리오 (4)

| # | 파일 | 요지 |
|---|---|---|
| F1 | `scenarios/F1-contradiction.md` | 링크된 두 concept 간 enum 상충 → 모순으로 보고 |
| F2 | `scenarios/F2-no-false-positive.md` | 일관 쌍 + supersession 쌍 → 모순 오보 금지 |
| F3 | `scenarios/F3-orphan.md` | 진짜 고립 보고 + capability 허브는 정당 root로 제외 |
| F4 | `scenarios/F4-source-integrity.md` | dangling sources path 보고 + 존재하는 raw 오보 금지 |

---

## 성장 backlog (비차단)

실패 모드를 만날 때마다 추가(성장형). eval 러너 코드는 만들지 않는다 — 수동 + 기존 okf-lint 재사용.

- **F5** — 클린 그래프 0·0·0: 모순·orphan·출처누락이 없을 때 `요약: 0·0·0` 리포트 생성 확인
- **F6** — 다중 hop 전이 모순: A→B→C 전이적 상충 탐지
- **F7** — 심각도 등급: 모순/orphan/출처누락에 우선순위 부여
