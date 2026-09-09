import Image from "next/image";
import Link from "next/link";
import danteLogo from "@/assets/dante-logo.png";
import { StepRail } from "@/components/projects/step-rail";
import { requireUser } from "@/lib/auth/user";

// 온보딩 셸. 로그인 화면(src/app/page.tsx)과 같은 분할 구조를 그대로 쓴다
// — 로그인 → 프로젝트 연결 → 러너 선택이 한 흐름으로 이어져 보이게.
//
//   좌우 비율 5fr:8fr (38.46 : 61.54) — Supabase 기준, 1:1 이 아니다.
//   lg 미만에서는 오른쪽 패널을 숨기고 왼쪽이 화면을 다 쓴다(1컬럼 grid).
//
// 이 화면들에는 상단 헤더를 두지 않는다. 온보딩 중에는 갈 곳이 하나뿐이라
// 네비게이션이 오히려 방해가 된다. 로그아웃은 /projects 목록 헤더에 있다.
export default async function OnboardingLayout({ children }: LayoutProps<"/projects">) {
  // 목록 셸과 달리 여기엔 헤더가 없어서 세션 확인을 레이아웃이 직접 한다.
  await requireUser();

  return (
    <div className="grid min-h-svh lg:grid-cols-[5fr_8fr]">
      {/* 왼쪽: 로고 · 지금 할 일 */}
      <div className="relative flex flex-col px-6 py-8 lg:px-10">
        <Link href="/projects" className="flex w-fit items-center gap-2.5 text-lg font-semibold">
          {/* 옆에 "Dante" 텍스트가 있으므로 alt 는 비운다(장식용). 표시 크기는
              Tailwind preflight 의 img{height:auto} 때문에 CSS 로 못박는다. */}
          <Image
            src={danteLogo}
            alt=""
            priority
            draggable={false}
            className="h-8 w-6 select-none"
          />
          Dante
        </Link>

        {/* flex-1 + 가운데 정렬: 로고 높이와 무관하게 본문이 세로 중앙에 온다 */}
        <div className="flex flex-1 items-center py-16">
          {/* 로그인 폼은 max-w-sm(384) 이지만 온보딩은 패널 안에 설명·메타가
              들어가서 그 폭으로는 답답하다. 한 단계 넓힌다. */}
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>

      {/* 오른쪽: 단계 안내. 좁은 화면에서는 통째로 사라진다. */}
      <div className="border-border relative hidden border-l lg:flex lg:items-center lg:justify-center">
        <StepRail />
      </div>
    </div>
  );
}
