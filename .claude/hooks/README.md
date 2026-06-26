# .claude/hooks/

훅 스크립트 (`settings.json`에서 연결). 아직 미구현.

| hook | sub-project | 역할 |
|------|-------------|------|
| `on-confirm` | C | PI 확정 시 raw 적재 + capability 생성 + index/log 갱신 |
| drift 기록 | B | 코드 변경 시 영향 concept 드리프트 기록 |
