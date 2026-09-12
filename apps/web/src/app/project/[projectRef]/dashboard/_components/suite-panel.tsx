import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * 히어로 우측 패널. 점 격자 위에 테스트 스위트 카드 하나가 떠 있다.
 *
 * 격자는 이미지가 아니라 radial-gradient 반복이다 — 배경색이 바뀌어도 따라오고
 * 에셋이 하나 줄어든다. 20px 간격, 점 색은 보더와 같은 Mauve 5.
 */
export function SuitePanel({
  framework,
  branch,
  testFiles,
  components,
  runs,
  passRate,
}: {
  framework: string;
  branch: string;
  testFiles: number;
  components: number;
  runs: number;
  passRate: number;
}) {
  return (
    <div
      className="border-border relative h-full min-h-80 overflow-hidden rounded-lg border"
      style={{
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <div className="absolute top-1/2 left-1/2 w-[min(21rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2">
        <div className="border-border bg-card rounded-lg border p-3.5">
          <div className="flex items-start gap-3">
            <div className="bg-brand-mint/10 text-brand-mint grid size-8 shrink-0 place-items-center rounded-md">
              <FlaskConical className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">Test suite</p>
              <p className="text-muted-foreground truncate text-xs">{framework}</p>
              <p className="text-muted-foreground truncate font-mono text-xs">{branch}</p>
            </div>
            <Badge variant="success">{passRate}%</Badge>
          </div>

          <div className="border-border mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t pt-2.5 text-[11px]">
            <PanelMetric label="Tests" value={testFiles} />
            <Dot />
            <PanelMetric label="Components" value={components} />
            <Dot />
            <PanelMetric label="Runs" value={runs} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="text-muted-foreground">
      {label} <span className="text-foreground">{value}</span>
    </span>
  );
}

function Dot() {
  return <span className="text-muted-foreground/50">·</span>;
}
