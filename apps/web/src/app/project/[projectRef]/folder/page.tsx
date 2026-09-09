// 선택된 파일(`?file=`)을 <FileView> 로 띄운다. `?mode=edit` 이면 테스트 diff.
import { FileView } from "@/components/file-view";
import { getFileContent, mockFileTree } from "@/lib/mock-data";

export default async function FolderPage({
  searchParams,
}: PageProps<"/project/[projectRef]/folder">) {
  const sp = await searchParams;
  const file = typeof sp.file === "string" ? sp.file : undefined;
  const mode = sp.mode === "edit" ? "edit" : "view";

  if (!file) {
    return <p className="text-muted-foreground text-sm">왼쪽 트리에서 파일을 선택하세요.</p>;
  }

  const status = mockFileTree.find((e) => e.path === file)?.status ?? "none";

  // key={file} — 파일 바뀌면 분할 비율 초기화
  return <FileView key={file} file={file} mode={mode} content={getFileContent(file, status)} />;
}
