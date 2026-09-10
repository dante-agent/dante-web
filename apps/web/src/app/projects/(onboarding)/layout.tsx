import { SplitShell } from "@/components/layout/split-shell";
import { StepRail } from "@/components/projects/step-rail";
import { requireUser } from "@/lib/auth/user";

// 온보딩 셸. 목록·로그인과 같은 분할 구조를 쓰고, 오른쪽 패널만 단계 레일로 바꾼다.
//
// 이 화면들에는 계정/로그아웃도 두지 않는다. 온보딩 중에는 할 일이 하나뿐이라
// 빠져나가는 길이 보이면 오히려 방해가 된다. 로고를 누르면 목록으로 돌아간다.
export default async function OnboardingLayout({ children }: LayoutProps<"/projects">) {
  await requireUser();

  return <SplitShell aside={<StepRail />}>{children}</SplitShell>;
}
