# 알림 — GitHub

알림 기획 중 **GitHub** 표면만 다룬다. Slack · Discord · Email 은 별도 문서.

> 구현 메모 (2026-09-19): 코드와 대조해 고쳤다. 기획과 다르게 된 것 요약.
>
> - 테스트는 PR 의 커밋(head SHA)마다 새로 만든다. 스냅샷 업데이트, "없거나 낡은 테스트만"
>   고르기는 없다(§1).
> - 드래프트·`skip-dante` 라벨·`[skip dante]`·브랜치 필터·스누즈는 **GitHub 에 쓸 때만** 거른다.
>   생성·실행은 그 전에 다 돈다(AI 비용도 나간다). 걸리면 Slack·Discord 도 안 보낸다(§6.1).
> - 스누즈 중에는 체크도 만들지 않는다(skipped 체크 없음). 나머지 필터는 `skipped` 체크를 남긴다(§5, §6.3).
> - PR 작성자가 프로젝트 팀의 Dante 멤버가 아니면 생성하지 않고 `skipped` 로 끝난다 — 체크는 `neutral`(§5).
> - 커버리지는 수집하지 않는다. 실제 코멘트에는 커버리지 줄이 나오지 않는다(§4).
> - 러너 시간 초과를 `cancelled` 로 닫지 않는다. 샌드박스 시간 초과는 "could not finish" 로 끝난다.
>   `check-run.ts` 의 `timedOutCheckRun` 은 만들어만 두고 부르는 곳이 없다(§5).
> - "실패 → 실패 재알림 안 함"(리뷰어 멘션)은 없다. `lastConclusion` 은 적기만 하고 읽지 않는다(§6.2).
> - 미리보기는 늘 표본 데이터다. 최근 실제 실행을 쓰는 건 아직 없다(§9).
> - Email 은 설정 화면에 ComingSoon 자리만 있다(§10).

설정 위치는 `/project/<ref>/settings/notifications`. GitHub **연결** 상태(설치·레포)는
`settings/github` 이고, 여기서는 "무엇을 PR 에 어떻게 쓸지"만 정한다.

---

## 1. 전제 — 단테가 PR 에서 하는 일

```
PR 열림 / 푸시 / Re-run
   → 작업 적기                    (PullRequestJob, 커밋(head SHA)마다 하나. 웹훅은 바로 200)
   → 바뀐 파일에서 컴포넌트 찾기   (경로로 거르고, head 커밋 본문을 ts-morph 로)
   → 비용 낼 사람 확인             (PR 작성자 또는 Re-run 누른 사람 — 팀 멤버·월 한도)
   → 테스트 생성                   (LLM, 바뀐 컴포넌트 파일마다. PR 당 최대 10 파일)
   → 테스트 실행                   (Vercel Sandbox, 팀마다 하나씩 차례로)
   → 결과를 PR 에 되돌려줌          ← 이 문서
```

- 생성은 **커밋마다 새로** 한다. 스냅샷 업데이트, "없거나 낡은 테스트만 생성"은 없다(아직 없음).
  같은 커밋을 Re-run 하면 그 커밋의 테스트를 지우고 다시 만든다(`pr-test-generation.ts`).
- 만든 테스트는 레포에 커밋하지 않는다. `PullRequestTest` 에 저장하고, 샌드박스에서만
  `<파일>.dante.test.tsx` 이름으로 써서 돌린다.
- 처리 중에 새 커밋이 오면 옛 작업은 `superseded` 로 닫고 결과를 PR 에 쓰지 않는다.
- 작업 흐름: `pull-request-job.ts` (`queued → running(생성) → awaiting_run → testing(샌드박스) → done / failed / superseded`).

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
키는 이 문서에서만 쓰는 이름이고, 코드는 `RunStatus`(`run-summary.ts`)로 다룬다.

| 키                    | RunStatus    | 시점                              | 코멘트 제목 (`### Dante — …`)            |
| --------------------- | ------------ | --------------------------------- | ---------------------------------------- |
| `sync.queued`         | `queued`     | PR 열림·푸시 감지                 | Queued — (아직 보내지 않음)              |
| `sync.scanning`       | `scanning`   | 컴포넌트 스캔 시작                | Scanning components — (아직 보내지 않음) |
| `test.generating`     | `generating` | 테스트 생성 시작                  | Generating tests                         |
| `test.running`        | `running`    | 실행 줄에 세움 (샌드박스 차례 전) | Running tests                            |
| `test.run.completed`  | `completed`  | 실행 끝                           | all N tests passed / N of M tests failed |
| `sync.failed`         | `failed`     | 어느 단계든 실패                  | could not finish                         |
| `component.unchanged` | `unchanged`  | 변경된 컴포넌트 없음              | no components changed in this push       |
| (없음)                | `skipped`    | 할 일은 있지만 돌리지 않음        | skipped test generation + 사유 인용      |

