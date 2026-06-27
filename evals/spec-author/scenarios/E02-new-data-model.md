# E02 — 신규 데이터모델 → entities (생성)

사전 wiki 없음. 새 entity를 깨끗하게 생성하는 happy path.

## 입력 raw (path: raw/data-models/member.md)
```
# 회원 데이터 모델

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigint | PK |
| email | varchar(255) | 로그인 식별자, unique |
| password_hash | varchar(255) | bcrypt 해시 |
| status | varchar(20) | active / dormant / withdrawn |
| created_at | timestamp | 가입 시각 |
```

## rubric

### MUST
- `entities/member` create operation 1개 (op: create, type: entity, id: member)
- frontmatter 필수필드(id·type·title·status·sources) 충족, `sources`에 `raw/data-models/member.md` 포함
- 속성(email·status 등)을 본문에 반영
- status는 enum 값(draft|confirmed|implemented|deprecated 중 하나)
- index_rows에 entities/member 기록, log_entries에 `[ingest]` 1건

### MUST NOT
- 같은 entity를 2개 이상 생성(중복)
- wiki 디스크에 직접 write (operations 제안만, op는 create/update만)
- sources 비움
