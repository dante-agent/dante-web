import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * 대시보드의 한 섹션 — 제목 줄 + 내용.
 * 제목 오른쪽 자리(action)는 비워도 줄 높이가 흔들리지 않게 min-h 를 준다.
 */
export function Section({
  title,
  action,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground text-[17px] font-medium tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** 섹션 제목 오른쪽의 "더 보기" 류 링크. 화살표가 hover 에 살짝 움직인다. */
export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group text-foreground inline-flex items-center gap-1.5 text-[12.5px]"
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}

/**
 * 나란히 놓인 두 목록(Recent runs · Up next)의 줄 격자. 첫 칸(상태·우선순위 글자)·간격·오른쪽 끝 칸을
 * 한 값으로 맞춰 두 목록의 경로가 같은 x 에서 시작하고 여백 리듬이 같다.
 * 첫 칸 64px 는 가장 긴 글자("● Running")가 들어가는 폭이다. 끝 칸도 56px 로 고정해(가장 긴 "1m 04s"·"just now"
 * 가 들어간다) 내용이 시간이든 화살표든 경로 칸 폭이 같다. 끝 칸 내용은 오른쪽에 붙인다.
 */
export const LIST_ROW =
  "grid grid-cols-[64px_minmax(0,1fr)_56px] items-center gap-3 px-4 py-2.5 [&>:last-child]:justify-self-end";

/**
 * 목록이 들어갈 틀. 줄 사이에 hairline 만 긋는다.
 * footer 는 줄 아래 남는 자리를 채운다 — 두 칸(2-pane)에서 줄 수가 달라도 틀 높이가 맞고(flex-1),
 * 늘어난 자리가 빈 채로 남지 않는다.
 */
export function ListPanel({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="border-border bg-card flex flex-1 flex-col overflow-hidden rounded-lg border">
      <div className="divide-border/60 divide-y">{children}</div>
      {footer}
    </div>
  );
}

/** 아직 보여줄 게 없을 때. 무엇이 여기 생기는지와 어디서 시작하는지만 말한다. */
export function EmptyPanel({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="border-border bg-card flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border px-6 py-9 text-center">
      <p className="text-[13.5px]">{title}</p>
      <p className="text-muted-foreground max-w-[46ch] text-[12.5px] leading-relaxed">{hint}</p>
      <div className="mt-2">
        <ArrowLink href={action.href}>{action.label}</ArrowLink>
      </div>
    </div>
  );
}

/**
 * 파일 경로를 두 줄로: 이름을 크게, 폴더는 흐리게. 반쪽 폭에서 긴 경로가 한 줄로 잘리면
 * 정작 파일 이름이 가려진다. extra 는 폴더 뒤에 붙는 짧은 설명이다.
 */
export function PathLabel({
  path,
  extra,
  ghost = false,
}: {
  path: string;
  extra?: string;
  /** 불러오는 중. 같은 줄 높이를 유지한 채 글자만 가린다. */
  ghost?: boolean;
}) {
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const dir = slash === -1 ? "/" : path.slice(0, slash);
  const sub = extra ? `${dir} · ${extra}` : dir;
  return (
    <span className="flex min-w-0 flex-col gap-0.5" title={ghost ? undefined : path}>
      <span className="text-foreground/90 truncate font-mono text-[12.5px]">
        {ghost ? <Ghost>{name}</Ghost> : name}
      </span>
      <span className="text-muted-foreground truncate text-[11.5px]">
        {ghost ? <Ghost>{sub}</Ghost> : sub}
      </span>
    </span>
  );
}

/**
 * 스켈레톤 조각. 실제 글자를 투명하게 두고 배경만 깜빡인다 — 따로 막대를 그리면 줄 높이가
 * 글꼴 크기·행간과 어긋나 불러온 뒤 레이아웃이 튄다. 같은 태그·같은 글자 크기 안에 넣어 쓴다.
 * 모양은 components/ui/skeleton.tsx 와 같다(bg-muted + pulse).
 */
export function Ghost({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="bg-muted animate-pulse rounded-sm text-transparent select-none motion-reduce:animate-none"
    >
      {children}
    </span>
  );
}

/** "4m ago" · "3h ago" · "2d ago". 좁은 칸에 들어가게 짧게. 한 달이 넘으면 날짜. */
export function timeAgo(date: Date) {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
