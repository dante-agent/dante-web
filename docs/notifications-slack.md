# 알림 — Slack

알림 기획 중 **Slack** 표면만 다룬다. GitHub 은 `notifications-github.md`. Discord 와
Email 은 기획 문서가 아직 없다(범위 밖 참고).

> 구현 메모 (2026-09-19): 팀 모델이 들어온 뒤라 워크스페이스 연결은 **사용자가 아니라
> 팀**에 붙였다(`SlackInstallation.teamId`, 팀 설정 `/team/<id>/settings/slack`, owner 만).
> 본문도 팀 기준으로 고쳤다. 아직 없는 것: §6 멘션, §8 의 채널·초대 배지, §9 의 실제
> 결과로 보내는 테스트 알림, 팀·계정 삭제 때의 봇 토큰 폐기(§3.4).

채널 설정 위치는 GitHub 과 같은 `/project/<ref>/settings/notifications` 다. 다만 이
표면은 **두 층으로 쪼개진다** — 워크스페이스를 붙이는 일은 팀당 한 번이고(팀 설정),
어느 채널로 무엇을 보낼지는 프로젝트마다 다르다(프로젝트 알림 설정).

---

## 1. 전제 — Slack 은 GitHub 과 성격이 다르다

|             | GitHub PR 코멘트            | Slack 메시지                          |
| ----------- | --------------------------- | ------------------------------------- |
| 성격        | 보러 오는 곳                | 밀어내는 곳 — 사람을 방해한다         |
| 맥락        | 이미 그 PR 을 보고 있다     | 무슨 PR 인지부터 말해줘야 한다        |
| 중간 상태   | 같은 코멘트에 덮어써도 공짜 | 덮어써도 알림은 이미 울렸다           |
| 시끄러우면  | 스크롤로 지나친다           | 채널을 음소거한다 — 다시 안 돌아온다  |
| 되돌릴 여지 | 코멘트 수정·삭제            | 수정은 되지만 울린 알림은 못 되돌린다 |

이 차이가 이 문서의 기본값을 전부 결정한다. **기본은 실패만 보낸다.** GitHub 에는
Queued 부터 전부 쓰지만 Slack 에는 결론만 간다. 진행 상태를 Slack 으로 밀면 한 PR 이
사람을 네 번 방해하고, 그 팀은 일주일 안에 채널을 음소거한다.

---

## 2. 두 층 — 워크스페이스 연결과 채널 라우팅

```
워크스페이스 연결   팀당 한 번       "우리 팀 Slack 에 단테를 설치한다"   /team/<id>/settings/slack
      ↓
채널 라우팅        프로젝트마다     "이 레포 결과는 #frontend-ci 로"    /project/<ref>/settings/notifications
```

연결을 **팀**에 다는 이유는 GitHub App 설치와 같은 모양이기 때문이다. 레포 다섯 개를
연결한 팀이 Slack 을 다섯 번 붙일 이유가 없다. 팀 하나에 워크스페이스 하나다
(`SlackInstallation.teamId` 가 unique). 연결·다시 연결·끊기는 팀 owner 만 한다. 연결한
사람이 팀을 떠나거나 탈퇴해도 연결은 팀에 남는다. 채널 라우팅은 프로젝트에 남는다.

이 구분은 화면에도 그대로 나타난다. 팀에 워크스페이스가 안 붙어 있으면 프로젝트 알림
화면에는 Slack 폼 대신 "팀 설정으로 가라"는 배지 하나만 보이고, 붙고 나면 채널 목록이
열린다(§8, §11).

---

## 3. 연결 — OAuth

### 3.1 흐름

```
팀 설정 "Connect Slack" (owner 만)
  → GET /api/slack/install?teamId=…         (state 를 쿠키에 심는다)
  → slack.com/oauth/v2/authorize?client_id=…&scope=…&redirect_uri=…&state=…
  → 사용자가 워크스페이스와 채널 접근을 승인
  → GET /api/slack/callback?code=…&state=…
  → POST oauth.v2.access  (code → bot token)
  → SlackInstallation 저장 (토큰은 암호화, 팀당 한 행을 덮어쓴다)
  → 팀 설정 Slack 화면으로 복귀 (?connected=1 또는 ?error=…)
```

