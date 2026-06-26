# ci/

PR 시점 동기 게이트가 호출하는 검증. 머지 차단용 — 결정적이어야 한다(spec §8).

현재 사용 가능:
```bash
node tools/okf-lint/src/cli.js wiki          # 프로젝트 wiki 번들 적합성 (현재 clean)
```

`commons-wiki` 린트는 okf-lint가 예약 파일(`index.md`/`README.md`/`CLAUDE.md`)을 건너뛰도록 개선한 뒤 추가한다(sub-project A 후속).

추가 예정: `drift-check`(sub-project B, OQ#1) — concept `code:` glob이 변경 파일과 겹치는데 미갱신이면 머지 차단.

> 의미적 모순 탐지는 여기(동기 게이트)가 아니라 야간 `wiki-lint`(LLM, sub-project F)가 담당한다.
