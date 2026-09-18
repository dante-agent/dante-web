import { CheckCircle2, Circle, LoaderCircle, XCircle } from "lucide-react";
import Link from "next/link";
import type { GeneratedSession, SessionStatus } from "@/lib/projects/generated-sessions";
import { SessionDeleteButton } from "./session-delete-button";

const STATUS_ICON: Record<SessionStatus, typeof CheckCircle2> = {
  not_run: Circle,
  running: LoaderCircle,
  passed: CheckCircle2,
  failed: XCircle,
};

const STATUS_COLOR: Record<SessionStatus, string> = {
  not_run: "text-muted-foreground",
  running: "text-brand-cobalt",
  passed: "text-brand-mint",
  failed: "text-brand-orange",
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
          <div
            key={session.id}
            className="group hover:bg-sidebar-accent/60 flex items-center gap-1 rounded-md pr-1"
          >
            <Link
              href={`/project/${projectRef}/recommend/${session.id}`}
              className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
            >
              <Icon
                className={`size-3.5 shrink-0 ${STATUS_COLOR[session.status]} ${
                  session.status === "running" ? "animate-spin" : ""
                }`}
              />
              <span className="text-sidebar-foreground truncate text-xs">{session.title}</span>
            </Link>
            <SessionDeleteButton
              projectRef={projectRef}
              versionId={session.id}
              title={session.title}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100"
            />
          </div>
        );
      })}
    </div>
  );
}
