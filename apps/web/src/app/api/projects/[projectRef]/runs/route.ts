import { prisma } from "@dante/db";
import { NextResponse } from "next/server";
import { githubApp } from "@/lib/github/app";
import { detectRuntimeCommands } from "@/lib/projects/detect-runtime";
import { resolveRuntimeSettings } from "@/lib/projects/runtime";
import { createClient } from "@/lib/supabase/server";

type Body = { versionId?: unknown };
type RunnerResult = {
  status: "passed" | "failed" | "error";
  exitCode: number | null;
  logs: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt: string;
};

export async function POST(
  request: Request,
  context: RouteContext<"/api/projects/[projectRef]/runs">
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const runnerUrl = process.env.RUNNER_URL;
  const runnerSecret = process.env.RUNNER_SECRET;
  if (!runnerUrl || !runnerSecret) {
    return NextResponse.json({ error: "테스트 실행 서버가 설정되지 않았습니다." }, { status: 503 });
  }

  const { projectRef } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Body;
  if (typeof body.versionId !== "string") {
    return NextResponse.json({ error: "실행할 테스트 버전이 필요합니다." }, { status: 400 });
  }

  const version = await prisma.testFileVersion.findFirst({
    where: {
      id: body.versionId,
      testFile: { component: { project: { ref: projectRef, userId: user.id } } },
    },
    select: {
      id: true,
      content: true,
      testFile: {
        select: {
          path: true,
          component: {
            select: {
              project: {
                select: {
                  id: true,
                  testFramework: true,
                  installCommand: true,
                  testCommand: true,
                  testTimeoutMs: true,
                  repoOwner: true,
                  repoName: true,
                  defaultBranch: true,
                  installationId: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!version)
    return NextResponse.json({ error: "테스트 버전을 찾을 수 없습니다." }, { status: 404 });

  const project = version.testFile.component.project;
  const run = await prisma.testRun.create({
    data: { testFileVersionId: version.id, status: "queued" },
    select: { id: true },
  });

  try {
    const defaults = await detectRuntimeCommands(projectRef, project, project.testFramework);
    const runtime = resolveRuntimeSettings(project, defaults);
    const { data: installationToken } = await githubApp().octokit.request(
      "POST /app/installations/{installation_id}/access_tokens",
      { installation_id: Number(project.installationId) }
    );

    await prisma.testRun.update({
      where: { id: run.id },
      data: { status: "running", startedAt: new Date() },
    });

    const runnerResponse = await fetch(`${runnerUrl.replace(/\/$/, "")}/runs/stream`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${runnerSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        repo: {
          url: `https://github.com/${project.repoOwner}/${project.repoName}.git`,
          revision: project.defaultBranch,
          token: installationToken.token,
        },
        testFile: { path: version.testFile.path, content: version.content },
        commands: { install: runtime.installCommand, test: runtime.testCommand },
        timeoutMs: runtime.timeoutMs,
      }),
      signal: request.signal,
    });
    if (!runnerResponse.ok || !runnerResponse.body) {
      throw new Error(`runner 응답 오류 (${runnerResponse.status})`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = runnerResponse.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "run", runId: run.id })}\n`));
        let pending = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            pending += decoder.decode(value, { stream: true });
            const lines = pending.split("\n");
            pending = lines.pop() ?? "";
            for (const line of lines) await persistResultEvent(run.id, line);
          }
          if (pending) await persistResultEvent(run.id, pending);
          controller.close();
        } catch (error) {
          await markRunError(run.id, error);
          controller.error(error);
        }
      },
      cancel() {
        return reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    await markRunError(run.id, error);
    console.error("[test-run]", { projectRef, runId: run.id, error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "테스트 실행에 실패했습니다." },
      { status: 502 }
    );
  }
}

async function persistResultEvent(runId: string, line: string) {
  let event: { type?: unknown; result?: RunnerResult };
  try {
    event = JSON.parse(line) as typeof event;
  } catch {
    return;
  }
  if (event.type !== "result" || !event.result) return;
  const result = event.result;
  await prisma.testRun.update({
    where: { id: runId },
    data: {
      status: result.status,
      exitCode: result.exitCode,
      logs: result.logs,
      errorMessage: result.errorMessage ?? null,
      startedAt: new Date(result.startedAt),
      finishedAt: new Date(result.finishedAt),
    },
  });
}

async function markRunError(runId: string, error: unknown) {
  await prisma.testRun
    .update({
      where: { id: runId },
      data: {
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    })
    .catch(() => {});
}
