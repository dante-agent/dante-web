import type { Metadata } from "next";
// 선택된 파일(`?file=`)을 <FileView> 로 띄운다. `?mode=edit` 이면 테스트 diff.
// Test Code 칸은 저장된 최신 버전을 보여준다. 레포에 테스트가 있으면 열 때 버전으로 가져온다
// (처음이면 v1, 레포에서 바뀌었으면 다음 번호). AI 로 만든 버전은 커밋 전 draft 로 표시한다.
import { notFound } from "next/navigation";
import { FileView } from "@/components/file-view";
import { FolderEmptyState } from "@/components/folder-empty-state";
import { requireUser } from "@/lib/auth/user";
import { getFileText } from "@/lib/github/blob";
import { getRepoTree } from "@/lib/github/tree";
import { getLatestGeneratedTest, saveGeneratedVersion } from "@/lib/projects/generated-versions";
import { getOwnedProjectId, getProjectRepo } from "@/lib/projects/queries";
import { componentName } from "@/lib/projects/recommendations";

export const metadata: Metadata = { title: "Explorer" };

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
  // 둘 다 getOwnedProject(cache) 한 번의 조회를 나눠 쓴다.
  const [repo, projectId] = await Promise.all([
    getProjectRepo(projectRef, user.id),
    getOwnedProjectId(projectRef, user.id),
  ]);
  if (!repo || !projectId) notFound();

  // 저장된 최신 버전은 트리를 기다릴 필요가 없다. 트리는 layout 과 같은 요청 → cache 로 1회.
  const [entries, stored] = await Promise.all([
    getRepoTree(repo),
    getLatestGeneratedTest(projectId, file),
  ]);
  const repoTestPath = entries.find((e) => e.path === file)?.testPath ?? null;

  const [source, repoTest] = await Promise.all([
    getFileText(repo, file),
    repoTestPath ? getFileText(repo, repoTestPath) : Promise.resolve(null),
  ]);

  // 레포 테스트를 새 버전으로 가져와야 할 때만 쓰기 트랜잭션에 들어간다. 조건은
  // saveGeneratedVersion 의 onlyIfRepoChanged 와 같다(버전이 없거나, 레포에서 온 최신 버전과
  // 내용이 다를 때). 대부분의 열기는 위의 읽기 한 번으로 끝난다.
  // 최종 판정은 여전히 트랜잭션 안에서 한다 — 동시에 연 다른 요청과 겹쳐도 중복을 쌓지 않는다.
  let latest = stored;
  const needsRepoSync =
    repoTestPath !== null &&
    repoTest !== null &&
    (!stored || (stored.source === "repo" && stored.code !== repoTest));
  if (needsRepoSync) {
    try {
      await saveGeneratedVersion({
        projectId,
        sourceFilePath: file,
        componentName: componentName(file),
        testPath: repoTestPath,
        code: repoTest,
        source: "repo",
        onlyIfRepoChanged: true,
      });
      latest = await getLatestGeneratedTest(projectId, file);
    } catch (error) {
      // 저장이 안 돼도 레포 테스트는 보여줄 수 있다. 보기를 깨지 않고 로그만 남긴다.
      console.error("[folder] 레포 테스트 가져오기 실패", { file, error });
    }
  }
  const draft =
    latest && latest.source !== "repo" ? { version: latest.version, source: latest.source } : null;

  // key={file} — 파일 바뀌면 분할 비율 초기화
  return (
    <FileView
      key={file}
      projectRef={projectRef}
      file={file}
      testPath={latest?.testPath ?? repoTestPath}
      mode={mode}
      draft={draft}
      // 실행은 저장된 버전만 돌린다. 레포 테스트도 열 때 버전으로 들어오므로 대개 있다.
      versionId={latest?.id ?? null}
      terminal
      saveable
      content={{ source: source ?? "", test: latest?.code ?? repoTest, testDraft: null }}
    />
  );
}
