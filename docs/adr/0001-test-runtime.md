# ADR-0001. 생성된 테스트를 어디서 실행할 것인가

- 상태: 채택 · 실행 위치(`apps/runner` 서버)는 [ADR-0002](./0002-run-sandbox-from-web.md) 로 대체
- 날짜: 2026-09-10
- 관련: `packages/sandbox`, `apps/web/src/app/project/[projectRef]/settings/runtime/page.tsx`, `apps/web/src/lib/projects/runtime.ts` (`apps/runner` 는 커밋 9eb7b21 에서 지웠다)

## 배경

dante 는 사용자 레포의 컴포넌트를 읽어 테스트 코드를 만들어 준다. 만든 것으로 끝나면 반쪽이다. 실제로 돌려서 통과/실패와 로그를 보여줘야 제품이 된다.

그 "돌리는 곳"이 아직 없다. `apps/runner` 는 `POST /runs` 가 `501` 을 반환하는 껍데기고, 설정 화면의 Runtime 탭도 비어 있다. Node 버전이나 install/test 커맨드를 받아 봐야 읽을 주체가 없어서, 저장만 되고 아무도 안 보는 설정이 되기 때문이다.

문제의 핵심은 성능이 아니라 **격리**다. 우리가 실행할 코드는 남이 쓴 코드다. 격리 없이 서버에서 그냥 돌리면 파일 시스템, 환경 변수, DB 접속 정보가 전부 노출된다. 무한 루프 하나로 서버가 멈추기도 한다.

## 선택지

### 1. 자체 서버 + Docker

우리가 서버를 빌리고, 그 위에 Docker 컨테이너를 띄워 그 안에서만 실행한다.

- 규모가 커지면 단위 비용이 제일 싸다
- 이미지 설계, 컨테이너 탈출 방어, 리소스 제한, 모니터링, 보안 패치를 전부 직접 한다
- 사용자가 0명이어도 서버 비용은 매달 고정으로 나간다

### 2. 샌드박스 서비스 (Vercel Sandbox / E2B / Daytona)

격리된 리눅스 환경을 API 로 빌려 쓴다. 몇 초 만에 뜨고, 명령을 실행하고, 버린다.

|           | Vercel Sandbox                | E2B                      | Daytona          |
| --------- | ----------------------------- | ------------------------ | ---------------- |
| 고정비    | 없음 (Pro $20 크레딧서 차감)  | Pro $150/월              | 없음             |
| 무료분    | Hobby CPU 5시간·생성 5천회/월 | 최초 $100 크레딧         | 최초 $200 크레딧 |
| CPU       | $0.128/vCPU·시                | $0.0504/vCPU·시          | $0.0504/vCPU·시  |
| 메모리    | $0.0212/GB·시                 | $0.0162/GiB·시           | $0.0162/GiB·시   |
| 최대 실행 | Hobby 45분 / Pro 24시간       | Hobby 1시간 / Pro 24시간 | —                |
| 연동      | Vercel 계정 그대로            | 별도 가입                | 별도 가입        |

(2026-09-10 기준 공개 요금)

### 3. GitHub Actions

워크플로우를 사용자 레포에 넣고, 실행을 GitHub 에 맡긴다.

- 인프라 비용 0, 격리도 GitHub 책임
- 이미 GitHub 연동이 있어 재사용된다
- 결과까지 1~2분. "버튼 누르면 몇 초 뒤 결과" 가 안 된다
- 사용자 레포에 파일을 넣어야 해서 거부감이 생길 수 있다

## 결정

**2번 중 Vercel Sandbox 를 쓴다.**

1. **고정비가 없다.** E2B 는 프로덕션 등급을 쓰려면 안 써도 매달 $150 이다. 사용자가 몇 명인지 모르는 지금 단계에서 감당할 이유가 없다.
2. **연동이 없다.** web 을 Vercel 에 올리므로 계정·청구·대시보드가 하나로 끝난다. 별도 가입, 별도 토큰, 별도 요금제가 생기지 않는다.
3. **단가 차이가 의미 없는 규모다.** 2분짜리 테스트 1,000회면 Vercel 약 $10, E2B·Daytona 약 $6. 이 $4 를 아끼려고 $150 을 내거나 연동을 하나 더 늘릴 이유가 없다.
4. **격리를 직접 안 만든다.** Firecracker microVM 단위로 분리되고, 기본 이미지에 Node LTS 가 들어 있어 우리 쪽 Docker 이미지가 필요 없다.

