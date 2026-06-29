# F2 — 일관 쌍·supersession 쌍을 모순으로 오보하지 않는다

두 가지 false-positive 회피를 한 시나리오에서 검증한다.
**(a) 일관 쌍:** `member` entity와 `login-rule` policy가 링크됐지만 enum과 상충 없음 → 모순 아님.
**(b) supersession 쌍:** `auth-v1`(deprecated, 세션 기반)이 `auth-v2`(confirmed, JWT 기반)로 대체됨 → 내용이 다르지만 `superseded_by`/`supersedes` 엣지로 연결된 의도된 대체 → FA3 제외.

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
related:
  - "[[policies/login-rule]]"
---
## 속성
| 속성 | 타입 | 설명 |
|---|---|---|
| memberId | string | 회원 식별자 |
| email | string | 로그인 식별자 |
| accountStatus | enum | active / suspended / withdrawn |

## 계정 상태
허용 enum 값: `active`, `suspended`, `withdrawn`.
```

## 사전 wiki (path: wiki/policies/login-rule.md)
```
---
id: login-rule
type: policy
title: 로그인 처리 규칙
status: confirmed
owner: auth-squad
layer: business
sources:
  - path: raw/business-policies/login-rule.md
related:
  - "[[entities/member]]"
---
## 규칙
1. 로그인 요청 시 회원의 `accountStatus`가 `active`인 경우에만 인증을 허용한다.
2. `suspended` 상태의 회원은 로그인 불가 메시지를 반환한다.
3. `withdrawn` 상태의 회원은 탈퇴 안내 메시지를 반환한다.
```

## 사전 wiki (path: wiki/decisions/auth-v1.md)
```
---
id: auth-v1
type: decision
title: 세션 기반 인증 채택 (폐기됨)
status: deprecated
owner: auth-squad
layer: application
sources:
  - path: raw/meetings-contracts/2025-01-auth-session.md
superseded_by: "[[decisions/auth-v2]]"
---
## 결정
서버 세션 방식으로 인증 상태를 관리한다. 세션 스토어에 사용자 상태를 보관한다.

## 폐기 사유
수평 확장 시 세션 스토어가 병목이 되어 JWT 기반 방식으로 대체됨.
```

## 사전 wiki (path: wiki/decisions/auth-v2.md)
```
---
id: auth-v2
type: decision
title: JWT 기반 인증 채택
status: confirmed
owner: auth-squad
layer: application
sources:
  - path: raw/meetings-contracts/2026-06-auth-jwt.md
supersedes: "[[decisions/auth-v1]]"
---
## 결정
JWT 토큰 기반으로 인증 상태를 관리한다. 서버는 stateless로 운영한다.

## 선택 근거
수평 확장 시 세션 스토어 병목을 제거하기 위해 세션 기반 인증(auth-v1)을 대체한다.
```

## 호출
```
wiki-lint — wiki 그래프 진단해 리포트 남겨줘.
```

## 기대 (rubric)

### MUST
- `[[entities/member]] ↔ [[policies/login-rule]]` 일관 쌍을 모순으로 **보고하지 않는다** (두 concept이 같은 enum 값을 일관되게 사용함)
- `[[decisions/auth-v1]] ↔ [[decisions/auth-v2]]` supersession 쌍을 모순으로 **보고하지 않는다** (`superseded_by`/`supersedes` 엣지 → FA3 제외)
- 이 시나리오에서 모순 findings가 0개이거나 리포트에 모순 섹션이 없다 (또는 `요약: 모순 0`)

### MUST NOT
- `[[entities/member]] ↔ [[policies/login-rule]]` 정상 일관 쌍을 모순으로 보고한다
- `[[decisions/auth-v1]] ↔ [[decisions/auth-v2]]` deprecated↔현행 대체 쌍을 "세션 기반 vs JWT 기반" 내용 차이를 이유로 모순으로 보고한다
- `wiki/`·`raw/`·`index.md`·`log/`에 쓴다
