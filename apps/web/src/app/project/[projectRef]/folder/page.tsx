// 선택된 파일(`?file=`)을 <FileView> 로 띄운다. `?mode=edit` 이면 테스트 diff.
import { notFound } from "next/navigation";
import { FileView } from "@/components/file-view";
import { FolderEmptyState } from "@/components/folder-empty-state";
import { requireUser } from "@/lib/auth/user";
import { getFileText } from "@/lib/github/blob";
import { getRepoTree } from "@/lib/github/tree";
import { getProjectRepo } from "@/lib/projects/queries";

export default async function FolderPage({
  params,
  searchParams,
}: PageProps<"/project/[projectRef]/folder">) {
  const { projectRef } = await params;
  const sp = await searchParams;
  const file = typeof sp.file === "string" ? sp.file : undefined;
  const mode = sp.mode === "edit" ? "edit" : "view";

  if (!file) return <FolderEmptyState projectRef={projectRef} />;

  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();

  const entries = await getRepoTree(repo); // layout 과 같은 요청 → cache 로 1회
  const testPath = entries.find((e) => e.path === file)?.testPath ?? null;

  const [source, test] = await Promise.all([
    getFileText(repo, file),
    testPath ? getFileText(repo, testPath) : Promise.resolve(null),
  ]);

  // key={file} — 파일 바뀌면 분할 비율 초기화
  return (
    <FileView
      key={file}
      projectRef={projectRef}
      file={file}
      testPath={testPath}
      mode={mode}
      content={{ source: source ?? "", test, testDraft: null }}
    />
  );
}
