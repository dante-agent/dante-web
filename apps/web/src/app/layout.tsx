import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";
import { Providers } from "./providers";

// DESIGN.md §3 — sans: Geist(400/600), mono: Hack(400/700)
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Hack 은 hack-font 패키지의 서브셋 woff2(ASCII·라틴·일반 구두점, 각 ~23KB)만 쓴다.
// 전체판(hack.css, 각 ~108KB)은 그리스·키릴·박스 문자까지 들어 있어 무겁다. 이탤릭은 앱에서 안 쓴다.
// adjustFontFallback: false — 기본값('Arial' 메트릭 보정 폴백)이 끼면 로딩 중 폴백이 비고정폭이
// 된다. 폴백 스택(ui-monospace, "SF Mono", Menlo, monospace)은 globals.css 의 --font-mono 가 가진다.
const hack = localFont({
  src: [
    {
      path: "../../node_modules/hack-font/build/web/fonts/hack-regular-subset.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/hack-font/build/web/fonts/hack-bold-subset.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-hack",
  display: "swap",
  adjustFontFallback: false,
});

const DESCRIPTION = "AI test code generation and management.";

// 페이지는 짧은 제목만 준다("Dashboard"). 뒤의 " · Dante" 는 여기 template 이 붙인다.
// 템플릿은 겹쳐 붙지 않고 가장 가까운 레이아웃의 것 하나만 쓰인다 — 그래서 프로젝트·팀
// 레이아웃은 자기 템플릿에 " · Dante" 까지 직접 적는다.
//
// 기본값은 noindex. 로그인해야 보이는 화면이 대부분이라 새 페이지가 실수로 검색에
// 걸리지 않게 막아 두고, 공개 페이지(/, /privacy, /terms)만 각자 index 로 연다.
// metadataBase: og:image 같은 상대 경로를 절대 URL 로 바꿀 때 쓰는 기준 주소.
// 안 주면 Next 가 Vercel 기본 도메인을 쓰는데, 공유 미리보기에는 실제 서비스 주소가 박혀야 한다.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Dante", template: "%s · Dante" },
  description: DESCRIPTION,
  applicationName: "Dante",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Dante",
  },
  // 이미지(app/opengraph-image.tsx)가 가로형이라 큰 카드로 띄운다. X 는 og:image 를 그대로 가져간다.
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geist.variable} ${hack.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
