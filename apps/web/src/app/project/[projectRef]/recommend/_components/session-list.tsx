import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { GeneratedSession, SessionStatus } from "@/lib/projects/generated-sessions";
import { SessionDeleteButton } from "./session-delete-button";

const STATUS_LABEL: Record<SessionStatus, string> = {
  needs_clarification: "Needs clarification",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_VARIANT: Record<SessionStatus, "outline" | "secondary" | "default"> = {
  needs_clarification: "outline",
  in_progress: "secondary",
  completed: "default",
};

export function SessionList({
  projectRef,
  sessions,
}: {
  projectRef: string;
  sessions: GeneratedSession[];
}) {
  return (
    <ul className="flex flex-col gap-1">
      {sessions.map((session) => (
        <li key={session.id} className="group -mx-2 flex items-center gap-3">
          <Link
            href={`/project/${projectRef}/recommend/${session.id}`}
            className="group-hover:bg-muted flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{session.title}</span>
            <Badge variant={STATUS_VARIANT[session.status]}>{STATUS_LABEL[session.status]}</Badge>
            <span className="text-muted-foreground w-20 shrink-0 text-right text-xs">
              {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
            </span>
          </Link>
          <SessionDeleteButton
            projectRef={projectRef}
            versionId={session.id}
            title={session.title}
            className="mr-1"
          />
        </li>
      ))}
    </ul>
  );
}
