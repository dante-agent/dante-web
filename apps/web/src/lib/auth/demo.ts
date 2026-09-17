// 심사용 데모 계정(로그인 화면의 Preview 버튼, app/auth/actions.ts).
//
// 심사관 여럿이 같은 계정을 돌려 쓴다. 한 사람이 프로젝트를 지우거나 실행 설정을 망가뜨리면
// 다음 사람은 빈 화면을 보고, 초대는 실제 메일이 나간다. 그래서 되돌릴 수 없거나 밖으로
// 나가는 액션만 서버에서 막는다. 테스트 생성·실행·채팅은 보여주려는 기능이라 막지 않는다.

export const DEMO_BLOCKED_MESSAGE = "This isn't available in the demo account.";

export function isDemoUser(user: { email?: string | null }) {
  const email = process.env.DEMO_EMAIL;
  return Boolean(email) && user.email === email;
}
