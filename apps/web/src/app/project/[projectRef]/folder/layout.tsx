import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SubSidebar } from "@/components/sub-sidebar";
import { FileTree } from "@/components/file-tree";
import { requireUser } from "@/lib/auth/user";
import { getRepoTree } from "@/lib/github/tree";
import { getProjectRepo } from "@/lib/projects/queries";

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
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          }
        >
          <RepoTree projectRef={projectRef} />
        </Suspense>
      }
    >
      {children}
    </SubSidebar>
  );
}

async function RepoTree({ projectRef }: { projectRef: string }) {
  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();
  const entries = await getRepoTree(repo);
  return <FileTree entries={entries} />;
}
