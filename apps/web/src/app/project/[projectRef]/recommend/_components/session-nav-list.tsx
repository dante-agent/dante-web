import { CheckCircle2, CircleDot, HelpCircle } from "lucide-react";
import Link from "next/link";
import type { GeneratedSession, SessionStatus } from "@/lib/projects/generated-sessions";

const STATUS_ICON: Record<SessionStatus, typeof CheckCircle2> = {
  needs_clarification: HelpCircle,
  in_progress: CircleDot,
  completed: CheckCircle2,
};

const STATUS_COLOR: Record<SessionStatus, string> = {
  needs_clarification: "text-brand-orange",
  in_progress: "text-brand-cobalt",
  completed: "text-brand-mint",
};

export function SessionNavList({
  projectRef,
  sessions,
}: {
  projectRef: string;
  sessions: GeneratedSession[];
}) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto pt-10">
      <p className="text-muted-foreground px-2 text-[11px] font-medium tracking-wide uppercase">
        Recent sessions
      </p>
      {sessions.length === 0 && (
        <p className="text-muted-foreground px-2 py-3 text-xs leading-5">
          No generated test sessions yet.
        </p>
      )}
      {sessions.map((session) => {
        const Icon = STATUS_ICON[session.status];
        return (
          <Link
            key={session.id}
            href={`/project/${projectRef}/recommend/${session.id}`}
            className="hover:bg-sidebar-accent/60 flex items-center gap-2 rounded-md px-2 py-1.5 text-left"
          >
            <Icon className={`size-3.5 shrink-0 ${STATUS_COLOR[session.status]}`} />
            <span className="text-sidebar-foreground truncate text-xs">{session.title}</span>
          </Link>
        );
      })}
    </div>
  );
}
