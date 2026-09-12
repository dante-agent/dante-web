import Link from "next/link";
import { Bell, FolderCode, KeyRound, Puzzle, Sparkles, SquareTerminal } from "lucide-react";

/**
 * 프로젝트를 굴리는 데 필요한 화면들로 가는 줄.
 * href 는 전부 실재하는 라우트다 — 안 만든 화면은 여기 올리지 않는다.
 */
const ENTRIES = [
  {
    key: "explorer",
    Icon: FolderCode,
    title: "Explorer",
    hint: "Browse the repo",
    href: (ref: string) => `/project/${ref}/folder`,
  },
  {
    key: "recommend",
    Icon: Sparkles,
    title: "Recommendations",
    hint: "What to test next",
    href: (ref: string) => `/project/${ref}/recommend`,
  },
  {
    key: "runtime",
    Icon: SquareTerminal,
    title: "Runtime",
    hint: "Install & test command",
    href: (ref: string) => `/project/${ref}/settings/runtime`,
  },
  {
    key: "notifications",
    Icon: Bell,
    title: "Notifications",
    hint: "PR comments & checks",
    href: (ref: string) => `/project/${ref}/settings/notifications`,
  },
  {
    key: "api-keys",
    Icon: KeyRound,
    title: "API keys",
    hint: "Bring your own model",
    href: () => "/account/settings/ai",
  },
  {
    key: "extension",
    Icon: Puzzle,
    title: "Extension",
    hint: "Connect your editor",
    href: () => "/account/settings/extension",
  },
] as const;

export function GetStarted({ projectRef }: { projectRef: string }) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      {/*
        칸마다 위·왼쪽 hairline 을 두고 격자 전체를 1px 끌어올려, 바깥쪽 선은
        컨테이너 보더에 겹쳐 잘리게 한다. 열 수가 바뀌어도(2 → 3 → 6) 줄 끝에
        선이 남지 않는다 — divide-x/divide-y 는 DOM 순서로만 긋기 때문에 이게 안 된다.
      */}
      <div className="-mt-px -ml-px grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {ENTRIES.map(({ key, Icon, title, hint, href }) => (
          <Link
            key={key}
            href={href(projectRef)}
            className="border-border hover:bg-muted/40 flex flex-col items-center gap-1.5 border-t border-l px-4 py-8 text-center transition-colors"
          >
            <Icon className="text-muted-foreground mb-1 size-4" strokeWidth={1.5} />
            <span className="text-sm">{title}</span>
            <span className="text-muted-foreground text-xs">{hint}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
