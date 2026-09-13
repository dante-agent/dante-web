import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getCurrentTeamId } from "@/lib/teams/current";

// 헤더 프로필 메뉴의 "Team settings" 가 오는 곳.
//
// 링크에 팀 id 를 박지 않고 여기서 고르는 이유: 메뉴는 어느 화면에서나 같은 컴포넌트라
// 팀을 모른다. 지금 팀(쿠키)의 설정으로 보낸다. 쿠키가 없거나 빠진 팀이면 개인 팀이다.
export default async function TeamIndex() {
  const user = await requireUser();
  redirect(`/team/${await getCurrentTeamId(user)}/settings/general`);
}
