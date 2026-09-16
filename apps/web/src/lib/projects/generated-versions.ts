import { Prisma, prisma } from "@dante/db";
import { getRepoTree } from "@/lib/github/tree";
import type { ProjectRepo } from "@/lib/projects/queries";
import { componentName } from "@/lib/projects/recommendations";
import { testPathFor } from "@/lib/projects/test-generation-prompt";

// AI 가 만든 테스트 코드를 한 "버전"으로 저장한다 (서버 전용).
//
// 왜 여기서 저장하나: 생성 결과를 세션 상세 화면에서 다시 열고 실행하려면
// DB 에 버전이 남아 있어야 한다. 생성 자체(generateTestForFile)는 PR 파이프라인과
// 공유되므로 순수하게 두고, "추천 화면에서 눌러 만든 것을 남긴다"는 이 관심사는
// 액션 쪽에서 이 함수로만 처리한다.
//
// Component/TestFile 은 아직 아무도 안 쓰던 테이블이다(recommendations.ts 주석 참고).
// 여기서 처음으로 채운다 — 한 소스 파일에 대해 Component 하나, 그 아래 TestFile 하나,
// 그 아래에 생성할 때마다 TestFileVersion 이 쌓인다.

export async function saveGeneratedVersion(args: {
  projectId: string;
  /** 테스트 대상 소스 파일 경로(레포 루트 기준). Component.filePath 로 쓴다. */
  sourceFilePath: string;
  /** 화면·식별용 이름. 경로 파일명에서 뽑은 값이 온다. */
  componentName: string;
  /** 만들 테스트 파일 경로. TestFile.path 로 쓴다. */
  testPath: string;
  /** 생성된 테스트 코드 전체. */
  code: string;
  /** "ai"(생성) | "user"(사용자가 직접 고침) | "repo"(레포 테스트를 가져옴). 기본 "ai". */
  source?: "ai" | "user" | "repo";
  /**
   * 레포 동기화용. 켜면 최신 버전이 없거나 "레포에서 온 버전인데 내용이 다를 때"만 쌓고,
   * 아니면 아무것도 쓰지 않고 null. AI·사용자 버전 위로 레포 내용을 덮지 않는다.
   */
  onlyIfRepoChanged?: boolean;
}): Promise<string | null> {
  try {
    return await insertVersion(args);
  } catch (error) {
    // 같은 파일을 두 곳(추천·폴더 보기)에서 동시에 저장하면 둘 다 같은 번호(또는 첫 Component)를
    // 잡아 한쪽이 unique 제약으로 P2002 가 난다. 상대가 커밋을 끝냈으니 한 번 더 하면 다음 번호로 들어간다.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return insertVersion(args);
    }
    throw error;
  }
}

// ponytail: 버전을 지우지 않고 계속 쌓는다. 생성마다 AI 원가가 들어 월 한도가 먼저 막지만,
// 행이 문제 되면 이 트랜잭션에서 파일당 최신 N개만 남기고 지운다(실행 기록이 붙은 버전은 남길지 정할 것).
function insertVersion(args: Parameters<typeof saveGeneratedVersion>[0]): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    // 추천은 export 이름을 모른다(경로만 본다). 이름을 exportName 자리에 그대로 쓴다 —
    // 같은 파일을 또 생성하면 같은 Component 로 붙어 버전이 이어지게 하려는 것이다.
    const component = await tx.component.upsert({
      where: {
        projectId_filePath_exportName: {
          projectId: args.projectId,
          filePath: args.sourceFilePath,
          exportName: args.componentName,
        },
      },
      create: {
        projectId: args.projectId,
        filePath: args.sourceFilePath,
        exportName: args.componentName,
        name: args.componentName,
      },
      update: {},
      select: { id: true },
    });

    const testFile = await tx.testFile.upsert({
      where: { componentId: component.id },
      create: { componentId: component.id, path: args.testPath },
      // 동기화는 건너뛸 수도 있어서 경로는 실제로 쌓을 때만 바꾼다(아래).
      update: args.onlyIfRepoChanged ? {} : { path: args.testPath },
      select: { id: true },
    });

    // 버전은 1 부터 증가. 직전 최대에 +1 한다. 한 트랜잭션 안이라 같은 파일에 대한
    // 동시 생성이 같은 번호를 잡는 건 @@unique([testFileId, version]) 가 막는다.
    const last = await tx.testFileVersion.findFirst({
      where: { testFileId: testFile.id },
      orderBy: { version: "desc" },
      select: { version: true, source: true, content: true },
    });
    // 트랜잭션 안에서 본다 — P2002 재시도 때도 상대가 방금 넣은 버전을 보고 중복을 쌓지 않는다.
    if (args.onlyIfRepoChanged && last && (last.source !== "repo" || last.content === args.code)) {
      return null;
    }
    if (args.onlyIfRepoChanged) {
      await tx.testFile.update({ where: { id: testFile.id }, data: { path: args.testPath } });
    }

    const created = await tx.testFileVersion.create({
      data: {
        testFileId: testFile.id,
        content: args.code,
        version: (last?.version ?? 0) + 1,
        source: args.source ?? "ai",
      },
      select: { id: true },
    });

    return created.id;
  });
}

