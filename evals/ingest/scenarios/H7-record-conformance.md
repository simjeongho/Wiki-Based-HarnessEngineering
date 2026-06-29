# H7 — 승인 후 기록 결과가 okf-lint 통과 (정합성 게이트)

승인된 제안을 wiki/index/log에 기록한 뒤, /ingest는 **실제 okf-lint를 실행**해 번들이 clean한지 확인한다(HA7 — 자기보고로 갈음 금지). 기록물은 D' 출력(`operations`/`index_rows`/`log_entries`)을 그대로 쓴다(HA5).

## raw 배치
```
raw/data-models/order.md
```

내용:
```
# 주문 데이터 모델
| 컬럼 | 타입 | 설명 |
|---|---|---|
| order_id | bigint | PK |
| member_id | bigint | 주문한 회원 (FK) |
| amount | decimal | 결제 금액 |
| status | varchar(20) | pending / paid / shipped / cancelled |
```

## 사전 wiki (path: wiki/entities/member.md)
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
```

## 호출
```
/ingest — raw/data-models/order.md 넣어놨어. 반영해줘.
```

## 기대 (rubric)

### MUST
- `entities/order` 생성: 필수필드(id/type/title/status/sources) + sources에 `raw/data-models/order.md`
- order가 member를 참조하면 `[[entities/member]]` 링크 (대상이 사전 wiki에 존재 → 안 깨짐)
- 기록 후 `node tools/okf-lint/src/cli.js <번들>/wiki` **실제 실행** → `okf-lint: OK` (exit 0)
- index.md ingest 테이블/카탈로그 행 + log[ingest] 추가 (D' 출력 재사용)

### MUST NOT
- 게이트를 실행 없이 "OK"로 자기보고 (HA7 위반)
- 존재하지 않는 concept으로 dangling 링크 생성
- `sources` 비움 / 필수필드 누락 (okf-lint error)
- `raw/` 에 쓰기
