# spec-author eval 결과 (2026-06-27)

채점: 정합성(okf-lint) + 루브릭(judge sub-agent). 코어 8/8 통과.
**정합성 주의:** 에이전트 self-check 자기보고는 신뢰 불가(E03 1차가 증명) — 외부 게이트가 진실. "독립검증" 표기만 신뢰.

| 시나리오 | 정합성(okf-lint) | 루브릭(judge) | 종합 |
|---|---|---|---|
| E01 대체 | self-report OK | ✅ PASS | ✅ |
| E02 생성 | self-report OK | ✅ PASS | ✅ |
| E03 레거시SQL | ✅ **독립검증 OK** (재실행) | ✅ PASS | ✅ |
| E04 worthy:false | n/a (0 ops) | ✅ PASS | ✅ |
| E05 정제 | self-report OK | ✅ PASS | ✅ |
| E06 process | self-report OK | ✅ PASS | ✅ |
| E10 멱등 | n/a (0 ops, no-op) | ✅ PASS | ✅ |
| E14 정합성 | ✅ 독립검증 OK | ✅ PASS | ✅ |

## 발견 (Task 4 산출)

1. **에이전트 self-check 신뢰 불가** — E03 1차가 "okf-lint OK"라 보고했으나 독립검증은 exit 1(broken link). 자기보고로 정합성을 갈음 금지. **외부 okf-lint 게이트가 진실**(설계 DA5 백스톱이 작동함을 입증 — D'가 틀려도 게이트가 잡음).
2. **E03 시나리오 underspecified(해결)** — query가 `[[entities/member]]`를 링크하는데 member entity 부재로 깨짐. wiki-before에 entities/member 추가 → 재실행 → 독립검증 OK.

## 후속 (비차단)

- **정합성 독립 재검**: E01/E02/E05/E06은 아직 에이전트 self-report만 신뢰한 상태. 엄밀히는 독립 재검 권장(self-report 신뢰 불가 판명).
- **D' 프롬프트 보강**: self-check 시 stub 날조 금지(오직 wiki-before+제안만 펼침), 링크 대상 부재 시 생성 또는 링크 제외 — 명문화.
- **성장 backlog 시나리오**: E07(모호→질문)·E08(충돌≠reversal)·E09(dangling)·E11(commons 재사용)·E12(부분 worthy)·E13(process 과추출 금지).
