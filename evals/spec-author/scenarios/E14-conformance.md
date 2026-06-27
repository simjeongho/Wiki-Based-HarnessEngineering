# E14 — 정합성 전용: 제안이 okf-lint를 통과해야 (결정적 백스톱)

내용 판단보다 **구조적 정합성**에 집중. 어떤 산출물이든 D'의 제안은 okf-lint를 통과해야 한다.

## 입력 raw (path: raw/business-policies/refund.md)
```
# 환불 정책

- 결제 후 7일 이내 미사용분에 한해 전액 환불.
- 부분 사용 시 사용분 차감 후 환불.
- 환불은 원결제수단으로만.
```

## rubric

### MUST (대부분 결정적 okf-lint 검사로 판정)
- 제안된 모든 `operations[].content`가 okf-lint 통과:
  - frontmatter 필수필드(id·type·title·status·sources) 충족, id == 파일명, type == 폴더
  - status/layer enum 유효
  - 본문/frontmatter의 `[[폴더/id]]` 링크가 (이 제안 + 기존 wiki 안에서) 해소 가능
  - `superseded_by`가 있으면 status=deprecated
- `policies/*` create로 환불 규칙 표현, sources에 raw 경로

### MUST NOT
- okf-lint 실패를 유발하는 변경안 반환 (깨진 링크/누락 필드/enum 위반)
- 존재하지 않는 concept으로의 dangling 링크 생성
- 디스크 write
