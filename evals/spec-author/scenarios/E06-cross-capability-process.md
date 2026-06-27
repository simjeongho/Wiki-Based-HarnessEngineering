# E06 — 2+ capability를 가로지르는 흐름 → processes 생성 (입자)

흐름이 여러 화면을 가로지름 → process가 흐름 소유, capability는 frontmatter 역링크만.

## 입력 raw (path: raw/requirements/onboarding-flow.md)
```
# 회원 온보딩 흐름 (요구)

신규 고객은 다음 순서로 온보딩한다:
1. 회원가입 (signup)
2. 이메일 인증 (email-verification)
3. 프로필 설정 (profile-setup)
세 단계를 모두 마쳐야 정식 회원으로 전환된다.
```

## wiki-before (path: wiki/capabilities/signup.md)
```
---
id: signup
type: capability
title: 회원가입
status: confirmed
sources:
  - path: raw/screen-definitions/signup.md
---
## 목적
회원 가입 기능.
```

## wiki-before (path: wiki/capabilities/email-verification.md)
```
---
id: email-verification
type: capability
title: 이메일 인증
status: confirmed
sources:
  - path: raw/screen-definitions/email-verification.md
---
## 목적
이메일 인증 기능.
```

## wiki-before (path: wiki/capabilities/profile-setup.md)
```
---
id: profile-setup
type: capability
title: 프로필 설정
status: confirmed
sources:
  - path: raw/screen-definitions/profile-setup.md
---
## 목적
프로필 설정 기능.
```

## rubric

### MUST
- `processes/member-onboarding`(또는 유사 id) **create** — 본문 단계가 `[[capabilities/signup]]` → `[[capabilities/email-verification]]` → `[[capabilities/profile-setup]]` 순서로 링크
- 세 capability에 대한 update operation: frontmatter `related`에 `[[processes/member-onboarding]]` 역링크 추가
- 모든 링크 해소 가능(끊김 없음)

### MUST NOT
- 흐름(순서)을 capability **본문에 복제** (process가 단독 소유)
- process를 만들지 않고 한 capability 본문에만 흐름을 욱여넣음
- 디스크 write
