# ADR-0002. runner 서버를 없애고 web 에서 샌드박스를 부른다

- 상태: 채택
- 날짜: 2026-09-15
- 관련: `packages/sandbox/run.ts`, `apps/web/src/lib/notifications/pull-request-job.ts`, `apps/web/src/lib/notifications/pr-test-run.ts`, `apps/web/src/lib/notifications/test-run-queue.ts`, `apps/web/src/lib/notifications/test-run-rules.ts`, `apps/web/src/app/api/internal/pr-test-run/route.ts` (`runner-client.ts` 는 커밋 6bfa147, `apps/runner` 는 커밋 9eb7b21 에서 지웠다)
- 이어받는 결정: [ADR-0001](./0001-test-runtime.md) (실행 환경은 Vercel Sandbox)

## 배경

ADR-0001 은 "테스트를 **어떤 샌드박스에서** 돌리나" 를 정했다. "그 샌드박스를 **누가 부르나**" 는 따로 따지지 않았고, 원래 있던 `apps/runner`(Fastify 서버) 가 그 역할을 그대로 이어받았다.

지금 구조는 이렇다.

```
GitHub 웹훅 → web(after) ──HTTP──▶ runner 서버 ──SDK──▶ Vercel Sandbox
               결과 대기            큐(1개), 결과 대기       클론·install·test
```

배포하려고 보니 runner 서버가 하는 일이 거의 없다.

1. **격리는 샌드박스가 한다.** runner 는 사용자 코드를 직접 돌리지 않는다. 별도 서버로 떼어 둘 보안상 이유가 없다.
2. **web 도 이미 기다린다.** `pull-request-job.ts` 는 `after()` 안에서 runner 응답이 올 때까지 함수를 붙잡고 있다. runner 는 요청을 한 번 더 넘길 뿐이다.
3. **배포·인증이 하나 더 생긴다.** runner 를 Railway 등에 올리면 서버 비용, Docker 이미지, `RUNNER_URL`/`RUNNER_SECRET`, 그리고 Vercel 팀 범위 토큰을 따로 관리해야 한다. web 은 Vercel 에 있어서 OIDC 토큰이 자동으로 들어온다.
4. **동시 실행 규칙이 제품 요구와 안 맞는다.** `queue.ts` 는 Hobby 플랜 동시 실행 수에 맞춰 전역에서 하나씩 돌린다. 여러 팀이 쓰면 한 팀의 실행이 다른 팀을 막는다.

## 요구사항

- 배포해서 여러 팀이 쓴다. 사용자는 Vercel 계정이 없다. 샌드박스는 우리 Vercel 팀(Pro) 계정으로 만들고 요금도 우리가 낸다.
- **같은 팀 안에서는 테스트 실행을 한 번에 하나씩** 돌린다.
- **다른 팀끼리는 병렬로** 돌린다.
- 샌드박스는 테스트를 실행할 때만 뜬다. AI 테스트 생성은 샌드박스를 쓰지 않으므로 이 규칙에 묶이지 않는다.

## 선택지

### 1. runner 서버 유지 (Railway + Docker)

`queue.ts` 를 팀별 큐(`Map<teamId, queue>`)로 바꾸고, 요청에 `teamId` 를 싣는다.

- 코드 변경이 가장 적다
- 큐가 프로세스 메모리에 있어서 인스턴스를 하나로 고정해야 한다
- Railway 서버·이미지·시크릿을 따로 운영한다. Vercel 팀 범위 토큰을 발급받아 넣어야 한다
- web 도 runner 도 둘 다 결과를 기다리므로, 한 실행이 두 곳의 시간을 쓴다

### 2. web 에서 샌드박스를 바로 부른다

`run.ts` 를 패키지로 옮기고 web 이 함수로 부른다. 팀 단위 직렬 실행은 DB 로 막는다.

