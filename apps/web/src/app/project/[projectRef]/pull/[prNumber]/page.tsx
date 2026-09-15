import Link from "next/link";
import { notFound } from "next/navigation";
import { GitPullRequest } from "lucide-react";
import { FileView } from "@/components/file-view";
import { requireUser } from "@/lib/auth/user";
import { fetchFileText, installationClient } from "@/lib/github/pull-request";
import { getPullRequestPreview, parsePrNumber } from "@/lib/notifications/pull-request-preview";
import { readStoredRun, type StoredRun } from "@/lib/notifications/stored-run";
import { rerunPullRequest } from "./actions";

/** "다시 실행" 서버 액션이 after() 로 PR 작업을 돈다. api/github/webhook/route.ts 와 같은 이유 */
export const maxDuration = 800;

// PR preview. PR 코멘트의 "Open in Dante" 가 여기로 온다(lib/notifications/links.ts).
//
// 폴더 보기와 같은 화면이다. `?file=` 로 고른 파일을 <FileView> 로 띄운다 — 왼쪽은 PR head
// 커밋의 소스, 오른쪽은 Dante 가 만든 테스트. 파일을 고르기 전에는 실행 결과와 로그를 보여준다.
export default async function PullRequestPreviewPage({
  params,
  searchParams,
}: PageProps<"/project/[projectRef]/pull/[prNumber]">) {
  const { projectRef, prNumber: prParam } = await params;
  const prNumber = parsePrNumber(prParam);
  if (prNumber === null) notFound();

  // 레이아웃도 확인하지만 페이지가 그 검사에 기대지 않는다 (settings/general 과 같은 규칙).
  const user = await requireUser();
  const preview = await getPullRequestPreview(projectRef, user.id, prNumber);
  if (!preview) notFound();
  const { project, job } = preview;

  const sp = await searchParams;
  const file = typeof sp.file === "string" ? sp.file : undefined;
  const test = file ? job?.tests.find((t) => t.filePath === file) : undefined;

  if (job && test) {
    // 소스는 저장하지 않았다. 테스트를 만든 그 커밋에서 다시 읽는다 — 기본 브랜치를 읽으면
    // 머지 전 PR 의 코드와 테스트가 어긋난다.
    const octokit = await installationClient(project.installationId);
    const source = await fetchFileText(
      octokit,
      { owner: project.repoOwner, repo: project.repoName },
      test.filePath,
      job.headSha
    );

    // key={file} — 파일 바뀌면 분할 비율 초기화 (folder/page.tsx 와 같다)
    return (
      <FileView
        key={test.filePath}
        projectRef={projectRef}
        file={test.filePath}
        testPath={test.testPath}
        mode={sp.mode === "edit" ? "edit" : "view"}
        content={{ source: source ?? "", test: test.code, testDraft: null }}
      />
    );
  }

  const prUrl = `https://github.com/${project.repoOwner}/${project.repoName}/pull/${prNumber}`;
  const run = job ? readStoredRun(job.runResult) : null;

  return (
    <div className="h-[calc(100svh-47px)] overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 pt-16 pb-12">
        <header className="flex flex-col items-center gap-3 text-center">
          <GitPullRequest className="text-brand-orange size-8" />
          <h1 className="text-sm font-medium">Pull request #{prNumber}</h1>
          <p className="text-muted-foreground text-xs">
            <a
              href={prUrl}
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {project.repoOwner}/{project.repoName}
            </a>
            {job && (
              <>
                {" · "}
                <span className="font-mono">{job.headSha.slice(0, 7)}</span>
                {" · job "}
                {job.status}
              </>
            )}
          </p>
          {job && job.tests.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Select a file on the left to see its source and generated test.
            </p>
          )}
        </header>

        {sp.rerun === "1" && (
          <RerunPanel
            projectRef={projectRef}
            prNumber={prNumber}
            inFlight={
              job !== null && ["queued", "running", "awaiting_run", "testing"].includes(job.status)
            }
          />
        )}

        {!job ? (
          <Panel>
            <p className="text-muted-foreground">Dante has not processed this pull request yet.</p>
          </Panel>
        ) : (
          <>
            <Panel title="Result">
              <RunSummary run={run} jobError={job.error} />
            </Panel>

            {job.tests.length > 0 && (
              <Panel title="Generated tests">
                <ul className="flex flex-col">
                  {job.tests.map((t) => {
                    const counts = run?.testsByFile.get(t.testPath);
                    return (
                      <li key={t.testPath}>
                        <Link
                          href={`?file=${encodeURIComponent(t.filePath)}`}
                          className="hover:bg-muted -mx-2 flex items-baseline gap-2 rounded px-2 py-1.5"
                        >
                          <span className="font-mono">{t.testPath}</span>
                          {counts && (
                            <span className="text-muted-foreground ml-auto shrink-0">
                              {counts.total} test{counts.total === 1 ? "" : "s"}
                              {counts.failed > 0 && ` · ${counts.failed} failed`}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}

            {job.runLogs && (
              <details className="border-border overflow-hidden rounded-md border">
                <summary className="text-muted-foreground border-border cursor-pointer px-3 py-1.5 text-[11px] font-medium">
                  Runner logs
                </summary>
                <pre className="border-border max-h-[480px] overflow-auto border-t bg-black p-3 font-mono text-[12px] leading-relaxed">
                  {job.runLogs}
                </pre>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 코멘트의 Re-run 링크(?rerun=1)로 왔을 때만 보인다. 링크를 연 것만으로는 돌리지 않고,
 * 버튼을 눌러야 돈다(actions.ts). 이미 도는 중이면 겹쳐 돌리지 않게 버튼을 막는다.
 */
function RerunPanel({
  projectRef,
  prNumber,
  inFlight,
}: {
  projectRef: string;
  prNumber: number;
  inFlight: boolean;
}) {
  return (
    <Panel title="Re-run">
      <form action={rerunPullRequest} className="flex items-center gap-3">
        <input type="hidden" name="projectRef" value={projectRef} />
        <input type="hidden" name="prNumber" value={prNumber} />
        <p className="text-muted-foreground flex-1">
          {inFlight
            ? "Dante is already working on this pull request."
            : "Generate and run tests again for the latest commit of this pull request. AI usage is billed to you."}
        </p>
        <button
          type="submit"
          disabled={inFlight}
          className="bg-brand-orange shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40"
        >
          Re-run
        </button>
      </form>
    </Panel>
  );
}

/** folder-empty-state 의 "Recently opened" 상자와 같은 모양. */
function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="border-border overflow-hidden rounded-md border">
      {title && (
        <div className="text-muted-foreground border-border border-b px-3 py-1.5 text-[11px] font-medium">
          {title}
        </div>
      )}
      <div className="px-3 py-2.5 text-xs">{children}</div>
    </section>
  );
}

function RunSummary({ run, jobError }: { run: StoredRun | null; jobError: string | null }) {
  if (!run) {
    return (
      <p className="text-muted-foreground">
        {jobError ?? "Tests have not run for this commit yet."}
      </p>
    );
  }

  if (run.totals === null) {
    return (
      <p>
        Dante could not finish the run.
        {run.errorMessage && (
          <span className="text-muted-foreground mt-1 block font-mono">{run.errorMessage}</span>
        )}
      </p>
    );
  }

  return (
    <>
      <p className="font-medium">
        {run.totals.failed === 0
          ? `All ${run.totals.passed} tests passed`
          : `${run.totals.failed} of ${run.totals.total} tests failed`}
        {run.durationMs !== null && (
          <span className="text-muted-foreground font-normal">
            {" "}
            · {Math.round(run.durationMs / 100) / 10}s
          </span>
        )}
      </p>
      {run.failures.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {run.failures.map((failure, index) => (
            <li key={index}>
              <span className="font-mono">{failure.file}</span> › {failure.name}
              {failure.message && (
                <span className="text-muted-foreground block font-mono">{failure.message}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
