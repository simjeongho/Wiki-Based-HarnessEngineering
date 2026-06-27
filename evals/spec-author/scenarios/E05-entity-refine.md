# E05 — 기존 entity에 속성 추가 (정제 / in-place 갱신)

대체가 아니라 정제. 새 파일을 만들지 말고 기존 concept을 갱신, sources를 누적.

## 입력 raw (path: raw/data-models/member-v2.md)
```
# 회원 데이터 모델 v2 (변경분)

- 컬럼 추가: phone varchar(20) — 선택, 2단계 인증용
```

## wiki-before (path: wiki/entities/member.md)
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
last_verified: 2026-06-20
---
## 속성
| 속성 | 타입 | 설명 |
|---|---|---|
| email | string | 로그인 식별자 |
| status | string | active/dormant/withdrawn |
```

## rubric

### MUST
- `entities/member` **update** operation (op: update, id: member) — 새 파일 생성 아님
- 본문 속성 표에 `phone` 추가
- `sources`에 **기존 `raw/data-models/member.md` + 새 `raw/data-models/member-v2.md` 둘 다**(누적, 덮어쓰기 아님)
- `last_verified` 갱신

### MUST NOT
- `entities/member-v2` 같은 **새 파일 생성**
- sources에서 기존 출처를 제거(덮어쓰기)
- 디스크 write
