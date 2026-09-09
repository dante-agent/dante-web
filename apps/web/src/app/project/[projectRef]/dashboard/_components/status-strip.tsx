import { Badge } from "@/components/ui/badge";

interface StatusStripProps {
  running: boolean;
  aiModel: string;
  currentTask: string;
  tokensUsed: number;
  tokenLimit: number;
}

export function StatusStrip({
  running,
  aiModel,
  currentTask,
  tokensUsed,
  tokenLimit,
}: StatusStripProps) {
  return (
    <div
      className={`bg-card divide-border flex flex-wrap divide-x rounded-xl border-l-4 ${
        running ? "border-l-brand-mint" : "border-l-border"
      }`}
    >
      <div className="flex items-center px-4 py-3">
        <Badge variant={running ? "success" : "outline"}>{running ? "실행 중" : "대기"}</Badge>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
        <p className="text-muted-foreground text-xs">AI 엔진 및 모델</p>
        <p className="truncate font-mono text-sm font-medium">{aiModel}</p>
      </div>
      <div className="flex min-w-0 flex-[2] flex-col justify-center gap-1 px-4 py-3">
        <p className="text-muted-foreground text-xs">현재 작업</p>
        <p className="truncate text-sm">{currentTask}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3">
        <p className="text-muted-foreground text-xs">토큰 사용량</p>
        <p className="font-mono text-sm font-medium">
          {tokensUsed.toLocaleString()} / {tokenLimit.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
