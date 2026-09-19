import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AiChatDock } from "@/components/ai-chat";
import { SubSidebar } from "@/components/sub-sidebar";
import { FileTree } from "@/components/file-tree";
import { requireUser } from "@/lib/auth/user";
import { getRepoTree } from "@/lib/github/tree";
import { getGeneratedSourcePaths } from "@/lib/projects/generated-versions";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";

// 폴더 보기 섹션 셸. 서브 사이드바에 레포 파일 트리가 붙는다.
// 트리 페치는 Suspense 안 async 컴포넌트로 스트리밍 — 셸은 즉시, 트리는 준비되는 대로.
export default async function FolderLayout({
  children,
  params,
}: LayoutProps<"/project/[projectRef]/folder">) {
  const { projectRef } = await params;
  return (
    <SubSidebar
      nav={
        <Suspense
          fallback={
            <div role="status" className="flex flex-1 items-center justify-center">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
              <span className="sr-only">Loading files…</span>
            </div>
          }
        >
          <RepoTree projectRef={projectRef} />
        </Suspense>
      }
    >
      {/* 본문 오른쪽에 AI 채팅이 붙는다. layout 에 두어야 파일을 옮겨도 대화가 남는다. */}
      <AiChatDock projectRef={projectRef}>{children}</AiChatDock>
    </SubSidebar>
  );
}

async function RepoTree({ projectRef }: { projectRef: string }) {
  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();
  const projectId = await getOwnedProjectId(projectRef, user.id);
  const [entries, generated] = await Promise.all([
    getRepoTree(repo),
    projectId ? getGeneratedSourcePaths(projectId) : new Set<string>(),
  ]);
  // 초록 = 레포에 테스트가 있거나 Dante 에서 생성한 버전이 있음. testPath 는 레포 파일일 때만 둔다.
  const marked = entries.map((entry) =>
    entry.status === "none" && generated.has(entry.path)
      ? { ...entry, status: "has" as const }
      : entry
  );
  return <FileTree entries={marked} />;
}
