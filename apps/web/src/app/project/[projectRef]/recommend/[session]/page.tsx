import { CodePanel } from "./_components/code-panel";
import { ResizableSplit } from "./_components/resizable-split";
import { ReviewPanel } from "./_components/review-panel";
import { prisma } from "@dante/db";
import { notFound } from "next/navigation";
import { requireProjectContext } from "@/lib/projects/queries";
import type { SessionDetail } from "./mock-data";
import type { TestRunView } from "./_components/test-terminal";

// AI 추천 세션 상세 (Jules 세션 화면). 좌측 세션 사이드바는 recommend/layout.tsx 가 제공하고,
// 여기서는 중앙 리뷰 패널 + 우측 코드 diff 패널의 2-pane 을 채운다.
// 지금은 정적 목업 — 실제 생성/저장이 붙으면 session 파라미터로 조회한다.
export default async function SessionDetailPage({
  params,
}: PageProps<"/project/[projectRef]/recommend/[session]">) {
  const { projectRef, session: sessionId } = await params;
  const { user, project } = await requireProjectContext(projectRef);
  const version = await prisma.testFileVersion.findFirst({
    where: {
      id: sessionId,
      testFile: { component: { project: { ref: projectRef, userId: user.id } } },
    },
    select: {
      id: true,
      content: true,
      version: true,
      createdAt: true,
      testFile: {
        select: {
          path: true,
          component: { select: { name: true, filePath: true } },
        },
      },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, logs: true, errorMessage: true },
      },
    },
  });
  if (!version) notFound();

  const contentLines = version.content.replace(/\n$/, "").split("\n");
  const session: SessionDetail = {
    id: version.id,
    title: `${version.testFile.component.name} 테스트 파일 생성`,
    readOnly: true,
    targetFile: version.testFile.component.filePath,
    branch: "앱 초안 · 저장소 미반영",
    timeSpent: "방금 전",
    summary: {
      what: [
        `\`${version.testFile.path}\` 파일 초안(v${version.version})을 생성했습니다.`,
        `${contentLines.length}줄의 테스트 코드가 추가될 예정입니다.`,
      ],
      why: ["AI 추천 입력창에서 요청한 내용을 바탕으로 테스트 초안을 만들었습니다."],
      verification: ["아직 테스트 실행과 GitHub 반영은 진행하지 않았습니다."],
    },
    code: {
      changeType: "A",
      path: version.testFile.path,
      additions: contentLines.length,
      deletions: 0,
      lines: contentLines.map((text, index) => ({
        kind: "add",
        oldNo: null,
        newNo: index + 1,
        text,
      })),
    },
  };
  const latestRun = version.runs[0];
  const initialRun: TestRunView | null = latestRun
    ? {
        status: latestRun.status as TestRunView["status"],
        logs: latestRun.logs,
        errorMessage: latestRun.errorMessage,
      }
    : null;

  // 프로젝트 셸의 p-8 을 상쇄해 Jules 처럼 패널을 화면 끝까지 붙인다. 헤더(47px) 아래를 꽉 채운다.
  // 두 패널 사이 구분선은 드래그로 폭 조절(ResizableSplit).
  return (
    <ResizableSplit
      left={<ReviewPanel projectName={project.name} projectRef={projectRef} session={session} />}
      right={
        <CodePanel
          code={session.code}
          projectRef={projectRef}
          versionId={version.id}
          initialRun={initialRun}
        />
      }
    />
  );
}