`state` 는 `<팀 id>.<난수>` 다. GitHub App 설치(`lib/github/state.ts`)와 같은 방식으로,
state 를 httpOnly 쿠키(`dante_slack_state`, 10분)에 심고 콜백에서 돌아온 값이 쿠키와
같은지 본다. DB 에 상태 행을 만들지 않는 이유는 이 값이 짧게 살고 끝나서 정리할 것이
남지 않는 편이 낫기 때문이다. 쿠키 대조가 없으면 남이 만든 콜백 URL 로 사용자를 유인해
엉뚱한 워크스페이스를 붙일 수 있다. 팀 id 를 state 에 싣는 건 콜백이 어느 팀에 붙일지
알아야 해서인데, 쿠키와 대조하므로 남이 팀 id 만 바꾼 링크를 만들어도 통하지 않는다.

콜백은 승인 화면에 다녀오는 사이 owner 가 아니게 됐을 수 있어 역할을 한 번 더 본다.
성공이든 실패든 state 쿠키는 지운다. 실패 사유(`owner`, `config`, `state`, `denied`,
`code`, `exchange`)는 `?error=` 로 팀 설정 화면에 돌려주고, 교환 실패면 Slack 오류
코드를 `?detail=` 로 같이 보여준다.

토큰은 `lib/crypto/secret.ts` 의 `encryptSecret` 으로 암호화해 저장한다. 사용자 API
키와 같은 규칙이다 — DB 가 새도 토큰으로 못 쓴다.

### 3.2 필요한 scope

| scope               | 왜                                            |
| ------------------- | --------------------------------------------- |
| `chat:write`        | 메시지 보내기·수정                            |
| `chat:write.public` | 봇을 초대하지 않은 공개 채널에도 보낼 수 있다 |
| `channels:read`     | 공개 채널 목록 (채널 선택기)                  |
| `groups:read`       | 비공개 채널 목록. 봇이 초대된 것만 보인다     |

`chat:write.public` 이 없으면 사용자가 채널마다 `/invite @dante` 를 해야 하고, 그걸
잊은 채로 "왜 안 와요" 문의가 온다. 비공개 채널은 이 scope 로도 안 되므로 초대가
필요하다 — 채널 선택기 아래에 "비공개 채널은 @dante 를 초대해야 목록에 나온다"는
안내를 늘 보여주고, 목록의 비공개 채널에는 `(private)` 를 붙인다.

scope 를 늘리면 이미 연결한 팀은 다시 승인해야 한다. 승인받은 scope 는
`SlackInstallation.scopes` 에 남긴다.

### 3.3 연결이 끊기는 경우

Slack 에서 앱을 지우거나 토큰을 폐기하면 API 가 `token_revoked` / `account_inactive` /
`invalid_auth` / `not_authed` 를 낸다. **이것을 감지하려고 Events API 를 붙이지는
않는다** — 웹훅 엔드포인트가 하나 더 늘고 서명 검증이 또 생긴다. 대신 호출이 그 오류를
내는 순간 `revokedAt` 을 찍고 설정 화면에 배지를 띄운다(§8). 그 호출은 알림 전송,
프로젝트 알림 화면의 채널 목록 조회, 채널 저장, 테스트 알림 네 곳이다. 끊긴 연결로는
아무것도 보내지 않는다.

다시 연결하면 같은 행(팀당 한 행)을 덮어쓰고 `revokedAt` 을 비운다. 다른 워크스페이스로
바꿔 붙이면 옛 토큰을 `auth.revoke` 로 Slack 쪽에서도 폐기한다 — 행만 덮으면 옛
워크스페이스에 앱이 설치된 채로 남는데, 그걸 지울 화면이 우리에게 없다.

### 3.4 연결 끊기와 삭제

- **팀 설정의 Disconnect** (owner 만) — 행을 지우고, 아직 살아 있는 토큰이면
  `auth.revoke` 로 Slack 쪽 토큰도 폐기한다. 폐기는 최선만 다한다(실패해도 로그만 남긴다).
