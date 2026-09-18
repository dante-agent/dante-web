"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, GitBranch, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ResizableSplit } from "../../[session]/_components/resizable-split";
import { generatePlannedTests, saveRecommendChat, type GeneratedTestFile } from "../../actions";
import { SendingFiles } from "./sending-files";
import { WritingCode } from "./writing-code";

// 생성은 한 번의 서버 액션(generatePlannedTests)이라 진행 상황이 오지 않는다. 그래서 단계는 연출이다:
// 읽기 → 전송(최소 시간을 채움) → 작성(AI 응답을 기다린 뒤, 받은 코드를 우측에 타이핑) → 세션으로 이동.
export type Stage = "read" | "send" | "write" | "open" | "error";

const READ_MS = 700;
const SEND_MS = 1500;
/** 코드 한 파일을 타이핑하는 시간. 길이에 비례하되 이 범위로 자른다. */
const TYPE_MIN_MS = 1200;
const TYPE_MAX_MS = 3000;
/** 타이핑이 끝나고 세션으로 넘어가기 전 잠깐 멈춤 — 완성된 코드를 한 번 보여준다. */
const OPEN_DELAY_MS = 600;

const STEPS: { stage: Exclude<Stage, "error">; label: string }[] = [
  { stage: "read", label: "Reading source" },
  { stage: "send", label: "Sending to AI" },
  { stage: "write", label: "Writing tests" },
  { stage: "open", label: "Opening session" },
];
const ORDER = STEPS.map((s) => s.stage);

const ERROR_MESSAGE = {
  budget: "You've exceeded this month's AI budget, so tests can't be generated.",
  preview: "Generated a preview, but it can't be saved because you don't own this project.",
  error: "Test generation failed. Check your API key and AI settings.",
  failed: "Couldn't run test generation. Please try again in a moment.",
};

type Done = { files: GeneratedTestFile[]; failed: string[]; url: string };

