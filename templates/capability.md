---
id: signup
type: capability
title: 회원가입
status: confirmed
owner: auth-squad
layer: business
sources:
  - path: raw/screen-definitions/signup.md
    ref: "Sheet2!A1:F30"
code:
  - src/auth/signup/**
related:
  - "[[entities/member]]"
  - "[[policies/password-rule]]"
traces: [REQ-001, REQ-002]
tags: [auth, onboarding]
last_verified: 2026-06-25
---
## 목적
이 기능이 무엇을 가능하게 하는가 (한 문장).

## 화면·UI
- 사용 컴포넌트: [[references/design-system]] 의 컴포넌트 링크

## 흐름
1. 단계 …

## 구성요소
- 엔티티: [[entities/member]]
- 정책: [[policies/password-rule]]
- 인터페이스: [[interfaces/...]]
- 결정: [[decisions/...]]

## 인수 기준 (TDD 시드)
- [ ] …

## 출처
- [[raw/screen-definitions/signup]]
