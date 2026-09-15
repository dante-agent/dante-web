import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { requireProjectContext } from "@/lib/projects/queries";
import { getGeneratedSessionDetail } from "@/lib/projects/generated-sessions";
import { CodePanel } from "./_components/code-panel";
import { ResizableSplit } from "./_components/resizable-split";
import { ReviewPanel } from "./_components/review-panel";
import type { SessionDetail } from "./session-detail";

// AI 추천 세션 상세. 좌측 세션 사이드바는 recommend/layout.tsx 가 제공하고,
// 여기서는 중앙 리뷰 패널 + 우측 코드 diff 패널의 2-pane 을 채운다.
// session 파라미터 = 저장된 TestFileVersion 의 id.
export default async function SessionDetailPage({
  params,
}: PageProps<"/project/[projectRef]/recommend/[session]">) {
  const { projectRef, session: versionId } = await params;
  const { user, project } = await requireProjectContext(projectRef);

  const detail = await getGeneratedSessionDetail(projectRef, user.id, versionId);
  if (!detail) notFound();

  // 저장된 파일 내용을 그대로 "추가" diff 로 보여준다 — 새로 만드는 파일이라 전부 add.
  const lines = detail.content.replace(/\n$/, "").split("\n");
  const ranStatus = detail.latestRun?.status;

  const session: SessionDetail = {
    id: detail.versionId,
    title: `${detail.componentName} test · v${detail.version}`,
    readOnly: true,
    targetFile: detail.targetFile,
    origin: `Draft v${detail.version} · not committed`,
    createdLabel: formatDistanceToNow(detail.createdAt, { addSuffix: true }),
    summary: {
      what: [
        `Generated \`${detail.testPath}\` (v${detail.version}).`,
        `${lines.length} lines of test code.`,
      ],
      why: [`Requested from the AI recommendations for \`${detail.targetFile}\`.`],
      verification: ranStatus
        ? [runVerificationLabel(ranStatus)]
        : ["Not run yet — run it from the Code panel."],
    },
    code: {
      changeType: "A",
      path: detail.testPath,
      additions: lines.length,
      deletions: 0,
      lines: lines.map((text, index) => ({
        kind: "add" as const,
        oldNo: null,
        newNo: index + 1,
        text,
      })),
    },
  };

  // 프로젝트 셸의 p-8 을 상쇄해 패널을 화면 끝까지 붙인다. 헤더(47px) 아래를 꽉 채운다.
  // 두 패널 사이 구분선은 드래그로 폭 조절(ResizableSplit).
  return (
    <ResizableSplit
      left={<ReviewPanel projectName={project.name} projectRef={projectRef} session={session} />}
      right={<CodePanel code={session.code} />}
    />
  );
}

function runVerificationLabel(status: string): string {
  if (status === "passed") return "Latest run passed.";
  if (status === "failed") return "Latest run failed — some tests did not pass.";
  if (status === "queued" || status === "running") return "A run is in progress.";
  return "Latest run could not complete (error).";
}
