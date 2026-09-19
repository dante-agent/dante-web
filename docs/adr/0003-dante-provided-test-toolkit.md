# ADR-0003. 테스트 실행 환경은 Dante 가 전부 제공하고, 테스트 대상만 사용자 레포에서 가져온다

- 상태: 채택
- 날짜: 2026-09-16
- 관련: `packages/sandbox/live.ts`, `packages/sandbox/toolkit.ts`, `apps/web/src/app/api/projects/[projectRef]/runs/live/route.ts`, `apps/web/src/lib/projects/test-generation.ts`, `apps/web/src/lib/projects/test-generation-prompt.ts`, `apps/web/src/app/api/chat/route.ts`
- 이어받는 결정: [ADR-0001](./0001-test-runtime.md) (실행 환경은 Vercel Sandbox), [ADR-0002](./0002-run-sandbox-from-web.md) (web 이 샌드박스를 부른다)

## 배경

지금 실행은 "사용자 레포에 있는 설정 그대로" 돈다. 샌드박스에서 레포를 클론하고, 레포의 `install` 커맨드로 설치하고, 레포의 `test` 커맨드에 생성된 테스트 파일을 넘긴다. 테스트에 필요한 라이브러리는 레포 `package.json` 에 있어야 한다.

폴더 보기 실행 터미널을 붙이고 처음 돌린 레포(`junye0l/8around-sns`, 공개)에서 이게 깨졌다.

- 레포에는 `vitest` 만 있다. `@testing-library/react`·`@testing-library/user-event` 도, DOM 환경(`jsdom`·`happy-dom`)도 없다. `vitest.config.ts` 는 경로 별칭만 있어 환경이 node 다. 기존 테스트 16개 파일(68개)은 전부 `lib/` 아래 로직 테스트다.
- AI 가 만든 `components/auth/AuthPanels.test.tsx` 는 React 컴포넌트 테스트라 `@testing-library/react` 를 import 했다.
- 실행 결과: `Cannot find package '@testing-library/react'`. testing-library 를 빼더라도 DOM 환경이 없어 렌더링 테스트는 돌 수 없다.

그런데 Dante 의 목적은 **사용자가 레포에 테스트 라이브러리를 들이지 않아도** 테스트를 만들고 돌려 보게 하는 것이다. "레포에 없으면 못 돌린다" 는 이 목적과 반대다.

## 요구사항

- 테스트는 **Dante 안에서만** 실행하는 것을 전제로 한다. 사용자가 이 테스트를 자기 CI 에서 돌리는 경우는 지원 대상이 아니다.
- 사용자 레포는 바뀌지 않는다. 설치는 샌드박스 안에서만 하고, 샌드박스는 실행이 끝나면 버려진다.
- 온보딩에서 고른 러너(vitest·jest)를 따른다. jest 를 고른 프로젝트를 vitest 로 바꿔 돌리지 않는다.
- 적용 범위는 **폴더 보기 실행과 폴더 보기·추천 화면·AI 채팅의 테스트 생성 프롬프트**다.
- **PR 자동 테스트(`runTest`, `pr-test-run.ts`, `pull-request-job.ts`)는 바꾸지 않는다.** 다른 담당 영역이다.

## 선택지

### 1. 레포 그대로 (현행)

레포에 설치된 것만 쓴다. 프롬프트에 설치 패키지 목록을 넣어 AI 가 없는 걸 import 하지 않게 한다.

- 샌드박스 쪽 변경이 없다
- 테스트 도구가 없는 레포에서는 컴포넌트 테스트를 만들 수 없다
- 제품 목적과 맞지 않는다

### 2. 레포 러너 위에 도구만 끼워 넣는다

레포의 러너·설정은 그대로 쓰고, 부족한 테스트 도구만 레포 `node_modules` 에 저장하지 않는 설치로 추가한다.

- 러너·설정은 레포 것이라 레포마다 상황이 달라진다
- 패키지 매니저마다 "저장하지 않는 설치" 방식이 다르다(pnpm·Yarn)
- 레포의 오래된 러너, 이미 있는 다른 버전의 testing-library, 레포 설정의 `include`·`setupFiles` 와 부딪힌다
- 이 문서의 첫 초안이 이 방식이었고, 엣지 케이스 대부분이 여기서 나왔다

