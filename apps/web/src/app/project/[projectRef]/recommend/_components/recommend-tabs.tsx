import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "suggested", label: "추천" },
  { key: "sessions", label: "세션" },
  { key: "scheduled", label: "예약됨" },
] as const;

export type RecommendTab = (typeof TABS)[number]["key"];

export function RecommendTabs({
  projectRef,
  active,
}: {
  projectRef: string;
  active: RecommendTab;
}) {
  return (
    <div className="flex items-center gap-1">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/project/${projectRef}/recommend?tab=${tab.key}`}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
