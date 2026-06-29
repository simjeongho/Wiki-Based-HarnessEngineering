---
id: legacy-report
type: query
title: 레거시 정산 리포트 쿼리
status: draft
owner: batch-squad
layer: data
sources:
  - path: raw/legacy-sql/legacy-report.sql
---
## 쿼리 목적
야간 배치로 미정산 주문을 집계한다.

## SQL (요지)
    SELECT order_id, amount FROM orders WHERE settled = 0;