### 3. Dante 전용 실행 환경

러너·설정·테스트 도구를 **레포 밖의 Dante 폴더**에 두고, 레포에서는 테스트 대상(소스 코드와 소스가 쓰는 패키지)만 빌려 쓴다.

- 러너 버전·설정·도구가 항상 같다. 레포 러너·설정과 섞이지 않는다
- 도구는 npm 으로 Dante 폴더에 설치하므로 레포의 패키지 매니저와 무관하다
- 테스트 파일(레포 안)과 도구(Dante 폴더)를 서로 찾게 만드는 설정이 필요하다 — 아래 실험으로 확인했다
- 레포의 러너 설정(vite 플러그인 등)은 적용되지 않는다

## 결정

**3번을 쓴다.**

> 테스트를 돌리는 환경(러너, 설정, 테스트 도구)은 Dante 가 전부 제공하고, 테스트 대상(소스 코드와 소스가 쓰는 패키지)은 사용자 레포 것을 그대로 쓴다. 사용자 레포는 바뀌지 않고, 테스트는 Dante 에서만 실행하는 것을 전제로 한다.

1. 제품 목적이 "레포에 테스트 의존성을 들이지 않는다" 이므로 1번은 맞지 않는다.
2. 2번은 레포 러너·설정과 섞여서 레포마다 결과가 달라진다. 3번은 그 원인을 구조로 없앤다.
3. 환경을 고정하면 생성 프롬프트도 고정된다. AI 가 레포마다 무엇이 있는지 추측하지 않는다.
4. 샌드박스에서 실제로 돌려 성립을 확인했다(아래 "검증").

## 설계

### 누가 무엇을 제공하나

| Dante 가 제공                             | 사용자 레포에서 가져옴                                  |
| ----------------------------------------- | ------------------------------------------------------- |
| 러너(고정 버전)                           | 소스 코드                                               |
| 실행 설정                                 | 소스가 쓰는 패키지(React·Next 등, 레포 install 로 설치) |
| testing-library·user-event·jest-dom·jsdom | 경로 별칭(`tsconfig.json` 의 `paths`)                   |
| setup(매처 등록·테스트마다 화면 정리)     | React 버전(맞는 testing-library 를 고르는 기준)         |

### vitest 환경 (검증됨)

```
샌드박스 생성·클론 ─▶ 레포 install ─▶ Dante 도구 설치(/tmp/dante-toolkit) ─▶ Dante 설정으로 실행 ─▶ 리포트·정리
```

1. **도구 설치**: 레포 밖 폴더에 npm 으로 설치한다. 버전은 고정한다.
2. **React 한 벌**: npm 이 testing-library 의 peer 로 도구 폴더에 `react`·`react-dom`·`scheduler` 를 같이 설치한다. 그대로 두면 React 가 두 벌이 되어 `Invalid hook call` 이 난다. 도구 폴더의 것을 지우고 레포 것만 쓴다.
3. **Dante 설정** (도구 폴더에 둔다)
   - `root`: 레포
   - 별칭: `@/` 등 레포 `tsconfig` 의 `paths` → 레포 경로 / `@testing-library/*` → 도구 폴더 / `react`·`react-dom` → 레포 `node_modules`
   - `environment: "jsdom"`
   - `server.deps.inline: [/@testing-library/]` — node_modules 패키지는 기본으로 Node 가 직접 불러와 별칭이 안 먹는다. 도구는 변환 경로로 태운다.
   - `setupFiles`: `@testing-library/jest-dom/vitest` 등록, `afterEach(cleanup)`
4. **실행**: `NODE_PATH=<레포>/node_modules` 를 붙여 도구 폴더의 vitest 로 돌린다. testing-library 의 CJS `require("react")` 가 레포 React 를 찾게 하려는 것이다. 없으면 `Cannot find module 'react'`.
5. **리포트**: 기존과 같이 `--reporter=json --outputFile.json=...` 로 쓰고 `report.ts` 가 읽는다.

