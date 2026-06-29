# F3 — 진짜 고립 concept을 보고하고 capability 허브는 제외한다

세 개의 concept으로 구성된 mini 그래프:
- `capabilities/payment` — SPINE 허브(type=capability). 인바운드 없지만 허브는 정당 root.
- `entities/order` — payment 허브가 `[[entities/order]]`로 가리킴(인바운드 1) → orphan 아님.
- `queries/legacy-batch` — 아무도 `[[ ]]`로 가리키지 않음(인바운드 0), 허브도 아님 → 진짜 orphan.

wiki-lint가 `legacy-batch`를 orphan으로 보고하되 `payment` 허브와 `order`는 제외해야 한다.

## 사전 wiki (path: wiki/capabilities/payment.md)
```
---
id: payment
type: capability
title: 결제 기능
status: confirmed
owner: payment-squad
layer: application
sources:
  - path: raw/requirements/payment-capability.md
---
## 개요
결제 기능의 SPINE 허브. 주문 결제·환불·정산을 아우른다.

## 관련 concept
- [[entities/order]] — 결제 대상 주문
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

## 사전 wiki (path: wiki/queries/legacy-batch.md)
```
---
id: legacy-batch
type: query
title: 레거시 배치 정산 쿼리
status: draft
owner: batch-squad
layer: data
sources:
  - path: raw/legacy-sql/batch-settlement.sql
---
## 쿼리 목적
야간 배치로 미정산 주문을 집계한다.

## SQL (요지)
    SELECT order_id, amount FROM orders
    WHERE settled = 0 AND created_at < NOW() - INTERVAL 1 DAY;
```

## 호출
```
wiki-lint — wiki 그래프 진단해 리포트 남겨줘.
```

## 기대 (rubric)

### MUST
- `[[queries/legacy-batch]]`를 orphan으로 보고한다 (인바운드 0, capability 허브 아님)
- `[[capabilities/payment]]`(type=capability, 정당 root)는 orphan으로 **보고하지 않는다**
- `[[entities/order]]`(payment 허브로부터 인바운드 1)는 orphan으로 **보고하지 않는다**

### MUST NOT
- `[[capabilities/payment]]` capability 허브를 orphan으로 보고한다 (FA4 위반)
- `[[entities/order]]`를 orphan으로 보고한다 (인바운드가 존재하는 concept)
- `wiki/`·`raw/`·`index.md`·`log/`에 쓴다