- **팀 삭제 / 계정 삭제(개인 팀이 같이 지워짐)** — `SlackInstallation` 은 Cascade 로
  같이 지워지지만 **봇 토큰은 폐기하지 않는다(아직 없음)**. 워크스페이스에는 앱이 설치된
  채로 남는다.

---

## 4. 무엇을 보낼지

프로젝트마다 켜고 끈다. 기본값이 중요하다.

| 이벤트 (`id`)                   | 기본 | 비고                                                          |
| ------------------------------- | ---- | ------------------------------------------------------------- |
| 테스트 실패 (`failed`)          | 켬   | 이것 하나가 Slack 을 붙이는 이유다                            |
| 실패에서 복구 (`recovered`)     | 켬   | "고쳐졌다"를 모르면 사람이 채널을 계속 쳐다본다               |
| 전부 통과 (`passed`)            | 끔   | 켜면 하루에 수십 번 울린다                                    |
| 단테가 못 끝냄 (`cannotFinish`) | 켬   | 우리 쪽 문제다. 조용히 넘어가면 신뢰를 잃는다                 |
| 진행 상태(Queued 등)            | —    | 토글이 없다. 밀어내는 표면에는 중간 상태를 아예 보내지 않는다 |

"전부 통과"를 켜는 팀도 있다. 릴리스 브랜치처럼 성공 자체가 소식인 경우다. 그래서
끄되 없애지는 않는다.

판정은 이렇다(`lib/slack/rules.ts`). 실행 자체가 실패했으면 `cannotFinish`, 끝났는데
실패가 하나라도 있으면 `failed`, 전부 통과면 이 PR 의 직전 결론이 `failed` 였을 때만
`recovered` 이고 아니면 `passed` 다. 진행 중이거나 테스트가 0개인 실행은 소식이 아니라서
보내지도, 전달 로그에 적지도 않는다. 꺼 둔 이벤트는 보내지 않고 전달 로그에 `skipped`
로 사유를 적는다(§10).

---

## 5. 메시지

### 5.1 모양

한 덩어리 mrkdwn 으로 시작한다. Block Kit 은 버튼과 상호작용이 필요해질 때 간다 —
지금 필요한 건 "무엇이 깨졌고 어디로 가면 되는가" 뿐이다.

```
dante · 3 of 24 tests failed
wlrnjs/my-blog #42

• Button.test.tsx › renders disabled state — expected "true" to be "false"
• Card.test.tsx › applies elevation — snapshot mismatch
• Card.test.tsx › forwards ref — ref is null

Open the pull request · Open in Dante
```

첫 줄에 레포와 PR 번호를 넣는 이유는 §1 이다. Slack 을 보는 사람은 그 PR 을 보고 있지
않다. GitHub 코멘트에서는 생략해도 되는 맥락이 여기서는 필수다. 둘째 줄
`owner/repo #번호` 가 PR 링크다. PR 제목은 넣지 않는다.

- 첫 줄 문구는 이벤트마다 다르다: `N of M tests failed` / `Fixed — all M tests pass now`
  / `All M tests passed` / `Dante couldn't finish this run`.
- 실패 목록은 `failed` 에만 붙는다. 한 줄에 `` `파일` › 테스트 이름 — 사유 `` 이고, 사유는
  첫 줄만, 200자를 넘으면 자른다. `cannotFinish` 에는 실행 오류의 첫 줄을 붙인다.
- 링크는 맨 아래 한 줄. "Open in Dante" 는 `NEXT_PUBLIC_APP_URL` 이 있을 때만 붙는다(§13).
- 테스트 이름에 `<Button>` 같은 글자가 있어도 링크로 읽히지 않게 `& < >` 를 이스케이프한다.
- 링크 미리보기(unfurl)는 끈다. PR 링크마다 GitHub 카드가 펼쳐지면 메시지가 몇 배로 길어진다.
- 문구 언어는 프로젝트마다 고른다(`en` / `ko`, 기본 `en`). 테스트 이름·실패 사유·실행
  오류는 원문 그대로 둔다.

