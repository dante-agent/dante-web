import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// 화면은 막지 않는다. 로그인해야 보이는 페이지는 비로그인 크롤러가 오면 로그인 화면으로
// 튕기고, 루트 layout 의 기본 noindex 가 한 번 더 막는다. 여기서 Disallow 로 막으면 크롤러가
// 그 noindex 를 읽지 못해 URL 만 색인되는 경우가 생긴다.
// API 는 HTML 이 아니라 볼 게 없으니 뺀다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
