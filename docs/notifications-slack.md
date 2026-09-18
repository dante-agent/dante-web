# 알림 — Slack

알림 기획 중 **Slack** 표면만 다룬다. GitHub 은 `notifications-github.md`, Discord 와
Email 은 별도 문서.

> 구현 메모 (2026-09-18): 팀 모델이 들어온 뒤라 워크스페이스 연결은 **사용자가 아니라
> 팀**에 붙였다(`SlackInstallation.teamId`, 팀 설정 `/team/<id>/settings/slack`, owner 만).
> 아래 "사용자당"은 팀당으로 읽는다. §6 멘션과 §8 의 채널·초대 배지는 아직 없다.

설정 위치는 GitHub 과 같은 `/project/<ref>/settings/notifications` 다. 다만 이 표면은
**두 층으로 쪼개진다** — 워크스페이스를 붙이는 일은 사람당 한 번이고, 어느 채널로
무엇을 보낼지는 프로젝트마다 다르다.

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
워크스페이스 연결   사용자당 한 번   "우리 팀 Slack 에 단테를 설치한다"
      ↓
채널 라우팅        프로젝트마다     "이 레포 결과는 #frontend-ci 로"
```

연결을 **사용자**에 다는 이유는 GitHub App 설치와 같은 모양이기 때문이다. 레포 다섯
개를 연결한 사람이 Slack 을 다섯 번 붙일 이유가 없다. 팀 모델이 생기면 소유자만
`Team` 으로 옮기면 되고, 채널 라우팅은 그대로 프로젝트에 남는다.

이 구분은 화면에도 그대로 나타난다. 워크스페이스가 안 붙어 있으면 채널 선택기 자리에
"Slack 워크스페이스 연결" 버튼 하나만 보이고, 붙고 나면 채널 목록이 열린다.

---

## 3. 연결 — OAuth

### 3.1 흐름

```
설정 화면 "Connect Slack"
  → slack.com/oauth/v2/authorize?client_id=…&scope=…&state=…
  → 사용자가 워크스페이스와 채널 접근을 승인
  → GET /api/slack/callback?code=…&state=…
  → POST oauth.v2.access  (code → bot token)
  → SlackInstallation 저장 (토큰은 암호화)
  → 설정 화면으로 복귀
```

`state` 는 서명한 짧은 문자열이다. 사용자 id, 돌아갈 프로젝트 ref, nonce, 만료
시각을 담고 HMAC 으로 서명한다. DB 에 상태 행을 만들지 않는 이유는 이 값이 5분짜리라
정리할 것이 남지 않는 편이 낫기 때문이다. 서명이 없으면 남이 만든 콜백 URL 로
사용자를 유인해 엉뚱한 워크스페이스를 붙일 수 있다.

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
필요하다 — 채널 선택기에서 비공개 채널에는 그 안내를 같이 보여준다.

### 3.3 연결이 끊기는 경우

Slack 에서 앱을 지우거나 토큰을 폐기하면 API 가 `token_revoked` / `account_inactive`
를 낸다. **이것을 감지하려고 Events API 를 붙이지는 않는다** — 웹훅 엔드포인트가 하나
더 늘고 서명 검증이 또 생긴다. 대신 호출이 그 오류를 내는 순간 `revokedAt` 을 찍고
설정 화면에 배지를 띄운다(§8). 다시 연결하면 같은 행을 덮어쓴다.

---

## 4. 무엇을 보낼지

프로젝트마다 켜고 끈다. 기본값이 중요하다.

| 이벤트               | 기본 | 비고                                            |
| -------------------- | ---- | ----------------------------------------------- |
| 테스트 실패          | 켬   | 이것 하나가 Slack 을 붙이는 이유다              |
| 실패에서 복구        | 켬   | "고쳐졌다"를 모르면 사람이 채널을 계속 쳐다본다 |
| 전부 통과            | 끔   | 켜면 하루에 수십 번 울린다                      |
| 단테가 못 끝냄       | 켬   | 우리 쪽 문제다. 조용히 넘어가면 신뢰를 잃는다   |
| 진행 상태(Queued 등) | 끔   | 밀어내는 표면에는 중간 상태를 보내지 않는다     |

"전부 통과"를 켜는 팀도 있다. 릴리스 브랜치처럼 성공 자체가 소식인 경우다. 그래서
끄되 없애지는 않는다.

---

## 5. 메시지

### 5.1 모양

한 덩어리 mrkdwn 으로 시작한다. Block Kit 은 버튼과 상호작용이 필요해질 때 간다 —
지금 필요한 건 "무엇이 깨졌고 어디로 가면 되는가" 뿐이다.

```
dante · 3 of 24 tests failed
wlrnjs/my-blog #42 — Add card elevation