실패 목록은 최대 N 개(GitHub 문서 §4 의 `prCommentFailedLimit`, 기본 10 을 공유한다).
나머지는 `…and 4 more` 로 접고, 전체는 PR 코멘트에 있다. 같은 정보를 두 번 완전하게 적을
이유가 없다 — Slack 은 "가서 봐야 할 이유"를 주는 자리다.

### 5.2 언제 수정하고 언제 새로 보내는가

이게 Slack 에서 가장 자주 틀리는 부분이다.

- **같은 결론이 반복되면 수정한다.** 같은 PR 이 계속 실패 중이면 `chat.update` 로 마지막
  메시지의 숫자만 갱신한다. 푸시마다 새 메시지를 쌓으면 채널이 같은 소식으로 찬다.
- **결론이 바뀌면 새로 보낸다.** 실패 → 성공, 성공 → 실패는 사람이 알아야 하는
  변화인데, 조용히 수정하면 알림이 울리지 않아 아무도 모른다. 수정은 갱신이지 소식이
  아니다.

판정에는 Slack 전용 열 `PullRequestSurface.slackLastEvent`(`failed` / `passed` /
`cannotFinish`)를 쓴다. GitHub 의 `lastConclusion` 은 쓰지 않는다. 이벤트를 꺼서 보내지
않은 경우에도 결론은 적는다 — 통과를 끈 채로 "실패 → 통과"가 오면, 그다음 실패가 복구
뒤의 새 실패인지 알아야 한다.

사람이 메시지를 지워 `chat.update` 가 `message_not_found` 를 내면 새로 보내 스레드를
다시 시작한다.

### 5.3 스레드

같은 PR 의 후속 메시지는 **첫 메시지의 스레드**에 단다. 채널 본문에는 PR 하나당 한
줄만 남는다. 스레드 답글은 기본적으로 알림을 울리지 않으므로 §5.2 의 "결론이 바뀌면
새로" 와 충돌한다 — 결론이 바뀐 경우에만 `reply_broadcast` 로 채널에도 띄운다.

프로젝트의 채널을 바꾸면 옛 스레드는 없는 것으로 치고 새 채널에 새 메시지로 시작한다.
새 채널에는 맥락이 없다.

---

## 6. 멘션 (아직 없음)

> 구현 메모: 멘션 설정과 `slackMentions` 열은 아직 없다. 아래는 기획이다.

실패했을 때 누구를 부를지. 프로젝트 설정에 Slack 사용자·그룹을 몇 개 고를 수 있게
한다(`<@U123>`, `<!subteam^S456>`).

- **첫 실패에만 부른다.** 연속 실패마다 멘션하면 그 사람이 앱을 음소거한다.
- **PR 작성자를 자동으로 찾아 부르지 않는다.** GitHub 계정과 Slack 계정을 잇는 확실한
  방법이 없다. 이메일로 `users.lookupByEmail` 을 쓰면 `users:read.email` 이 필요하고,
  회사 메일과 GitHub 메일이 다른 사람에게는 엉뚱한 사람이 불린다. 잘못 부르는 것이
  안 부르는 것보다 나쁘다. 매핑은 나중에 사용자가 직접 하게 한다.
- `@here` / `@channel` 은 선택지에 두지 않는다. 필요하면 그룹을 만들어 부른다.

---

## 7. 알림 제어

GitHub 과 **공유하는 것**과 **Slack 전용**을 구분한다.

| 제어                       | 범위       | 비고                                     |
| -------------------------- | ---------- | ---------------------------------------- |
| 대상 브랜치 필터           | 공유       | "적용 범위" 섹션 하나가 모든 표면에 건다 |
| Draft PR 제외              | 공유       | 같은 이유                                |
| `skip-dante` 라벨          | 공유       | 같은 이유                                |
| `[skip dante]` 커밋 메시지 | 공유       | 같은 이유                                |
| 스누즈                     | 공유       | "아무 데도 쓰지 않기"가 스누즈의 정의다  |
| 어떤 이벤트를 보낼지       | Slack 전용 | §4                                       |
| 어느 채널로                | Slack 전용 | 프로젝트당 하나                          |
| 메시지 언어                | Slack 전용 | §5.1                                     |
| 멘션 대상                  | Slack 전용 | §6 (아직 없음)                           |

