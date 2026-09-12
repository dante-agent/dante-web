# dante-web 작업 가이드

> 아래 `nextjs-agent-rules` 블록은 `next dev`가 자동 관리한다(영문 고정). 마커 밖의 이 내용은 건드리지 않으니 여기에 규칙을 적는다.

## 구조

pnpm workspace. Turborepo/Nx 없음.

```
apps/web      Next.js 16 (App Router, Turbopack) — BFF 포함  ← 이 디렉터리
apps/runner   Fastify 5 — 테스트 실행 서버 (현재 껍데기, 실행 환경은 ADR-0001)
packages/db   Prisma 6 — 스키마/클라이언트, web·runner 공유 (@dante/db)
```

## 명령 (리포 루트에서)

|                                                 |                           |
| ----------------------------------------------- | ------------------------- |
| `pnpm dev`                                      | web (localhost:3000)      |
| `pnpm dev:runner`                               | runner (localhost:4000)   |
| `pnpm build` / `pnpm lint`                      | 전체                      |
| `pnpm db:migrate` / `db:generate` / `db:studio` | Prisma (packages/db 기준) |

## 규칙

- **DB 접근은 전부 Next.js 서버에서.** 모든 테이블 RLS ON, 정책 없음. 권한 검사(팀 멤버 여부)는 앱 코드에서.
  - **새 테이블을 만들면 그 마이그레이션에 `ALTER TABLE "public"."<표>" ENABLE ROW LEVEL SECURITY;` 를 같이 넣는다.** RLS 는 Prisma 스키마로 표현할 수 없어서 `migrate dev` 가 생성해주지 않는다 — 손으로 안 넣으면 조용히 빠지고, 그 표는 anon 키로 PostgREST 에 열린다. (실제로 `extension_auth_codes`·`extension_tokens` 가 이렇게 빠졌다)
- `SUPABASE_SERVICE_ROLE_KEY` 에 `NEXT_PUBLIC_` 절대 붙이지 말 것. 서버 전용 (`src/lib/supabase/admin.ts`).
- Supabase 클라이언트: 브라우저 `src/lib/supabase/client.ts` / 서버 `server.ts` / 세션 갱신 `proxy.ts`. Next 16은 `middleware.ts` → `proxy.ts` (`src/proxy.ts`).
- Prisma 연결 문자열 2개: `DATABASE_URL`(pooler 6543, `?pgbouncer=true&connection_limit=1`) 런타임, `DIRECT_URL`(5432) migrate 전용. 우리 테이블은 `public` 스키마에만. Supabase CLI 마이그레이션과 섞지 않음.
- Monaco Editor는 SSR에서 깨짐 → `dynamic(() => import(...), { ssr: false })`.
- GitHub 레포는 Octokit 공식 API로만 읽는다. 크롤링 금지.
- 비밀값은 평문 저장 금지. Node 내장 `crypto` 로 AES-256-GCM (`ENCRYPTION_KEY`, `src/lib/crypto/secret.ts`). 지금 저장하는 비밀값은 없다 — 사용자 API 키는 사라졌고(Dante 가 프로바이더와 직접 계약) GitHub 은 설치 토큰을 매번 새로 발급받는다. AI 제공자 키는 서버 환경변수로만 둔다.
- 리포는 `dante-web` / `dante-extension` 2개 유지. 모노레포로 합치지 않음.

## 커밋 컨벤션

husky + lint-staged + commitlint + prettier (설정은 리포 루트). Conventional Commits.

- **type** (11종 중 하나): `feat` `fix` `docs` `hotfix` `refactor` `test` `chore` `rename` `asset` `design` `a11y`
- **scope 필수** — 비우면 커밋 실패
- 예: `feat(chat): 채팅방 목록 무한 스크롤 추가`
- 커밋 시 스테이징된 파일에 `prettier --write` 자동 실행 (pre-commit)
- 작게 자주 커밋. 하나의 커밋 = 하나의 논리적 단위

