# H1 — 미반영 raw만 골라낸다 (스캔)

raw/ 에 파일이 여럿이고 일부는 이미 wiki에 반영됨. /ingest는 **반영 안 된 것만** 처리 대상으로 삼아야 한다(HA2: wiki `sources` 스캔).

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

## raw 배치
```
raw/data-models/member.md          # 이미 member entity의 sources에 있음 → 반영됨
raw/data-models/order.md           # 어떤 concept의 sources에도 없음 → 미반영
raw/interface-specs/pay-api.md     # 어떤 concept의 sources에도 없음 → 미반영
```

내용(요지):
- `raw/data-models/order.md` — 주문 데이터 모델(주문번호/회원ID/금액/상태)
- `raw/interface-specs/pay-api.md` — 결제 PG 연동 API 명세

## 호출
```
/ingest — raw/ 아래 파일들 넣어놨어. 아직 위키에 반영 안 된 거 판단해서 반영해줘.
```

## 기대 (rubric)

### MUST
- 미반영 목록 = `{raw/data-models/order.md, raw/interface-specs/pay-api.md}` 정확히 둘
- 반영 판정 근거 = wiki concept의 `sources[].path`에 그 raw가 있는지 (HA2)
- 각 미반영 raw에 대해서만 spec-author 증류 진행

### MUST NOT
- `raw/data-models/member.md`(이미 반영됨)를 재처리/재증류
- 미반영 목록에 이미 반영된 raw 포함
- `raw/` 에 쓰기
