export default async function FolderPage({ params }: PageProps<"/project/[projectRef]/folder">) {
  const { projectRef } = await params;

  return (
    <>
      <h1 className="text-2xl font-medium tracking-tight">폴더</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        프로젝트 <code className="font-mono">{projectRef}</code> · 구현 예정
      </p>
    </>
  );
}
