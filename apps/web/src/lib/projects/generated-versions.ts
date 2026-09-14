import { prisma } from "@dante/db";

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
}): Promise<string> {
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
      update: { path: args.testPath },
      select: { id: true },
    });

    // 버전은 1 부터 증가. 직전 최대에 +1 한다. 한 트랜잭션 안이라 같은 파일에 대한
    // 동시 생성이 같은 번호를 잡는 건 @@unique([testFileId, version]) 가 막는다.
    const last = await tx.testFileVersion.findFirst({
      where: { testFileId: testFile.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const created = await tx.testFileVersion.create({
      data: {
        testFileId: testFile.id,
        content: args.code,
        version: (last?.version ?? 0) + 1,
        source: "ai",
      },
      select: { id: true },
    });

    return created.id;
  });
}
