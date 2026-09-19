// 프로젝트 조회 (서버 전용). 이 사용자가 멤버인 팀의 프로젝트만 읽는다(lib/teams/access.ts).
// 함수들이 userId 를 받는 이유는 그대로다 — 멤버십을 누구 기준으로 볼지가 그 값이다.

import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";
import { projectConnection, type ConnectionStatus } from "@/lib/github/connection";
import { accessibleProjectWhere } from "@/lib/teams/access";
import { listTeams } from "@/lib/teams/current";

export type ProjectSummary = {
  ref: string;
  name: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  teamId: string;
};

const summarySelect = {
  ref: true,
  name: true,
  repoOwner: true,
  repoName: true,
  defaultBranch: true,
  teamId: true,
} as const;

/** 이 사용자가 멤버인 팀들의 프로젝트 전부. 최근 생성 순. 헤더 스위처·목록용. */
export function listProjects(userId: string): Promise<ProjectSummary[]> {
  return prisma.project.findMany({
    where: accessibleProjectWhere(userId),
    select: summarySelect,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 프로젝트 스코프 레이아웃 진입점. 로그인 + 멤버 확인.
 * ref 에 해당하는 프로젝트가 없거나 내가 멤버가 아닌 팀의 것이면 notFound().
 * 목록도 같이 돌려준다 — 헤더가 필요로 하고, 조회 한 번으로 끝난다.
 *
 * 헤더의 조직·레포 목록은 이 프로젝트의 팀 것만 남긴다. 팀 드롭다운이 이 팀을
 * 가리키는데 그 옆 목록에 다른 팀 레포가 섞이면 어느 팀을 보고 있는지 흐려진다.
 *
 * 프로젝트 레이아웃과 설정 레이아웃이 같은 요청에서 부르므로 cache 로 dedup.
 */
export const requireProjectContext = cache(async (ref: string) => {
  const user = await requireUser();
  const [all, teams] = await Promise.all([listProjects(user.id), listTeams(user.id)]);
  const project = all.find((p) => p.ref === ref);
  if (!project) notFound();
  const projects = all.filter((p) => p.teamId === project.teamId);
  return { user, project, projects, teams };
});

/** GitHub 호출에 필요한 필드. installationId(BigInt)가 있어 클라이언트로 넘기지 않는다. */
export type ProjectRepo = {
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  installationId: bigint;
};

/**
 * 한 프로젝트 화면이 필요로 하는 행 전부. 서버 전용(installationId 가 BigInt 다).
 * 연결 상태 중 설치 쪽 값(정지·삭제)은 여기 없다 — 대시보드만 쓰므로 getDashboardProject 가 따로 읽는다.
 */
export type OwnedProject = ProjectSummary &
  ProjectRepo & {
    id: string;
    testFramework: string | null;
    testCommand: string | null;
    disconnectedAt: Date | null;
    disconnectedReason: string | null;
  };

/**
 * ref 가 내가 멤버인 팀의 프로젝트면 그 행, 아니면 null. 프로젝트 행은 여기서만 읽는다.
 *
 * 아래 getOwnedProjectId·getProjectRepo·getDashboardProject 와 채팅 라우트가 전부 이 결과를
 * 쓴다. 따로 읽으면 한 화면이 같은 행을 서너 번 읽는다(대시보드는 셋을 다 부른다).
 * 단건 조회의 권한 조건(accessibleProjectWhere)도 여기 한 곳이다 — 보안 경계는 이 where 다.
 *
 * cache 는 서버 컴포넌트 렌더 안에서만 dedup 한다. 서버 액션·라우트 핸들러에서 id 와 repo 가
 * 둘 다 필요하면 이 함수를 한 번 부르고 projectRepoOf 로 나눠 쓴다.
 */
export const getOwnedProject = cache((ref: string, userId: string): Promise<OwnedProject | null> =>
  prisma.project.findFirst({
    where: { ref, ...accessibleProjectWhere(userId) },
    select: {
      id: true,
      ...summarySelect,
      installationId: true,
      testFramework: true,
      testCommand: true,
      disconnectedAt: true,
      disconnectedReason: true,
    },
  })
);

/** OwnedProject 에서 GitHub 호출용 필드만. 다른 값이 GitHub 쪽 함수로 새지 않게 좁힌다. */
export function projectRepoOf(project: ProjectRepo): ProjectRepo {
  return {
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    defaultBranch: project.defaultBranch,
    installationId: project.installationId,
  };
}

/** 대시보드 히어로가 그리는 값. 지표(테스트 수·통과율)는 아직 목업이다. */
export type DashboardProject = ProjectSummary & {
  testFramework: string | null;
  /** 러너가 실행할 테스트 명령. 없으면 Advisor 가 setup 이슈를 띄운다. */
  testCommand: string | null;
  connection: ConnectionStatus;
};

/**
 * 요약(ProjectSummary)에 러너 이름과 연결 상태를 얹는다.
 * 레이아웃의 requireProjectContext 로는 두 값을 알 수 없어 대시보드만 설치 행을 한 번 더 읽는다.
 */
export async function getDashboardProject(
  ref: string,
  userId: string
): Promise<DashboardProject | null> {
  const project = await getOwnedProject(ref, userId);
  if (!project) return null;

  // 연결 상태는 프로젝트와 설치 두 군데에 나뉘어 적힌다 (lib/github/connection.ts).
  const installation = await prisma.githubInstallation.findUnique({
    where: { id: project.installationId },
    select: { suspendedAt: true, deletedAt: true },
  });
  // 설치 행이 지워지면 프로젝트도 Cascade 로 지워진다. 없다면 그사이 프로젝트가 사라진 것이다.
  if (!installation) return null;

  const { ref: projectRef, name, repoOwner, repoName, defaultBranch, teamId } = project;
  return {
    ref: projectRef,
    name,
    repoOwner,
    repoName,
    defaultBranch,
    teamId,
    testFramework: project.testFramework,
    testCommand: project.testCommand,
    connection: projectConnection({
      disconnectedAt: project.disconnectedAt,
      disconnectedReason: project.disconnectedReason,
      installation,
    }),
  };
}

/**
 * ref 가 내 프로젝트면 내부 id, 아니면 null.
 *
 * ProjectRepo 에 id 를 끼워 넣지 않은 이유: 그 타입은 "GitHub 호출에 필요한 필드"
 * 라서, 관계없는 값이 섞이면 무엇을 위한 묶음인지가 흐려진다. 사용량 기록처럼
 * 내부 id 만 필요한 자리가 따로 있으니 함수도 따로 둔다(조회는 getOwnedProject 한 번).
 */
export const getOwnedProjectId = cache(
  async (ref: string, userId: string): Promise<string | null> =>
    (await getOwnedProject(ref, userId))?.id ?? null
);

/**
 * layout·page 가 같은 요청에서 각각 부르므로 cache 로 dedup.
 * 같은 요청에서는 같은 객체를 돌려준다 — lib/github/tree.ts 의 트리 캐시가 이 객체를 키로 쓴다.
 */
export const getProjectRepo = cache(
  async (ref: string, userId: string): Promise<ProjectRepo | null> => {
    const project = await getOwnedProject(ref, userId);
    return project ? projectRepoOf(project) : null;
  }
);