### jest 환경 (검증됨)

같은 구조다. jest 는 vitest 와 달리 설정이 직접 채워야 하는 것이 많다.

1. **도구 설치**: jest, jest-environment-jsdom, TS 변환기(`@swc/core`·`@swc/jest`), testing-library. React 삭제·`NODE_PATH` 는 필요 없다(아래 3).
2. **Dante 설정** (`jest.config.cjs`, 도구 폴더에 둔다 — 레포가 `"type": "module"` 이어도 CJS 로 읽힌다)
   - `rootDir`: 레포, `testEnvironment`·`transform` 은 도구 폴더 경로
   - `transform`: swc 로 TS/TSX, JSX 는 automatic 런타임
   - `moduleNameMapper` — **순서가 중요하다.** jest 는 위에서부터 처음 맞는 규칙을 쓴다.
     1. CSS·스타일 → 빈 모듈 스텁 (경로 별칭보다 먼저. 뒤에 두면 `@/index.css` 가 별칭에 걸려 CSS 를 JS 로 읽는다)
     2. `tsconfig` `paths` 별칭 (긴 키부터)
     3. `@testing-library/*` → 도구 폴더, `@jest/globals` → 도구 폴더
     4. `react`·`react-dom` → 레포 `node_modules`
   - `setupFilesAfterEnv`: `@testing-library/jest-dom`. 화면 정리는 jest 전역 `afterEach` 로 testing-library 가 스스로 한다.
3. **React 한 벌**: `moduleNameMapper` 는 node_modules 안의 `require` 에도 적용된다. 도구 폴더에 peer 로 React 가 깔려도 레포 것으로 간다.
4. **실행**: `jest --config <Dante 설정> --ci --json --outputFile=<리포트> --runTestsByPath <파일들>`

### 경로 별칭

`tsconfig.json` 에서 `paths` 를 읽는다. `extends`(상대 경로)와 `references` 를 따라간다 — Vite 템플릿은 루트가 `references` 만 두고 `paths` 는 `tsconfig.app.json` 에 있다. JSONC(주석·끝 쉼표)를 읽는다. 후보가 여럿이면 첫 번째, node_modules·레포 밖을 가리키는 별칭은 버린다(`packages/sandbox/toolkit.ts`).

### 생성 프롬프트

폴더 보기·추천 화면 생성(`generateTestForFile`)과 AI 채팅은 러너와 함께 "Dante 환경에서 쓸 수 있는 도구" 를 알린다. 도구 세트·레포 소스·레포에 설치된 패키지만 import 하게 한다.

## 검증 (2026-09-16, 샌드박스 실험)

### vitest 실험

대상: `junye0l/8around-sns` (npm, 단일 패키지, React 19.2.8, Next 16.3.4, vitest 4.1.11). 도구: vitest 4.1.11, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/user-event 14.6.7, @testing-library/jest-dom 7.0.1, jsdom 30.0.1.

| 시도                                           | 결과                                                 |
| ---------------------------------------------- | ---------------------------------------------------- |
| 도구 폴더 + 별칭 + jsdom                       | testing-library·jsdom·`@/` 해결, `Invalid hook call` |
| + 도구 폴더 React 삭제 + `NODE_PATH`           | 렌더링 성공. 매처 미등록·화면 정리 없음으로 3개 실패 |
| + setup 파일                                   | **AuthPanels 3/3 통과**                              |
| `NODE_PATH` 없이                               | `Cannot find module 'react'`                         |
| JSON 리포트                                    | total 3 / passed 3 / 파일 1                          |
| 레포 기존 로직 테스트, 레포 설정 vs Dante 설정 | 둘 다 16개 파일 68개 통과                            |
| 도구 설치 시간                                 | 약 15초                                              |
| 레포 변경                                      | 샌드박스 안에서도 추가한 테스트 파일 외 없음         |

### jest 실험

