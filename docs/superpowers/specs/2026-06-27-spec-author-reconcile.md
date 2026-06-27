# spec-author (D') — raw→concept 증류·정합 엔진 설계

- **작성일**: 2026-06-27
- **상태**: 설계 (이 대화에서 합의된 결정 박제)
- **상위 문서**: [`2026-06-25-llm-wiki-okf-si-harness-design.md`](2026-06-25-llm-wiki-okf-si-harness-design.md) §7 빌드 루프 / §9 운영 루프 / §10 OQ#4·#6
- **선행 완료**: okf-lint supersession 토대(예약 파일 skip, `supersedes`/`superseded_by`, `superseded_by`→`deprecated` 규칙) — PR #5

---

## 1. 목적

raw 산출물 한 건 + 현재 wiki 그래프를 입력받아, **만들거나 고쳐야 할 concept 변경안을 *제안*하는 순수 엔진**. 빌드 트리거 ①(화면 확정)과 ingest 트리거 ②(불규칙 산출물)가 **공유하는 두뇌**다.

핵심 비유: **D' = 원고를 쓰는 기자, H/on-confirm = 승인받아 인쇄하는 윤전기, okf-lint = 교열.**

## 2. 핵심 설계 결정 (이 대화에서 확정)

| # | 결정 | 근거 |
|---|---|---|
| DA1 | **작성(authoring)과 기록(persisting)을 분리.** D'는 내용을 *작성*만, 디스크 write·승인·git은 H(또는 on-confirm)가 한다 | D'를 부수효과 없는 순수 엔진으로 두어 트리거 ①②가 재사용 |
| DA2 | D'는 **변경안(proposal)** 을 반환 — 추상 설명이 아니라 `(op, 경로, 완성된 파일 내용, 근거)` 목록 | H가 발명 없이 그대로 write 가능 |
| DA3 | **정제(refine) vs 대체(supersede)** 를 구분해 제안 | 과거 why 보존 ([[2026-06-25...]] D-INGEST-3) |
| DA4 | **concept-worthiness 판단은 프롬프트 규칙**(전용 agent 아님). 순수 보관/현황성 문서면 "concept 대상 아님" 반환 | 과설계 회피 |
| DA5 | **모든 변경안은 okf-lint를 통과**해야 함(반환 전 self-check) | 비결정적 출력의 결정적 백스톱 |
| DA6 | **process는 흐름(순서)을 단독 소유**, capability는 frontmatter `related`로만 역참조. process는 흐름이 2+ capability를 가로지를 때만 생성 (OQ#6 해소) | 중복·비대 방지 (D13 정신) |

> 입자 크기(OQ#6): `capabilities/` = 한 기능/화면 단위, `processes/` = 여러 화면을 가로지르는 하나의 업무 능력.

## 3. 인터페이스

**입력**
- raw 산출물 경로(사람/봇이 이미 `raw/<category>/`에 배치 — D'는 분류·배치하지 않음) + 카테고리
- 읽기 전용: 현재 `wiki/` + `commons-wiki/` 그래프, `index.md`

**출력 (proposal) — JSON structured output (sub-agent schema로 강제)**

D'는 sub-agent를 **JSON 스키마로 dispatch**해 아래 형태만 반환하게 한다(파싱 모호성 제거, H가 그대로 소비, okf-lint self-check 자동화).

```jsonc
{
  "worthy": true,                    // false면 concept 대상 아님(raw 보관만)
  "skip_reason": null,               // worthy:false일 때 이유
  "operations": [                    // op은 create|update 둘뿐
    {
      "op": "create",                // 새 concept
      "type": "decision",            // FOLDER_TO_TYPE 폴더 결정
      "id": "new-auth",              // 파일명 결정 → wiki/decisions/new-auth.md
      "content": "<frontmatter+본문 전체>",
      "rationale": "회의에서 JWT 전환 결정"
    },
    {
      "op": "update",                // 기존 concept 갱신(정제 또는 대체의 old 쪽)
      "type": "decision",
      "id": "old-auth",
      "content": "<status: deprecated + superseded_by 추가된 전체>",
      "rationale": "new-auth로 대체됨"
    }
  ],
  "log_entries": ["[ingest] raw/meetings-contracts/2026-07-auth.md",
                  "[decision] old-auth → new-auth"],
  "index_rows": [{ "date": "2026-07-xx",
                   "source": "raw/meetings-contracts/2026-07-auth.md",
                   "concepts": ["decisions/new-auth", "decisions/old-auth", "policies/password-rule"] }]
}
```

- **경로는 `(type,id)`에서 파생** — D'는 경로를 직접 쓰지 않고 `type`(폴더)·`id`(파일명)만 주면 H/스키마가 `wiki/<type>/<id>.md`로 푼다.
- **대체(supersession)는 별도 op 아님** — `update`(old=deprecated+superseded_by) + `create`(new=supersedes) 조합으로 표현, rationale로 묶음.
- D'는 디스크를 건드리지 않는다. H가 `worthy`/`operations`를 사람에게 제시 → 승인분만 write(초기 inline, 규모 커지면 스테이징 — DA-Q1).

## 4. 판단 규칙 (프롬프트로 인코딩)

1. **worthiness**: 지속적 지식(규칙·결정·데이터 모양·연계·흐름)이 있으면 concept, 순수 현황/잡담/일정 공유면 raw 보관만.
2. **raw 타입 → concept 타입 매핑** (기본):

   | raw 카테고리 | 산출 concept |
   |---|---|
   | data-models | `entities/` |
   | legacy-sql | `queries/` + 박힌 규칙 → `policies/` 승격 |
   | interface-specs | `interfaces/` |
   | business-policies | `policies/` |
   | meetings-contracts | `decisions/`(ADR) + 영향 `policies/`/`entities/` 갱신 |
   | requirements | `capabilities/` 씨앗 + `traces` |
3. **영향 concept 탐지**: 산출물이 언급하는 엔티티·id·주제로 wiki 그래프를 순회해 기존 concept을 찾는다.
4. **정제 vs 대체**:
   - 모순 없는 추가/보강 → 해당 concept **in-place 갱신**(`sources` 누적, `last_verified` 갱신). log `[update]`.
   - 과거 *결정*을 뒤집음 → **대체**: old `status: deprecated`+`superseded_by`, new ADR `supersedes`, 영향 concept 재링크. log `[decision]`(+`[contradiction]`).
5. **process/capability**(DA6): 흐름이 2+ capability를 가로지르면 `processes/` 생성(본문=순서, capability 링크), 아니면 단일 capability 본문에 남김.
6. 모든 concept은 템플릿(`templates/<type>.md`) 준수 + `sources` 필수 + 반환 전 okf-lint self-check.

## 5. 경계 / 비목표

- 디스크 write·승인·git 커밋 ❌ (H/on-confirm 담당)
- raw 분류·배치 ❌ (사람/PI-DEV 봇 담당)
- PR 게이트·drift-check ❌ (별도)
- **새 production 코드 없음** — 검증은 기존 okf-lint CLI 재사용. 따라서 **TDD task 0개.**

## 6. 검증 — eval 주도 (TDD 아님)

`evals/`에 시나리오(입력 raw + 루브릭 MUST/MUST NOT). 실행 = D' 호출 → (a) 루브릭 채점(사람 또는 judge sub-agent) + (b) 변경안 okf-lint 통과(결정적).

시나리오는 **happy path가 아니라 "두려운 실패 모드"마다 하나**씩. 그룹별:

| 그룹 | # | 시나리오 | MUST | MUST NOT |
|---|---|---|---|---|
| 생성 | E2 | 신규 데이터모델 | 새 entities + sources + capability 링크 | 중복 entity |
| 생성 | E3 | 레거시 SQL(규칙 박힘) | queries 생성 + 규칙 policies 승격 | 규칙 누락 |
| 정제 | E5 | 기존 entity 속성 추가 | in-place 갱신, sources **누적** | 새 파일 생성 / sources 덮어쓰기 |
| 대체 | E1 | 회의록이 기존 결정 뒤집음 | update(old=deprecated+superseded_by)+create(new=supersedes) + 영향 policy 갱신 | old 삭제 |
| 입자 | E6 | 흐름이 2+ capability 가로지름 | `processes/` 생성, capability는 related 역링크만 | capability 본문에 흐름 복제 |
| 입자 | E13 | 흐름이 1 capability 안에서 끝남 | capability 본문에 흐름 유지 | process 과추출 |
| worthiness | E4 | 잡담/현황성 회의록 | `worthy:false` + skip_reason | 억지 concept |
| worthiness | E12 | 문서 일부만 concept 감 | 알맹이만 추출 | 노이즈까지 concept화 |
| 부정/적대 | E7 | 정보 부족·모호 | 추측 말고 질문/보류 | 빈칸 추측 채움 |
| 부정/적대 | E8 | 기존과 모순이나 결정 reversal 아님 | contradiction 플래그 | 조용히 덮어쓰기 |
| 부정/적대 | E9 | 없는 concept 참조 | 생성하거나 플래그 | dangling 링크 |
| 멱등 | E10 | 같은 산출물 재-ingest | no-op 제안 | 중복 생성 |
| 재사용 | E11 | 디자인시스템 등 공통자산 | commons reference 링크(D6) | 재구현 |
| 정합성 | E14 | 임의 산출물 | 변경안이 okf-lint self-check 통과(깨진링크·필수필드·supersession 위반 0) | 린트 실패 변경안 반환 |

채점 = (a) 루브릭 MUST/MUST NOT 사람 또는 judge sub-agent + (b) 변경안 okf-lint 통과(결정적). eval 프레임워크는 만들지 않는다(과설계 회피) — 시나리오는 마크다운 파일, **실패를 발견할 때마다 추가하는 성장형**.

## 7. 열린 질문 (D' 한정) — 각 초기 기본값 채택

- **DA-Q1 변경안 전달 형식**: 대화창 inline vs `wiki/.proposed/` 스테이징 파일(실제 파일 diff 검토). → **초기 inline — 단, 전체 파일이 아니라 "변경 내역(요약/diff)"만 제시**(무엇이 생성/갱신/대체되는지). 변경 규모가 커지면 스테이징으로 승급. (전체 content는 `operations[].content`에 있고, H는 승인 시 그걸 write; 사람에겐 diff만 보임.)
- **DA-Q2 영향 concept 탐지**: id/링크 매칭(이름 다르면 놓침) vs **agent가 `index.md`를 읽어 의미 판단** vs 검색 도구. → **초기 index.md 기반 의미 판단**(D'가 어차피 LLM, 임베딩 인프라 불필요). 카탈로그가 ~100페이지를 넘어 한 번에 못 읽을 만큼 커지면 **QMD(Quick Markdown Search) 등 마크다운 검색 도구** 도입 검토(임베딩보다 이 wiki 구조에 자연스러움).
- **DA-Q3 traces(REQ-ID) 자동 결선**: → **raw에 REQ-ID가 명시된 경우만 자동 결선, 추론 금지**(틀린 추적성은 없느니만 못함).

## 8. 후속

- **H (`/ingest`)**: D'를 호출하는 얇은 스킬(트리거+inline 승인+기록). 본 D' 완료 후 spec→plan.
- 트리거 ①(define-screen/on-confirm)도 D'를 호출하도록 정렬.
