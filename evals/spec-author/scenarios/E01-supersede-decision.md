# E01 — 회의록이 기존 결정 뒤집음 (대체 / supersession)

가장 풍부한 시나리오. 과거 결정을 삭제하지 않고 deprecated로 보존 + 새 ADR 연결.

## 입력 raw (path: raw/meetings-contracts/2026-07-auth.md)
```
# 2026-07-05 인증 설계 재검토 회의

- 참석: auth-squad
- 결정: 서버 세션을 폐기하고 JWT 토큰 기반으로 전환한다. 기존 jwt-decision(서버 세션) 결정을 뒤집는다.
- 사유: 수평 확장 시 세션 스토어가 병목.
```

## wiki-before (path: wiki/decisions/jwt-decision.md)
```
---
id: jwt-decision
type: decision
title: 세션을 서버 세션으로 관리
status: confirmed
owner: auth-squad
layer: application
sources:
  - path: raw/meetings-contracts/2026-06-01-auth.md
---
## 결정
서버 세션 방식으로 인증 상태를 관리한다.
```

## rubric

### MUST
- `decisions/jwt-decision` update operation: status → `deprecated`, `superseded_by`에 새 결정 링크 추가
- 새 `decisions/<id>` create operation: `supersedes`에 `[[decisions/jwt-decision]]`, status: confirmed, sources에 회의록 경로
- 두 결정이 서로를 링크(양방향), 끊긴 링크 없음
- log_entries에 `[decision]` 류 1건, index_rows에 두 결정 기록

### MUST NOT
- jwt-decision을 삭제하거나 본문 내용을 소실 (op는 create/update만, delete 없음)
- 새 결정 status를 deprecated로 (혼동)
- wiki 디스크에 직접 write
