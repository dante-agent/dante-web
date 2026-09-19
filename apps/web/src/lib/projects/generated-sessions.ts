import { cache } from "react";
import { prisma } from "@dante/db";
import { isUuid } from "@/lib/chat/cursor";
import { getOwnedProjectId } from "@/lib/projects/queries";
import {
  sessionLabel,
  VERSION_NOTE_PREFIX_LENGTH,
  VERSION_NOTE_PREFIXES,
} from "@/lib/projects/session-label";

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

/**
 * 세션 제목(sessionLabel)을 계산하는 데 필요한 메시지만 DB 에서 골라 온다.
 *
 * 대화 JSON 은 세션마다 최대 100개 × 5000자다. 사이드바는 제목 한 줄만 쓰므로 통째로 읽지 않고
 * Postgres 에서 "마지막 버전 알림"과 "그 바로 앞 사용자 메시지"만 뽑는다. 제목을 만드는 규칙
 * (공백 정리·80자 자르기·실패 재생성 제목)은 그대로 sessionLabel 에 맡긴다 — 두 메시지만 넘겨도
 * 전체를 넘긴 것과 결과가 같다(sessionLabel 이 보는 게 이 둘뿐이다).
 *
 * DB JSON 은 믿지 않는다: 객체이고 role 이 user/assistant, text 가 문자열인 메시지만 본다.
 * 대화가 배열이 아니면 빈 대화로 친다.
 */
async function sessionLabels(versionIds: string[]): Promise<Map<string, string | null>> {
  if (versionIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<
    { versionId: string; noteText: string; requestText: string | null }[]
  >`
    WITH msgs AS (
      SELECT t.test_file_version_id AS version_id, e.ord, e.item->>'role' AS role, e.item->>'text' AS text
      FROM test_chat_threads t
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(t.messages) = 'array' THEN t.messages ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS e(item, ord)
      WHERE t.test_file_version_id = ANY(${versionIds}::uuid[])
        AND jsonb_typeof(e.item) = 'object'
        AND e.item->>'role' IN ('user', 'assistant')
        AND jsonb_typeof(e.item->'text') = 'string'
    ),
    notes AS (
      SELECT DISTINCT ON (version_id) version_id, ord, left(text, ${VERSION_NOTE_PREFIX_LENGTH}::int) AS text
      FROM msgs
      WHERE role = 'assistant'
        AND EXISTS (
          SELECT 1 FROM unnest(${[...VERSION_NOTE_PREFIXES]}::text[]) AS p(prefix)
          WHERE starts_with(msgs.text, p.prefix)
        )
      ORDER BY version_id, ord DESC
    )
    SELECT n.version_id::text AS "versionId", n.text AS "noteText", (
      SELECT m.text FROM msgs m
      WHERE m.version_id = n.version_id AND m.role = 'user' AND m.ord < n.ord
      ORDER BY m.ord DESC
      LIMIT 1
    ) AS "requestText"
    FROM notes n
  `;
  return new Map(
    rows.map((row) => {
      const messages: Parameters<typeof sessionLabel>[0] = [];
      if (row.requestText !== null) messages.push({ role: "user", text: row.requestText });
      messages.push({ role: "assistant", text: row.noteText });
      return [row.versionId, sessionLabel(messages)];
    })
  );
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
    },
  });
  // 위에서 소유 프로젝트의 버전만 골랐으니 그 id 로만 대화를 읽는다.
  const labels = await sessionLabels(versions.map((version) => version.id));

  return versions.map((version) => ({
    id: version.id,
    title: labels.get(version.id) ?? `${version.testFile.component.name} test`,
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
