"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, GitBranch, Sparkles } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { requestArrivalFocus } from "@/components/generation/arrival-focus";
import { GenerationSteps } from "@/components/generation/generation-steps";
import { SendingFiles } from "@/components/generation/sending-files";
import {
  useGenerationPerformance,
  type GenerationOutcome,
} from "@/components/generation/use-generation-performance";
import { useAnnounce } from "@/components/live-announcer";
import { ResizableSplit } from "../../[session]/_components/resizable-split";
import { generatePlannedTests, saveRecommendChat, type GeneratedTestFile } from "../../actions";
import { WritingCode } from "./writing-code";

/** 타이핑이 끝나고 세션으로 넘어가기 전 잠깐 멈춤 — 완성된 코드를 한 번 보여준다. */
const OPEN_DELAY_MS = 600;

// 예산 한도는 팀이 아니라 사람마다이고 매달 1일 초기화된다. 사용자는 AI 제공자 키를 넣지
// 않으므로(Dante 가 제공자와 직접 계약) 실패 문구에서 키 안내는 빼고 다시 시도만 권한다.
const ERROR_MESSAGE = {
  budget:
    "You've used up your personal AI budget this month, so tests can't be generated. It resets on the 1st.",
  preview: "Generated a preview, but it can't be saved because you don't own this project.",
  error: "Test generation failed. Please try again in a moment.",
};

const basename = (path: string) => path.split("/").pop() || path;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 생성 화면 본문. 좌측은 파일을 AI 로 보내는 연출과 단계, 우측은 테스트 코드가 써지는 연출.
 * 연출 흐름은 useGenerationPerformance 가 맡고, 여기선 생성·대화 저장·세션 이동만 정한다.
 */
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
  const prompt = `Generate tests for ${files.map(basename).join(", ")}`;
  // 배치 중 생성에 실패한 파일 이름 — 좌측에 한 줄로 알린다.
  const [failed, setFailed] = useState<string[]>([]);
  // 연출이 끝난 뒤 쓸 것 — 이동할 세션 주소, 대화 저장 완료.
  const resultRef = useRef({ url: "", saved: Promise.resolve() as Promise<unknown> });

  const generate = useCallback(async (): Promise<GenerationOutcome<GeneratedTestFile>> => {
    try {
      const result = await generatePlannedTests(projectRef, files);
      if (!result.ok) return { ok: false, message: ERROR_MESSAGE[result.reason] };

      const failedNote =
        result.failed.length > 0
          ? ` Couldn't generate ${result.failed.length} (${result.failed.join(", ")}) — try those again.`
          : "";
      const summary =
        result.files.length === 1
          ? `Generated \`${result.files[0].testPath}\`.${failedNote} Review it on the right and run it when you're ready.`
          : `Generated ${result.files.length} test files.${failedNote} Review them on the right and run them when you're ready.`;
      const messages = [
        { id: crypto.randomUUID(), role: "user" as const, text: prompt },
        { id: crypto.randomUUID(), role: "assistant" as const, text: summary },
      ];
      setFailed(result.failed);
      resultRef.current = {
        // 생성 직후에는 실행하지 않는다 — 사용자가 코드를 보고 Run 을 눌러 돌린다.
        url: `/project/${projectRef}/recommend/${result.versionId}?tests=${result.versionIds.join(",")}`,
        // 연출과 겹쳐 대화를 미리 저장한다(배치의 모든 세션에). 이동 전에 끝났는지만 기다린다.
        saved: Promise.all(
          result.versionIds.map((id) => saveRecommendChat(projectRef, id, messages))
        ),
      };
      return { ok: true, files: result.files };
    } catch (err) {
      unstable_rethrow(err);
      throw err;
    }
  }, [projectRef, files, prompt]);

  const finish = useCallback(async () => {
    const { saved, url } = resultRef.current;
    await Promise.all([saved.catch(() => undefined), wait(OPEN_DELAY_MS)]);
    requestArrivalFocus();
    router.replace(url);
    // 좌측 사이드바는 레이아웃이라 이동만으로는 다시 그리지 않는다. 새 세션이 목록에 뜨게 새로고침한다.
    router.refresh();
  }, [router]);

  const {
    stage,
    files: generated,
    typing,
    error,
    start,
  } = useGenerationPerformance<GeneratedTestFile>({ finish });

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // 새로고침·뒤로가기로 다시 생성(재과금)되지 않게 대상 파일을 URL 에서 지운다.
    // 파일이 없으면 page.tsx 가 목록으로 리다이렉트한다.
    window.history.replaceState(null, "", window.location.pathname);
    start(generate);
  }, [start, generate]);

  const current = stage ?? "read";
  // 일부 파일 실패는 조건부로 나타나는 문구라 스크린리더가 놓친다. 공용 알림으로 한 번 읽는다.
  useAnnounce(failed.length > 0 ? `Couldn't generate ${failed.join(", ")}.` : null);

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
            <h1 className="truncate text-sm font-semibold">Generating tests</h1>
            <Sparkles className="text-brand-cobalt ml-auto size-4" />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
            <div className="flex justify-end">
              <p className="bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm">{prompt}</p>
            </div>

            <div className="flex gap-2">
              <Sparkles className="text-brand-cobalt mt-0.5 size-4 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <SendingFiles files={files} stage={current} />
                <GenerationSteps stage={current} finalLabel="Opening session" />

                {failed.length > 0 && (
                  <p className="text-muted-foreground text-sm">
                    Couldn&apos;t generate {failed.join(", ")}.
                  </p>
                )}
                {error && (
                  <div className="flex flex-col items-start gap-2">
                    <p role="alert" className="text-destructive flex items-center gap-1.5 text-sm">
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
          files={generated}
          typing={typing}
          waiting={current === "write" && !generated}
          failed={current === "error"}
        />
      }
    />
  );
}
