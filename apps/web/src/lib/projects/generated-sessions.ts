import { prisma } from "@dante/db";
import { getOwnedProjectId } from "@/lib/projects/queries";

// 저장된 테스트 버전을 "세션"으로 조회한다 (서버 전용).
//
// 세션 = TestFileVersion 한 건. 추천 화면에서 생성해 저장한(saveGeneratedVersion)
// 버전들이 사이드바 목록과 세션 상세 화면의 데이터 소스가 된다.

/** 사이드바·목록에서 쓰는 상태. 마지막 실행(TestRun)에서 유도한다. */
export type SessionStatus = "needs_clarification" | "in_progress" | "completed";

export interface GeneratedSession {
  /** 버전 id = 세션 id (`/recommend/{id}`). */
  id: string;
  title: string;
  status: SessionStatus;
  updatedAt: string;
}

export interface GeneratedSessionDetail {
  versionId: string;
  componentName: string;
  /** 테스트 대상 소스 파일(레포 루트 기준). */
  targetFile: string;
  /** 테스트 파일 경로. */
  testPath: string;
  version: number;
  content: string;
  createdAt: Date;
  latestRun: {
    status: string;
    logs: string | null;
    errorMessage: string | null;
  } | null;
}

/** 실행이 없으면 "확인 필요"(아직 안 돌림). 돌고 있으면 진행 중, 통과면 완료. */
function statusFromRun(runStatus: string | undefined): SessionStatus {
  if (runStatus === "passed") return "completed";
  if (runStatus === "queued" || runStatus === "running") return "in_progress";
  return "needs_clarification";
}

function sessionTitle(componentName: string, version: number): string {
  return `${componentName} test · v${version}`;
}

/** 이 프로젝트의 저장된 버전을 최신순으로. 사이드바·세션 탭이 쓴다. */
export async function getGeneratedSessions(
  projectRef: string,
  userId: string,
  limit = 30
): Promise<GeneratedSession[]> {
  // 프로젝트 소유권 판정은 getOwnedProjectId 에 맡긴다(팀 스키마 도입으로 Project 에
  // userId 직접 필터가 없다). 소유가 아니면 조회할 것도 없다.
  const projectId = await getOwnedProjectId(projectRef, userId);
  if (!projectId) return [];

  const versions = await prisma.testFileVersion.findMany({
    // 레포 테스트를 가져온 버전은 세션이 아니다 — 폴더 보기에서 파일을 열 때마다 생긴다.
    where: { source: { not: "repo" }, testFile: { component: { projectId } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      version: true,
      createdAt: true,
      testFile: { select: { component: { select: { name: true } } } },
      runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
    },
  });

  return versions.map((version) => ({
    id: version.id,
    title: sessionTitle(version.testFile.component.name, version.version),
    status: statusFromRun(version.runs[0]?.status),
    updatedAt: version.createdAt.toISOString(),
  }));
}

/** 세션 상세 화면용. 없거나 이 사용자 것이 아니면 null. */
export async function getGeneratedSessionDetail(
  projectRef: string,
  userId: string,
  versionId: string
): Promise<GeneratedSessionDetail | null> {
  const projectId = await getOwnedProjectId(projectRef, userId);
  if (!projectId) return null;

  const version = await prisma.testFileVersion.findFirst({
    where: {
      id: versionId,
      testFile: { component: { projectId } },
    },
    select: {
      id: true,
      version: true,
      content: true,
      createdAt: true,
      testFile: {
        select: { path: true, component: { select: { name: true, filePath: true } } },
      },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, logs: true, errorMessage: true },
      },
    },
  });
  if (!version) return null;

  return {
    versionId: version.id,
    componentName: version.testFile.component.name,
    targetFile: version.testFile.component.filePath,
    testPath: version.testFile.path,
    version: version.version,
    content: version.content,
    createdAt: version.createdAt,
    latestRun: version.runs[0] ?? null,
  };
}

/**
 * 세션(= TestFileVersion) 하나를 지운다. 실행 기록(TestRun)·대화(TestChatThread)는 FK Cascade 로
 * 함께 지워진다. 그 파일에 남은 버전이 하나도 없으면 빈 Component·TestFile 도 정리한다.
 *
 * versionId 는 클라이언트에서 오므로 믿지 않는다 — 이 사용자 소유 프로젝트의, repo 가 아닌
 * (추천/사용자가 만든) 버전일 때만 지운다. 지웠으면 true.
 */
export async function deleteGeneratedSession(
  projectRef: string,
  userId: string,
  versionId: string
): Promise<boolean> {
  const projectId = await getOwnedProjectId(projectRef, userId);
  if (!projectId) return false;

  const version = await prisma.testFileVersion.findFirst({
    where: { id: versionId, source: { not: "repo" }, testFile: { component: { projectId } } },
    select: { id: true, testFileId: true, testFile: { select: { componentId: true } } },
  });
  if (!version) return false;

  await prisma.$transaction(async (tx) => {
    await tx.testFileVersion.delete({ where: { id: version.id } });
    // 이 파일에 남은 버전(레포 포함)이 없으면 Component 를 지운다 — TestFile 은 Cascade 로 따라온다.
    const remaining = await tx.testFileVersion.count({ where: { testFileId: version.testFileId } });
    if (remaining === 0) {
      await tx.component.delete({ where: { id: version.testFile.componentId } });
    }
  });
  return true;
}
