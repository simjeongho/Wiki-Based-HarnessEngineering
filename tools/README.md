# tools/

이 프로젝트의 결정적 검증·스캐폴드 도구. 각각 **독립 ESM 패키지**다 (루트 package.json 없음 — 디렉터리별로 명령 실행). 외부 의존성은 `okf-lint`의 `yaml` 하나뿐, 테스트는 Node 내장 러너(`node --test`)를 쓴다.

| 도구 | 역할 |
|------|------|
| `okf-lint` | OKF 번들 적합성 — 필수 frontmatter·enum·폴더↔타입·구조적 링크 유효성 (PR 게이트, 머지 차단) |
| `okf-init` | 신규 프로젝트 OKF 번들 스캐폴드 (`raw/ wiki/ log/ index.md`) |

## 실행

```bash
node tools/okf-lint/src/cli.js wiki                 # wiki 번들 린트 (exit 0=OK, 1=error, 2=루트 없음)
node tools/okf-init/src/cli.js <대상디렉터리>        # 신규 번들 스캐폴드
```

## 선행 (clone 직후 1회)

`okf-lint`는 `yaml`에 의존한다. 미설치 시 `ERR_MODULE_NOT_FOUND`로 lint·테스트가 전부 실패한다.

```bash
npm install --prefix tools/okf-lint
```

## 테스트

```bash
cd tools/okf-lint && node --test                                   # 전체
node --test tools/okf-lint/test/schema.test.js                     # 단일 파일
node --test --test-name-pattern="superseded_by" tools/okf-lint/test/schema.test.js   # 이름으로
cd tools/okf-init && node --test
```

## 주의

`okf-lint`의 enum·필수필드·폴더 매핑은 `tools/okf-lint/src/schema.js`(`CONCEPT_TYPES`·`STATUSES`·`LAYERS`·`FOLDER_TO_TYPE`·`REQUIRED_FIELDS`)가 **진실의 원천**이다. 루트 `CLAUDE.md` §3·§4 표와 어긋나면 코드가 맞다 — 표를 고친다.
