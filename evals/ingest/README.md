# `/ingest` 스킬 eval + verify 스위트

`/ingest` 오케스트레이터가 **미반영 raw 스캔 → pre-pass 분류 가드 → spec-author 증류 → 사람 승인 → 원자적 기록 → okf-lint 게이트**를 제대로 도는지 고정한다. **TDD가 아니라 eval+verify 주도** — spec-author eval과 동형이되, /ingest는 디스크에 쓰므로 검증을 둘로 나눈다(spec `2026-06-29-ingest-skill.md` §6).

- **(A) eval (결정적 부분)**: 여기 `scenarios/*.md`. 미반영 판정·pre-pass 탐지·worthy 처리·기록 후 정합성을 채점.
- **(B) verify (승인 UX)**: 실제 repo end-to-end 수동 실행 (plan Task 3 Step 2, 2커밋 방식).

## 시나리오 형식

각 시나리오 = `scenarios/<id>.md` **파일 하나**. 아래 섹션을 fenced 블록으로:

- `## 사전 wiki (path: wiki/<폴더>/<id>.md)` — (선택) 사전 wiki 상태. **이미 반영된 raw는 그 concept의 `sources`로 표현**한다. 여러 개 가능.
- `## raw 배치` — raw/ 에 놓인 파일들(경로 + 내용). 미반영/이미반영/오배치가 섞일 수 있음.
- `## 호출` — 사람의 `/ingest` 호출 의도.
- `## 기대 (rubric)` — MUST / MUST NOT.

> 디렉터리 트리를 만들지 않는다(파일 폭발 방지). 실행 시 블록 내용을 스킬 흐름에 그대로 붙인다.

## 실행 (Inline + judge sub-agent)

1. **셋업(흉내)**: 시나리오의 `사전 wiki`·`raw 배치` 블록을 스크래치패드 임시 번들에 펼친다(실제 `wiki/` 안 건드림). `/ingest` 흐름을 그 번들 기준으로 수행.
2. **승인 흉내**: eval에선 controller가 worthy:true 제안을 **자동 승인**으로 흉내(사람 대역). 거절 시나리오(H6)만 거절.
3. **채점 — 결정적 트랙**:
   - 미반영 목록이 정확한가(이미 반영된 raw 제외)?
   - pre-pass가 오배치를 보고했는가(이동은 안 했는가)?
   - 기록 후 `node tools/okf-lint/src/cli.js <임시>/wiki` → `okf-lint: OK`(exit 0)인가? (HA7 — 자기보고 금지, 실제 실행)
4. **채점 — 루브릭 트랙**: `../spec-author/judge-prompt.md` 형식의 judge sub-agent(또는 사람)로 MUST/MUST NOT 채점.
5. 결과를 `RESULTS.md`에 1행 기록.

## 코어 시나리오 (4)

H1 미반영 판정 · H3 pre-pass 오배치 · H5 worthy:false 처리 · H7 기록 후 정합성.

**성장 backlog:** H2 미반영 0건 · H4 pre-pass 정상통과(무소음) · H6 승인 거절 · H8 배치 순차성. **실패 모드를 만나면 추가**(성장형). eval 러너 코드는 만들지 않는다 — 수동 + 기존 okf-lint 재사용.

## 원칙

- `/ingest`는 **`raw/`에 쓰지 않는다**(불변규칙 1). pre-pass는 오배치를 *보고*만, 이동 안 함.
- 승인 전 wiki 변경 금지. 게이트는 실제 okf-lint 실행이 진실.
- eval 중간 산출물(임시 번들·제안 JSON·judge 채점)은 스크래치패드에서 버린다. 영구 보존은 `scenarios/`·`RESULTS.md`뿐.
