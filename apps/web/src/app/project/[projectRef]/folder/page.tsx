// 선택된 파일(`?file=`)을 <FileView> 로 띄운다. `?mode=edit` 이면 테스트 diff.
import { FileView } from "@/components/file-view";
import { FolderEmptyState } from "@/components/folder-empty-state";
import { getFileContent, mockFileTree } from "@/lib/mock-data";

export default async function FolderPage({
  params,
  searchParams,
}: PageProps<"/project/[projectRef]/folder">) {
  const { projectRef } = await params;
  const sp = await searchParams;
  const file = typeof sp.file === "string" ? sp.file : undefined;
  const mode = sp.mode === "edit" ? "edit" : "view";

  if (!file) return <FolderEmptyState projectRef={projectRef} />;

  const status = mockFileTree.find((e) => e.path === file)?.status ?? "none";

  // key={file} — 파일 바뀌면 분할 비율 초기화
  return (
    <FileView
      key={file}
      projectRef={projectRef}
      file={file}
      mode={mode}
      content={getFileContent(file, status)}
    />
  );
}
