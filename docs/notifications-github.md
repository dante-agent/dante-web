# 알림 — GitHub

알림 기획 중 **GitHub** 표면만 다룬다. Slack · Discord · Email 은 별도 문서.

설정 위치는 `/project/<ref>/settings/notifications`. GitHub **연결** 상태(설치·레포)는
`settings/github` 이고, 여기서는 "무엇을 PR 에 어떻게 쓸지"만 정한다.

---

## 1. 전제 — 단테가 PR 에서 하는 일

```
PR 열림 / 푸시
   → 변경된 컴포넌트 스캔        (ts-morph)
   → 스냅샷 업데이트
   → 없거나 낡은 테스트 생성      (LLM)
   → 테스트 실행                 (runner)
   → 결과를 PR 에 되돌려줌        ← 이 문서
```

되돌려주는 표면은 두 개다. **둘 다 만든다.**

|           | PR 코멘트                  | Check Run                         |
| --------- | -------------------------- | --------------------------------- |
| 보는 곳   | PR 대화 탭                 | PR 하단 체크 목록 / Checks 탭     |
| 성격      | 읽는 것 — 사람이 훑는 요약 | 판정하는 것 — 머지를 막을 수 있음 |
| 길이      | 길어도 됨 (접기 가능)      | 짧은 제목 + summary               |
| 필요 권한 | `pull_requests: write`     | `checks: write`                   |

코멘트만 있으면 실패해도 머지된다. Check 만 있으면 왜 실패했는지 알기 어렵다.

---

## 2. 이벤트

PR 하나에서 순서대로 일어난다. 개별 알림이 아니라 **하나의 코멘트가 거쳐가는 상태**로 다룬다.

| 키                    | 시점                 | 코멘트 상태                              |
| --------------------- | -------------------- | ---------------------------------------- |
| `sync.queued`         | PR 열림·푸시 감지    | Queued                                   |
| `sync.scanning`       | 컴포넌트 스캔 시작   | Scanning components                      |
| `test.generating`     | 테스트 생성 시작     | Generating tests                         |
| `test.running`        | 러너에 제출          | Running tests                            |
| `test.run.completed`  | 실행 끝              | all N tests passed / N of M tests failed |
| `sync.failed`         | 어느 단계든 실패     | could not finish                         |
| `component.unchanged` | 변경된 컴포넌트 없음 | (생략 가능)                              |

중간 상태를 **같은 코멘트에 덮어쓴다**. 단계마다 새 코멘트를 달면 PR 타임라인이 망가진다.

GitHub App 이 받아야 하는 이벤트: `pull_request`(opened, synchronize, reopened,
ready_for_review), `check_run`(rerequested).

---

## 3. PR 코멘트 — 동작

### 3.1 Sticky (기본값, 끌 수 있음)

PR 당 코멘트 **하나**를 만들고 이후에는 계속 수정한다.

- 찾는 법: 코멘트 본문에 보이지 않는 마커 `<!-- dante:pr-summary -->` 를 넣는다.
  다시 열 때 PR 의 issue comment 목록에서 우리 봇이 쓴 + 마커가 있는 것을 찾는다.
- 빠른 경로로 `PullRequestSurface.commentId` 를 DB 에 캐시한다. 사람이 코멘트를
  지웠으면 404 → 마커 재탐색 → 그래도 없으면 새로 만든다.
- **끄면**: 푸시마다 새 코멘트. 이력이 남는 걸 선호하는 팀을 위한 옵션이고 기본값 아님.

### 3.2 변경 없으면 코멘트 안 단다

`component.unchanged` 로 끝난 PR (예: README 만 고친 PR) 에는 아무것도 남기지 않는다.
문서 PR 마다 "0 tests" 코멘트가 붙으면 사람들이 봇을 뮤트한다.

이미 코멘트가 있는 PR 에서 이후 푸시가 무변경이면 → 코멘트는 그대로 두고 갱신만 한다(지우지 않음).

### 3.3 전부 통과하면 한 줄로 접는다

```
Dante — 24 passed · 3 components updated · 12s
```

`<details>` 안에 상세를 넣고 접은 상태로 둔다. 실패가 있을 때만 펼친 상태로 렌더한다.

### 3.4 코멘트 예시 (실패)