- 실제로 PR 에 처음 가는 건 `generating` 이다. `queued`·`scanning` 은 렌더 문구만 있고
  보내는 곳이 없다. 컴포넌트가 없으면 진행 상태 없이 바로 `unchanged` 로 끝난다.
- `skipped` 사유: PR 작성자가 팀 멤버가 아님·월 한도 초과·한도 확인 실패·작성자 모름,
  프로젝트에 러너 미선택, 샌드박스 미설정(`pr-author-rules.ts`, `run-result.ts`).
  Re-run 누른 사람이 팀 멤버가 아니거나 누군지 모르면 `failed` 로 끝난다.

중간 상태를 **같은 코멘트에 덮어쓴다**. 단계마다 새 코멘트를 달면 PR 타임라인이 망가진다.

GitHub App 이 받아야 하는 이벤트: `pull_request`(opened, synchronize, reopened,
ready_for_review), `check_run`(rerequested). 온보딩을 끝내지 않았거나 연결이 끊긴
프로젝트에는 쓰지 않는다(`webhook.ts` 의 `notifiableProjects`).

---

## 3. PR 코멘트 — 동작

### 3.1 Sticky (기본값, 끌 수 있음)

PR 당 코멘트 **하나**를 만들고 이후에는 계속 수정한다.

- 찾는 법: 코멘트 본문 맨 앞에 보이지 않는 마커 `<!-- dante:pr-summary -->` 를 넣는다.
  다시 찾을 때는 PR 의 issue comment 목록에서 우리 App 이 쓴(`GITHUB_APP_SLUG` 가 있으면
  `performed_via_github_app.slug`, 없으면 Bot 작성자) + 마커 접두사 `<!-- dante:pr-summary`
  가 있는 것을 찾는다. 접두사로 보는 건 예전 마커(`<!-- dante:pr-summary:<ref> -->`)도 잇기 위해서다.
  목록은 5 페이지(500개)까지만 본다.
- 빠른 경로로 `PullRequestSurface.commentId` 를 DB 에 캐시한다. 사람이 코멘트를
  지웠으면 404 → 마커 재탐색 → 그래도 없으면 새로 만든다. 404 가 아닌 오류(권한 등)는 새로 만들지 않고 실패로 적는다.
- **끄면**(`append`): 푸시마다 새 코멘트. 이력이 남는 걸 선호하는 팀을 위한 옵션이고 기본값 아님.
  이때도 마지막 코멘트 ID 는 적어 둔다 — 나중에 sticky 로 바꾸면 그 코멘트부터 이어서 고친다.

### 3.2 변경 없으면 코멘트 안 단다

`component.unchanged` 로 끝난 PR (예: README 만 고친 PR) 에는 아무것도 남기지 않는다.
문서 PR 마다 "0 tests" 코멘트가 붙으면 사람들이 봇을 뮤트한다. 전달 로그에는
`skipped — no components changed` 로 남는다.

이미 코멘트가 있는 PR(DB 에 `commentId` 가 있음)에서 이후 푸시가 무변경이면 → 코멘트는
그대로 두고 갱신만 한다(지우지 않음).

### 3.3 전부 통과하면 한 줄로 접는다

```
Dante — 24 passed · 3 components updated · 12s
```

`<details>` 안에 상세를 넣고 접은 상태로 둔다. 실패가 있을 때만 펼친 상태로 렌더한다.
한 줄에는 켜 둔 항목만 들어간다(수 · 컴포넌트 수 · 소요 시간). 상세 안의 컴포넌트 표는
실패 여부와 상관없이 늘 자기 `<details>` 로 접혀 있다.

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
- `Card.test.tsx` › applies elevation — `snapshot mismatch`
- `Card.test.tsx` › forwards ref — `ref is null`

<details><summary>Components in this PR</summary>