- 배포 대상이 web 하나다. 인증은 OIDC 로 끝난다
- 서버리스라 인스턴스가 여러 개다. 메모리 큐가 안 통하므로 DB 로 직렬을 보장해야 한다
- 실행 시간이 Vercel Functions 의 `maxDuration` 에 묶인다

## 결정

**2번을 쓴다.**

1. runner 가 격리에 기여하는 것이 없고, 서버를 하나 더 두는 비용(운영·시크릿·토큰 발급)만 남는다.
2. 1번의 "인스턴스 하나" 전제는 서비스로 키울 때 먼저 깨지는 부분이다. DB 기반 직렬은 어차피 필요해진다.
3. 실행 시간 제약은 1번에도 이미 있다. web 이 `after()` 안에서 runner 를 기다리기 때문이다. 서버를 없앤다고 새로 생기는 제약이 아니다.
4. ADR-0001 의 경계("샌드박스 제공자를 갈아끼워도 web 은 그대로")는 **HTTP 서버가 아니라 패키지 함수 하나**로 지킨다.

## 설계

### 실행 코드의 위치

- `apps/runner/src/run.ts`, `report.ts` 와 테스트를 `packages/` 아래 패키지로 옮긴다.
- 이 패키지는 DB 를 모른다. 요청(레포·테스트 파일·커맨드·타임아웃)을 받아 결과를 돌려준다. ADR-0001 에서 runner 가 지키던 규칙을 그대로 가져간다.
- web 은 `callRunner`(HTTP) 대신 이 함수를 부른다. `RUNNER_URL`/`RUNNER_SECRET` 은 없앤다.
- 인증: 배포 환경은 OIDC 자동 주입. 로컬은 `VERCEL_TOKEN`/`VERCEL_TEAM_ID`/`VERCEL_PROJECT_ID` 를 쓴다(Vercel 팀 뷰어는 `vercel env pull` 로 OIDC 토큰을 받을 수 없다).

### 팀 단위 직렬 실행

PR 작업의 흐름을 "생성" 과 "실행" 두 단계로 나눈다. 잠그는 것은 실행 단계뿐이다.

```
queued ─▶ running(생성) ─▶ awaiting_run ─┬─▶ running(실행) ─▶ done / failed
                                          │
                        같은 팀 실행 중이면 └─ 대기 (함수 종료)
```

1. **생성**: 락 없이 돈다. 끝나면 `awaiting_run` 으로 둔다.
2. **실행 자리 잡기**: 짧은 트랜잭션 안에서 `pg_advisory_xact_lock(teamId 해시)` 를 잡고, 같은 팀(`project.teamId`)에 실행 중인 작업이 있는지 본다.
   - 없으면 이 작업을 실행 중으로 바꾸고 트랜잭션을 끝낸 뒤 샌드박스를 띄운다.
   - 있으면 `awaiting_run` 그대로 두고 함수를 끝낸다.
   - 락은 확인·표시하는 동안만 잡는다. 샌드박스가 도는 몇 분 동안 트랜잭션을 열어 두지 않는다.
3. **다음 작업 넘기기**: 실행이 끝나면 같은 팀의 가장 오래된 `awaiting_run` 을 **내부 API 호출로 새 함수에서** 시작한다. `after()` 로 이어 붙이면 앞 함수의 `maxDuration` 안에서 돌게 되어 대기열이 길수록 잘린다.
4. **죽은 작업 넘기기**: 함수가 중간에 죽으면 실행 중 표시가 남는다. 시작 시각이 실행 상한보다 오래된 작업은 죽은 것으로 보고 자리 잡기에서 무시한다. 넘겨받을 함수가 없어 대기열이 멈추는 경우는, 새 작업이 들어올 때나 Re-run 이 눌릴 때 자리 잡기를 다시 시도해서 푼다.

`PullRequestJob.status` 는 문자열 컬럼이라 상태를 늘리는 데 마이그레이션이 필요 없다. "실행 중인 작업" 을 생성 단계의 `running` 과 구분할 방법(상태값 분리 또는 컬럼)은 구현에서 정한다.

