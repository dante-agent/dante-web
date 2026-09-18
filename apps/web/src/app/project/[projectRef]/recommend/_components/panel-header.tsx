import type { LucideIcon } from "lucide-react";

/** 패널 상단 줄 — 왼쪽에 아이콘 + 제목, 오른쪽에 (있으면) 액션. */
export function PanelHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Icon className="text-muted-foreground size-4" />
        {title}
      </h2>
      {action}
    </div>
  );
}
