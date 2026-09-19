import { Check, LoaderCircle } from "lucide-react";
import { CodeSkeleton } from "@/components/generation/code-skeleton";
import { cn } from "@/lib/utils";
import { CodePanel } from "../../[session]/_components/code-panel";

/**
 * 우측 "테스트 코드가 써지는" 연출. AI 응답 전엔 스켈레톤 줄이 깜빡이고, 코드를 받으면
 * 세션 상세와 같은 코드 패널(CodePanel)에 한 글자씩 채워 넣는다. 파일이 여럿이면 차례로 쓰고
 * 상단 탭이 지금 쓰는 파일을 따라간다.
 */
export function WritingCode({
  sources,
  files,
  typing,
  waiting,
  failed,
}: {
  /** 코드를 받기 전 탭·헤더에 쓸 경로(생성 대상 원본, 또는 고치는 테스트 파일). */
  sources: string[];
  files: { testPath: string; code: string }[] | null;
  typing: { index: number; chars: number };
  waiting: boolean;
  failed: boolean;
}) {
  const tabs = files ? files.map((f) => f.testPath) : sources;
  const active = files ? typing.index : 0;
  const file = files?.[active];
  const content = file ? file.code.slice(0, typing.chars) : "";

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      {tabs.length > 1 && (
        // 누를 수 없는 진행 표시다. 지금 쓰는 파일·끝난 파일은 색·체크로만 보여서 글자로도 붙인다.
        <ol
          aria-label="Test files"
          className="border-border flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b px-2"
        >
          {tabs.map((path, index) => (
            <li
              key={path}
              aria-current={index === active ? "step" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs",
                index === active ? "bg-muted text-foreground" : "text-muted-foreground"
              )}
              title={path}
            >
              {files && index < active && <Check className="text-brand-mint size-3" />}
              {path.split("/").pop() || path}
              <span className="sr-only">
                {files && index < active
                  ? ", written"
                  : index === active
                    ? ", writing"
                    : ", waiting"}
              </span>
            </li>
          ))}
        </ol>
      )}

      {file ? (
        <CodePanel
          code={{
            changeType: "A",
            path: file.testPath,
            additions: content ? content.split("\n").length : 0,
            deletions: 0,
          }}
          content={content}
          follow
        />
      ) : (
        <section className="bg-background flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-4">
            <span className="min-w-0 flex-1 truncate font-mono text-xs" title={sources[0]}>
              {sources[0]}
            </span>
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              {failed ? (
                "Generation failed"
              ) : (
                <>
                  <LoaderCircle className="size-3 animate-spin" />
                  {waiting ? "AI is writing tests…" : "Preparing…"}
                </>
              )}
            </span>
          </div>
          <CodeSkeleton pulsing={waiting} />
        </section>
      )}
    </div>
  );
}
