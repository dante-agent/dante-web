import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// 로그인 도중 실패했을 때 착지하는 곳. 원인은 서버 로그에서 보고,
// 사용자에게는 다시 시도할 길만 준다.
export default function AuthErrorPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-medium tracking-tight">로그인하지 못했습니다</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          인증이 취소됐거나 중간에 끊겼습니다. 다시 시도해 주세요.
        </p>
      </div>

      <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
        로그인으로 돌아가기
      </Link>
    </main>
  );
}
