import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { isOpsEmail } from "@/lib/ops/allowlist";

// 서버 전용. 운영 지표 화면(/ops)의 문지기.
//
// User 에 role 컬럼을 만들지 않은 이유: 지금 필요한 건 권한 단계가 아니라 "운영자
// 두어 명"이다. 컬럼을 늘리면 마이그레이션·RLS·배정 화면이 줄줄이 따라오는데 그만한
// 이유가 아직 없다. 환경변수면 Vercel 에서 값만 고쳐도 되고, 운영자가 바뀌는 주기는
// 배포보다 훨씬 느리다. 등급이 갈리기 시작하면 그때 표로 올린다.
//
// 판정 규칙 자체는 lib/ops/allowlist.ts 에 있다(테스트가 붙어 있다).
const ALLOWLIST_ENV = "OPS_EMAILS";

/**
 * 지표 화면을 볼 자격이 있는 로그인 사용자. 아니면 404.
 *
 * 403 이 아니라 404 인 이유: "권한이 없습니다"는 그 주소에 무언가 있다는 뜻이 된다.
 * 로그인만 하면 누구나 눌러볼 수 있는 자리라 존재 자체를 알리지 않는 편이 낫다.
 */
export async function requireOpsUser() {
  const user = await requireUser();
  if (!isOpsEmail(user.email, process.env[ALLOWLIST_ENV])) notFound();
  return user;
}
