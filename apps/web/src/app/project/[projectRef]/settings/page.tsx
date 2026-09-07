export default async function SettingsPage({
  params,
}: PageProps<"/project/[projectRef]/settings">) {
  const { projectRef } = await params;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-medium tracking-tight">설정</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        프로젝트 <code className="font-mono">{projectRef}</code> · 구현 예정
      </p>
    </main>
  );
}
