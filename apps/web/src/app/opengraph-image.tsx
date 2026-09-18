import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// 링크를 슬랙·카톡·X 에 붙였을 때 뜨는 미리보기 이미지. 루트에 두어 모든 페이지가 같이 쓴다.
// 요청 시점 값을 읽지 않으므로 빌드 때 한 번 만들어 정적으로 내려간다.
//
// 글꼴은 따로 싣지 않는다. next/og 기본 글꼴이 Geist 라 앱 본문(DESIGN.md §3)과 같다.
// 색은 로그인 화면과 맞춘다 — 배경 --background-warm, 글자 Mauve 12 / 10, 강조 CR Orange.

export const alt = "Dante — AI test generation and management";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  // 빌드는 apps/web 에서 돈다. 로고는 로그인 화면과 같은 파일이다.
  const logo = await readFile(join(process.cwd(), "src/assets/dante-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#151211",
        color: "#EEEDF0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* 원본 289x362 비율 그대로 */}
        <img src={logoSrc} width={48} height={60} alt="" />
        <span style={{ fontSize: 44, letterSpacing: "-0.02em" }}>Dante</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ fontSize: 68, lineHeight: 1.15, letterSpacing: "-0.03em", maxWidth: 980 }}>
          Stop letting tests hold up your features.
        </div>
        <div style={{ fontSize: 32, lineHeight: 1.4, color: "#7D7982", maxWidth: 920 }}>
          Dante reads your repository, suggests the tests you are missing, and runs them for you.
        </div>
      </div>

      <div style={{ display: "flex", width: 96, height: 6, background: "#FF570A" }} />
    </div>,
    size
  );
}
