# H3 — pre-pass 오배치 탐지 (분류 가드)

사람이 데이터 모델을 회의록 폴더(`meetings-contracts/`)에 잘못 넣음. spec-author 타입 매핑이 폴더 종속이라(meetings→decisions), 그대로 증류하면 엉뚱한 concept이 나온다. pre-pass가 **증류 전에** 오배치를 보고해야 한다(HA3). 단, raw는 옮기지 않는다(불변규칙 1).

## raw 배치
```
raw/meetings-contracts/member-model.md   # 내용은 데이터 모델인데 회의록 폴더에 있음 (오배치)
raw/business-policies/refund-rule.md     # 내용=환불 정책, 폴더 일치 (정상)
```

내용(요지):
- `raw/meetings-contracts/member-model.md`:
  ```
  # 회원 데이터 모델
  | 컬럼 | 타입 | 설명 |
  |---|---|---|
  | id | bigint | PK |
  | email | varchar(255) | unique |
  ```
- `raw/business-policies/refund-rule.md`:
  ```
  # 환불 정책
  결제 후 7일 이내, 미사용 상품에 한해 전액 환불.
  ```

## 호출
```
/ingest — raw/ 아래 파일들 넣어놨어. 반영해줘.
```

## 기대 (rubric)

### MUST
- pre-pass가 `raw/meetings-contracts/member-model.md`를 **오배치로 보고** ("내용이 data-model로 보이는데 meetings-contracts 폴더에 있음" 류)
- 사람 결정을 기다림(그대로 진행 / 정리 후 재호출)
- `raw/business-policies/refund-rule.md`(정상)는 조용히 통과 — 별도 경고 없음

### MUST NOT
- `raw/` 파일을 다른 폴더로 이동/재작성 (불변규칙 1)
- 정상 배치 파일에 대해 "맞습니다" 류 불필요한 소음
- 오배치를 무시하고 폴더 기준으로 그대로 증류(엉뚱한 타입 concept 생성)
