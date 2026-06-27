# E04 — 잡담/현황성 회의록 → worthy:false (concept 대상 아님)

지속적 지식이 없는 산출물. 억지로 concept을 만들면 안 됨.

## 입력 raw (path: raw/meetings-contracts/2026-07-standup.md)
```
# 2026-07-06 데일리 스탠드업

- A: 어제 로그인 화면 작업, 오늘 이어서.
- B: QA 환경 느림 — 인프라팀에 문의함.
- 다음 회의: 내일 10시.
```

## rubric

### MUST
- `worthy: false`, `skip_reason`에 "지속적 지식 없음(현황/일정만)" 류 사유
- `operations`는 빈 배열

### MUST NOT
- 어떤 concept도 create/update 하지 않음 (현황 발언을 decision/policy로 둔갑)
- 디스크 write
