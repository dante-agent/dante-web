import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "hack-font/build/web/hack.css";
import "./globals.css";
import { Providers } from "./providers";

// DESIGN.md §3 — sans: Geist(400/600), mono: Hack(400/700, hack.css)
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dante",
  description: "AI 테스트 코드 생성·관리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={geist.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
