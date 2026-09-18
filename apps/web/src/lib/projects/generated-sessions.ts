import { cache } from "react";
import { prisma } from "@dante/db";
import { isUuid } from "@/lib/chat/cursor";
import { getOwnedProjectId } from "@/lib/projects/queries";
import { sessionLabel } from "@/lib/projects/session-label";

// 저장된 테스트 버전을 "세션"으로 조회한다 (서버 전용).
//
// 세션 = TestFileVersion 한 건. 추천 화면에서 생성해 저장한(saveGeneratedVersion)
// 버전들이 사이드바 목록과 세션 상세 화면의 데이터 소스가 된다.

/** 사이드바·목록에서 쓰는 상태. 마지막 실행(TestRun)에서 유도한다. */
export type SessionStatus = "not_run" | "running" | "passed" | "failed";

export interface GeneratedSession {
  /** 버전 id = 세션 id (`/recommend/{id}`). */
  id: string;
  /** 이 버전을 만든 요청(프롬프트·후속 요청). 대화에서 못 찾으면 "Counter test". */
  title: string;
  /** 파일(컴포넌트)과 버전. 제목 아래 작은 글씨. 예: "Counter · v6". */
  meta: string;
  status: SessionStatus;
  updatedAt: string;
  /** 같은 프롬프트로 배치 생성된 세션끼리 공유하는 묶음 id. 단건이면 null. */
  batchId: string | null;
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
  /** 사용자가 남긴 피드백. "up" | "down" | null. */
  feedback: string | null;
  latestRun: {
    status: string;
    logs: string | null;
    errorMessage: string | null;
  } | null;
}

/** 실행 기록에서 상태를 유도한다. 실행이 없으면 "아직 안 돌림", 돌는 중이면 running,
 * 통과면 passed, 그 밖(failed·error)은 failed 로 접는다. */
function statusFromRun(runStatus: string | undefined): SessionStatus {
  if (runStatus === "passed") return "passed";
  if (runStatus === "queued" || runStatus === "running") return "running";
  if (runStatus === "failed" || runStatus === "error") return "failed";
  return "not_run";
}

/** DB JSON(대화 메시지 배열)에서 제목 계산에 필요한 역할·글자만 추린다. 모양이 다르면 건너뛴다. */
function chatMessages(value: unknown): { role: "user" | "assistant"; text: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const { role, text } = (item ?? {}) as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof text !== "string") return [];
    return [{ role, text }];
  });
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
      batchId: true,
      testFile: { select: { component: { select: { name: true } } } },
      runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      chatThread: { select: { messages: true } },
    },
  });

  return versions.map((version) => ({
    id: version.id,
    title:
      sessionLabel(chatMessages(version.chatThread?.messages)) ??
      `${version.testFile.component.name} test`,
    meta: `${version.testFile.component.name} · v${version.version}`,
    status: statusFromRun(version.runs[0]?.status),
    updatedAt: version.createdAt.toISOString(),
    batchId: version.batchId,
  }));
}

/**
 * 세션 상세 화면용. 없거나 이 사용자 것이 아니면 null.
 * 페이지와 generateMetadata(탭 제목)가 같은 요청에서 둘 다 부른다. cache 로 한 번만 읽는다.
 */
export const getGeneratedSessionDetail = cache(async function getGeneratedSessionDetail(
  projectRef: string,
  userId: string,
  versionId: string
): Promise<GeneratedSessionDetail | null> {
  // 세션 id 는 URL(/recommend/<id>, ?tests=)에서 온다. uuid 모양이 아니면 Prisma 가
  // @db.Uuid 캐스팅에서 던져 404 대신 500 이 난다 — 쿼리 전에 없는 세션으로 친다.
  if (!isUuid(versionId)) return null;
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
      feedback: true,
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
    feedback: version.feedback,
    latestRun: version.runs[0] ?? null,
  };
});

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
  if (!isUuid(versionId)) return false;
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

/** 세션(버전) 하나에 피드백을 남긴다("up"|"down", 같은 값을 다시 누르면 null 로 해제). 소유 검증 포함. */
export async function setSessionFeedback(
  projectRef: string,
  userId: string,
  versionId: string,
  value: "up" | "down" | null
): Promise<boolean> {
  if (!isUuid(versionId)) return false;
  const projectId = await getOwnedProjectId(projectRef, userId);
  if (!projectId) return false;
  const res = await prisma.testFileVersion.updateMany({
    where: { id: versionId, testFile: { component: { projectId } } },
    data: { feedback: value },
  });
  return res.count > 0;
}
