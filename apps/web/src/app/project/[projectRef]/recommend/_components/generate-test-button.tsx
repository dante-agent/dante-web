"use client";

import { useId } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { MAX_SELECT } from "./suggested-list";

// 추천 카드의 클릭 영역. 누르면 바로 생성 화면(/recommend/generate)으로 넘어가, 파일을 AI 로 보내고
// 코드가 써지는 과정을 보여준 뒤 세션 상세(채팅 + Monaco + 실행)로 이어진다. 생성 요청과 오류
// 표시는 생성 화면이 맡는다.
export function generateHref(projectRef: string, filePaths: string[]): string {
  const query = new URLSearchParams(filePaths.map((file) => ["file", file]));
  return `/project/${projectRef}/recommend/generate?${query}`;
}

/**
 * 카드 전체가 클릭 영역이다. children 이 카드 본문.
 *
 * 선택 모드에서는 링크가 아니라 체크박스가 된다 — 카드를 누르면 생성으로 넘어가 버리면
 * 고르던 것이 날아간다. 오른쪽 끝 칸은 화살표·체크박스 모두 size-4 라 모드가 바뀌어도
 * 폭이 흔들리지 않는다.
 */
export function GenerateTestButton({
  projectRef,
  filePath,
  componentName,
  selectMode = false,
  checked = false,
  onToggle,
  /** 최대 선택 수에 도달했는지 — 도달하면 안 고른 카드는 더 고를 수 없다. */
  selectionFull = false,
  children,
}: {
  projectRef: string;
  filePath: string;
  componentName: string;
  selectMode?: boolean;
  checked?: boolean;
  onToggle?: () => void;
  selectionFull?: boolean;
  children: React.ReactNode;
}) {
  const locked = selectMode && !checked && selectionFull;
  const className =
    "flex w-full items-center gap-3 rounded-lg p-2.5 text-left aria-disabled:cursor-default";
  // 이름(aria-label)은 짧게 두고, 카드 본문(우선순위·경로·추천 사유)은 설명으로 잇는다.
  // aria-label 만 두면 본문이 통째로 가려져 스크린리더로는 왜 추천됐는지 들을 수 없다.
  const bodyId = useId();
  const lockedId = useId();
  const body = (
    <span id={bodyId} className="contents">
      {children}
    </span>
  );

  if (selectMode) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`Select ${componentName}`}
        aria-describedby={locked ? `${lockedId} ${bodyId}` : bodyId}
        title={locked ? `Up to ${MAX_SELECT} files at a time` : undefined}
        // 한도에 닿은 카드도 포커스는 받아야 이유(title)를 들을 수 있다 — disabled 대신 aria-disabled.
        aria-disabled={locked}
        onClick={() => {
          if (!locked) onToggle?.();
        }}
        className={className}
      >
        {body}
        {locked && (
          <span id={lockedId} className="sr-only">
            Maximum reached. Up to {MAX_SELECT} files at a time.
          </span>
        )}
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          readOnly
          tabIndex={-1}
          aria-hidden
          className="accent-primary pointer-events-none size-4 shrink-0 disabled:opacity-40"
        />
      </button>
    );
  }

  return (
    <Link
      href={generateHref(projectRef, [filePath])}
      // 생성 화면은 여는 즉시 과금되는 요청을 보내지 않지만(클라이언트에서 시작), 목록의 모든 카드를
      // 미리 받을 이유도 없다.
      prefetch={false}
      aria-label={`Generate tests for ${componentName}`}
      aria-describedby={bodyId}
      className={className}
    >
      {body}
      <ArrowRight
        aria-hidden
        className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  );
}