| Component | Change  | Tests |
| --------- | ------- | ----- |
| `Button`  | changed | 8     |
| `Card`    | added   | 11    |
| `Badge`   | added   | 5     |

</details>

[Open in Dante](https://…/project/abc123/pull/42) · [Re-run](https://…/project/abc123/pull/42?rerun=1)
```

- Coverage 줄은 미리보기 표본에만 나온다. 실제 실행은 커버리지를 수집하지 않아서 이 줄이 없다(아직 없음).
- 두 링크는 `NEXT_PUBLIC_APP_URL` 이 있을 때만 그린다(`links.ts`). Re-run 링크는 Dante 의 PR
  화면(`?rerun=1`)을 열 뿐이고, 거기서 버튼을 눌러야 다시 돈다. 비용은 누른 사람 한도로 센다.
- 실패 사유는 인라인 코드로 감싸 한 줄로 눕힌다(`comment.ts`).

### 3.5 언어 (English / 한국어)

코멘트와 체크(§5)를 같은 언어로 쓴다. 기본값은 영어 — 외부 기여자가 드나드는 레포도 있어서.

- 문구는 `comment.ts` · `check-run.ts` 의 `COPY` 표에 둔다. Discord · Slack 과 같은 방식이다.
- **번역하지 않는 것**: 테스트 이름, 파일 경로, 실패 사유, 건너뛴 사유(`skipReason`), Dante 오류
  문장(`run.error`). 원문이어야 검색해서 답을 찾을 수 있다.

```markdown
### Dante — 테스트 24개 중 3개 실패

|           |                                          |
| --------- | ---------------------------------------- |
| 테스트    | 전체 24개 · **21개 통과** · **3개 실패** |
| 컴포넌트  | 추가 2개 · 변경 1개                      |
| 소요 시간 | 14s                                      |
```

---

## 4. PR 코멘트 — 표시 항목 토글

설정 화면에서 켜고 끈다. 기본값은 커버리지만 끄고 나머지는 켬(`settings.ts` 의 `DEFAULT_COMMENT_FIELDS`).

| 항목                        | 키             | 기본 | 비고                                                                      |
| --------------------------- | -------------- | ---- | ------------------------------------------------------------------------- |
| 전체 / 성공 / 실패 수       | `counts`       | 켬   | 끄면 제목 줄만 남는다                                                     |
| 실패한 테스트 목록          | `failedList`   | 켬   | 최대 N 개 (기본 10, 1~50), 나머지는 `…and 4 more`                         |
| 실패 사유(assertion 메시지) | `failedReason` | 켬   | 끄면 테스트 이름만                                                        |
| 변경된 컴포넌트 표          | `components`   | 켬   | added / changed / removed                                                 |
| 커버리지 델타               | `coverage`     | 끔   | base 브랜치 대비. 값이 있을 때만 그린다 — 지금은 수집하지 않음(아직 없음) |
| 소요 시간                   | `duration`     | 켬   |                                                                           |
| 단테 딥링크                 | `link`         | 켬   | 지금은 끌 수 있다. 끌 수 없게 할지 논의 — 제품 유입 경로                  |
| Re-run 링크                 | `rerun`        | 켬   |                                                                           |

토글이 8 개면 화면이 지저분해서 **Compact / Detailed 프리셋 2 개**를 위에 두고,
**Custom** 을 고르면 개별 토글이 나온다.

- Compact: 수 · 실패 목록 · 단테 딥링크만.
- Detailed: 기본값과 같다(커버리지 제외 전부). 손대지 않은 프로젝트가 Custom 으로 보이지 않게.
- 어느 프리셋과도 안 맞는 조합이면 Custom 으로 표시된다.

---

## 5. Check Run

코멘트와 별개로 `checks: write` 로 체크 하나를 만든다. 이름은 `dante`. 체크는 커밋(head SHA)에
붙어서, 푸시가 오면 새 SHA 에 새로 만든다.

| status / conclusion | 제목 (en / ko)                               | 조건                                                                      |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `in_progress`       | Running / 실행 중                            | 생성·실행 중 (`generating`, `running`)                                    |
| `success`           | N passed / N개 통과                          | 실패 0                                                                    |
| `failure`           | N failed / N개 실패                          | 실패 ≥ 1 이고 머지 차단 켬                                                |
| `failure`           | Could not finish / 실행을 끝내지 못함        | 우리 쪽이 못 끝냄(샌드박스 오류·시간 초과 포함) 이고 머지 차단 켬         |
| `neutral`           | N failed / Could not finish                  | 위 두 경우인데 머지 차단 끔                                               |
| `neutral`           | No components changed / 바뀐 컴포넌트 없음   | 대상 컴포넌트 없음 (문서 PR 등)                                           |
| `neutral`           | Skipped test generation / 테스트 생성 건너뜀 | 생성 안 함(작성자가 팀 멤버 아님, 한도, 러너 미선택 등). summary 는 사유  |
| `skipped`           | Skipped / 건너뜀                             | 드래프트·`skip-dante` 라벨·`[skip dante]`·브랜치 필터. summary 는 사유    |
| (체크 없음)         | —                                            | 스누즈 중                                                                 |
| `cancelled`         | Timed out / 시간 초과                        | 러너 타임아웃 — (아직 없음) `timedOutCheckRun` 은 있지만 부르는 곳이 없다 |

실패 summary 에는 실패한 테스트를 5 개까지 `파일 › 이름` 으로 적고 나머지는 코멘트로 넘긴다.

설정 항목:

- **테스트 실패 시 머지 차단** — 켜면 실패를 `failure` 로, 끄면 `neutral` 로 보고한다. 기본 끔.
- 우리가 직접 머지를 막을 수는 없다. 실제 차단은 레포의 branch protection /
  ruleset 에서 `dante` 를 required check 로 추가해야 동작한다.
  → 토글 아래에 현재 상태 안내와 **"Add it as a required check on GitHub"** 링크
  (`https://github.com/<owner>/<repo>/settings/rules`)를 둔다. 이게 없으면 "켰는데 왜 안 막지?" 문의가 온다.
  - 판정은 룰셋(`GET /rules/branches/{기본 브랜치}`)만 본다. 거기 있으면 "required", 없으면
    "확인 못 함"이다 — classic branch protection 은 우리 권한(`administration: read` 없음)으로
    못 읽어서 "안 걸려 있음"으로 단정하지 않는다. 결과는 몇 분 캐시하고, GitHub 설정을 저장하면 비운다.
- Check 상세 화면의 "Re-run" 버튼 → `check_run.rerequested` 웹훅으로 같은 커밋을 처음(생성)부터 다시 돌린다.
  비용은 누른 사람 한도로 센다. 이미 돌고 있는 작업이면 겹쳐 돌리지 않는다.
- 제목과 summary 는 코멘트와 같은 언어로 쓴다(§3.5). 체크 이름 `dante` 는 required check 목록에
  들어가는 문자열이라 번역하지 않는다.

### 끝나지 않는 체크를 만들지 않는다

중간 상태(`in_progress`)는 **결론을 채워줄 쪽이 있을 때만** 만든다. 지금은 PR 작업이
생성·실행 단계마다 결과를 보내고 끝에 결론을 채우므로 `check-run.ts` 의 `RUNNER_REPORTS_BACK`
이 켜져 있다. 끄면 PR 이벤트를 받자마자 `neutral`(제목 `Not running tests yet`)로 닫는
예전 동작으로 돌아간다.

in_progress 로 열어두면 GitHub 이 알아서 끝내주지 않아 PR 마다 스피너가 영원히 돌고,
`dante` 를 required check 로 걸어둔 레포에서는 **테스트가 깨져서가 아니라 끝나지 않아서**
머지가 막힌다. 그래서:

- 작업이 예외로 멈추면 "could not finish" 결론을 채워 닫는다(`pull-request-job.ts` 의 `failJob`).
- GitHub 은 끝난 체크를 PATCH 로 in_progress 로 되돌리지 않는다. 같은 커밋을 다시 돌릴 때는
  캐시된 체크가 끝났으면 새로 만든다(`pull-request.ts` 의 `canReuseCheckRun`).
- 구멍: 함수가 통째로 죽으면(실행 시간 상한 등) 체크가 in_progress 로 남는다. 15 분 넘게
  멈춘 실행은 DB 에서만 `failed` 로 닫고 GitHub 에는 쓰지 않는다 — 사용자가 Re-run 으로 푼다
  (`test-run-queue.ts`). 여기를 `cancelled`(시간 초과)로 닫는 것은 아직 없음.

---

## 6. 알림 제어

범위 판정은 `scope.ts` 의 `evaluateScope` 한 곳이다. 순서는 스누즈 → 드래프트 → 라벨 → 커밋
메시지 → 브랜치 필터이고, 처음 걸린 사유를 전달 로그에 적는다.

**거르는 시점은 GitHub 에 결과를 쓸 때다.** 작업 자체(컴포넌트 찾기·생성·실행)는 필터와 상관없이
끝까지 돌고 AI 비용도 나간다. 걸리면 코멘트는 안 쓰고(로그 `skipped`), Slack·Discord 도 보내지
않는다. 체크는 스누즈가 아니면 `skipped` 로 남긴다 — `dante` 를 required 로 걸어 둔 레포에서
체크가 아예 없으면 머지가 영영 "기다리는 중"이 되기 때문이다.

### 6.1 브랜치 필터

- 대상 브랜치(base) 화이트리스트 — 비워 두면 `default branch` 만. 한 줄에 패턴 하나, `*` 허용
  (`release/*`). `*` 는 `/` 를 포함해 나머지 전부에 붙는다.
- **Draft PR 제외** (기본 켬)
- `skip-dante` 라벨이 붙은 PR 은 늘 제외한다 — 설정 없음, 대소문자 무시.
- head 커밋 메시지에 `[skip dante]` 가 있으면 건너뛴다(대소문자 무시) — CI 관례를 따른다.
  메시지를 못 읽으면 평소대로 보낸다.

### 6.2 상태 변화 시에만 알림

PR 코멘트는 sticky 라 항상 갱신된다. 이 옵션은 **Slack/Email 로 밀어내는 알림**에 적용된다.
GitHub 문서 범위에서는 하나만 관련된다:

- **실패 → 실패 재알림 안 함**: 같은 PR 에서 연속 실패 시 리뷰어 멘션은 첫 실패에만. (아직 없음 —
  리뷰어 멘션 자체가 없다.)

판정에 쓸 값은 `PullRequestSurface.lastConclusion` (§11). 지금은 체크를 쓸 때 적기만 하고 읽는
곳이 없다. Slack·Discord 는 각자 열(`slackLastEvent`, `discordOutcome`)로 판정한다.

### 6.3 스누즈 / 뮤트

프로젝트 단위로 "아무것도 쓰지 않기"를 켠다. 대규모 리팩터링 기간용. 화면 문구는
"Pause all notifications for" 이고, GitHub 뿐 아니라 Slack·Discord 도 멈춘다.

- 기간 선택: 1시간 / 오늘 / 1주 / 해제할 때까지. "오늘"은 브라우저 시간대의 자정까지,
  "해제할 때까지"는 `2999-12-31` 을 넣는다.
- 스누즈 중에도 **분석은 계속 돌린다** — 결과는 단테에만 쌓이고 PR 은 조용하다.
  분석까지 멈추면 스누즈 해제 후 이력이 비어 있게 된다.
- 스누즈 중에는 체크도 만들지 않는다(skipped 체크도 없음). 전달 로그에는
  `skipped — snoozed until <시각>` 이 남는다.
- 켜져 있는 동안 설정 화면 상단에 해제(Resume) 배너.

---

## 7. 전달 로그

`settings/notifications` 하단. 최근 20 건.

| 시각        | PR  | 표면    | 결과                                                  |
| ----------- | --- | ------- | ----------------------------------------------------- |
| 2 min ago   | #42 | comment | delivered — updated                                   |
| 2 min ago   | #42 | check   | delivered — failure                                   |
| 1 hour ago  | #41 | comment | failed — 403 — Resource not accessible by integration |
| 3 hours ago | #40 | comment | skipped — draft PR                                    |

- 표면 값은 `github_comment` · `github_check` · `discord` · `slack`, 결과는 `ok`(delivered) ·
  `skipped` · `failed`. 코멘트 성공은 `created` / `updated`, 체크 성공은 결론(진행 중이면 `in_progress`)을 적는다.
- 실패한 건은 GitHub 이 준 사유 원문을 그대로 보여준다(`<상태 코드> — <메시지>`, 500 자까지).
  sticky 코멘트가 지워진 경우(404)는 다시 찾거나 새로 만들어서 실패로 남지 않는다.
- 설치 토큰을 못 받으면(앱 삭제·정지) 표면별로 두 줄 적지 않고 comment 한 줄만 적는다.
- **재시도** 버튼은 PR 번호가 있는 실패 행에만 있다. 그때 결과를 다시 보내는 게 아니라 PR 의
  지금 커밋으로 작업을 처음부터 다시 돌린다. 비용은 누른 사람 한도로 센다.
- 보존 기간 30 일. 크론 없이 기록할 때 가끔(1/50) 옛 행을 지우고, 화면은 30 일 안쪽만 읽는다.

이게 없으면 "왜 코멘트가 안 달렸지"를 우리 서버 로그를 봐야만 알 수 있다.

---

## 8. 연결 상태 배지

`settings/github` 의 연결 상태와는 다른 층이다. 여기서는 **쓰기 권한**을 본다(`status.ts`).

| 상태                        | 표시                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| 정상                        | (배지 없음)                                                             |
| 설치 정지 / 삭제            | `settings/github` 과 같은 연결 배너 (`connectionNotice`)                |
| 레포가 설치에서 빠짐        | 위와 같음                                                               |
| `pull_requests: write` 없음 | "No permission to comment on pull requests" + "Approve on GitHub" 링크  |
| `checks: write` 없음        | "No permission to create checks" + 위와 같음                            |
| 최근 3 건 연속 전달 실패    | "Recent notifications were not delivered" + "See the delivery log" 링크 |

앞의 두 줄은 이미 `lib/github/connection.ts` 가 접어주는 상태를 그대로 쓴다. 연결이 끊겼으면
권한 배지는 띄우지 않는다(할 일이 두 개로 보이지 않게).

- 연속 실패는 `ok`/`failed` 만 센다. `skipped` 는 의도된 침묵이라 넣지 않는다.
- 권한은 설치 정보를 10 분 캐시해서 본다. 사용자가 GitHub 에서 새 권한을 승인하면
  `installation.new_permissions_accepted` 웹훅이 캐시를 비운다. 권한을 못 물어보면 배지를 띄우지 않는다.

권한 부족은 App 에 권한을 추가했을 때 기존 설치가 자동으로 따라오지 않기 때문에 실제로 흔하다
(사용자가 GitHub 에서 새 권한을 승인해야 한다).

---

## 9. 미리보기 (= "Send test notification" 의 GitHub 버전)

다른 채널에서는 "테스트 알림 1건 보내기" 버튼이지만, GitHub 은 진짜 PR 에 테스트 코멘트를
달 수 없다. 대신 **설정 화면 안에서 렌더 결과를 보여준다.**

- 토글을 바꾸면 옆 패널에 코멘트가 실시간으로 다시 그려진다. 실제로 쓰는 코드와 같은
  `renderPrComment` 를 부른다.
- 데이터는 표본(`run-summary.ts` 의 `SAMPLE_RUNS`)에 이 프로젝트의 링크를 붙여 쓴다.
  이 프로젝트의 **가장 최근 실제 실행 결과**를 쓰는 건 아직 없음.
- 실패 있음 / 전부 통과 두 가지를 탭(Failing / Passing)으로 전환해서 볼 수 있게 한다 (접힘 상태 확인용).
- 코멘트를 끄면 미리보기 대신 "코멘트를 달지 않는다"는 안내를 보인다.
- 마크다운 원문이 아니라 **GitHub 에서 보일 모양으로 렌더**한다 (`comment-markdown.tsx`).
  - `<details>` 는 GitHub 처럼 접힌 채로 시작한다. 전부 통과해 접힌 상세 안에 컴포넌트 표
    `<details>` 가 또 들어가는데, 둘 다 따로 접힌다.
  - 링크는 모양만 있고 눌러도 이동하지 않는다.
  - 실제 실행 결과의 테스트 이름이 들어올 수 있어서 원본 HTML 은 버리고 `<details><summary>`
    만 직접 잘라 그린다. `rehype-raw` 는 쓰지 않는다.

목적은 같다 — **저장 전에 결과물을 눈으로 확인**해서, PR 을 만들어 보는 왕복을 없앤다.

---

## 10. 설정 화면 구성

실제 화면 순서(`settings/notifications/page.tsx`). 화면 문구는 영어다.

```
Notifications
├─ [연결이 끊겼으면] 연결 배너 (settings/github 과 같은 것)
├─ [스누즈 중이면] 해제 배너
├─ 상태 배지 (§8)
│
├─ GitHub                                   ← 이 문서 (한 폼, 저장 버튼 하나)
│  ├─ Pull request comment
│  │  ├─ 켜기/끄기                          [켬]
│  │  ├─ 동작: Sticky | 매번 새 코멘트
│  │  ├─ 변경 없으면 코멘트 안 달기          [켬]
│  │  └─ 전부 통과 시 접기                   [켬]
│  ├─ What the comment says
│  │  ├─ 표시 항목: Compact | Detailed | Custom
│  │  └─ 실패 목록 최대 개수 (1~50, 기본 10)
│  ├─ Language: English | 한국어 (체크도 따른다, §3.5)
│  ├─ Check run
│  │  ├─ 켜기/끄기                          [켬]
│  │  └─ 테스트 실패 시 머지 차단            [끔]  (required check 안내, §5)
│  └─ 미리보기 패널 (§9, 옆에 붙음)
│
├─ Where it applies                         (따로 저장)
│  ├─ 대상 브랜치
│  └─ Draft PR 제외                         [켬]
├─ 스누즈 (기간 고르고 Snooze)
│
├─ Discord                                  ← 별도 문서
├─ Slack                                    ← 별도 문서 (팀에 연결 안 됐으면 팀 설정 안내)
├─ Email                                    ← ComingSoon 자리만 (아직 없음)
└─ 전달 로그 (§7)
```

---

## 11. 데이터 모델

Slack/Discord 가 붙을 것을 전제로 테이블 하나에 모은다. 아래는 GitHub 에 쓰는 열만 옮겼다.
Discord·Slack 열은 이미 있고 실제 정의는 `packages/db/prisma/schema.prisma` 가 기준이다.

```prisma
/// 프로젝트당 1행. 알림을 "언제, 어디로, 어떻게" 보낼지의 설정값.
/// 행이 없으면 기본값을 쓴다(lib/notifications/settings.ts). 프로젝트를 만들 때 미리 넣지 않는다.
model ProjectNotificationSetting {
  projectId String @id @map("project_id") @db.Uuid

  // ── GitHub PR 코멘트 ────────────────────────────────
  prCommentEnabled        Boolean @default(true)     @map("pr_comment_enabled")
  /// "sticky" | "append" — enum 대신 문자열 (Project.testFramework 와 같은 이유)
  prCommentMode           String  @default("sticky") @map("pr_comment_mode")
  prCommentSkipUnchanged  Boolean @default(true)     @map("pr_comment_skip_unchanged")
  prCommentCollapseOnPass Boolean @default(true)     @map("pr_comment_collapse_on_pass")
  /// 표시 항목 토글 묶음. 항목이 늘어도 마이그레이션이 필요 없게 JSON. DB 기본값이 없어 저장할 때 채운다.
  /// { counts, failedList, failedReason, components, coverage, duration, link, rerun }
  prCommentFields         Json    @map("pr_comment_fields")
  /// "en" | "ko" — 코멘트와 체크가 같이 따른다 (§3.5)
  prCommentLocale         String  @default("en")     @map("pr_comment_locale")
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

  // ── Discord · Slack 열은 생략 (각 채널 문서) ─────────

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
  /// 마지막으로 보고한 체크 결론. "상태 변화 시에만" 판정용 — 지금은 적기만 한다(§6.2).
  lastConclusion String? @map("last_conclusion")

  // Discord·Slack 메시지 좌표 열은 생략

  updatedAt DateTime @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, prNumber])
  @@map("pull_request_surfaces")
}

/// 전달 로그 (§7). 30 일 보존 — 기록할 때 가끔 같이 지운다.
model NotificationDelivery {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  /// "github_comment" | "github_check" | "discord" | "slack" | (나중에) "email"
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

PR 작업 쪽 표 `PullRequestJob`(커밋마다 작업 하나, `@@unique([projectId, prNumber, headSha])`)과
`PullRequestTest`(그 작업에서 만든 테스트)는 스키마를 본다.

---

## 12. 필요한 GitHub App 권한 · 이벤트

기존(연결용)에 더해서:

| 종류   | 항목                   | 왜                                              |
| ------ | ---------------------- | ----------------------------------------------- |
| 권한   | `pull_requests: write` | PR 코멘트 생성·수정                             |
| 권한   | `checks: write`        | Check Run 생성·업데이트                         |
| 권한   | `contents: read`       | (이미 필요) 소스 스캔, 샌드박스 클론            |
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
