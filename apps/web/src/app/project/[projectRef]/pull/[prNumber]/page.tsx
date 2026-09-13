import { notFound } from "next/navigation";
import { prisma } from "@dante/db";
import { requireUser } from "@/lib/auth/user";
import { readStoredRun, type StoredRun } from "@/lib/notifications/stored-run";
import { accessibleProjectWhere } from "@/lib/teams/access";

// PR preview. PR 코멘트의 "Open in Dante" 가 여기로 온다(lib/notifications/links.ts).
//
// 이 PR 의 가장 최근 작업 하나를 보여준다 — 만든 테스트 코드와 runner 결과·로그.
// 코멘트는 요약만 담아서, "어떤 테스트가 왜 실패했나"를 보려면 코드와 로그가 필요하다.
export default async function PullRequestPreviewPage({
  params,
}: PageProps<"/project/[projectRef]/pull/[prNumber]">) {
  const user = await requireUser();
  const { projectRef, prNumber: prParam } = await params;

  const prNumber = Number(prParam);
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) notFound();

  // 레이아웃도 확인하지만 페이지가 그 검사에 기대지 않는다 (settings/general 과 같은 규칙).
  const project = await prisma.project.findFirst({
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: { id: true, repoOwner: true, repoName: true },
  });
  if (!project) notFound();

  const job = await prisma.pullRequestJob.findFirst({
    where: { projectId: project.id, prNumber },
    orderBy: { createdAt: "desc" },
    select: {
      headSha: true,
      status: true,
      error: true,
      runResult: true,
      runLogs: true,
      updatedAt: true,
      tests: {
        orderBy: { testPath: "asc" },
        select: { id: true, filePath: true, testPath: true, code: true },
      },
    },
  });

  const prUrl = `https://github.com/${project.repoOwner}/${project.repoName}/pull/${prNumber}`;
  const run = job ? readStoredRun(job.runResult) : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <header>
        <h1 className="font-heading text-[22px] leading-tight font-medium tracking-[-0.02em]">
          Pull request #{prNumber}
        </h1>
        <p className="text-muted-foreground mt-2 text-[13px]">
          <a href={prUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
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
      </header>

      {!job ? (
        <p className="text-muted-foreground border-border bg-card border p-5 text-[13px]">
          Dante has not processed this pull request yet.
        </p>
      ) : (
        <>
          <RunSection run={run} jobError={job.error} />

          <section>
            <SectionTitle>Generated tests</SectionTitle>
            {job.tests.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-[13px]">
                No tests were generated for this commit.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-4">
                {job.tests.map((test) => {
                  const counts = run?.testsByFile.get(test.testPath);
                  return (
                    <details key={test.id} className="border-border bg-card border" open>
                      <summary className="flex cursor-pointer items-baseline gap-3 px-4 py-3">
                        <span className="font-mono text-[13px]">{test.testPath}</span>
                        <span className="text-muted-foreground text-[12px]">
                          for {test.filePath}
                          {counts &&
                            ` · ${counts.total} test${counts.total === 1 ? "" : "s"}${counts.failed > 0 ? ` · ${counts.failed} failed` : ""}`}
                        </span>
                      </summary>
                      <pre className="border-border overflow-x-auto border-t p-4 font-mono text-[12px] leading-relaxed">
                        {test.code}
                      </pre>
                    </details>
                  );
                })}
              </div>
            )}
          </section>

          {job.runLogs && (
            <section>
              <SectionTitle>Runner logs</SectionTitle>
              <details className="border-border bg-card mt-3 border">
                <summary className="cursor-pointer px-4 py-3 text-[13px]">Show logs</summary>
                <pre className="border-border max-h-[480px] overflow-auto border-t p-4 font-mono text-[12px] leading-relaxed">
                  {job.runLogs}
                </pre>
              </details>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RunSection({ run, jobError }: { run: StoredRun | null; jobError: string | null }) {
  return (
    <section>
      <SectionTitle>Result</SectionTitle>
      <div className="border-border bg-card mt-3 border p-5 text-[13px]">
        {!run ? (
          <p className="text-muted-foreground">
            {jobError ?? "Tests have not run for this commit yet."}
          </p>
        ) : run.totals === null ? (
          <p>
            Dante could not finish the run.
            {run.errorMessage && (
              <span className="text-muted-foreground mt-1 block font-mono">{run.errorMessage}</span>
            )}
          </p>
        ) : (
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
              <ul className="mt-3 flex flex-col gap-2">
                {run.failures.map((failure, index) => (
                  <li key={index}>
                    <span className="font-mono">{failure.file}</span> › {failure.name}
                    {failure.message && (
                      <span className="text-muted-foreground block font-mono text-[12px]">
                        {failure.message}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
      {children}
    </h2>
  );
}
