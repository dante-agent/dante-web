"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 레포 주소 복사. 메타 줄 안에 들어가는 아이콘 버튼이다. 성공 표시는 1.5초 뒤 원래대로 돌아간다. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 표시가 돌아오기 전에 페이지를 떠나면 타이머가 남는다.
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  async function copy() {
    // http 로 열었거나 권한이 없으면 clipboard 가 없다. 조용히 넘긴다.
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={copy}
      title={copied ? "Copied" : "Copy repository URL"}
      aria-label={copied ? "Copied" : "Copy repository URL"}
      className="text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
