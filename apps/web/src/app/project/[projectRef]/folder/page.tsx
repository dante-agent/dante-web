// 사이드바에서 고른 파일 확인용 임시 화면. 다음 PR 에서 소스|테스트 2-pane(Monaco)로 교체.
export default async function FolderPage({
  searchParams,
}: PageProps<"/project/[projectRef]/folder">) {
  const { file } = await searchParams;

  if (!file) {
    return <p className="text-muted-foreground text-sm">왼쪽 트리에서 파일을 선택하세요.</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">선택된 파일</p>
      <p className="font-mono text-sm">{file}</p>
    </div>
  );
}
