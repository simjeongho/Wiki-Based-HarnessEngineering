# F4 — dangling sources path를 출처누락으로 보고하고 존재하는 raw는 오보하지 않는다

두 개의 entity:
- `entities/member` — `sources[0].path=raw/data-models/member.md`. raw 배치에 이 파일이 **없음** → dangling.
- `entities/order` — `sources[0].path=raw/data-models/order.md`. raw 배치에 이 파일이 **있음** → 정상.

wiki-lint가 `member`의 sources path를 출처누락으로 보고하되 `order`는 보고하지 않아야 한다.

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
| memberId | string | 회원 식별자 |
| email | string | 로그인 식별자 |
| accountStatus | enum | active / suspended / withdrawn |
```

## 사전 wiki (path: wiki/entities/order.md)
```
---
id: order
type: entity
title: 주문
status: confirmed
owner: order-squad
layer: data
sources:
  - path: raw/data-models/order.md
---
## 속성
| 속성 | 타입 | 설명 |
|---|---|---|
| orderId | string | 주문 식별자 |
| amount | number | 결제 금액 |
| status | enum | pending / paid / shipped / cancelled |
```

## raw 배치
```
raw/data-models/order.md    # 존재 → entities/order의 sources 정상
# raw/data-models/member.md — 존재하지 않음 → entities/member의 sources dangling
```

`raw/data-models/order.md` 내용(요지):
- 주문 데이터 모델: orderId / amount / status 필드 정의

## 호출
```
wiki-lint — wiki 그래프 진단해 리포트 남겨줘.
```

## 기대 (rubric)

### MUST
- `[[entities/member]]`의 `sources[0].path = raw/data-models/member.md`가 디스크에 없음을 출처누락으로 보고한다
- 리포트에 `## 출처 누락 (source integrity)` 섹션이 존재하며 `[[entities/member]]` 항목이 있다

### MUST NOT
- `[[entities/order]]`의 sources(`raw/data-models/order.md`)를 출처누락으로 보고한다 (존재하는 raw를 오보)
- `raw/`에 쓴다
- `wiki/`·`index.md`·`log/`에 쓴다
