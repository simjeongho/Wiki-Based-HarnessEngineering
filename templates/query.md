---
id: active-members-by-region
type: query
title: 지역별 활성 회원 집계
status: draft
owner: data-squad
layer: data
sources:
  - path: raw/legacy-sql/active_members.sql
code:
  - src/reports/active_members.sql
related:
  - "[[entities/member]]"
tags: [report, legacy-sql]
---
## 하는 일 (평문)
이 쿼리가 무엇을 반환하는지 평문으로.

## 건드리는 테이블·엔티티
- [[entities/member]]

## 박힌 업무 규칙 → policies 승격
- 추출한 규칙: [[policies/...]]

## 입출력
- 입력 / 출력 컬럼 …

## 왜 이렇게 짰는가
- [[decisions/...]]

## 코드 위치
- `src/reports/active_members.sql`