공유하는 것을 표면마다 따로 두면 "드래프트 PR 을 껐는데 왜 Slack 은 오지" 가 된다.
적용 범위는 "이 PR 에 우리가 관여할지"의 판정이고, 표면 설정은 "관여한다면 어디에
어떻게"의 문제다. `lib/notifications/scope.ts` 가 앞의 판정만 순수 함수로 들고 있고,
`lib/notifications/deliver.ts` 가 그 판정을 통과한 실행만 Slack 에 넘긴다. 범위 밖이라
건너뛴 PR 은 GitHub 표면에만 `skipped` 를 적고 Slack 행은 남기지 않는다.

---

## 8. 연결 상태 배지

| 상태                    | 표시                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 정상                    | (배지 없음)                                                                                                                                        |
| 워크스페이스 미연결     | 프로젝트 알림 화면: Slack 폼 대신 "Slack isn't connected" + "Open team settings". 팀 설정: "No workspace connected" + Connect Slack(owner 만)      |
| 토큰 폐기 / 앱 삭제됨   | 프로젝트 알림 화면: 폼 대신 "The Slack connection was lost" + "Open team settings". 팀 설정: 같은 제목 + Reconnect(owner 만)                       |
| 채널 목록을 못 받음     | 채널 선택기 아래 "Couldn't list channels. Slack said: <코드>". 저장된 채널은 그대로 보여준다                                                       |
| 채널이 사라짐·보관됨    | (아직 없음) 배지는 없다. 저장할 때 보관된 채널은 거절한다(`#<채널> is archived.`). 목록에 없는 저장 채널도 선택지에 남겨 조용히 비워지지 않게 한다 |
| 비공개 채널에 봇 없음   | (아직 없음) 배지는 없다. 채널 선택기 아래의 초대 안내(§3.2)만 있다                                                                                 |
| 최근 3건 연속 전달 실패 | "Recent notifications were not delivered" + 로그 링크. 표면을 가리지 않고 최근 전달·실패 3건이 모두 실패일 때 뜬다                                 |

마지막 배지만 GitHub 쪽 배지 목록(`lib/notifications/status.ts`)에서 나온다. Slack 연결
배지는 그 목록에 합치지 않고, 프로젝트 알림 화면과 팀 설정 화면이 같은 `StatusBadge`
컴포넌트로 직접 그린다.

---

## 9. 테스트 알림 보내기

GitHub 에서는 진짜 PR 에 시험 코멘트를 달 수 없어 미리보기를 만들었지만, Slack 은
**진짜 한 건 보내는 것이 맞다.** 확인해야 하는 게 문구가 아니라 "이 채널에 실제로
도착하는가"이기 때문이다 — scope, 채널 권한, 봇 초대 여부는 보내봐야 안다.

- 버튼 하나("Send a test message"). 지금은 항상 표본 실패 결과로 보낸다. 최근 실제 실행
  결과로 보내는 것은 아직 없다.
