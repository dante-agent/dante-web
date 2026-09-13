import { redirect } from "next/navigation";
import { requireUser, syncUser } from "@/lib/auth/user";

// 헤더 프로필 메뉴의 "Team settings" 가 오는 곳.
//
// 링크에 팀 id 를 박지 않고 여기서 고르는 이유: 메뉴는 어느 화면에서나 같은 컴포넌트라
// 팀을 모른다. 팀 전환(feat/team-switcher)이 붙기 전까지는 개인 팀으로 보낸다.
// syncUser 를 거치므로 아직 미러되지 않은 사용자도 개인 팀이 생긴 뒤에 도착한다.
export default async function TeamIndex() {
  const user = await requireUser();
  const { personalTeamId } = await syncUser(user);
  redirect(`/team/${personalTeamId}/settings/general`);
}
