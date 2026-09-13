"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Download } from "lucide-react";
import { DiffView } from "./diff-view";
import type { SessionDetail } from "../mock-data";

// 우측 "Code" 패널 — 파일별 diff 리뷰. Jules 우측 컬럼 대응.
// 목업 인터랙션: Collapse all(diff 접기/펼치기), Copy(코드 클립보드 복사).
export function CodePanel({ code }: { code: SessionDetail["code"] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = code.lines.map((l) => l.text).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없으면 조용히 무시 — 데모용이라 별도 에러 UI 는 두지 않는다.
    }
  };

  return (
    <section className="bg-background flex min-w-0 flex-1 flex-col">
      {/* 패널 헤더 */}
      <div className="border-border flex h-12 shrink-0 items-center justify-between border-b px-4">
        <span className="text-sm font-medium">Code</span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs"
        >
          <Download className="size-3.5" />
          Download zip
        </button>
      </div>

      {/* Review 서브헤더 */}
      <div className="border-border flex h-10 shrink-0 items-center justify-between border-b px-4">
        <span className="text-muted-foreground text-xs font-medium">Review</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {collapsed ? "Expand all" : "Collapse all"}
          </button>
          <button
            type="button"
            className="border-border text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
          >
            Stacked
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>

      {/* 파일 행 */}
      <div className="border-border flex h-9 shrink-0 items-center gap-2 border-b px-4">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={collapsed ? "diff 펼치기" : "diff 접기"}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <span className="text-brand-cobalt font-mono text-xs font-semibold">{code.changeType}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={code.path}>
          {code.path}
        </span>
        {code.additions > 0 && (
          <span className="font-mono text-xs text-emerald-400">+{code.additions}</span>
        )}
        {code.deletions > 0 && (
          <span className="font-mono text-xs text-red-400">-{code.deletions}</span>
        )}
        <button
          type="button"
          onClick={copy}
          className="text-muted-foreground hover:text-foreground ml-1 flex items-center gap-1"
          aria-label="코드 복사"
        >
          {copied ? <Check className="text-brand-mint size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>

      {/* diff 본문 */}
      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <DiffView lines={code.lines} />
        </div>
      )}
    </section>
  );
}
