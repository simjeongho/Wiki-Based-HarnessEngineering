---
id: member
type: entity
title: 회원
status: confirmed
owner: auth-squad
layer: data
sources:
  - path: raw/data-models/member.md
related:
  - "[[policies/password-rule]]"
tags: [auth]
---
## 업무적 의미
이 엔티티가 업무에서 의미하는 바.

## 속성
| 속성 | 타입 | 설명 |
|---|---|---|
| email | string | 로그인 식별자 |

## 불변 규칙
- [[policies/password-rule]]

## 관계
- …

## 사용처
- [[capabilities/signup]]

## 출처
- [[raw/data-models/member]]
