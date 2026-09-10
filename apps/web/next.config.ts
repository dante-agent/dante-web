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
};

export default nextConfig;