```markdown
<!-- dante:pr-summary -->

### Dante — 3 of 24 tests failed

|            |                                         |
| ---------- | --------------------------------------- |
| Tests      | 24 total · **21 passed** · **3 failed** |
| Components | 2 added · 1 changed                     |
| Coverage   | 68% → 71% (+3%)                         |
| Duration   | 14s                                     |

**Failed**

- `Button.test.tsx` › renders disabled state — `expected "true" to be "false"`
- `Card.test.tsx` › applies elevation — snapshot mismatch
- `Card.test.tsx` › forwards ref — `ref is null`

<details><summary>Components in this PR</summary>

| Component | Change  | Tests |
| --------- | ------- | ----- |
| `Button`  | changed | 8     |
| `Card`    | added   | 11    |
| `Badge`   | added   | 5     |

</details>

[Open in Dante](https://…/project/abc123/pull/42) · [Re-run](…)
```

---

## 4. PR 코멘트 — 표시 항목 토글

설정 화면에서 켜고 끈다. 기본값은 켬.

| 항목                        | 기본 | 비고                                               |
| --------------------------- | ---- | -------------------------------------------------- |
| 전체 / 성공 / 실패 수       | 켬   | 끄면 제목 줄만 남는다                              |
| 실패한 테스트 목록          | 켬   | 최대 N 개 (기본 10), 나머지는 `…and 4 more`        |
| 실패 사유(assertion 메시지) | 켬   | 끄면 테스트 이름만                                 |
| 변경된 컴포넌트 표          | 켬   | added / changed / removed                          |
| 커버리지 델타               | 끔   | base 브랜치 대비. 커버리지 수집이 켜진 경우만 노출 |
| 소요 시간                   | 켬   |                                                    |
| 단테 딥링크                 | 켬   | 끌 수 없게 할지 논의 — 제품 유입 경로              |
| Re-run 링크                 | 켬   |                                                    |

> 토글이 8 개면 화면이 지저분하다. **Compact / Detailed 프리셋 2 개**를 위에 두고,
> "Customize" 를 열면 개별 토글이 나오는 구조를 제안한다.

---

## 5. Check Run

코멘트와 별개로 `checks: write` 로 체크 하나를 만든다. 이름은 `dante`.

| conclusion  | 조건                            |
| ----------- | ------------------------------- |
| `success`   | 실패 0                          |
| `failure`   | 실패 ≥ 1                        |
| `neutral`   | 대상 컴포넌트 없음 (문서 PR 등) |
| `skipped`   | 브랜치 필터에 걸림 / 스누즈 중  |
| `cancelled` | 러너 타임아웃                   |

설정 항목:

- **테스트 실패 시 머지 차단** — 켜면 실패를 `failure` 로, 끄면 `neutral` 로 보고한다.
- 우리가 직접 머지를 막을 수는 없다. 실제 차단은 레포의 branch protection /
  ruleset 에서 `dante` 를 required check 로 추가해야 동작한다.
  → 토글 옆에 **"레포 설정에서 required 로 추가하기"** 딥링크와, 현재 required 인지
  아닌지 감지해서 보여주는 배지를 같이 둔다. 이게 없으면 "켰는데 왜 안 막지?" 문의가 온다.
- Check 상세 화면의 "Re-run" 버튼 → `check_run.rerequested` 웹훅으로 재실행.

---

## 6. 알림 제어

### 6.1 브랜치 필터

- 대상 브랜치(base) 화이트리스트 — 기본 `default branch` 만. 패턴 입력 허용 (`release/*`).
- **Draft PR 제외** (기본 켬)
- 특정 라벨이 붙은 PR 제외 (`skip-dante`) — 옵션
- 커밋 메시지에 `[skip dante]` 가 있으면 건너뛴다 — CI 관례를 따른다

### 6.2 상태 변화 시에만 알림

PR 코멘트는 sticky 라 항상 갱신된다. 이 옵션은 **Slack/Email 로 밀어내는 알림**에 적용된다.
GitHub 문서 범위에서는 하나만 관련된다:

- **실패 → 실패 재알림 안 함**: 같은 PR 에서 연속 실패 시 리뷰어 멘션은 첫 실패에만.

판정에 쓸 값은 `PullRequestSurface.lastConclusion` (§11).

### 6.3 스누즈 / 뮤트

프로젝트 단위로 "GitHub 에 아무것도 쓰지 않기"를 켠다. 대규모 리팩터링 기간용.

- 기간 선택: 1시간 / 오늘 / 1주 / 해제할 때까지
- 스누즈 중에도 **분석은 계속 돌린다** — 결과는 단테 대시보드에만 쌓이고 PR 은 조용하다.
  분석까지 멈추면 스누즈 해제 후 이력이 비어 있게 된다.
