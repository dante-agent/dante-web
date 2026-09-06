# 빌드 컨텍스트는 리포 루트: docker build -f apps/runner/Dockerfile .
FROM node:22-slim

RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/db/package.json packages/db/package.json
COPY apps/runner/package.json apps/runner/package.json
RUN pnpm install --frozen-lockfile --filter @dante/runner...

COPY packages/db packages/db
COPY apps/runner apps/runner
RUN pnpm --filter @dante/db generate

WORKDIR /repo/apps/runner
EXPOSE 4000
CMD ["pnpm", "start"]
