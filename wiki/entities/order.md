---
id: order
type: entity
title: 주문
status: confirmed
owner: order-squad
layer: data
sources:
  - path: raw/data-models/order.md
related:
  - "[[policies/refund-rule]]"
---
## 속성
| 속성 | 타입 | 설명 |
|---|---|---|
| orderId | string | 주문 식별자 |
| amount | number | 결제 금액 |
| status | enum | pending / paid / shipped / cancelled |

## 상태 전이
허용 enum 값: `pending`, `paid`, `shipped`, `cancelled`.
