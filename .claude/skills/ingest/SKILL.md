---
name: ingest
description: raw/ 아래 아직 wiki에 반영되지 않은 산출물을 찾아 OKF concept으로 증류·승인·기록한다. 사용자가 raw 폴더에 파일을 넣어두고 "반영해줘 / ingest 해줘 / 위키에 반영" 류로 요청할 때 사용. 미반영 스캔 → pre-pass 분류 가드 → spec-author 증류 → 사람 승인 → wiki/index/log 원자적 기록 → okf-lint 게이트.
---

# `/ingest` — raw 배치 동기화 오케스트레이터

너는 `/ingest` 스킬이다. 사람이 `raw/<category>/`에 떨궈둔 산출물 중 **아직 wiki에 반영 안 된 것**을 찾아 OKF concept으로 반영한다. 너는 **메인 세션의 오케스트레이터**다 — 증류는 `spec-author` 에이전트에 위임하고, 너는 스캔·사람 승인·기록·게이트를 담당한다.

> 설계 근거: `docs/superpowers/specs/2026-06-29-ingest-skill.md`. 스키마·불변규칙: 루트 `CLAUDE.md`. 증류 엔진 계약: `docs/superpowers/specs/2026-06-27-spec-author-reconcile.md` §3.

**절대 규칙:**
- `raw/`에 **쓰지 않는다**(불변규칙 1). pre-pass에서 오배치를 발견해도 *보고만* 하고 옮기지 않는다.
- **사람 승인 전 wiki를 바꾸지 않는다**(HA4·HA6).
- 게이트 결과는 **실제 okf-lint를 실행**해 확인한다 — "OK일 것"이라고 자기보고하지 마라(HA7).
- 모호하면 추측하지 말고 사람에게 묻는다.

---

## [1] 스캔 — 미반영 raw 목록 산출 (HA2)

1. `wiki/**/*.md`의 frontmatter `sources[].path`를 전부 모은다 = **이미 반영된 raw 경로 집합**.
2. `raw/**` 의 파일을 나열하고, 그 집합에 **없는** 파일 = **미반영 raw**.
3. 미반영이 0건이면 "반영할 새 raw 없음"을 보고하고 **종료**한다.
4. 미반영 목록을 사람에게 보여준다(파일별 경로).

> 판정 기준은 wiki의 실제 `sources`다(index.md 테이블이 아니라). index 테이블은 기록용일 뿐 진실의 원천이 아니다.

## [2] pre-pass — 분류 가드 (HA3)

미반영 각 파일에 대해, **폴더(카테고리)와 내용이 맞는지** 헤더/앞부분만 가볍게 확인한다:

- 폴더↔내용 매핑 감각: `data-models`=데이터 모델 / `legacy-sql`=SQL / `interface-specs`=API·연계 / `business-policies`=업무 규칙 / `meetings-contracts`=회의록·계약 / `requirements`=요구사항 / `screen-definitions`=화면 정의.
- **불일치만 모아서 한 번에 보고**한다. 예: "`raw/meetings-contracts/x.md`가 내용상 data-model로 보입니다. meetings-contracts 폴더에 있는데 그대로 진행할까요, 아니면 raw를 정리하고 다시 부르실까요?"
- **일치하는 파일엔 아무 말도 하지 않는다**(소음 금지).
- 사람이 "그대로 진행"이면 폴더 기준으로 계속, "정리 후 재호출"이면 중단. **raw 파일은 절대 옮기지 않는다.**

## [3] 배치 루프 — 파일 1건씩 순차 (HA4)

미반영(+ pre-pass 통과) raw를 **한 건씩** 처리한다:

1. **증류**: `spec-author` 에이전트를 호출한다. 입력 = 그 raw 파일 경로 + 확정 카테고리 + 현재 wiki 그래프(읽기). 출력 = 제안 JSON(`worthy`/`operations`/`log_entries`/`index_rows`).
2. **worthy:false**: spec-author가 "concept 대상 아님"이면, `skip_reason`을 사람에게 보고하고 **raw는 그대로 둔 채 다음 파일로**. concept을 억지로 만들지 마라.
3. **worthy:true**: 제안을 **변경 내역(diff 요약)** 으로 제시한다 — 무엇이 생성/갱신/대체되는지(전체 content를 다 펼치지 말고 핵심 변경만). 대체(supersession)면 old=deprecated, new=supersedes 쌍을 명확히.
4. **★사람 승인★**: 그 파일의 제안 **전체**를 승인/거절(HA6 — operation별 부분 승인 없음). 거절·수정이면 기록하지 않고 다음 파일로.
5. **기록**(승인 시에만, D' 출력 재사용 — HA5):
   - 각 `operations[].content`를 `wiki/<type>/<id>.md`에 쓴다(`op: create`=신규, `op: update`=덮어쓰기).
   - `index_rows`를 `index.md`에 반영한다 — raw→wiki ingest 테이블 행 + 해당 타입 카탈로그 행.
   - `log_entries`를 `log/<YYYY-MM-DD>.md`에 append한다(없으면 생성).
6. 다음 파일로.

## [4] 게이트 — 정합성 확인 (HA7)

배치가 끝나면 **실제로** 실행한다:

```bash
node tools/okf-lint/src/cli.js wiki
```

- `okf-lint: OK`(exit 0)면 완료를 보고한다(반영된 concept 목록 + 갱신된 index/log).
- error면 무엇이 실패했는지(깨진 링크·필수필드·enum·supersession 위반) 사실대로 보고한다. PR 동기 게이트와 동일하게 이게 통과해야 머지 가능하다.

---

## 경계 (하지 않는 것)

- raw 분류·배치·이동 ❌ (사람이 함, pre-pass는 보고만)
- concept 증류·worthy 판단 ❌ (spec-author가 함)
- 의미적 모순 탐지 ❌ (야간 wiki-lint가 함 — 너는 구조 게이트만)
- 코드 drift-check ❌ (코드 동반 변경 시 별도)
