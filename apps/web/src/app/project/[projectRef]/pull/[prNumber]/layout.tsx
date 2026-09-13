import { notFound } from "next/navigation";
import { FileTree } from "@/components/file-tree";
import { SubSidebar } from "@/components/sub-sidebar";
import { requireUser } from "@/lib/auth/user";
import { getPullRequestPreview, parsePrNumber } from "@/lib/notifications/pull-request-preview";

// PR preview 셸. 폴더 보기(folder/layout.tsx)와 같은 모양이다 — 서브 사이드바에 파일 트리.
// 트리는 레포 전체가 아니라 이 PR 에서 테스트를 만든 파일만 담는다.
export default async function PullRequestPreviewLayout({
  children,
  params,
}: LayoutProps<"/project/[projectRef]/pull/[prNumber]">) {
  const { projectRef, prNumber: prParam } = await params;
  const prNumber = parsePrNumber(prParam);
  if (prNumber === null) notFound();

  const user = await requireUser();
  const preview = await getPullRequestPreview(projectRef, user.id, prNumber);
  if (!preview) notFound();

  const entries = (preview.job?.tests ?? []).map((test) => ({
    path: test.filePath,
    status: "has" as const,
    testPath: test.testPath,
  }));

  return <SubSidebar nav={<FileTree entries={entries} />}>{children}</SubSidebar>;
}
