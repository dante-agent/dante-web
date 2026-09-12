import type { ReactNode } from "react";

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
    <section className="flex flex-col gap-4">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
