import Image from "next/image";
import Link from "next/link";
import danteLogo from "@/assets/dante-logo.png";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { buttonVariants } from "@/components/ui/button";

// 앱에 없는 주소, 그리고 하위 세그먼트가 따로 받지 않은 notFound() 가 여기로 온다.
// 루트 레이아웃 안에서 그려지므로 폰트·전역 스타일은 그대로 붙는다.
//
// metadata 는 내보내지 않는다 — not-found.tsx 는 page/layout 이 아니라서 Next 가 읽지 않는다.
// 탭 제목은 루트 레이아웃의 default("Dante"), noindex 는 404 응답에 Next 가 알아서 넣는다.
//
// 링크는 "/" 하나로 둔다. 로그인 상태면 proxy 가 /projects 로 보내고, 아니면 로그인 화면이 뜬다
// (lib/supabase/proxy.ts). 비로그인으로 없는 주소를 열면 대개 proxy 가 먼저 로그인으로
// 돌리므로, 이 화면이 비로그인에 보이는 건 공개 경로(/auth/*·/terms/…) 아래일 때뿐이다.
export default function NotFound() {
  return (
    // 로그인·초대 화면과 같은 한 장짜리 틀 (invite/[token]/page.tsx).
    <main
      id={MAIN_CONTENT_ID}
      className="bg-background-warm flex min-h-svh items-center justify-center px-6 py-16"
    >
      <div className="w-full max-w-sm">
        {/* 표시 크기를 CSS 로 못박는 이유는 src/app/page.tsx 참고 */}
        <Image
          src={danteLogo}
          alt="Dante"
          priority
          draggable={false}
          className="h-8 w-6 select-none"
        />
        <div className="mt-8">
          {/* 짧은 기술 라벨이라 mono 700 (DESIGN.md §3) */}
          <p className="text-muted-foreground font-mono text-xs font-bold tracking-widest">404</p>
          <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight">
            This page doesn&apos;t exist
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            The link may be broken, or the page may have moved.
          </p>
          <Link
            href="/"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "mt-8 h-10 w-full",
            })}
          >
            Back to Dante
          </Link>
        </div>
      </div>
    </main>
  );
}
