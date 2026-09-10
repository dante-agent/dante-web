# dante-web

웹(제품 중심) + 테스트 러너. pnpm workspace. Turborepo/Nx 안 씀.

```
apps/web      Next.js — BFF 포함
apps/runner   Fastify — 테스트 실행 서버 (껍데기, 실행 환경은 ADR-0001)
packages/db   Prisma 스키마/클라이언트 (web·runner 공유)
```

## 기술 스택

### 런타임 / 툴

|            | 버전              |
| ---------- | ----------------- |
| Node       | 22 LTS (`.nvmrc`) |
| pnpm       | 12                |
| TypeScript | 5.9.3             |

### 개발 툴 (root devDependencies)

| 패키지                          | 버전   | 용도                                              |
| ------------------------------- | ------ | ------------------------------------------------- |
| prettier                        | 3.9.6  | 포맷터 (`prettier.config.cjs`, printWidth 100)    |
| prettier-plugin-tailwindcss     | 0.8.1  | Tailwind 클래스 정렬                              |
| husky                           | 9.1.7  | git hooks (`.husky/`)                             |
| lint-staged                     | 17.5.0 | pre-commit: 스테이징 파일에 `prettier --write`    |
| @commitlint/cli                 | 21.2.2 | commit-msg: 메시지 검사 (`commitlint.config.cjs`) |
| @commitlint/config-conventional | 21.2.2 | Conventional Commits 베이스                       |

**git hooks (`.husky/`)**

| 훅         | 동작                                                                      |
| ---------- | ------------------------------------------------------------------------- |
| pre-commit | `npx lint-staged` → 스테이징 파일 `prettier --write`                      |
| commit-msg | `commitlint` 메시지 검사                                                  |
| pre-push   | `main`/`master` 직접 push 차단 + 브랜치 이름 규칙 검사 + `pnpm typecheck` |

커밋 · 브랜치 · PR · 에이전트 작업 규칙 (type 11종, scope 필수, PR 크기 등) → **`apps/web/AGENTS.md`**

### apps/web

| 패키지                      | 버전            | 용도                                        |
| --------------------------- | --------------- | ------------------------------------------- |
| next                        | 16.3.4          | 프레임워크 / BFF (App Router, Turbopack)    |
| react / react-dom           | 19.2.8          |                                             |
| tailwindcss                 | 4.3.3           | 스타일                                      |
| @tailwindcss/postcss        | 4.3.3           |                                             |
| shadcn/ui                   | CLI 4.21.0      | 컴포넌트 (`pnpm dlx shadcn@latest add ...`) |
| @base-ui/react              | 1.8.0           | shadcn 4.x 프리미티브 (Radix 대체)          |
| class-variance-authority    | 0.7.1           | variant                                     |
| cn                          | 0.2.5           | className 병합 (clsx + tailwind-merge 대체) |
| lucide-react                | 1.41.0          | 아이콘                                      |
| tw-animate-css              | 1.4.0           | 애니메이션 유틸                             |
| @tanstack/react-query       | 5.102.8         | 서버 상태                                   |
| zod                         | 4.5.4           | 스키마 검증                                 |
| react-hook-form             | 7.87.0          | 폼                                          |
| @hookform/resolvers         | 5.9.1           | zod ↔ RHF                                   |
| @supabase/supabase-js       | 2.115.0         | Supabase 클라이언트                         |
| @supabase/ssr               | 0.12.6          | 세션/쿠키 (server·client·proxy)             |
| @monaco-editor/react        | 4.7.0           | 코드 에디터 + diff                          |
| octokit                     | 5.0.5           | GitHub API                                  |
| semver                      | 7.8.5           | 실행 환경 판별                              |
| ts-morph                    | 28.0.0          | 컴포넌트 추출                               |
| ai                          | 7.0.93          | Vercel AI SDK                               |
| @ai-sdk/anthropic           | 4.0.49          |                                             |
| @ai-sdk/openai              | 4.0.59          |                                             |
| @ai-sdk/google              | 4.0.64          |                                             |
| resend                      | 6.26.0          | 메일 발송                                   |
| react-email                 | 6.9.3           | 메일 템플릿                                 |
| date-fns                    | 4.4.0           | 이력 날짜 그룹핑                            |
| eslint / eslint-config-next | 9.39.5 / 16.3.4 | 린트                                        |

### apps/runner

| 패키지  | 버전    | 용도      |
| ------- | ------- | --------- |
| fastify | 5.12.3  | HTTP 서버 |
| tsx     | 4.23.13 | 실행      |

### packages/db

| 패키지                  | 버전   | 용도                     |
| ----------------------- | ------ | ------------------------ |
| prisma / @prisma/client | 6.19.3 | 스키마·마이그레이션·쿼리 |

### 인프라

|                |                            |
| -------------- | -------------------------- |
| Supabase       | Auth + Postgres + Realtime |
| Vercel         | web 배포                   |
| Vercel Sandbox | 테스트 실행 (ADR-0001)     |