/**
 * 이 소스 파일에 저장된 가장 최근 버전. 폴더 보기 Test Code 칸이 이 값을 보여준다.
 * projectId 는 부르는 쪽이 소유 확인을 마친 값이어야 한다.
 */
export async function getLatestGeneratedTest(
  projectId: string,
  sourceFilePath: string
): Promise<{
  id: string;
  testPath: string;
  code: string;
  version: number;
  source: string;
} | null> {
  const latest = await prisma.testFileVersion.findFirst({
    where: { testFile: { component: { projectId, filePath: sourceFilePath } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      version: true,
      source: true,
      testFile: { select: { path: true } },
    },
  });
  return latest
    ? {
        id: latest.id,
        testPath: latest.testFile.path,
        code: latest.content,
        version: latest.version,
        source: latest.source,
      }
    : null;
}

/** 저장된 생성 버전이 있는 소스 경로. 폴더 보기 트리가 레포 테스트와 함께 "테스트 있음"으로 칠한다. */
export async function getGeneratedSourcePaths(projectId: string): Promise<Set<string>> {
  const rows = await prisma.component.findMany({
    where: { projectId, testFiles: { some: { versions: { some: {} } } } },
    select: { filePath: true },
  });
  return new Set(rows.map((row) => row.filePath));
}

/** 한 번에 받는 코드 상한(글자). 테스트 파일 하나로는 넉넉하고, 조작된 요청이 거대한 행을 못 넣게. */
const MAX_TEST_CODE = 200_000;

export type SaveTestCodeResult =
  { ok: true; versionId: string; version: number } | { ok: false; reason: "not-found" | "invalid" };

/**
 * 이 소스 파일의 테스트를 통째로 바꿔 새 버전으로 저장한다. 채팅 Apply·채팅 수정 도구·폴더 보기
 * 직접 수정이 같은 규칙을 쓴다. 화면 갱신(refresh)은 부르는 쪽 몫이다 — 라우트 핸들러에서도 부른다.
 *
 * code 도 filePath 도 사용자·모델이 보낸 값이다. 레포 트리에 있는 소스 경로만 받는다 —
 * 없는 경로로 Component 행이 생기지 않게. 내용은 검사하지 않는다(사용자 자신의 draft).
 * repo·projectId 는 부르는 쪽이 소유 확인을 마친 값이어야 한다.
 */
export async function saveTestCode(args: {
  repo: ProjectRepo;
  projectId: string;
  filePath: string;
  code: unknown;
  source: "ai" | "user";
}): Promise<SaveTestCodeResult> {
  const { repo, projectId, filePath, code, source } = args;
  if (typeof code !== "string" || !code.trim() || code.length > MAX_TEST_CODE) {
    return { ok: false, reason: "invalid" };
  }
  const entry = (await getRepoTree(repo)).find((e) => e.path === filePath);
  if (!entry) return { ok: false, reason: "not-found" };

  // 경로는 지금 보여주는 테스트의 것을 잇는다. 처음이면 레포 규칙대로.
  const latest = await getLatestGeneratedTest(projectId, filePath);
  const versionId = await saveGeneratedVersion({
    projectId,
    sourceFilePath: filePath,
    componentName: componentName(filePath),
    testPath: latest?.testPath ?? entry.testPath ?? testPathFor(filePath),
    code,
    source,
  });
  // onlyIfRepoChanged 를 켜지 않았으니 항상 쌓인다.
  if (!versionId) return { ok: false, reason: "invalid" };
  return { ok: true, versionId, version: (latest?.version ?? 0) + 1 };
}
