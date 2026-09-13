import type { NextConfig } from "next";
import { MODEL } from "./src/lib/ai/chat-model";
import { hasRate } from "./src/lib/ai/pricing";

// 단가표에 없는 모델로는 빌드(과 dev 서버)가 뜨지 않게 한다.
//
// MODEL 을 바꾸고 pricing.ts 를 안 고치면 원가가 null 로 기록되고, 한도 판정은
// 호출마다 추정치(budget.ts 의 UNKNOWN_CALL_COST_USD)로 센다 — 조용히 틀린다.
// 런타임에 던지면 배포가 끝난 뒤 사용자 요청에서야 드러나므로, 설정 파일이 읽히는
// 시점(next build / next dev)에 막는다. 테스트 러너가 없는 저장소라 여기가 가장
// 확실히 매번 도는 자리다.
if (!hasRate(MODEL)) {
  throw new Error(
    `pricing.ts 에 "${MODEL}" 단가가 없습니다. chat-model.ts 의 MODEL 을 바꿨다면 단가표도 같이 고치세요.`
  );
}

const nextConfig: NextConfig = {
  images: {
    // 프로필 이미지 호스트 화이트리스트. 여기 없는 호스트를 next/image 에 넘기면
    // 최적화 요청이 400 으로 막힌다 — 아무 URL 이나 우리 서버로 프록시되는 걸
    // 막기 위한 기본 동작이다.
    remotePatterns: [
      // GitHub 아바타. URL 에 ?v=4 가 붙어 오므로 search 를 제한하지 않는다.
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Google 아바타. 계정마다 lh3·lh4… 로 갈려서 서브도메인을 열어둔다.
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },

  async redirects() {
    return [
      // 온보딩 4단계가 /api-key → /ai 로 바뀌었다. 키를 받지 않는데 URL 에
      // api-key 가 남아 있으면 거짓말이라 이름을 옮겼고, 그동안 나간 링크
      // (메일·북마크·에러 리포트)가 404 로 죽지 않게 여기서 받아준다.
      {
        source: "/projects/setup/:projectRef/api-key",
        destination: "/projects/setup/:projectRef/ai",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
