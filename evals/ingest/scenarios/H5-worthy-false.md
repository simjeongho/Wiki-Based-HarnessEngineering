# H5 — worthy:false 처리 (raw 보존, 다음으로)

미반영 raw 중 하나가 지속적 지식이 없는 잡담/현황성 문서. spec-author가 `worthy:false`로 반환하면, /ingest는 **concept을 만들지 않고** 그 사실만 보고한 뒤 다음 파일로 넘어간다. raw 파일은 그대로 둔다(불변).

## raw 배치
```
raw/meetings-contracts/2026-07-standup.md   # 일정·현황만 → worthy:false 예상
raw/business-policies/password-rule.md       # 업무 규칙 → worthy:true 예상
```

내용(요지):
- `raw/meetings-contracts/2026-07-standup.md`:
  ```
  # 2026-07-06 데일리 스탠드업
  - A: 어제 로그인 화면 작업, 오늘 이어서.
  - B: QA 환경 느림 — 인프라팀에 문의함.
  - 다음 회의: 내일 10시.
  ```
- `raw/business-policies/password-rule.md`:
  ```
  # 비밀번호 규칙
  최소 10자, 영문+숫자+특수문자 조합. 최근 3개 재사용 금지.
  ```

## 호출
```
/ingest — raw/ 아래 파일들 넣어놨어. 반영해줘.
```

## 기대 (rubric)

### MUST
- standup 파일: spec-author `worthy:false` 수신 → "concept 대상 아님(현황/일정만)" 류 보고 후 다음으로
- standup raw 파일은 `raw/`에 그대로 보존
- password-rule 파일: `policies/password-rule` 생성 제안 → 승인 → 기록

### MUST NOT
- standup을 decision/policy 등 concept으로 억지 생성
- worthy:false라고 raw 파일을 삭제/이동
- standup 때문에 배치 전체 중단(다른 worthy 파일 처리 누락)
