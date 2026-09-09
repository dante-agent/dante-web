import { prisma } from "@dante/db";

// ⚠️ 서버 전용. Prisma 클라이언트를 직접 쓰므로 클라이언트 컴포넌트에서 import 하면 안 된다.
// (`server-only` 패키지를 쓰면 컴파일 단계에서 막히지만 새 의존성이라 아직 안 넣었다 — github/app.ts 참고.)

export type ProjectListItem = {
  /** URL 에 쓰는 불투명 식별자. 레포 이름을 쓰지 않는 이유는 rename·이관 때문. */
  ref: string;
  name: string;
  repoFullName: string;
  defaultBranch: string;
  /** 테스트 파일 개수 */
  testCount: number;
  /** 마지막 실행 통과율(0~1). null 이면 아직 한 번도 안 돌린 프로젝트. */
  passRate: number | null;
};

/**
 * 로그인한 사용자가 접근 가능한 프로젝트 목록.
 *
 * 지금은 Project.userId 단일 소유자 모델이라 그 컬럼으로 직접 필터링한다
 * (schema.prisma Project 모델 주석: "TODO(팀 PR): 소유 주체가 User → Team 으로
 * 바뀌면 이 제약도 teamId 기준으로 옮긴다" — 아직 Team/TeamMember 모델이 없다).
 *
 * 모든 테이블 RLS 는 켜져 있지만 정책이 없다(AGENTS.md) — DB 가 대신 걸러주지
 * 않으므로 여기서 userId 로 직접 필터링해야 다른 사용자의 프로젝트가 새지 않는다.
 * 절대 인자 없이 findMany() 를 호출하지 말 것.
 */
export async function listProjectsForUser(userId: string): Promise<ProjectListItem[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return projects.map((project) => ({
    ref: project.ref,
    name: project.name,
    repoFullName: `${project.repoOwner}/${project.repoName}`,
    defaultBranch: project.defaultBranch,
    // TestFile/TestRun 모델이 아직 없다(schema.prisma 상단 주석: 테스트 생성 PR에서
    // 추가). 그 전까지는 모든 프로젝트가 "미실행" 으로 보인다 — 0% 완주가 아니라
    // 데이터가 아직 없는 상태라 testCount: 0 / passRate: null 이 맞는 표현이다.
    testCount: 0,
    passRate: null,
  }));
}