대상: `junye0l/hashsnap-test` (비공개, npm, Vite + React 19 SPA, `"type": "module"`, 테스트 도구·테스트 파일 없음, `paths` 는 `tsconfig.app.json`). 도구: jest 30.5.1, jest-environment-jsdom 30.5.1, @swc/core 1.16.2, @swc/jest 0.2.39, testing-library 는 vitest 와 같음.

| 시도                               | 결과                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| 도구 폴더 + swc + moduleNameMapper | 로직 테스트 3/3 통과. 컴포넌트 테스트는 `@/index.css` 가 별칭에 먼저 걸려 파싱 실패  |
| CSS 스텁을 별칭보다 앞으로         | **6/6 통과**(로직 3·컴포넌트 3: 확장자 포함 import, CSS import, 클릭, jest-dom 매처) |
| React                              | 도구 폴더 React 삭제·`NODE_PATH` 없이 레포 React 한 벌로 로드됨(스택으로 확인)       |
| 도구 설치 시간                     | 약 25~33초                                                                           |

npm 11 이 `@swc/core` 등의 install script 를 건너뛰었지만 swc 네이티브 바인딩과 jest 리졸버는 동작했다.

### 실제 실행 함수(`runTestLive`)로 확인

실험 스크립트가 아니라 구현한 함수를 그대로 샌드박스에 돌렸다(DB·앱 없이).

| 레포                                   | 러너   | 확인한 것                                                                                               | 결과                         |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `8around-sns`                          | vitest | 루트 `tsconfig` `paths` 자동 변환, AI 가 만든 컴포넌트 테스트                                           | 3/3 통과, 50초               |
| `hashsnap-test`                        | jest   | `references` 따라가 `tsconfig.app.json` 의 `paths` 자동 변환                                            | 6/6 통과, 41초               |
| `blog` (비공개, Next 16, React 19.0.0) | vitest | **레포에 vitest 가 없음**. `import from "vitest"`, 여러 `paths`+`baseUrl`, `next/link`, ESM 전용 패키지 | 2/2 통과, 47초               |
| `blog` (일부러 틀린 기대값)            | vitest | 실패가 error 가 아니라 failed 로, 실패 목록이 리포트로 나오는지                                         | failed, 1/2 실패·메시지 포함 |

저장용 로그(`TestRun.logs`)에 색 코드가 남지 않는 것도 네 번 모두 확인했다.

**확인한 범위**: npm, 단일 패키지, React 19. pnpm·Yarn·모노레포·React 18 은 확인하지 않았다.

## 해결하지 못하는 것 (엣지 케이스)

### 3번 설계로 사라진 것

2번(끼워 넣기)에서 문제였던 것들이다. Dante 가 러너·설정·도구를 따로 가지므로 해당하지 않는다.

- 패키지 매니저마다 다른 "저장하지 않는 설치"
- 레포에 이미 있는 오래된 러너, 다른 메이저의 testing-library
- 레포 러너 설정의 `include`·`exclude`·`setupFiles` 충돌

### 남는 한계 — 도구로 해결할 수 없다

| 경우                                                                              | 이유                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| JS/TS 가 아닌 레포                                                                | 환경이 Node 기반이다                                                                                    |
| React 가 아닌 UI (Vue·Svelte 등)                                                  | 도구 세트가 React 용이다                                                                                |
| 레포 install 실패                                                                 | 사설 레지스트리 토큰, lockfile 불일치, 네이티브 모듈, Node 버전. 소스 패키지는 레포 install 로만 얻는다 |
| Yarn Berry PnP                                                                    | `node_modules` 가 없어 `NODE_PATH`·별칭으로 React 를 찾을 수 없다                                       |
| Next.js 서버 컴포넌트(async), `next/navigation`·`next/image` 등 프레임워크 런타임 | jsdom 렌더링만으로는 돌지 않는다. AI 의 mock 으로만 우회된다                                            |
| import 시점에 환경 변수·DB·네트워크를 요구하는 코드                               | 샌드박스에 사용자 비밀값이 없다. mock 으로만 우회된다                                                   |

### 남는 한계 — 설계에서 생긴 것

