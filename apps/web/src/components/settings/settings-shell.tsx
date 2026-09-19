import type { ReactNode } from "react";
import { SettingsNav, type SettingsNavItem } from "@/components/settings/settings-nav";

// 설정 화면의 2단 껍데기. 왼쪽은 스코프 이름 + 링크 목록, 오른쪽은 페이지 본문.
//
// scope 를 큰 글씨로 두는 이유: 이 앱의 설정은 계정 것과 프로젝트 것이 나뉘어
// 있어서(AI 키는 계정, 실행 환경은 프로젝트) 지금 어느 쪽을 고치는 중인지가
// 화면에 늘 보여야 한다. 아니면 "여기서 바꾼 키가 다른 프로젝트에도 먹나?"를
// 매번 본문 설명으로 해명해야 한다.
//
// 왼쪽 열은 sticky — 본문이 길어져도 링크가 따라온다. top-20 = 헤더 12 + 여백 8.
export function SettingsShell({
  scope,
  title,
  items,
  footer,
  replace,
  children,
}: {
  /** 이 설정이 무엇에 붙는지. "Account" 또는 프로젝트 이름. */
  scope: string;
  /** scope 위에 붙는 짧은 라벨. "PROJECT" 처럼 종류를 알린다. */
  title: string;
  items: SettingsNavItem[];
  /** 링크 목록 아래 (다른 스코프로 건너가는 링크 등). */
  footer?: ReactNode;
  /** 탭 이동을 히스토리에 쌓지 않는다 (SettingsNav 참고). */
  replace?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-12">
      <div className="sticky top-20 w-44 shrink-0 self-start">
        <p className="text-muted-foreground font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
          {title}
        </p>
        <p className="font-heading mt-1.5 truncate text-[15px] font-medium" title={scope}>
          {scope}
        </p>

        <SettingsNav items={items} replace={replace} />

        {footer && <div className="border-border mt-5 border-t pt-4">{footer}</div>}
      </div>

      {/* min-w-0: flex 자식은 기본이 min-width:auto 라 긴 코드·경로가 열을 밀어낸다. */}
      <div className="min-w-0 flex-1 pb-16">{children}</div>
    </div>
  );
}
