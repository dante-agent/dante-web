import Image from "next/image";
import Link from "next/link";
import danteLogo from "@/assets/dante-logo.png";

// 로그인 화면(src/app/page.tsx)의 분할 구조를 컴포넌트로 뽑은 것.
// 로그인 · 프로젝트 목록 · 온보딩이 모두 이걸 쓴다 — 로그인부터 러너 선택까지
// 껍데기가 한 번도 바뀌지 않게.
//
//   좌우 비율 5fr:8fr (38.46 : 61.54) — Supabase 기준, 1:1 이 아니다.
//   lg 미만에서는 오른쪽 패널을 숨기고 왼쪽이 화면을 다 쓴다(1컬럼 grid).
//
// 상단 헤더는 두지 않는다. 로고는 왼쪽 위, 계정/약관 같은 부수 정보는 왼쪽 아래.
export function SplitShell({
  children,
  aside,
  footer,
  logoHref = "/projects",
  width = "md",
}: {
  children: React.ReactNode;
  /** 오른쪽 패널. 좁은 화면에서는 통째로 사라진다. */
  aside: React.ReactNode;
  /** 왼쪽 컬럼 맨 아래 (약관, 계정 등). */
  footer?: React.ReactNode;
  logoHref?: string;
  /**
   * 본문 폭. 로그인 폼은 max-w-sm(384) 이면 충분하지만, 온보딩은 패널 안에
   * 설명·메타가 들어가서 그 폭으로는 답답하다.
   */
  width?: "sm" | "md";
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[5fr_8fr]">
      <div className="relative flex flex-col px-6 py-8 lg:px-10">
        <Link href={logoHref} className="flex w-fit items-center gap-2.5 text-lg font-semibold">
          {/* 옆에 "Dante" 텍스트가 있으므로 alt 는 비운다(장식용). 표시 크기는
              Tailwind preflight 의 img{height:auto} 가 덮으므로 CSS 로 못박는다. */}
          <Image
            src={danteLogo}
            alt=""
            priority
            draggable={false}
            className="h-8 w-6 select-none"
          />
          Dante
        </Link>

        {/* flex-1 + items-center + justify-center: 로고·푸터 높이와 무관하게
            본문이 세로 중앙에 오고, 좁은 본문 블록이 컬럼 안에서 가로 중앙에 온다.
            로그인 화면(src/app/page.tsx)이 쓰는 방식 그대로다. */}
        <div className="flex flex-1 items-center justify-center py-16">
          <div className={width === "sm" ? "w-full max-w-sm" : "w-full max-w-md"}>{children}</div>
        </div>

        {footer}
      </div>

      <div className="border-border relative hidden border-l lg:flex lg:items-center lg:justify-center">
        {aside}
      </div>
    </div>
  );
}

/** 로그인 화면의 제품 소개. 온보딩 이전 화면들이 공유한다. */
export function ProductQuote() {
  return (
    <blockquote className="relative max-w-lg px-10">
      {/* 장식용 따옴표 — 본문 첫 줄에 겹쳐 놓는다. absolute 라 문단 흐름에
          영향을 주지 않고, 스크린리더는 aria-hidden 으로 건너뛴다. */}
      <span
        aria-hidden="true"
        className="text-muted-foreground/25 pointer-events-none absolute -top-10 left-6 text-9xl leading-none select-none"
      >
        &ldquo;
      </span>
      <p className="font-heading relative text-3xl leading-snug font-semibold">
        Stop letting tests hold up your features. Dante reads your repository, suggests the tests
        you are missing, and runs them for you.
      </p>
      <footer className="text-muted-foreground mt-6 text-sm">
        AI-powered test generation and management
      </footer>
    </blockquote>
  );
}
