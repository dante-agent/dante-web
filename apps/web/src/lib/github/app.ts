import { App } from "octokit";

// ⚠️ 서버 전용. private key 를 읽으므로 클라이언트 컴포넌트에서 import 하면 안 된다.
// (`server-only` 패키지를 쓰면 컴파일 단계에서 막히지만 새 의존성이라 아직 안 넣었다.)
//
// 로그인용 Supabase GitHub OAuth 와 헷갈리지 말 것:
//   로그인    "너 누구야"       → Supabase Auth  (src/lib/supabase/*)
//   레포 접근  "어떤 레포 볼래"  → 이 파일의 GitHub App
//
// 사용자 액세스 토큰은 저장하지 않는다. 필요할 때마다 App private key 로 서명한
// JWT 를 GitHub 에 내밀고 1시간짜리 "설치 토큰"을 받아 쓴다. Octokit 의 App 이
// 그 발급과 캐싱을 대신해준다.

let cached: App | null = null;

export function githubApp() {
  if (cached) return cached;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY 가 없습니다. .env.example 참고.");
  }

  cached = new App({ appId, privateKey: normalizePrivateKey(privateKey) });
  return cached;
}

/**
 * .env 파일은 한 줄이라 PEM 의 개행을 그대로 담을 수 없다.
 * 두 가지 흔한 표기를 모두 받아준다.
 *   1) 개행을 문자 그대로 "\n" 으로 바꿔 넣은 경우
 *   2) PEM 전체를 base64 로 인코딩해 넣은 경우 (Vercel 환경변수에서 자주 쓴다)
 */
function normalizePrivateKey(raw: string) {
  const value = raw.trim().replace(/^["']|["']$/g, "");
  if (value.includes("-----BEGIN")) return value.replace(/\\n/g, "\n");
  return Buffer.from(value, "base64").toString("utf8");
}

/**
 * 설치 화면 URL. 사용자를 여기로 보내면 GitHub 이 "어떤 레포를 열어줄지" 고르게 하고,
 * 끝나면 App 설정의 Setup URL(= /api/github/setup)로 되돌려보낸다.
 *
 * state 는 우리가 만든 1회용 난수다. 돌아왔을 때 쿠키의 값과 같은지 봐서
 * "이 설치는 우리 사이트에서 시작된 것"임을 확인한다(CSRF 방지).
 */
export function installationUrl(state: string) {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) throw new Error("GITHUB_APP_SLUG 가 없습니다. .env.example 참고.");

  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;
}

/**
 * 사용자가 레포를 더 열어주거나 연결을 끊는 화면. 설치 후에만 의미가 있다.
 *
 * 개인 계정과 조직의 경로가 다르다. 개인 설치의 URL 로 조직 설치를 열면 GitHub 이
 * 404 를 낸다 — 권한 없는 리소스에 403 대신 404 를 주기 때문에, 사용자에게는
 * "없는 페이지"로만 보이고 어디로 가야 하는지 알 길이 없다.
 */
export function installationSettingsUrl(installation: {
  id: bigint | number;
  accountLogin: string;
  accountType: string;
}) {
  const tail = `settings/installations/${installation.id}`;

  // accountType 은 GitHub 이 준 값 그대로다("User" | "Organization"). 값이 상하거나
  // 새 종류가 생기면 개인 경로로 떨어진다 — 둘 중 계정 소유자에게는 맞는 쪽이다.
  return installation.accountType === "Organization"
    ? `https://github.com/organizations/${installation.accountLogin}/${tail}`
    : `https://github.com/${tail}`;
}

/** App 자격(JWT)으로 설치 정보를 읽는다. 설치가 실재하는지, 누구 계정인지 확인용. */
export async function fetchInstallation(installationId: number) {
  const { data } = await githubApp().octokit.request("GET /app/installations/{installation_id}", {
    installation_id: installationId,
  });
  return data;
}
