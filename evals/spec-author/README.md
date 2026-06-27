# spec-author (D') eval 스위트

`spec-author` 에이전트가 raw 산출물 → OKF concept 변경안을 제대로 제안하는지 고정하는 eval. **TDD가 아니라 eval-주도** — 검증 = (a) 결정적 okf-lint 정합성 + (b) 루브릭 판단(judge sub-agent).

## 시나리오 형식

각 시나리오 = `scenarios/<id>.md` **파일 하나**. 아래 섹션을 fenced 블록으로:

- `## 입력 raw (path: raw/<category>/<file>)` — 입력 산출물 내용
- `## wiki-before (path: wiki/<폴더>/<id>.md)` — (선택) 사전 wiki 상태. update/대체/멱등 시나리오만. 여러 개 가능.
- `## rubric` — MUST / MUST NOT

> 디렉터리 트리를 만들지 않는다(파일 폭발 방지). 실행 시 블록 내용을 에이전트 dispatch에 그대로 붙인다.

## 실행 (Inline + judge sub-agent)

1. **dispatch**: `spec-author` 에이전트에 시나리오의 `입력 raw` 블록(+ 있으면 `wiki-before` 블록)을 붙이고 의도 경로를 알려준다 → 제안 JSON 수신.
2. **정합성 채점(결정적)**: 제안 JSON의 각 `operations[].content`(+ wiki-before)를 임시 디렉터리 `wiki/<type>/<id>.md`로 펼친 뒤
   `node tools/okf-lint/src/cli.js <임시>/wiki` → `okf-lint: OK`(exit 0)여야 함.
3. **루브릭 채점(판단)**: `judge-prompt.md`로 judge sub-agent를 띄워 MUST/MUST NOT 채점.
4. 결과를 `RESULTS.md`에 1행 기록.

## 코어 시나리오 (8)

E01 대체 · E02 생성 · E03 레거시SQL · E04 worthy:false · E05 정제 · E06 process 생성 · E10 멱등 · E14 정합성.

성장 backlog: E07 모호→질문 · E08 충돌≠reversal · E09 dangling · E11 commons 재사용 · E12 부분 worthy · E13 process 과추출 금지. **실패 모드를 만나면 추가**(성장형). eval 러너 코드는 만들지 않는다 — 수동 + 기존 okf-lint 재사용.
