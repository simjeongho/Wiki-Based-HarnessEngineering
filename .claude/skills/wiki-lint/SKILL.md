---
name: wiki-lint
description: wiki 그래프를 순회하며 의미적 모순·orphan·출처무결성을 진단해 비차단 리포트(reports/wiki-lint/<날짜>.md)로 남긴다. 야간 배치 또는 수동 호출. okf-lint(구조 게이트) 통과를 전제로 그 위 의미 계층만 본다.
---

# `/wiki-lint` — wiki 그래프 의미 진단 (비차단)

너는 `/wiki-lint` 스킬이다. `wiki/` 전체를 링크 그래프로 순회해 **의미적 모순·고립(orphan)·출처 무결성**을 진단하고, 그 결과를 `reports/wiki-lint/<YYYY-MM-DD>.md`에만 기록한다. 너는 **비차단 advisory 진단기**다 — 머지를 차단하지 않고, wiki/raw/index/log를 절대 쓰지 않는다. 발견은 다음날 사람/AI가 `/ingest`(H) 또는 operate(G) 루프로 처리한다.

> 설계 근거: `docs/superpowers/specs/2026-06-29-wiki-lint-design.md`. 스키마·불변규칙: 루트 `CLAUDE.md`. 링크 추출 선례: `tools/okf-lint/src/links.js`(`extractLinks`).

**전제:** `okf-lint`(결정적 구조 게이트)가 이미 통과했다고 가정한다. 깨진 링크·필수 frontmatter·enum·폴더매핑은 okf-lint 소관 — wiki-lint는 **그 위의 의미·판단 계층만** 본다.

**절대 규칙:**
- `wiki/`·`raw/`·`index.md`·`log/`에 **절대 쓰지 않는다**(FA6·불변규칙).
- **유일한 쓰기 대상**: `reports/wiki-lint/<YYYY-MM-DD>.md`.
- okf-lint가 잡는 구조 검사(깨진 링크·필수필드·enum)를 **중복하지 않는다** — 통과 전제.
- 모순은 **근거 인용 필수** — 추측·모호 보고 금지. 확신 없으면 보고하지 않는다(false-positive 회피).
- `superseded_by`/`supersedes`로 연결된 쌍은 **모순에서 제외**한다(FA3 — 의도된 old↔new 대체).
- 모호하면 추측하지 말고 사람에게 묻는다.

---

## [1] 그래프 구성

1. `wiki/**/*.md`의 모든 파일을 열거한다 = **노드 목록**. (스캔 대상은 프로젝트 `wiki/`만; `commons-wiki/`는 링크 해소 컨텍스트로 사용하되 1차 스캔 대상 아님.)
2. 각 노드의 frontmatter와 본문을 읽어 **엣지**를 수집한다. `tools/okf-lint/src/links.js`의 `extractLinks` 선례와 동일:
   - frontmatter `related`, `supersedes`, `superseded_by` 필드의 `[[폴더/id]]` 값
   - 본문의 `[[폴더/id]]` 패턴
   - 두 종류 모두를 엣지로 취급한다.
3. 엣지 목록을 기반으로 각 노드의 **인바운드 링크 수**를 집계한다(orphan 판단용). (이때 `commons-wiki/` 문서에서 프로젝트 `wiki/` concept을 가리키는 `[[폴더/id]]` 링크도 인바운드로 집계한다 — commons-wiki는 스캔 노드가 아니지만 인바운드 출처로는 유효하므로, commons-wiki에서만 링크된 concept을 orphan으로 오판하지 않는다.)
4. **supersession 엣지**(`superseded_by`/`supersedes`)를 별도 표시해 [2-모순]에서 건너뛸 수 있게 한다.

> 이 단계에서 파일을 쓰지 않는다. 읽기 전용.

## [2] 탐지기 순회

### [2-A] 모순(contradiction) — 링크 그래프 LLM 크롤러 (FA2/FA3)

각 노드 N에 대해:

1. N의 **1-hop 이웃 목록**을 구한다(N에서 나가는 엣지 + N으로 들어오는 엣지의 상대 노드).
2. **supersession 엣지로 연결된 이웃은 이 노드에 대해 건너뛴다**(FA3 — `superseded_by`/`supersedes` 관계인 쌍은 의도된 대체이므로 모순으로 판정 금지).
3. N + 남은 1-hop 이웃들의 내용을 LLM 컨텍스트에 올려 **"이웃 간 상충하는 사실·규칙이 있는가?"** 를 판정한다. 판정 기준:
   - 같은 식별자나 상태값을 서로 다르게 정의하는가 (예: enum 값이 한쪽에는 있고 다른 쪽에는 없는데 다른 쪽이 그 값을 전제하는가).
   - 같은 규칙에 다른 수치·조건을 명시하는가.