Button.test.tsx › renders disabled state — expected "true" to be "false"
Card.test.tsx › applies elevation — snapshot mismatch
Card.test.tsx › forwards ref — ref is null

Open the pull request | Open in Dante
```

첫 줄에 레포와 PR 번호를 넣는 이유는 §1 이다. Slack 을 보는 사람은 그 PR 을 보고 있지
않다. GitHub 코멘트에서는 생략해도 되는 맥락이 여기서는 필수다.

실패 목록은 최대 N 개(§GitHub 문서 §4 의 `prCommentFailedLimit` 를 공유한다). 나머지는
`…and 4 more` 로 접고, 전체는 PR 코멘트에 있다. 같은 정보를 두 번 완전하게 적을 이유가
없다 — Slack 은 "가서 봐야 할 이유"를 주는 자리다.

### 5.2 언제 수정하고 언제 새로 보내는가

이게 Slack 에서 가장 자주 틀리는 부분이다.

- **같은 결론이 반복되면 수정한다.** 같은 PR 이 계속 실패 중이면 `chat.update` 로 기존
  메시지의 숫자만 갱신한다. 푸시마다 새 메시지를 쌓으면 채널이 같은 소식으로 찬다.
- **결론이 바뀌면 새로 보낸다.** 실패 → 성공, 성공 → 실패는 사람이 알아야 하는
  변화인데, 조용히 수정하면 알림이 울리지 않아 아무도 모른다. 수정은 갱신이지 소식이
  아니다.

판정에는 `PullRequestSurface.lastConclusion` 을 그대로 쓴다(GitHub 문서 §11). 표면은
달라도 "직전에 뭐라고 말했는가"는 같은 값이다.

### 5.3 스레드

같은 PR 의 후속 메시지는 **첫 메시지의 스레드**에 단다. 채널 본문에는 PR 하나당 한
줄만 남는다. 스레드 답글은 기본적으로 알림을 울리지 않으므로 §5.2 의 "결론이 바뀌면
새로" 와 충돌한다 — 결론이 바뀐 경우에만 `reply_broadcast` 로 채널에도 띄운다.

---

## 6. 멘션

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

| 제어                 | 범위       | 비고                                     |
| -------------------- | ---------- | ---------------------------------------- |
| 대상 브랜치 필터     | 공유       | "적용 범위" 섹션 하나가 모든 표면에 건다 |
| Draft PR 제외        | 공유       | 같은 이유                                |
| `skip-dante` 라벨    | 공유       | 같은 이유                                |
| 스누즈               | 공유       | "아무 데도 쓰지 않기"가 스누즈의 정의다  |
| 어떤 이벤트를 보낼지 | Slack 전용 | §4                                       |
| 어느 채널로          | Slack 전용 | 프로젝트당 하나                          |
| 멘션 대상            | Slack 전용 | §6                                       |

공유하는 것을 표면마다 따로 두면 "드래프트 PR 을 껐는데 왜 Slack 은 오지" 가 된다.
적용 범위는 "이 PR 에 우리가 관여할지"의 판정이고, 표면 설정은 "관여한다면 어디에
어떻게"의 문제다. `lib/notifications/scope.ts` 가 이미 앞의 판정만 순수 함수로 들고
있으므로 Slack 도 그 함수를 그대로 부른다.

---

## 8. 연결 상태 배지

| 상태                    | 표시                                                  |
| ----------------------- | ----------------------------------------------------- |
| 정상                    | (배지 없음)                                           |
| 워크스페이스 미연결     | 채널 선택기 대신 "Connect Slack" 버튼                 |
| 토큰 폐기 / 앱 삭제됨   | "Slack 연결이 끊겼습니다" + 다시 연결 링크            |
| 채널이 사라짐·보관됨    | "#frontend-ci 를 찾을 수 없습니다" + 채널 다시 고르기 |
| 비공개 채널에 봇 없음   | "이 채널에 /invite @dante 가 필요합니다"              |
| 최근 3건 연속 전달 실패 | "최근 알림이 전달되지 않았습니다" + 로그 링크         |

GitHub 쪽 배지(`lib/notifications/status.ts`)와 같은 타입을 쓰고 목록만 합친다. 화면에
배지를 그리는 코드는 한 벌이면 된다.

---

## 9. 테스트 알림 보내기

GitHub 에서는 진짜 PR 에 시험 코멘트를 달 수 없어 미리보기를 만들었지만, Slack 은
**진짜 한 건 보내는 것이 맞다.** 확인해야 하는 게 문구가 아니라 "이 채널에 실제로
도착하는가"이기 때문이다 — scope, 채널 권한, 봇 초대 여부는 보내봐야 안다.

- 버튼 하나. 최근 실제 실행 결과가 있으면 그것으로, 없으면 표본으로 보낸다.
- 메시지에 "테스트 알림"임을 명시한다. 받은 사람이 진짜 실패로 오해하면 안 된다.
- 결과는 즉시 화면에 표시한다. 실패하면 Slack 이 준 오류 코드를 그대로 보여준다
  (`channel_not_found`, `not_in_channel`, `invalid_auth`).

---

## 10. 전달 로그

GitHub 과 같은 표에 `slack` 행이 섞인다. `NotificationDelivery.surface` 가 문자열이라
마이그레이션 없이 값만 는다.

| 시각      | PR  | 표면  | 결과                              |
| --------- | --- | ----- | --------------------------------- |
| 2 min ago | #42 | slack | delivered — #frontend-ci          |
| 5 min ago | #41 | slack | failed — not_in_channel           |
| 1 hour    | #40 | slack | skipped — passing runs are silent |

Slack 오류 코드를 번역하지 않고 그대로 적는다. `not_in_channel` 은 검색하면 답이
나오지만 "채널 오류"는 아무것도 알려주지 않는다.

---

## 11. 설정 화면 구성

```
Notifications
├─ [스누즈 중이면] 해제 배너
├─ GitHub                                  ← notifications-github.md
├─ Slack                                   ← 이 문서
│  ├─ 워크스페이스 (미연결이면 Connect 버튼 하나)
│  ├─ 채널 선택기
│  ├─ 무엇을 보낼지 (§4 토글 다섯)
│  ├─ 실패 시 멘션 (§6)
│  └─ 테스트 알림 보내기 (§9)
├─ 적용 범위                                ← 모든 표면에 공통
├─ Discord / Email                          ← 별도 문서
└─ 전달 로그
```

---

## 12. 데이터 모델 초안

```prisma
/// Slack 워크스페이스 설치. 사용자당 워크스페이스마다 한 행.
///
/// 프로젝트가 아니라 사용자에 다는 이유는 GitHub App 설치와 같다 — 레포를 다섯 개
/// 연결한 사람이 워크스페이스를 다섯 번 붙일 이유가 없다. 팀 모델이 생기면 이 행의
/// 주인만 Team 으로 옮긴다.
model SlackInstallation {
  id     String @id @default(uuid()) @db.Uuid
  userId String @map("user_id") @db.Uuid

  /// Slack 쪽 워크스페이스 id ("T0123"). 표시용 이름은 바뀔 수 있어 따로 캐시한다.
  teamId    String  @map("team_id")
  teamName  String  @map("team_name")
  botUserId String  @map("bot_user_id")
  /// xoxb- 토큰. 평문으로 두지 않는다 (lib/crypto/secret.ts).
  encryptedBotToken String @map("encrypted_bot_token")
  /// 승인받은 scope. 나중에 scope 를 늘리면 재승인이 필요한지 여기서 판단한다.
  scopes String[]

  /// token_revoked / account_inactive 를 만난 시각. null 이면 살아 있다.
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt      @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, teamId])
  @@map("slack_installations")
}
```

프로젝트 쪽 설정은 기존 `ProjectNotificationSetting` 에 열을 더한다. 표면마다 테이블을
나누면 "이 프로젝트의 알림 설정"을 읽는 데 조인이 늘어난다.

```prisma
model ProjectNotificationSetting {
  // …GitHub 열은 notifications-github.md §11

  /// 어느 설치를 쓰는지. 사용자가 워크스페이스를 여러 개 붙일 수 있다.
  slackInstallationId String? @map("slack_installation_id") @db.Uuid
  slackEnabled        Boolean @default(false) @map("slack_enabled")
  /// 채널 id ("C0123"). 이름은 바뀌므로 표시용으로만 캐시한다.
  slackChannelId   String? @map("slack_channel_id")
  slackChannelName String? @map("slack_channel_name")
  /// { failed, recovered, passed, cannotFinish } — §4
  slackEvents Json @map("slack_events")
  /// 실패 시 부를 대상. "U0123" | "S0456"(그룹)
  slackMentions String[] @default([]) @map("slack_mentions")
}
```

PR 하나에 보낸 메시지의 좌표도 필요하다. `PullRequestSurface` 에 두 열을 더한다.

```prisma
model PullRequestSurface {
  // …commentId, checkRunId, lastConclusion

  /// chat.update 와 스레드 답글에 쓰는 좌표. 채널이 바뀌면 새로 시작한다.
  slackChannelId String? @map("slack_channel_id")
  slackMessageTs String? @map("slack_message_ts")
}
```

---

## 13. Slack App 설정과 환경변수

앱 등록은 https://api.slack.com/apps 에서 한 번. 배포 환경마다 redirect URL 이 다르므로
개발용과 운영용 앱을 따로 두는 편이 낫다.

| 항목             | 값                                                 |
| ---------------- | -------------------------------------------------- |
| Redirect URL     | `<APP_URL>/api/slack/callback`                     |
| Bot token scopes | §3.2 의 넷                                         |
| Events API       | 쓰지 않는다 (§3.3)                                 |
| 배포             | 단일 워크스페이스면 그대로, 공개 배포는 Slack 심사 |

```
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
```

`NEXT_PUBLIC_APP_URL` 이 redirect URL 의 앞부분이 된다. GitHub 딥링크와 같은 값을 쓴다
— 지금은 비어 있어서 Slack 연결도 그것부터 채워야 한다.

---

## 범위 밖

- **Discord** — 메시지 모양과 제어는 이 문서와 거의 같지만 연결이 다르다(웹훅 URL
  하나). 별도 문서에서 다루되 §4~§7 은 이 문서를 참조한다.
- **Email** — 스코프가 프로젝트가 아니라 개인이다. 다이제스트 주기가 핵심 설계 축이라
  따로 다룬다.
- **슬래시 커맨드 / 버튼** — `/dante rerun` 같은 상호작용. 요청 서명 검증과 3초 응답
  규칙이 따라붙는다. 읽기 전용 알림이 자리를 잡은 뒤에 본다.
- **GitHub 계정 ↔ Slack 계정 자동 매핑** — §6 의 이유로 1차 범위 밖.
- **워크스페이스 여러 개에 동시 전송** — 프로젝트 하나는 채널 하나로 시작한다.
