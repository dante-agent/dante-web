import { Check, FileCode2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Stage } from "./use-generation-performance";

/**
 * "파일을 AI 로 보내는" 연출(추천 생성 화면·폴더 보기 공용). 파일마다 한 줄: 경로 → 선(점이 흘러감) → AI.
 * 전송 단계에선 점이 흐르고, 작성 단계부터는 선이 채워지고 AI 가 생각 중(깜빡임)으로 바뀐다.
 */
export function SendingFiles({ files, stage }: { files: string[]; stage: Stage }) {
  const sending = stage === "send";
  const sent = stage === "write" || stage === "open";

  return (
    <ul className="border-border bg-card flex flex-col gap-2 rounded-lg border p-3">
      {files.map((path, index) => (
        <li key={path} className="flex items-center gap-2">
          <span
            className={cn(
              "bg-muted flex size-7 shrink-0 items-center justify-center rounded-md",
              stage === "read" && "animate-pulse motion-reduce:animate-none"
            )}
          >
            <FileCode2 className="text-muted-foreground size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs" title={path}>
            {path}
          </span>

          {/* 전송 선 — 전송 중엔 점이 파일에서 AI 쪽으로 흐르고, 보낸 뒤엔 선이 채워진다. */}
          <span className="relative h-px w-14 shrink-0">
            <span
              className={cn(
                "absolute inset-0 transition-colors duration-500",
                sent ? "bg-brand-cobalt/70" : "bg-border"
              )}
            />
            {sending && (
              <span
                className="bg-brand-cobalt animate-send-packet absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full motion-reduce:hidden"
                style={{ animationDelay: `${index * 180}ms` }}
              />
            )}
          </span>

          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
              sent ? "border-brand-cobalt/50 bg-brand-cobalt/10" : "border-border"
            )}
            // 장식이다. 진행 상태는 옆 GenerationSteps 의 글자가 전한다.
            aria-hidden="true"
          >
            {stage === "open" ? (
              <Check className="text-brand-mint size-3.5" />
            ) : (
              <Sparkles
                className={cn(
                  "size-3.5",
                  sent
                    ? "text-brand-cobalt animate-pulse motion-reduce:animate-none"
                    : "text-muted-foreground"
                )}
              />
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
