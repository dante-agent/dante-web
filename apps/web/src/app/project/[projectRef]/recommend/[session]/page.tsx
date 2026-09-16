import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { isSandboxConfigured } from "@dante/sandbox";
import { getGeneratedSessionDetail } from "@/lib/projects/generated-sessions";
import { requireProjectContext } from "@/lib/projects/queries";
import type { TestRunView } from "@/lib/projects/run-version";
import { CodePanel } from "./_components/code-panel";
import { ResizableSplit } from "./_components/resizable-split";
import { ReviewPanel } from "./_components/review-panel";
import { TestRunPanel } from "./_components/test-run-panel";
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

  // 마지막 실행을 터미널의 초기 상태로 넘긴다. 저장하는 status 는 passed/failed/error 뿐이라
  // 그 밖의 값(있을 리 없지만)은 error 로 접는다.
  const initialRun: TestRunView | null = detail.latestRun
    ? {
        status:
          detail.latestRun.status === "passed"
            ? "passed"
            : detail.latestRun.status === "failed"
              ? "failed"
              : "error",
        logs: detail.latestRun.logs,
        errorMessage: detail.latestRun.errorMessage,
      }
    : null;
  const runnerConfigured = isSandboxConfigured();

  // 패널을 화면 끝까지 붙여 헤더(47px) 아래를 꽉 채운다(ResizableSplit).
  // 두 패널 사이 구분선은 드래그로 폭 조절. 우측은 diff(위) + 실행 터미널(아래).
  return (
    <ResizableSplit
      left={<ReviewPanel projectName={project.name} projectRef={projectRef} session={session} />}
      right={
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <CodePanel code={session.code} />
          </div>
          <div className="h-64 shrink-0">
            <TestRunPanel
              projectRef={projectRef}
              versionId={detail.versionId}
              initialRun={initialRun}
              runnerConfigured={runnerConfigured}
            />
          </div>
        </div>
      }
    />
  );
}

function runVerificationLabel(status: string): string {
  if (status === "passed") return "Latest run passed.";
  if (status === "failed") return "Latest run failed — some tests did not pass.";
  if (status === "queued" || status === "running") return "A run is in progress.";
  return "Latest run could not complete (error).";
}