| 경우                             | 이유                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 레포 러너 설정에 의존하는 코드   | Dante 설정만 쓰므로 레포의 vite 플러그인(SVG 컴포넌트 변환 등), `define`, 레포 setup 파일의 전역 mock·polyfill 이 적용되지 않는다                              |
| `tsconfig` 경로 별칭의 일부 형태 | `extends` 가 패키지(예: `@tsconfig/next`)를 가리키거나, 한 키에 후보가 여럿인 경우 첫 번째만 쓴다. 루트 `tsconfig.json` 이 없거나 다른 이름이면 별칭 없이 돈다 |
| React 17 이하                    | 도구의 testing-library 16 은 React 18·19 대상이다. 버전표를 두지 않으면 지원하지 않는다                                                                        |

### 확인 전 — 실험이 필요하다

| 경우        | 확인할 것                                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm        | 레포 루트 `node_modules` 의 심볼릭 링크 구조에서 `NODE_PATH`·별칭으로 React 를 찾는지                                                                                |
| 모노레포    | 소스가 속한 워크스페이스 기준으로 `root`·`tsconfig`·`NODE_PATH` 를 잡는 규칙. 루트에 `package.json` 이 없는 레포(예: `junye0l/techtab`)는 레포 install 부터 실패한다 |
| React 18    | testing-library 16 의 지원 범위 안이지만 실제로 돌려 보지 않았다                                                                                                     |
| 레포 테스트 | 레포에서 가져온 기존 테스트를 Dante 설정으로 돌린다. `8around-sns` 는 레포 설정과 결과가 같았지만, 레포 setup·플러그인에 기대는 테스트는 달라질 수 있다              |

### 제품 정책상 받아들인 차이

| 경우                                              | 결과                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 사용자가 테스트를 레포에 커밋해 자기 CI 에서 돌림 | 레포에 도구가 없어 실패한다. "Dante 에서만 실행" 이 전제라 지원하지 않는다. 커밋 기능을 붙일 때 화면에 알려야 한다  |
| 같은 테스트를 PR 자동 테스트가 돌림               | PR 경로는 레포 그대로라 폴더 보기에서 통과한 테스트가 PR 에서는 실패할 수 있다. 버그가 아니라 이 결정의 범위 차이다 |
| 실행 시간                                         | 도구 설치(약 15초)만큼 매 실행이 길어진다. 캐시가 없다                                                              |
| 공급망                                            | 실행마다 npm 레지스트리에서 받는다. 버전을 고정해 범위를 줄이지만 레지스트리 장애·오염의 영향은 받는다              |

## 결과

- `packages/sandbox/toolkit.ts`(도구 세트·경로 별칭·설정 파일 생성)와 `live.ts` 의 "Dante 도구 설치" 단계로 구현했다. `runTest`(PR 경로)는 그대로다.
- 폴더 보기 실행은 레포·Runtime 탭의 **테스트 커맨드를 쓰지 않는다**(Dante 설정으로 돈다). install 커맨드는 쓴다.
- 생성 프롬프트(폴더 보기·추천 화면)와 AI 채팅 시스템 프롬프트에 Dante 환경의 도구를 알린다. PR 경로(`pr-test-generation.ts`)는 기존 지시(설치 패키지 목록) 그대로 둔다.
- 폴더 보기 실행과 PR 자동 테스트의 실행 환경이 달라진다. 이 차이는 이 문서로 설명한다.

### 미해결: 팀 단위 직렬

ADR-0002 는 "대시보드의 수동 실행(`TestRun`)이 샌드박스를 쓰게 되면 같은 자리 잡기(팀 단위 직렬)를 거친다" 고 정했다. 폴더 보기 실시간 실행(`/runs/live`)은 지금 자리 잡기를 거치지 않고, 실행 중 버튼 비활성화로 한 화면에서 하나만 막는다. 같은 팀의 다른 사람·다른 탭·PR 자동 테스트와는 겹칠 수 있다. 이 규칙을 적용할지는 PR 경로 담당과 따로 정한다.

## 뒤집을 수 있는가

