import Link from "next/link";
import { OctagonAlert, TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ConnectionNotice } from "@/lib/github/connection";

// 연결이 끊겼을 때만 뜨는 배너. 페이지 최상단, 헤더 바로 아래.
//
// 톤이 둘인 이유(lib/github/connection.ts 의 tone): 넷 중 셋은 사용자가 GitHub 에서
// 클릭 몇 번으로 되돌릴 수 있고 하나(repo_deleted)만 되돌릴 수 없다. 넷을 같은
// 빨강으로 칠하면 "복구 가능"과 "끝났음"이 구분되지 않는다.
//
// 각진 테두리·카드 배경은 설정 화면의 다른 상자(General 의 <dl>)와 같은 모양이다.
const TONE = {
  warning: {
    Icon: TriangleAlert,
    box: "border-brand-orange/35 bg-brand-orange/[0.04]",
    icon: "text-brand-orange",
    button: "outline" as const,
  },
  danger: {
    Icon: OctagonAlert,
    box: "border-destructive/35 bg-destructive/[0.04]",
    icon: "text-destructive",
    button: "destructive" as const,
  },
};

export function ConnectionBanner({ notice }: { notice: ConnectionNotice }) {
  const tone = TONE[notice.tone];
  const { Icon } = tone;

  return (
    // role="alert" 은 쓰지 않는다. 페이지를 열자마자 있는 내용이라 끼어들 것이
    // 없고, 스크린리더가 본문을 읽기도 전에 가로채면 오히려 흐름이 끊긴다.
    <section className={`mt-6 max-w-2xl border p-5 ${tone.box}`}>
      <div className="flex gap-3.5">
        <Icon className={`mt-0.5 size-4 shrink-0 ${tone.icon}`} aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] leading-snug font-medium">{notice.title}</h2>
          <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">{notice.body}</p>

          <div className="mt-4">
            <Action action={notice.action} variant={tone.button} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** 배너의 단 하나뿐인 버튼. 링크 종류마다 태그가 다르다 (connection.ts 의 kind). */
function Action({
  action,
  variant,
}: {
  action: ConnectionNotice["action"];
  variant: "outline" | "destructive";
}) {
  const className = buttonVariants({ variant, size: "sm", className: "rounded-[4px]" });

  if (action.kind === "page") {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  // GitHub 은 새 탭 — 고치고 돌아와 Recheck 를 누르려면 이 화면이 남아 있어야
  // 한다. noreferrer noopener 는 새 탭이 window.opener 로 이쪽 창을 건드리지
  // 못하게 막는 관용구다.
  const github = action.kind === "github";

  return (
    <a
      href={action.href}
      target={github ? "_blank" : undefined}
      rel={github ? "noreferrer noopener" : undefined}
      className={className}
    >
      {action.label}
      {github && " ↗"}
    </a>
  );
}