- 켜져 있는 동안 설정 화면 상단에 해제 배너.

---

## 7. 전달 로그

`settings/notifications` 하단. 최근 20 건.

| 시각        | PR  | 표면    | 결과                                 |
| ----------- | --- | ------- | ------------------------------------ |
| 2 min ago   | #42 | comment | delivered — updated                  |
| 2 min ago   | #42 | check   | delivered — failure                  |
| 1 hour ago  | #41 | comment | failed — 403 resource not accessible |
| 3 hours ago | #40 | comment | skipped — draft PR                   |

- 실패한 건은 사유 원문을 그대로 보여준다 (`403 Resource not accessible by integration`
  → 권한 부족, `422` → 코멘트 삭제됨 등).
- 각 행에 **재시도** 버튼.
- 보존 기간 30 일.

이게 없으면 "왜 코멘트가 안 달렸지"를 우리 서버 로그를 봐야만 알 수 있다.

---

## 8. 연결 상태 배지

`settings/github` 의 연결 상태와는 다른 층이다. 여기서는 **쓰기 권한**을 본다.

| 상태                        | 표시                                                |
| --------------------------- | --------------------------------------------------- |
| 정상                        | (배지 없음)                                         |
| 설치 정지 / 삭제            | "GitHub 연결이 끊겼습니다" + `settings/github` 링크 |
| 레포가 설치에서 빠짐        | 위와 같음                                           |
| `pull_requests: write` 없음 | "PR 코멘트 권한이 없습니다" + App 권한 승인 링크    |
| `checks: write` 없음        | "Check 를 만들 수 없습니다" + 위와 같음             |
| 최근 3 건 연속 전달 실패    | "최근 알림이 전달되지 않았습니다" + 로그 링크       |

앞의 두 줄은 이미 `lib/github/connection.ts` 가 접어주는 상태를 그대로 쓴다.

권한 부족은 App 에 권한을 추가했을 때 기존 설치가 자동으로 따라오지 않기 때문에 실제로 흔하다
(사용자가 GitHub 에서 새 권한을 승인해야 한다).

---

## 9. 미리보기 (= "Send test notification" 의 GitHub 버전)

다른 채널에서는 "테스트 알림 1건 보내기" 버튼이지만, GitHub 은 진짜 PR 에 테스트 코멘트를
달 수 없다. 대신 **설정 화면 안에서 렌더 결과를 보여준다.**

- 토글을 바꾸면 옆 패널에 코멘트가 실시간으로 다시 그려진다.
- 데이터는 이 프로젝트의 **가장 최근 실제 실행 결과**를 쓴다. 없으면 샘플 데이터.
- 실패 있음 / 전부 통과 두 가지를 탭으로 전환해서 볼 수 있게 한다 (접힘 상태 확인용).

목적은 같다 — **저장 전에 결과물을 눈으로 확인**해서, PR 을 만들어 보는 왕복을 없앤다.

---

## 10. 설정 화면 구성

```
Notifications
├─ [스누즈 중이면] 해제 배너
│
├─ GitHub                                   ← 이 문서
│  ├─ 상태 배지 (§8)
│  ├─ PR 코멘트
│  │  ├─ 켜기/끄기
│  │  ├─ 동작: Sticky | 매번 새 코멘트
│  │  ├─ 변경 없으면 코멘트 안 달기        [✓]
│  │  ├─ 전부 통과 시 접기                 [✓]
│  │  └─ 표시 항목: Compact | Detailed | Customize ▾
│  ├─ Check Run
│  │  ├─ 켜기/끄기
│  │  └─ 테스트 실패 시 머지 차단  [ ]  (required check 상태 배지)
│  └─ 미리보기 패널 (§9)
│
├─ 적용 범위
│  ├─ 대상 브랜치
│  ├─ Draft PR 제외                         [✓]
│  └─ 스누즈
│
├─ Slack / Discord                          ← 별도 문서
├─ Email                                    ← 별도 문서
└─ 전달 로그 (§7)
```

---

## 11. 데이터 모델 초안

Slack/Discord 가 붙을 것을 전제로 테이블 하나에 모은다. GitHub 열만 지금 채운다.