- 화면에서 지금 고른 채널과 언어로 보낸다. 저장하기 전에 시험해 볼 수 있다.
- 메시지 맨 위에 "테스트 알림"임을 명시한다("Test notification from Dante — sample
  results, nothing actually ran."). 받은 사람이 진짜 실패로 오해하면 안 된다. PR 번호
  대신 레포로 링크하고, 가짜 프로젝트를 가리키는 "Open in Dante" 링크는 뺀다.
- 결과는 즉시 화면에 표시한다. 실패하면 Slack 이 준 오류 코드를 그대로 보여준다
  (`Slack said: channel_not_found`, `not_in_channel`, `invalid_auth`). 성공·실패 모두
  전달 로그에 PR 없이 한 줄 남긴다.

---

## 10. 전달 로그

GitHub 과 같은 표에 `slack` 행이 섞인다. `NotificationDelivery.surface` 가 문자열이라
마이그레이션 없이 값만 는다.

| 시각       | PR  | 표면  | 결과                                |
| ---------- | --- | ----- | ----------------------------------- |
| 2 min ago  | #42 | slack | delivered — posted to #frontend-ci  |
| 5 min ago  | #41 | slack | failed — not_in_channel             |
| 1 hour ago | #40 | slack | skipped — passing runs are silent   |
| 1 day ago  | —   | slack | delivered — test message to #alerts |

`delivered` 의 상세는 `posted to #채널`(새 메시지) / `replied in #채널`(스레드 답글) /
`updated in #채널`(수정) 중 하나다. `skipped` 사유는 꺼 둔 이벤트에 따라
`failures are turned off` / `fixes are turned off` / `passing runs are silent` /
`Dante errors are turned off` 다. 팀에 연결이 없으면 `failed — Slack is not connected
for this team` 이다.

Slack 오류 코드를 번역하지 않고 그대로 적는다. `not_in_channel` 은 검색하면 답이
나오지만 "채널 오류"는 아무것도 알려주지 않는다.

---

## 11. 설정 화면 구성

```
Notifications                              ← /project/<ref>/settings/notifications
├─ [GitHub 연결이 끊겼으면] 연결 배너
├─ [스누즈 중이면] 해제 배너
├─ 배지 (§8 의 최근 3건 실패 등)
├─ GitHub                                  ← notifications-github.md
├─ 적용 범위 · 스누즈                        ← 모든 표면에 공통
├─ Discord                                 ← 기획 문서 없음 (범위 밖 참고)
├─ Slack                                   ← 이 문서
│  ├─ [미연결·끊김이면] 폼 대신 팀 설정으로 가는 배지
│  ├─ Post to Slack 켜기 (워크스페이스 이름은 섹션 설명에)
│  ├─ 채널 선택기
│  ├─ 무엇을 보낼지 (§4 토글 넷)
│  ├─ 실패 시 멘션 (§6, 아직 없음)
│  ├─ 메시지 언어 (en / ko)
│  └─ Save · Send a test message (§9)
├─ Email                                   ← 아직 없음 (Coming soon)
└─ 전달 로그

Team settings › Slack                      ← /team/<id>/settings/slack
└─ 워크스페이스 이름 · 연결한 사람 · Connect / Reconnect / Disconnect (owner 만)
```

---

## 12. 데이터 모델

```prisma
/// Slack 워크스페이스 설치. 팀당 한 행.
model SlackInstallation {
  id     String @id @default(uuid()) @db.Uuid
  teamId String @unique @map("team_id") @db.Uuid

  /// Slack 쪽 워크스페이스 id ("T0123"). 이름은 바뀔 수 있어 표시용으로만 캐시한다.
  slackTeamId       String   @map("slack_team_id")
  slackTeamName     String   @map("slack_team_name")
  botUserId         String   @map("bot_user_id")
  /// xoxb- 토큰. 평문으로 두지 않는다 (lib/crypto/secret.ts).
  encryptedBotToken String   @map("encrypted_bot_token")
  /// 승인받은 scope. 나중에 scope 를 늘리면 다시 승인받아야 하는지 여기서 판단한다.
  scopes            String[]

  /// 연결한 사람. 탈퇴해도 연결은 팀에 남는다.
  installedById String?   @map("installed_by_id") @db.Uuid
  /// token_revoked / account_inactive 를 만난 시각. null 이면 살아 있다.
  revokedAt     DateTime? @map("revoked_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  team        Team  @relation(fields: [teamId], references: [id], onDelete: Cascade)
  installedBy User? @relation(fields: [installedById], references: [id], onDelete: SetNull)

  @@map("slack_installations")
}
```

프로젝트 쪽 설정은 기존 `ProjectNotificationSetting` 에 열을 더했다. 표면마다 테이블을
나누면 "이 프로젝트의 알림 설정"을 읽는 데 조인이 늘어난다. 워크스페이스는 팀에서
오므로 프로젝트가 설치를 고르는 열은 없다.

```prisma
model ProjectNotificationSetting {
  // …GitHub 열은 notifications-github.md §11, Discord 열은 생략

  slackEnabled     Boolean @default(false) @map("slack_enabled")
  /// 채널 id ("C0123"). 이름은 바뀌므로 표시용으로만 캐시한다.
  slackChannelId   String? @map("slack_channel_id")
  slackChannelName String? @map("slack_channel_name")
  /// { failed, recovered, passed, cannotFinish } — §4. 빈 객체면 기본값.
  slackEvents      Json    @default("{}") @map("slack_events")
  /// "en" | "ko" — §5.1
  slackLocale      String  @default("en") @map("slack_locale")

  // 아직 없음 — §6
  // slackMentions String[] @default([]) @map("slack_mentions")
}
```

PR 하나에 보낸 메시지의 좌표도 필요하다. `PullRequestSurface` 에 네 열을 더했다.

```prisma
model PullRequestSurface {
  // …commentId, checkRunId, lastConclusion, Discord 열

  /// chat.update 와 스레드 답글에 쓰는 좌표. 채널이 바뀌면 새로 시작한다.
  slackChannelId String? @map("slack_channel_id")
  /// 이 PR 의 첫 메시지. 후속 메시지는 이 스레드에 단다.
  slackThreadTs  String? @map("slack_thread_ts")
  /// 마지막으로 보낸 메시지. 같은 결론이 반복되면 이것을 고쳐 쓴다.
  slackMessageTs String? @map("slack_message_ts")
  /// 마지막 결론 ("failed" | "passed" | "cannotFinish"). 보내지 않았어도 적는다 (§5.2).
  slackLastEvent String? @map("slack_last_event")
}
```

---

## 13. Slack App 설정과 환경변수

앱 등록은 https://api.slack.com/apps 에서 한 번. 배포 환경마다 redirect URL 이 다르므로
개발용과 운영용 앱을 따로 두는 편이 낫다.

| 항목             | 값                                                 |
| ---------------- | -------------------------------------------------- |
| Redirect URL     | `<앱 주소>/api/slack/callback`                     |
| Bot token scopes | §3.2 의 넷                                         |
| Events API       | 쓰지 않는다 (§3.3)                                 |
| 배포             | 단일 워크스페이스면 그대로, 공개 배포는 Slack 심사 |

```
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URL=     # 선택
```

`SLACK_CLIENT_ID` 나 `SLACK_CLIENT_SECRET` 이 비면 팀 설정 화면이 연결 버튼 대신 안내를
띄운다. 눌러서 Slack 오류 화면을 보는 것보다 낫다.

redirect URL 은 기본으로 요청 주소의 origin 에 `/api/slack/callback` 을 붙여 만든다.
Slack App 에 적은 값과 글자 하나까지 같아야 하는데, 로컬에서 https 터널로 받으면서 Next
가 요청을 localhost 로 보는 경우처럼 origin 이 어긋나면 `SLACK_REDIRECT_URL` 로
못박는다.

`NEXT_PUBLIC_APP_URL` 은 redirect URL 과 상관없다. 메시지의 "Open in Dante" 링크에만
쓰이고(GitHub 딥링크와 같은 값), 비어 있으면 그 링크를 빼고 보낸다.

---

## 범위 밖

- **Discord** — 기획 문서가 따로 없다. 코드는 이미 있다(`lib/notifications/discord.ts`,
  `discord-send.ts`, 프로젝트 알림 화면의 Discord 섹션). 연결이 다르다 — OAuth 없이
  프로젝트 알림 설정에 채널 웹훅 URL 하나를 붙인다(`ProjectNotificationSetting` 의
  `encryptedDiscordWebhookUrl`). 이벤트 넷과 기본값, "언제 보내고 언제 고치나"는 이
  문서 §4·§5 를 따른다고 코드에 적혀 있다.
- **Email** — 아직 없다. 설정 화면에 Coming soon 만 있고 문서도 없다. 스코프가
  프로젝트가 아니라 개인이고, 다이제스트 주기가 핵심 설계 축이라 따로 다룬다.
- **슬래시 커맨드 / 버튼** — `/dante rerun` 같은 상호작용. 요청 서명 검증과 3초 응답
  규칙이 따라붙는다. 읽기 전용 알림이 자리를 잡은 뒤에 본다.
- **GitHub 계정 ↔ Slack 계정 자동 매핑** — §6 의 이유로 1차 범위 밖.
- **워크스페이스 여러 개에 동시 전송** — 팀 하나는 워크스페이스 하나, 프로젝트 하나는
  채널 하나로 시작한다.
