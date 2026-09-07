import Link from "next/link";
import { BookOpen, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GitHubIcon, GoogleIcon } from "@/components/brand-icons";

export default function LoginPage() {
  return (
    // 좌우 분할은 grid-cols-2 하나로 끝난다. lg 미만에서는 오른쪽 패널을 숨기고
    // 왼쪽 컬럼이 화면을 다 쓴다 (1컬럼 grid 가 되므로 별도 처리가 필요 없다).
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* 왼쪽: 로고 · 로그인 · 약관 */}
      <div className="relative flex flex-col px-6 py-8 lg:px-10">
        <Link href="/" className="flex w-fit items-center gap-2 text-lg font-semibold">
          <FlaskConical className="size-5" />
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
                GitHub 계정으로 계속하기
              </Button>
              <Button variant="outline" size="lg" className="h-10 w-full gap-2.5">
                <GoogleIcon className="size-4" />
                Google 계정으로 계속하기
              </Button>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground mx-auto max-w-sm text-center text-xs leading-relaxed">
          계속 진행하면 Dante의{" "}
          <Link href="/terms" className="hover:text-foreground underline underline-offset-2">
            이용약관
          </Link>
          {" 및 "}
          <Link href="/privacy" className="hover:text-foreground underline underline-offset-2">
            개인정보 처리방침
          </Link>
          에 동의하는 것으로 간주합니다.
        </p>
      </div>

      {/* 오른쪽: 문서 링크 + 제품 소개. 좁은 화면에서는 통째로 사라진다. */}
      <div className="border-border relative hidden border-l lg:flex lg:items-center lg:justify-center">
        {/* render 로 <a> 를 대신 그린다. 네이티브 <button> 이 아니게 되므로
            base-ui 가 키보드 동작을 직접 붙이도록 nativeButton={false} 를 준다. */}
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/docs" />}
          className="absolute top-8 right-10 gap-1.5"
        >
          <BookOpen className="size-3.5" />
          문서
        </Button>

        <blockquote className="relative max-w-lg px-10">
          {/* 장식용 따옴표 — 본문 첫 줄에 겹쳐 놓는다.
              absolute 라서 문단 흐름에 영향을 주지 않고, 스크린리더는 aria-hidden 으로 건너뛴다. */}
          <span
            aria-hidden="true"
            className="text-muted-foreground/25 pointer-events-none absolute -top-10 left-6 font-serif text-9xl leading-none"
          >
            &ldquo;
          </span>
          <p className="relative text-3xl leading-snug font-medium">
            테스트 코드를 짜느라 기능 개발이 밀리지 않도록. Dante가 저장소를 읽고 테스트를 제안하고
            실행까지 합니다.
          </p>
          <footer className="text-muted-foreground mt-6 text-sm">AI 테스트 코드 생성·관리</footer>
        </blockquote>
      </div>
    </div>
  );
}