```prisma
/// 프로젝트당 1행. 알림을 "언제, 어디로, 어떻게" 보낼지의 설정값.
model ProjectNotificationSetting {
  projectId String @id @map("project_id") @db.Uuid

  // ── GitHub PR 코멘트 ────────────────────────────────
  prCommentEnabled        Boolean @default(true)     @map("pr_comment_enabled")
  /// "sticky" | "append" — enum 대신 문자열 (Project.testFramework 와 같은 이유)
  prCommentMode           String  @default("sticky") @map("pr_comment_mode")
  prCommentSkipUnchanged  Boolean @default(true)     @map("pr_comment_skip_unchanged")
  prCommentCollapseOnPass Boolean @default(true)     @map("pr_comment_collapse_on_pass")
  /// 표시 항목 토글 묶음. 항목이 늘어도 마이그레이션이 필요 없게 JSON.
  /// { counts, failedList, failedReason, components, coverage, duration, link, rerun }
  prCommentFields         Json    @map("pr_comment_fields")
  prCommentFailedLimit    Int     @default(10)       @map("pr_comment_failed_limit")

  // ── GitHub Check Run ───────────────────────────────
  checkRunEnabled  Boolean @default(true)  @map("check_run_enabled")
  /// 켜면 실패를 conclusion=failure 로, 끄면 neutral 로 보고
  checkRunBlocking Boolean @default(false) @map("check_run_blocking")

  // ── 적용 범위 ───────────────────────────────────────
  /// base 브랜치 패턴. 빈 배열 = 기본 브랜치만
  branchFilters String[]  @default([])   @map("branch_filters")
  skipDraftPr   Boolean   @default(true) @map("skip_draft_pr")
  /// 이 시각까지 아무것도 쓰지 않는다. null = 스누즈 아님
  snoozedUntil  DateTime? @map("snoozed_until")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("project_notification_settings")
}

/// PR 하나에 우리가 만든 코멘트 / 체크의 GitHub 쪽 ID.
/// sticky 코멘트를 매번 목록에서 찾지 않기 위한 캐시다 — 없으면 마커로 재탐색한다.
model PullRequestSurface {
  id        String @id @default(uuid()) @db.Uuid
  projectId String @map("project_id") @db.Uuid
  prNumber  Int    @map("pr_number")

  commentId      BigInt? @map("comment_id")
  checkRunId     BigInt? @map("check_run_id")
  /// 마지막으로 보고한 결과. "상태 변화 시에만" 판정에 쓴다.
  lastConclusion String? @map("last_conclusion")

  updatedAt DateTime @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, prNumber])
  @@map("pull_request_surfaces")
}

/// 전달 로그 (§7). 30 일 보존, 배치로 정리.
model NotificationDelivery {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  /// "github_comment" | "github_check" | (나중에) "slack" | "discord" | "email"
  surface   String
  prNumber  Int?     @map("pr_number")
  /// "ok" | "skipped" | "failed"
  status    String
  /// skipped 사유 또는 에러 원문
  detail    String?
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
  @@map("notification_deliveries")
}
```

---

## 12. 필요한 GitHub App 권한 · 이벤트

기존(연결용)에 더해서:

| 종류   | 항목                   | 왜                                              |
| ------ | ---------------------- | ----------------------------------------------- |
| 권한   | `pull_requests: write` | PR 코멘트 생성·수정                             |
| 권한   | `checks: write`        | Check Run 생성·업데이트                         |
| 권한   | `contents: read`       | (이미 필요) 소스 스캔                           |
| 이벤트 | `pull_request`         | opened, synchronize, reopened, ready_for_review |
| 이벤트 | `check_run`            | rerequested (Re-run 버튼)                       |

권한을 늘리면 **기존 설치가 자동으로 따라오지 않는다.** 사용자가 GitHub 에서 승인해야 하고,
그때까지 API 는 `403 Resource not accessible by integration` 을 낸다 → §8 배지로 안내.

---

## 범위 밖

- Slack · Discord 라우팅과 웹훅 URL 마스킹·재발급 — 별도 문서.
  (GitHub 에는 프로젝트별 웹훅 URL 이 없다. 우리 App 웹훅 시크릿은 서버 환경변수 하나다.)
- Email 다이제스트 — 별도 문서. 스코프가 프로젝트가 아니라 **개인**이라는 점만 여기 남긴다.
- 이벤트별 Slack/Email 스위치 매트릭스 — 채널 문서가 나온 뒤 합친다.
- 인라인 리뷰 코멘트(코드 줄에 다는 것) — 1차 범위 밖. 요약 코멘트 먼저.
