import Image from "next/image";
import Link from "next/link";
import danteLogo from "@/assets/dante-logo.png";
import { Button } from "@/components/ui/button";
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons";

export default function LoginPage() {
  return (
    // 좌우 분할 비율은 Supabase 기준 약 38.5 : 61.5 (5fr:8fr = 38.46%). 1:1 이 아니다.
    // lg 미만에서는 오른쪽 패널을 숨기고 왼쪽 컬럼이 화면을 다 쓴다
    // (1컬럼 grid 가 되므로 별도 처리가 필요 없다).
    <div className="grid min-h-svh lg:grid-cols-[5fr_8fr]">
      {/* 왼쪽: 로고 · 로그인 · 약관 */}
      <div className="relative flex flex-col px-6 py-8 lg:px-10">
        <Link href="/" className="flex w-fit items-center gap-2.5 text-lg font-semibold">
          {/* static import 라 Next 가 원본 크기(289x362)를 알고 URL 에 콘텐츠 해시를 붙인다
              — 파일을 바꾸면 URL 이 바뀌어 캐시가 남지 않는다.
              옆에 "Dante" 텍스트가 있으므로 alt 는 비워 스크린리더가
              같은 이름을 두 번 읽지 않게 한다 (장식용 이미지). */}
          {/* Tailwind preflight 의 img{height:auto} 가 width/height 속성을 덮으므로
              표시 크기는 CSS 로 못박는다 (24x32). */}
          <Image
            src={danteLogo}
            alt=""
            priority
            draggable={false}
            className="h-8 w-6 select-none"
          />
          Dante
        </Link>

        {/* flex-1 + 가운데 정렬: 로고/약관 높이와 무관하게 폼이 세로 중앙에 온다 */}
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <h1 className="text-3xl font-medium tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-2 text-sm">Sign in to your account</p>

            <div className="mt-8 flex flex-col gap-3">
              <Button variant="outline" size="lg" className="h-10 w-full gap-2.5">
                <GitHubIcon className="size-4" />
                Continue with GitHub
              </Button>
              <Button variant="outline" size="lg" className="h-10 w-full gap-2.5">
                <GoogleIcon className="size-4" />
                Continue with Google
              </Button>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground text-center text-xs leading-relaxed text-balance">
          By continuing, you agree to Dante&apos;s{" "}
          <Link href="/terms" className="hover:text-foreground underline underline-offset-2">
            Terms of Service
          </Link>
          {" and "}
          <Link href="/privacy" className="hover:text-foreground underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      {/* 오른쪽: 제품 소개. 좁은 화면에서는 통째로 사라진다. */}
      <div className="border-border relative hidden border-l lg:flex lg:items-center lg:justify-center">
        <blockquote className="relative max-w-lg px-10">
          {/* 장식용 따옴표 — 본문 첫 줄에 겹쳐 놓는다.
              absolute 라서 문단 흐름에 영향을 주지 않고, 스크린리더는 aria-hidden 으로 건너뛴다. */}
          <span
            aria-hidden="true"
            className="text-muted-foreground/25 pointer-events-none absolute -top-10 left-6 font-serif text-9xl leading-none select-none"
          >
            &ldquo;
          </span>
          <p className="relative text-3xl leading-snug font-medium">
            Stop letting tests hold up your features. Dante reads your repository, suggests the
            tests you are missing, and runs them for you.
          </p>
          <footer className="text-muted-foreground mt-6 text-sm">
            AI-powered test generation and management
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
