import type { ReactNode } from "react";

// 설정 본문의 공통 조각 둘. 페이지마다 같은 마크업을 베끼지 않으려고 뺐다.

/** 페이지 제목 + 한 줄 설명. 페이지당 하나. */
export function SettingsHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="max-w-2xl">
      {/* tabIndex=-1: 누른 버튼이 사라진 뒤 포커스를 돌려받을 자리(connection-panel.tsx). */}
      <h1
        tabIndex={-1}
        className="font-heading text-[22px] leading-tight font-medium tracking-[-0.02em] outline-none"
      >
        {title}
      </h1>
      <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">{description}</p>
    </header>
  );
}

/**
 * 아직 안 만든 자리.
 *
 * 링크만 있고 눌러도 빈 화면이면 고장으로 읽힌다. 여기에 무엇이 들어올지
 * 적어 두면 "아직 안 왔다"가 되고, 다음 PR 의 범위 메모 노릇도 한다.
 */
export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <div className="border-border bg-card/40 mt-8 max-w-2xl border p-5">
      <p className="text-muted-foreground/70 font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
        Not built yet
      </p>
      <div className="text-muted-foreground mt-3 text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}
