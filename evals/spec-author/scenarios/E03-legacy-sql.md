# E03 — 레거시 SQL → queries + 박힌 규칙 policies 승격 (생성)

## 입력 raw (path: raw/legacy-sql/active_members.sql)
```
-- 활성 회원 목록: 최근 90일 내 로그인 + 탈퇴/휴면 제외
SELECT m.id, m.email
FROM member m
WHERE m.status = 'active'
  AND m.last_login_at > NOW() - INTERVAL '90 days';
```

## wiki-before (path: wiki/entities/member.md)
```
---
id: member
type: entity
title: 회원
status: confirmed
owner: auth-squad
layer: data
sources:
  - path: raw/data-models/member.md
---
## 속성
| 속성 | 타입 | 설명 |
|---|---|---|
| status | string | active/dormant/withdrawn |
| last_login_at | timestamp | 최근 로그인 시각 |
```

## rubric

### MUST
- `queries/active-members` create operation (type: query), sources에 raw 경로
- 본문에 "하는 일(평문)" + 건드리는 테이블/엔티티(`[[entities/member]]`)
- 박힌 업무규칙("활성 = status=active AND 최근 90일 로그인")을 **`policies/*` create로 승격** + query에서 링크
- log_entries `[ingest]`

### MUST NOT
- 규칙을 query 본문에만 두고 policies로 승격하지 않음
- 디스크 write / sources 비움