const basename = (path: string) => path.split("/").pop() || path;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function GeneratePerformance({
  projectRef,
  projectName,
  files,
}: {
  projectRef: string;
  projectName: string;
  files: string[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("read");
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 타이핑 진행: 몇 번째 파일을, 몇 글자까지 보여줬는지.
  const [typing, setTyping] = useState({ index: 0, chars: 0 });
  const savedRef = useRef<Promise<unknown>>(Promise.resolve());
  const startedRef = useRef(false);

  const prompt = `Generate tests for ${files.map(basename).join(", ")}`;

  // 1) 생성 요청과 앞 두 단계 연출을 동시에 시작한다. 작성 단계는 두 연출이 끝나야 들어간다.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // 새로고침·뒤로가기로 다시 생성(재과금)되지 않게 대상 파일을 URL 에서 지운다.
    // 파일이 없으면 page.tsx 가 목록으로 리다이렉트한다.
    window.history.replaceState(null, "", window.location.pathname);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stages = (async () => {
      await wait(reduced ? 0 : READ_MS);
      setStage((s) => (s === "read" ? "send" : s));
      await wait(reduced ? 0 : SEND_MS);
      setStage((s) => (s === "send" ? "write" : s));
    })();

    void (async () => {
      try {
        const result = await generatePlannedTests(projectRef, files);
        if (!result.ok) {
          setError(ERROR_MESSAGE[result.reason]);
          setStage("error");
          return;
        }
        const failedNote =
          result.failed.length > 0
            ? ` Couldn't generate ${result.failed.length} (${result.failed.join(", ")}) — try those again.`
            : "";
        const summary =
          result.files.length === 1
            ? `Generated \`${result.files[0].testPath}\`.${failedNote} Review it on the right and run it when you're ready.`
            : `Generated ${result.files.length} test files.${failedNote} Review them on the right and run them when you're ready.`;
        // 연출과 겹쳐 대화를 미리 저장한다(배치의 모든 세션에). 이동 전에 끝났는지만 기다린다.
        const messages = [
          { id: crypto.randomUUID(), role: "user" as const, text: prompt },
          { id: crypto.randomUUID(), role: "assistant" as const, text: summary },
        ];
        savedRef.current = Promise.all(
          result.versionIds.map((id) => saveRecommendChat(projectRef, id, messages))
        );
        await stages;
        setDone({
          files: result.files,
          failed: result.failed,
          // 생성 직후에는 실행하지 않는다 — 사용자가 코드를 보고 Run 을 눌러 돌린다.
          url: `/project/${projectRef}/recommend/${result.versionId}?tests=${result.versionIds.join(",")}`,
        });
      } catch (err) {
        unstable_rethrow(err);
        setError(ERROR_MESSAGE.failed);
        setStage("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) 코드를 받으면 파일마다 차례로 타이핑하고, 다 쓰면 세션으로 넘어간다.
  useEffect(() => {
    if (!done) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let cancelled = false;

    const typeFile = (index: number) =>
      new Promise<void>((resolve) => {
        const length = done.files[index].code.length;
        const duration = reduced ? 0 : Math.min(TYPE_MAX_MS, Math.max(TYPE_MIN_MS, length * 3));
        const start = performance.now();
        const tick = (now: number) => {
          if (cancelled) return;
          const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
          setTyping({ index, chars: Math.round(length * progress) });
          if (progress < 1) frame = requestAnimationFrame(tick);
          else resolve();
        };
        frame = requestAnimationFrame(tick);
      });

    void (async () => {
      for (let i = 0; i < done.files.length; i += 1) await typeFile(i);
      if (cancelled) return;
      setStage("open");
      await Promise.all([savedRef.current.catch(() => undefined), wait(OPEN_DELAY_MS)]);
      if (!cancelled) router.replace(done.url);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [done, router]);

  const current = ORDER.indexOf(stage as (typeof ORDER)[number]);

  return (
    <ResizableSplit
      left={
        <section className="border-border bg-background flex min-w-0 flex-1 flex-col border-r">
          <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <Link
              href={`/project/${projectRef}/recommend`}
              aria-label="Back to AI recommendations"
              className="text-muted-foreground hover:bg-muted hover:text-foreground -ml-2 flex size-8 items-center justify-center rounded-md"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <GitBranch className="text-muted-foreground size-4" />
            <span className="font-mono text-sm">{projectName}</span>
          </div>

          <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <span className="truncate text-sm font-semibold">Generating tests</span>
            <Sparkles className="text-brand-cobalt ml-auto size-4" />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div className="flex justify-end">
              <p className="bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm">{prompt}</p>
            </div>

            <div className="flex gap-2">
              <Sparkles className="text-brand-cobalt mt-0.5 size-4 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <SendingFiles files={files} stage={stage} />

                <ol className="flex flex-col gap-1.5" aria-live="polite">
                  {STEPS.map((step, index) => {
                    const state =
                      stage === "error"
                        ? "idle"
                        : index < current
                          ? "done"
                          : index === current
                            ? "active"
                            : "idle";
                    return (
                      <li
                        key={step.stage}
                        className={cn(
                          "flex items-center gap-2 text-sm transition-colors",
                          state === "idle" ? "text-muted-foreground/60" : "text-foreground/90"
                        )}
                      >
                        {state === "done" ? (
                          <Check className="text-brand-mint size-3.5 shrink-0" />
                        ) : state === "active" ? (
                          <LoaderCircle className="text-brand-cobalt size-3.5 shrink-0 animate-spin" />
                        ) : (
                          <span className="border-muted-foreground/40 size-3.5 shrink-0 rounded-full border" />
                        )}
                        {step.label}
                      </li>
                    );
                  })}
                </ol>

                {done && done.failed.length > 0 && (
                  <p className="text-muted-foreground text-sm">
                    Couldn&apos;t generate {done.failed.join(", ")}.
                  </p>
                )}
                {error && (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-destructive flex items-center gap-1.5 text-sm">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {error}
                    </p>
                    <Link
                      href={`/project/${projectRef}/recommend`}
                      className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
                    >
                      Back to recommendations
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      }
      right={
        <WritingCode
          sources={files}
          files={done?.files ?? null}
          typing={typing}
          waiting={stage === "write" && !done}
          failed={stage === "error"}
        />
      }
    />
  );
}