## 결과

- `apps/runner` 의 `POST /runs` 를 채운다: 샌드박스 생성 → 레포 클론 → install → 테스트 실행 → 로그·결과 수집 → 종료.
- 인증은 Vercel OIDC 토큰. 로컬은 `vercel link` + `vercel env pull`, 배포 환경에서는 자동 주입된다. **배포는 선행 조건이 아니다.**
- Runtime 탭이 받을 값이 확정된다: Node 버전, 패키지 매니저, install/test 커맨드, 환경 변수, 타임아웃.
- `apps/runner/Dockerfile` 은 그대로 둔다. 이건 runner **서버 자신**을 배포하는 이미지지, 사용자 테스트를 격리하는 이미지가 아니다. 둘은 별개다.
- README 의 인프라 표에서 runner 항목을 "자체 서버 + Docker" 에서 "Vercel Sandbox" 로 고친다.

## 뒤집을 수 있는가

있다. web 은 `apps/runner` 의 `POST /runs` 만 호출하므로, 그 안쪽 구현을 Vercel Sandbox → Daytona → 자체 Docker 중 무엇으로 바꿔도 web 코드는 그대로다. 이 경계를 유지하는 것이 이 결정의 전제다.

비용이 실제로 문제가 될 만큼 사용량이 커지면 그때 다시 판단한다. 고정비가 없고 단가도 싼 Daytona 가 1순위 대안, 규모가 더 커지면 1번이다.

## 현재 구현 (2026-09-19, main 041609d 기준)

- Vercel Sandbox 선택은 그대로다. 샌드박스는 vCPU 2개로 띄운다(`packages/sandbox/run.ts:134-143`).
- `apps/runner` 의 `POST /runs` 는 채우지 않는다. ADR-0002 로 runner 서버를 `Dockerfile` 과 함께 지웠고(커밋 9eb7b21), 같은 흐름은 `packages/sandbox` 의 함수 `runTest`·`runTestLive` 가 한다(`packages/sandbox/index.ts:5-6`). "web 은 `POST /runs` 만 호출한다" 는 경계는 이 패키지 입구가 대신 지킨다.
- 인증은 OIDC 그대로다. 로컬에서 OIDC 를 못 받는 경우(팀 뷰어 등)를 위해 `VERCEL_TOKEN`·`VERCEL_TEAM_ID`·`VERCEL_PROJECT_ID` 세 값도 받는다(`packages/sandbox/run.ts:96-99`, `packages/sandbox/run.ts:292-298`, `.env.example:73-78`).
- README 인프라 표는 "Vercel Sandbox" 로 고쳤다(`README.md:93`).
- Runtime 탭이 받는 값은 install 커맨드, test 커맨드, 타임아웃 셋이다(`apps/web/src/components/settings/runtime/runtime-form.tsx:71`, `:79`, `:99`). 타임아웃은 30초~10분이고(`apps/web/src/lib/projects/runtime.ts:28-29`), 화면에서 고르는 값은 1·3·5·10분이다(`apps/web/src/lib/projects/runtime.ts:99`).
- 패키지 매니저는 따로 받지 않는다. 레포 lockfile 로 정해 install 커맨드 기본값에 녹인다(`apps/web/src/lib/projects/detect-runtime.ts:46-48`).
- 아직 안 된 것: Node 버전과 환경 변수. 화면에는 ComingSoon 안내만 있고(`apps/web/src/app/project/[projectRef]/settings/runtime/page.tsx:57-62`), DB 컬럼도 없다(`packages/db/prisma/schema.prisma:251-252`).

## 참고

- [Vercel Sandbox 요금·쿼터](https://vercel.com/docs/sandbox/pricing)
- [Vercel Sandbox 개요](https://vercel.com/docs/sandbox)
- [E2B 요금](https://e2b.dev/pricing)
