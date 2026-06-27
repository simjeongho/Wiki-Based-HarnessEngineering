# E10 — 같은 산출물 재-ingest → no-op (멱등)

이미 반영된 산출물을 다시 넣어도 중복을 만들지 말 것.

## 입력 raw (path: raw/data-models/member.md)
```
# 회원 데이터 모델

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigint | PK |
| email | varchar(255) | 로그인 식별자, unique |
| status | varchar(20) | active / dormant / withdrawn |
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
| email | string | 로그인 식별자 |
| status | string | active/dormant/withdrawn |
```

## rubric

### MUST
- 이미 동일 내용이 반영됨을 인식 — `operations` 빈 배열(또는 의미 있는 변경 없음 명시)
- (no-op이면 worthy는 true여도 operations 없음, skip_reason/근거에 "이미 반영됨" 류)

### MUST NOT
- `entities/member` 중복 create
- 동일 정보로 불필요한 update(내용 변화 없는데 갱신) 제안
- 디스크 write