대시보드의 수동 실행(`TestRun`)이 샌드박스를 쓰게 되면 같은 자리 잡기를 거친다.

### 실행 시간 상한

2026-09-15 기준 Vercel 한도.

|                       | Pro                                      |
| --------------------- | ---------------------------------------- |
| Functions 기본 / 최대 | 300초 / 800초 (1800초 베타, 함수별 설정) |
| Sandbox 동시 실행     | 10,000                                   |
| Sandbox 세션 최대     | 24시간                                   |

- 지금 web 라우트에는 `maxDuration` 설정이 없다. 즉 웹훅 뒤의 생성과 실행을 합쳐 **300초**가 상한이고, 이 상태로도 실행이 잘릴 수 있다.
- 생성과 실행을 다른 함수에서 돌리므로 각자 상한을 따로 쓴다.
- 실행 함수의 상한은 800초로 둔다. runner 가 쓰던 "명령 최대 15분 + 샌드박스 여유 1분" 은 800초를 넘으므로 명령 상한을 줄인다(구체 값은 구현에서 정한다). 더 길게 필요해지면 1800초 베타를 검토한다.
- 동시 실행 10,000 이라 팀끼리의 병렬은 사실상 플랜에 막히지 않는다.

## 결과

- `apps/runner`(Dockerfile 포함)를 지운다. README 인프라 표, `.env.example`, `pnpm-workspace.yaml` 을 고친다.
- web 에 `@vercel/sandbox` 의존성이 생긴다.
- `queue.ts` 의 전역 직렬은 사라지고, 팀 단위 직렬로 대체된다.
- 배포는 web 하나다. Railway 는 쓰지 않는다.

## 뒤집을 수 있는가

있다. 실행은 패키지 함수 하나로 모여 있으므로, 샌드박스 제공자를 바꾸거나 나중에 다시 별도 서버로 떼어도 web 의 호출부와 직렬 규칙은 그대로다.

대기열이 길어져 "내부 API 호출로 넘기기" 가 자주 끊기면 Vercel Queues/Workflows 같은 외부 큐로 옮기는 것을 다시 판단한다.

## 현재 구현 (2026-09-19, main 041609d 기준)

설계대로 된 것

- `run.ts`·`report.ts` 와 테스트는 `packages/sandbox` 로 옮겼고(커밋 0d4e9f7), DB 를 모른다(`packages/sandbox/run.ts:10-15`). `apps/runner` 는 지웠다(커밋 9eb7b21). `RUNNER_URL`·`RUNNER_SECRET` 은 코드·`.env.example` 어디에도 남지 않았다.
- 로컬 인증은 `VERCEL_TOKEN`·`VERCEL_TEAM_ID`·`VERCEL_PROJECT_ID` 세 값이다(`packages/sandbox/run.ts:292-298`, `.env.example:73-78`). 인증이 없으면 실행을 건너뛴다(`packages/sandbox/run.ts:96-99`, `apps/web/src/lib/notifications/pr-test-run.ts:41`).
- 생성 끝 상태는 `awaiting_run` 이다(`apps/web/src/lib/notifications/pull-request-job.ts:509`). 자리 잡기는 짧은 트랜잭션 안의 `pg_advisory_xact_lock` 이고, 락 키는 `hashtext('pr-test-run:<teamId>')` 다(`apps/web/src/lib/notifications/test-run-queue.ts:50-60`). 차례는 `awaiting_run` 중 `updatedAt` 이 오래된 순이다(`test-run-queue.ts:83-87`).
- 다음 작업은 내부 API `POST /api/internal/pr-test-run` 으로 새 함수에서 시작한다(`test-run-queue.ts:106-122`). 받는 쪽은 202 를 먼저 돌려주고 `after()` 로 실행한다(`apps/web/src/app/api/internal/pr-test-run/route.ts:34-40`). 요청은 `GITHUB_APP_WEBHOOK_SECRET` 으로 작업 ID·만료(5분)를 HMAC 서명한다(`apps/web/src/lib/notifications/test-run-rules.ts:55-89`). 부를 주소는 `INTERNAL_APP_URL` 이 우선이다(`test-run-queue.ts:131-144`).
- `maxDuration = 800` 을 웹훅(생성, `apps/web/src/app/api/github/webhook/route.ts:19`), 내부 실행(`apps/web/src/app/api/internal/pr-test-run/route.ts:13`), 실시간 실행(`apps/web/src/app/api/projects/[projectRef]/runs/live/route.ts:15`) 라우트에 둔다. 설정·PR 화면 두 곳에도 같은 값이 있다(`apps/web/src/app/project/[projectRef]/settings/notifications/page.tsx:31`, `apps/web/src/app/project/[projectRef]/pull/[prNumber]/page.tsx:16`). "설정 없음 = 300초" 는 더 이상 해당하지 않는다.
- `queue.ts` 는 `apps/runner` 와 함께 지웠다(커밋 9eb7b21).

