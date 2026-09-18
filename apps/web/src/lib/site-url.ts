// 사이트의 절대 주소. robots.txt·sitemap.xml 처럼 요청 origin 없이 절대 URL 을 적어야 하는 곳에서 쓴다.
//
// NEXT_PUBLIC_APP_URL 이 먼저다(메일·PR 코멘트 링크와 같은 값). 비어 있으면 Vercel 이 넣어 주는
// 운영 도메인, 그것도 없으면(로컬) localhost 로 떨어진다.
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
