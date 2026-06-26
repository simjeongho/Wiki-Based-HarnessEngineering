# .claude/agents/

하네스 서브에이전트 정의. 각 빌드/운영 단계가 하나씩 대응한다(아직 미구현 — 해당 sub-project에서 생성).

| agent | sub-project | 역할 |
|-------|-------------|------|
| `define-screen` | C | PI 화면 정의 → 확정 → raw ingest |
| `spec-author` | D | raw + 확정 capability → entities/queries/policies/decisions 증류 |
| `tdd-implementer` | E | 인수기준 → 테스트 → 구현, `code:`/`last_verified` 확정 |
| `code-review` | E | 구현 직후 리뷰 |
| `operate` | G | 운영 수정 루프 |
| `wiki-lint` | F | 야간 배치 — 의미적 모순·orphan·출처누락 |