설계와 다른 것

- 실행 중 상태값은 `testing` 으로 정했다. 생성 쪽 `running` 과 상태값으로 나눴다(`packages/db/prisma/schema.prisma:655-657`, `apps/web/src/lib/notifications/pull-request-job.ts:55`). 생성이 넘기는 값은 `runInput`, 실행 시작 시각은 `runStartedAt` 컬럼에 둔다(`packages/db/prisma/schema.prisma:671`, `:673`).
- 명령 상한은 기본 5분, 최대 10분이고, 명령마다가 아니라 전체 마감에서 남은 시간을 준다. 샌드박스 수명은 여기에 1분을 더한다(`packages/sandbox/run.ts:18`, `:26`, `:107-111`, `:139`). Runtime 탭도 10분까지만 받고, 예전에 15분으로 저장된 값은 10분으로 접는다(`apps/web/src/lib/projects/runtime.ts:25-29`, `:89`).
- 죽은 작업은 "무시" 하지 않고, 자리 잡기 트랜잭션 안에서 `failed` 로 닫는다. 기준은 `runStartedAt` 이 15분 넘은 `testing` 이다(`apps/web/src/lib/notifications/test-run-rules.ts:47-53`, `test-run-queue.ts:67-79`). 새 작업·Re-run 은 15분 넘게 멈춘 진행 중 작업도 다시 `queued` 로 되돌린다(`apps/web/src/lib/notifications/pull-request-job.ts:128-132`).
- 자리 잡기를 다시 시도하는 때는 "새 작업이 들어올 때" 가 아니라 그 작업의 생성이 끝났을 때와 앞 실행이 끝났을 때다(`pull-request-job.ts:178-179`, `:233-235`). 넘기는 요청이 실패하면 작업을 `awaiting_run` 으로 되돌린다(`test-run-queue.ts:29-40`).
- `@vercel/sandbox` 의존성은 web 이 아니라 `packages/sandbox` 에 있다(`packages/sandbox/package.json:16`). web 은 `@dante/sandbox` 만 의존한다(`apps/web/package.json:19`).
- `pnpm-workspace.yaml` 은 `apps/*` 글롭이라 고치지 않았다(`pnpm-workspace.yaml:2`).

아직 안 된 것

- 대시보드 수동 실행(`TestRun`)은 이미 샌드박스를 쓰지만(`apps/web/src/app/api/projects/[projectRef]/runs/live/route.ts:85`) 자리 잡기를 거치지 않는다. 줄은 `PullRequestJob` 만 본다(`test-run-queue.ts:62-65`). [ADR-0003](./0003-dante-provided-test-toolkit.md) 의 "미해결: 팀 단위 직렬" 과 같은 문제다.

## 참고

- [Vercel Functions 실행 시간](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel Sandbox 요금·쿼터](https://vercel.com/docs/sandbox/pricing)
