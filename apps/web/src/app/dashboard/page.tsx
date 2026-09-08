import { redirect } from "next/navigation";
import { DEFAULT_NEXT } from "@/lib/auth/redirect";

// 로그인 직후 임시 착륙지였다. 지금은 프로젝트 목록(/projects)이 그 자리를 대신한다.
// 라우트를 지우지 않고 넘기는 이유는 이 경로를 이미 열어본 사람이 404 를 보지 않게 하기 위함.
// 사용자 표시·로그아웃은 /projects 레이아웃 헤더로 옮겼다.
export default function DashboardPage() {
  redirect(DEFAULT_NEXT);
}
