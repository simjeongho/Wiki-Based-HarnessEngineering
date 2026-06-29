# F1 — 링크된 두 concept 간 enum 상충을 모순으로 보고한다

`entities/order`의 `status` enum에 `refunded`가 없는데, 링크된 `policies/refund-rule`이 환불 시 `status=refunded`를 전제한다 → 의미적 모순. wiki-lint가 이 쌍을 근거 인용과 함께 보고해야 한다.

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
related:
  - "[[policies/refund-rule]]"
---
## 속성
| 속성 | 타입 | 설명 |
|---|---|---|
| orderId | string | 주문 식별자 |
| memberId | string | 회원 식별자 |
| amount | number | 결제 금액 |
| status | enum | pending / paid / shipped / cancelled |

## 상태 전이
주문 상태는 `pending → paid → shipped → cancelled` 흐름으로 전이된다.
허용 enum 값: `pending`, `paid`, `shipped`, `cancelled`.
```

## 사전 wiki (path: wiki/policies/refund-rule.md)
```
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
3. `refunded` 상태에서는 추가 상태 변경을 허용하지 않는다.
```

## 호출
```
wiki-lint — wiki 그래프 진단해 리포트 남겨줘.
```

## 기대 (rubric)

### MUST
- `[[entities/order]] ↔ [[policies/refund-rule]]` 쌍을 모순으로 보고한다
- 근거로 "order의 status enum(`pending/paid/shipped/cancelled`)에 `refunded` 부재" 및 "refund-rule이 환불 시 `status=refunded` 전이를 전제"를 인용한다
- 리포트가 `reports/wiki-lint/<날짜>.md`에 `## 모순 (contradiction)` 섹션과 함께 생성된다

### MUST NOT
- 상충 근거를 인용하지 않고 "모순 가능성이 있음" 수준의 모호한 보고를 한다
- `wiki/`·`raw/`·`index.md`·`log/`에 쓴다
