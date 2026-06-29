---
id: refund-rule
type: policy
title: 환불 처리 규칙
status: confirmed
owner: order-squad
layer: business
sources:
  - path: raw/business-policies/refund-rule.md
related:
  - "[[entities/order]]"
---
## 규칙
1. 배송 전(status=paid) 주문은 요청 즉시 환불한다.
2. 환불 완료 시 주문 status를 `refunded`로 전이한다.