## 작업 흐름 (에이전트 주도)

1. 개발자가 작업을 **한 문장**으로 준다 (1 PR = 1 목적)
2. 에이전트: 브랜치 생성 → 코드 + 작은 커밋 → `git push`(feature 브랜치) → `gh pr create`
3. 개발자/팀원이 PR diff 리뷰
4. **작성자가 아닌** 팀원이 Squash merge
5. 에이전트는 **merge 하지 않고, `main`에 직접 push 하지 않는다** (`--no-verify`는 부트스트랩 외 금지)

## 브랜치 · PR 규칙

- 브랜치 이름: `<type>/<kebab-desc>` — type은 커밋과 같은 11종. 예: `feat/chat-infinite-scroll`, `fix/login-redirect`
  - `pre-push` 훅이 규칙 위반 브랜치와 `main`/`master` 직접 push를 막는다
- **Squash merge만** 사용 → PR 하나 = main 커밋 하나. 그래서 **PR 제목도 커밋 컨벤션 형식**(`feat(chat): ...`)
- PR 본문은 `.github/pull_request_template.md` 형식을 채운다
- PR 크기 기준 (lockfile·생성 파일·포맷팅·rename 제외한 "의미 있는 줄"):
  - `200줄 이하` 이상적 · `200–400` 정상 · `400–600` 왜 못 쪼갰는지 설명 · `600 초과` 쪼개라
  - 한 문장으로 설명할 때 "그리고"가 들어가면 쪼갠다. 1 PR = 1 목적

## 에이전트 작업 규칙

- **질문 ≠ 수정 지시.** 개발자가 뭘 물어보면 바로 고치거나 지우지 말고, 먼저 설명한 뒤 "이렇게 바꿀까요?"를 물어보고 답을 받고 실행한다.
- 파일 삭제·덮어쓰기, 의존성 제거, 설정 변경처럼 되돌리기 번거로운 행동은 실행 전에 확인받는다.
- **이 저장소 기여자는 해당 스택/툴 경험이 적다고 가정한다.** 설명은 "왜 그런지 + 대안 + 트레이드오프"까지 풀고, 낯선 용어는 짧게 풀이한다. "그냥 이렇게 하세요"로 끝내지 않는다.
- **새 의존성(npm 패키지) 추가는 사람 승인 필수.** PR 설명에 "왜 필요한지 / 직접 구현 대비 이득" 한 줄. 몇 줄로 될 일은 라이브러리 대신 직접 짠다.
- 디버깅용 스크립트·로그·실험 파일은 리포 안에 만들지 않는다. 리포 밖 임시 폴더 사용. 리포에 남겨야 하면 먼저 묻는다.
- feature 브랜치 `git push` + `gh pr create`는 에이전트가 한다. **`main` push와 PR merge는 안 한다.**
- 기능 단위가 컴파일/통과되어 끝날 때마다 `git diff --stat` 결과를 보고한다 (감으로 추정하지 말고 실제로 실행)
- 마지막 커밋 이후 diff가 **400줄 초과 또는 파일 10개 초과**면 commit/PR 전에 멈추고 개발자에게 쪼갤지 물어본다
- 5줄마다 보고하란 뜻 아님 — "논리적 단위 완료" 시점에만
- CI(GitHub Actions)가 빨간불이면 merge 대상 아님. 로컬에서 `pnpm lint && pnpm typecheck && pnpm build` 통과 확인 후 PR 올린다

## 주의

- `apps/web/CLAUDE.md` 도 `next dev`가 관리(`@AGENTS.md` 한 줄). 마커 안쪽 영문 블록은 번역해도 `next dev` 실행 시 되돌아온다.
- `packages/db/prisma/schema.prisma` 는 datasource/generator만. 데이터 모델은 팀에서 채운다.
- 스택 버전은 리포 루트 `README.md` 참고.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
