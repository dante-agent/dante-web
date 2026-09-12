import type { NextConfig } from "next";

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
