import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { isSandboxConfigured } from "@dante/sandbox";
import { getGeneratedChat } from "@/lib/projects/generated-chat";
import {
  getGeneratedSessionDetail,
  type GeneratedSessionDetail,
} from "@/lib/projects/generated-sessions";
import { requireProjectContext } from "@/lib/projects/queries";
import type { TestRunView } from "@/lib/projects/run-version";
import { GeneratedTestsPanel, type GeneratedFile } from "./_components/generated-tests-panel";
import { ResizableSplit } from "./_components/resizable-split";
import { ReviewPanel } from "./_components/review-panel";
import type { SessionDetail } from "./session-detail";

// 한 번에 만들 수 있는 최대 파일 수와 맞춘다(ai-file-match 의 MAX_MATCHES). 탭 상한.
const MAX_TABS = 3;

export const metadata: Metadata = { title: "Session" };

// AI 추천 세션 상세. 좌측 세션 사이드바는 recommend/layout.tsx 가 제공하고,
// 여기서는 중앙 리뷰(채팅) 패널 + 우측 코드/실행 패널의 2-pane 을 채운다.
// session 파라미터 = 저장된 TestFileVersion 의 id. ?tests=id1,id2,id3 로 같은 배치의
// 다른 파일들을 받아 우측을 탭으로 나눠 보여준다.
export default async function SessionDetailPage({
  params,
  searchParams,
}: PageProps<"/project/[projectRef]/recommend/[session]">) {
  const { projectRef, session: versionId } = await params;
  const query = await searchParams;
  const { user, project } = await requireProjectContext(projectRef);

  const detail = await getGeneratedSessionDetail(projectRef, user.id, versionId);
  if (!detail) notFound();

  // 이 세션에 저장된 대화(프롬프트·추천 사유·후속). 없으면 빈 채팅으로 시작한다.
  const chat = await getGeneratedChat(projectRef, user.id, versionId);

  // 같은 배치로 만든 다른 파일들. 라우트 버전을 항상 첫 탭으로 두고, 나머지를 뒤에 붙인다.
  const extraIds = parseTestIds(query.tests, versionId).slice(0, MAX_TABS - 1);
  const extraDetails = await Promise.all(
    extraIds.map((id) => getGeneratedSessionDetail(projectRef, user.id, id))
  );
  const files: GeneratedFile[] = [detail, ...extraDetails.filter(isDetail)].map(toFileView);

  // 좌측 채팅 헤더용 요약. 코드/요약 자체는 우측 탭 패널이 파일별로 그린다.
  const session: SessionDetail = {
    id: detail.versionId,
    title: `${detail.componentName} test · v${detail.version}`,
    readOnly: true,
    targetFile: detail.targetFile,
    origin: `Draft v${detail.version} · not committed`,
    createdLabel: formatDistanceToNow(detail.createdAt, { addSuffix: true }),
    summary: { what: [], why: [], verification: [] },
    code: files[0].code,
  };

  const runnerConfigured = isSandboxConfigured();

  // 패널을 화면 끝까지 붙여 헤더(47px) 아래를 꽉 채운다(ResizableSplit).
  // 좌우 구분선은 드래그로 폭 조절. 우측은 (파일이 여럿이면 탭 +) diff(위) + 실행 터미널(아래)을
  // 세로 구분선(VerticalSplit)으로 나눠 높이를 조절한다 — 터미널은 Run 버튼 줄만 남을 때까지
  // 내릴 수 있고, 코드는 넘치면 스크롤된다.
  return (
    <ResizableSplit
      left={
        <ReviewPanel
          projectName={project.name}
          projectRef={projectRef}
          session={session}
          initialMessages={chat}
          feedback={detail.feedback === "up" || detail.feedback === "down" ? detail.feedback : null}
        />
      }
      right={
        <GeneratedTestsPanel
          projectRef={projectRef}
          files={files}
          runnerConfigured={runnerConfigured}
        />
      }
    />
  );
}

/** ?tests=id1,id2,id3 → 라우트 버전을 뺀 나머지 id 들(중복 제거). */
function parseTestIds(raw: string | string[] | undefined, exclude: string): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const ids = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== exclude);
  return [...new Set(ids)];
}

function isDetail(d: GeneratedSessionDetail | null): d is GeneratedSessionDetail {
  return d !== null;
}

/** 저장된 버전 상세 → 우측 탭 하나가 쓰는 코드/실행 뷰. */
function toFileView(detail: GeneratedSessionDetail): GeneratedFile {
  // 저장된 파일 내용을 그대로 "추가" diff 로 보여준다 — 새로 만드는 파일이라 전부 add.
  const lines = detail.content.replace(/\n$/, "").split("\n");

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

  return {
    versionId: detail.versionId,
    path: detail.testPath,
    content: detail.content,
    initialRun,
    code: {
      changeType: "A",
      path: detail.testPath,
      additions: lines.length,
      deletions: 0,
    },
  };
}
