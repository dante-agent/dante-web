// 알림 문구의 언어. PR 코멘트·체크, Discord, Slack 이 같은 모양을 쓴다.
//
// 설정 화면은 영어지만, 알림을 받는 팀은 한국어로 받고 싶을 수 있다. 번역 라이브러리를
// 들일 만큼 문장이 많지 않아서 각 표면이 자기 문구 표(COPY)를 이 키로 나눠 들고 있다.

export type NotificationLocale = "en" | "ko";

export const NOTIFICATION_LOCALES: { id: NotificationLocale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ko", label: "한국어" },
];

/** DB 에는 문자열 칸이라 무엇이든 들어올 수 있다. 모르는 값은 영어로. */
export function parseNotificationLocale(value: unknown): NotificationLocale {
  return value === "ko" ? "ko" : "en";
}