있다. Dante 환경은 샌드박스 실행 흐름의 한 단계(도구 설치)와 실행 커맨드·설정 파일, 프롬프트 한 줄이다. 되돌리면 1번(레포 그대로)이 된다.

도구 제공이 PR 자동 테스트에도 필요해지면, PR 경로 담당과 함께 `runTest` 에 같은 환경을 넣을지 다시 판단한다. 도구 설치 시간이 문제가 되면 도구가 미리 깔린 샌드박스 스냅샷을 검토한다.

## 현재 구현 (2026-09-19, main 041609d 기준)

설계대로 된 것

- 도구 폴더는 `/tmp/dante-toolkit`, 도구 버전은 "검증" 절의 버전으로 고정했다(`packages/sandbox/toolkit.ts:9-32`). vitest 는 도구 폴더의 React 를 지운다(`packages/sandbox/toolkit.ts:285-294`).
- vitest 설정(`root`·별칭·`jsdom`·`server.deps.inline`·`setupFiles`)과 `NODE_PATH`, jest 설정(CSS 스텁을 별칭보다 먼저 둔 `moduleNameMapper`·swc·`setupFilesAfterEnv`)이 설계와 같다(`packages/sandbox/toolkit.ts:197-278`).
- 실시간 실행은 install 커맨드는 쓰고 test 커맨드는 쓰지 않는다(`packages/sandbox/live.ts:108-115`, `:151-158`). PR 경로 `runTest` 에는 도구 설치 단계가 없다(`packages/sandbox/run.ts:156-181`).
- 폴더 보기·추천 화면 생성은 도구 안내를 켜고(`apps/web/src/lib/projects/test-generation.ts:75-76`, `apps/web/src/lib/projects/test-generation-prompt.ts:98-100`), AI 채팅 시스템 프롬프트도 같은 도구를 알린다(`apps/web/src/app/api/chat/route.ts:101`).

설계와 다른 것

- 실시간 실행(`/runs/live`)은 폴더 보기 터미널뿐 아니라 추천 세션 상세의 실행 패널도 쓴다(`apps/web/src/app/api/projects/[projectRef]/runs/live/route.ts:6-7`, `apps/web/src/app/project/[projectRef]/recommend/[session]/_components/test-run-panel.tsx:53`). 그래서 이 결정의 실행 범위도 두 화면이다.
- vitest setup 은 `@testing-library/react` 를 못 불러오면 화면 정리만 건너뛴다. React 가 없는 레포도 돌게 하려는 것이다(`packages/sandbox/toolkit.ts:221-229`). 채팅 프롬프트도 `@testing-library/react` 는 레포에 React 가 있어야 한다고 알린다(`apps/web/src/app/api/chat/route.ts:101`).
- vitest 는 JSON 리포트와 함께 기본 리포터도 켠다(`--reporter=default --reporter=json`, `packages/sandbox/toolkit.ts:234-237`).
- "검증" 절의 "저장용 로그에 색 코드가 남지 않는다" 는 지금과 다르다. 저장 로그는 색(SGR) 코드만 남기고 나머지 제어 코드를 뺀다(`packages/sandbox/live.ts:225-226`, `packages/sandbox/run.ts:241-247`, 커밋 d3df6ad).

아직 안 된 것

- 팀 단위 직렬은 여전히 미해결이다. `/runs/live` 는 자리 잡기 없이 `runTestLive` 를 부른다(`apps/web/src/app/api/projects/[projectRef]/runs/live/route.ts:85`). 폴더 보기는 실행 중 버튼을 막고(`apps/web/src/components/file-view.tsx:683`), 한 화면에서 새 실행을 시작하면 앞 요청을 끊는다(`apps/web/src/components/run-terminal.tsx:89`).

## 참고

- [Vitest 설정: `server.deps.inline`](https://vitest.dev/config/#server-deps-inline)
- [Vitest 테스트 환경](https://vitest.dev/guide/environment)
- [Testing Library React 설치](https://testing-library.com/docs/react-testing-library/intro)
- [jest-dom 과 Vitest](https://github.com/testing-library/jest-dom#with-vitest)
