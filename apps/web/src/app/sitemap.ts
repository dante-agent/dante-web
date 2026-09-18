import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// 검색에 열어 둔 공개 페이지만 적는다 — 각 페이지의 robots 가 index 인 곳과 같게 맞춘다.
// 공개 페이지를 늘리면 여기도 같이 추가한다.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
