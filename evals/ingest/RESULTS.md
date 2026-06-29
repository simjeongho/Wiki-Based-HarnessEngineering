# `/ingest` eval 결과 (2026-06-29)

채점: 결정적 트랙(미반영 판정·pre-pass·기록 후 okf-lint **독립 재검**) + 루브릭 트랙(controller 판정). **코어 4/4 통과.**

증류는 실제 `spec-author` 에이전트를 dispatch해 수신, 제안 content를 스크래치패드 샌드박스 번들에 펼쳐 `node tools/okf-lint/src/cli.js <샌드박스>/wiki`로 **독립 재검**(에이전트 self-check 자기보고와 별개).

| 시나리오 | 결정적 (okf-lint 독립) | 루브릭 | 종합 |
|---|---|---|---|
| H1 미반영 판정 | ✅ order·pay-api 증류 OK, member 제외 | ✅ PASS | ✅ |
| H3 pre-pass 오배치 | n/a (증류 전 단계) | ✅ PASS (스킬 인코딩) | ✅ |
| H5 worthy:false | ✅ password-rule OK / standup 0 ops | ✅ PASS | ✅ |
| H7 기록 정합성 | ✅ 전체 번들 OK (member+pay-api+order+password-rule) | ✅ PASS | ✅ |

## 시나리오별 근거

- **H1**: 미반영 = {order, pay-api}. spec-author가 둘 다 `worthy:true`로 증류, member(이미 `sources`에 `raw/data-models/member.md` 보유)는 대상에서 제외. HA2(sources 스캔) 판정 정확.
- **H3**: pre-pass는 증류 *전* 단계라 spec-author dispatch 없음. 스킬 [2]가 (a) 폴더↔내용 매핑 점검, (b) 불일치만 보고, (c) raw 이동 금지, (d) 사람 확인을 인코딩함을 확인. **live 행동 확인은 e2e verify(plan Task3 Step2)에서.**
- **H5**: standup → `worthy:false` + skip_reason("현황/일정만, 지속적 지식 없음") — concept 억지 생성 안 함. password-rule → `policies/password-rule` 생성(독립 lint OK). 배치가 standup 때문에 끊기지 않고 password-rule 처리.
- **H7**: `entities/order` 생성 — 필수필드 + sources(raw/data-models/order.md) + `[[entities/member]]` 링크(member 존재 → 안 깨짐) + status enum. 기록 후 **전체 번들 독립 okf-lint: OK**(exit 0) = HA7 게이트 통과(자기보고 아님).

## 발견

1. **spec-author 추측 금지 규칙 작동** — 4건 모두 raw에 없는 `owner`·`traces`·날짜를 추측해 채우지 않고 rationale에 "확인 필요"로 표기. (pay-api는 template 기본 owner 유지하며 확인 필요 명시.)
2. **하드닝된 self-check 정직성 유지** — 4건 모두 self-check 시 "임시 번들에 펼친 파일 목록 + okf-lint 종료코드"를 사실대로 보고. 독립 재검과 일치(E03 같은 자기보고 불일치 재발 없음).
3. **dangling 방지 작동** — 빈 그래프(pay-api·password-rule)에서 `related` 링크 대상이 없자 링크를 생략(억지 stub 생성 안 함).

## e2e verify (plan Task3 Step2) — ✅ 완료

실제 repo(클린 슬레이트)에서 `/ingest` 라이브 1회 실행. fixture 3건(member·order 데이터모델 + standup 회의록):

- **스캔**: wiki 비어 있음 → 3건 전부 미반영 판정 (정확).
- **pre-pass**: 셋 다 폴더↔내용 일치 → 무소음 통과 (오배치 보고 없음 — 정상).
- **배치 루프(순차)**: member → order(member FK 역링크, member 먼저 기록돼 링크 안 깨짐) → standup `worthy:false` skip(raw 보존).
- **기록**: `wiki/entities/{member,order}.md` + `index.md`(ingest표 2행 + entities 카탈로그 2줄) + `log/2026-06-29.md`. 제안 JSON은 `runs/*.json`.
- **게이트**: `node tools/okf-lint/src/cli.js wiki` → `okf-lint: OK` (실제 실행, HA7).
- **2커밋 보존**: 스냅샷 `b4164a8`(산출물 박제) → 원복 `80ef9a8`(작업트리 clean). 원복 후 재-lint `okf-lint: OK`(찌꺼기 0). `git show b4164a8`로 산출물 영구 확인 가능.

## 후속 (비차단)

- 성장 backlog 시나리오: H2(미반영 0건)·H4(pre-pass 정상 무소음)·H6(승인 거절 시 변경 0)·H8(배치 순차성) — 실패 모드 만날 때 추가.