4. 상충이 **명확한 근거와 함께** 확인될 때만 보고한다. 근거 인용 없이 "가능성 있음" 수준으로 보고하지 않는다. 확신이 없으면 보고하지 않는다(false-positive 회피).
5. 보고 단위 = 상충 **쌍** + 양쪽에서 인용한 근거 텍스트.

> 중복 방지: N과 M의 쌍은 한 번만 보고한다(N→M을 처리했으면 M→N은 건너뜀).

### [2-B] orphan — LLM 판단 (FA4)

1. 인바운드 `[[ ]]` 링크 수가 **0**인 노드를 후보(candidate)로 모은다.
2. 각 후보에 대해 **정당 root인가?** 를 LLM이 판단해 제외한다:
   - `type: capability`인 노드 — SPINE 허브는 설계상 root(다른 concept이 링크되지 않아도 정당).
   - `index.md`에서 직접 `[[폴더/id]]` 형태로 링크된 노드 — index 진입점 역할을 하므로 orphan이 아닌 정당 root로 간주한다(판단 시 `index.md`를 반드시 확인한다).
   - 허브이거나 index 진입점으로만 접근되는 최상위 concept.
3. 정당 root가 아닌 것만 **진짜 orphan**으로 보고한다.

### [2-C] 출처 무결성(source integrity) — 결정적 (FA5)

1. 각 노드의 frontmatter `sources` 배열을 순회한다.
2. `sources[].path`가 가리키는 파일이 **디스크에 실제 존재**하는지 확인한다(raw 이동·삭제 탐지).
3. 존재하지 않으면 dangling으로 보고한다.
4. `sources`가 **비어있는 경우**는 보고하지 않는다 — 이는 okf-lint 소관(중복 금지).

## [3] 리포트 작성 (FA6/FA7)

1. 오늘 날짜를 `YYYY-MM-DD` 형식으로 구한다.
2. `reports/wiki-lint/` 디렉터리를 생성한다(없으면).
3. `reports/wiki-lint/<YYYY-MM-DD>.md`를 **spec §6 형식**으로 작성한다:

```
# wiki-lint 리포트 — <YYYY-MM-DD>
## 요약: 모순 N · orphan M · 출처누락 K

## 모순 (contradiction)
- [[<폴더/id-A>]] ↔ [[<폴더/id-B>]]
  <모순 설명 한 줄>
  근거: <A 인용> ↔ <B 인용>

## orphan
- [[<폴더/id>]] — 인바운드 0, <허브 아닌 이유> → 고립

## 출처 누락 (source integrity)
- [[<폴더/id>]] — sources[<n>].path=<경로> 디스크에 없음

## 처리 안내
다음날 사람/AI가 /ingest(반영) 또는 operate 루프로 처리. wiki-lint는 비차단 진단만.
```

4. **클린 그래프**(모순 0·orphan 0·출처누락 0)이면 `요약: 모순 0 · orphan 0 · 출처누락 0` 리포트를 작성한다(무결성 통과 확인용). 모든 섹션을 포함하되 각 섹션에 "발견 없음." 또는 항목 없음으로 표기한다.
5. 각 카테고리 섹션은 findings가 없어도 헤더만 남긴다(형식 고정).

> **쓰기 대상은 `reports/wiki-lint/<날짜>.md` 하나뿐이다.** `wiki/`·`raw/`·`index.md`·`log/` 절대 쓰지 않는다.

## [4] 비차단 종료

리포트를 작성하고 완료를 보고한다. 머지 차단 없음. 아무것도 수정하지 않는다.

완료 보고 형식:
```
wiki-lint 완료.
리포트: reports/wiki-lint/<YYYY-MM-DD>.md
요약: 모순 N · orphan M · 출처누락 K
(발견이 있으면: "다음날 /ingest 또는 operate로 처리하세요.")
```

---

## 경계 (하지 않는 것)

- 구조 검사(깨진 링크·필수필드·enum·폴더매핑) ❌ — okf-lint 소관(통과 전제).
- wiki/raw/index/log 쓰기·자동 수정 ❌ — 리포트만(FA6).
- cron 야간 배선 ❌ — 후속 얇은 단계(FA1).
- 코드 drift-check ❌ — 코드 동반 변경 별도(B).
- supersession 체인(superseded_by/supersedes) 모순 보고 ❌ — 의도된 대체(FA3).
- 근거 없는 추측 모순 보고 ❌ — 확신 없으면 침묵(false-positive 회피).
- spec-author·okf-lint 강제 호출 ❌ — 독립 진단.
