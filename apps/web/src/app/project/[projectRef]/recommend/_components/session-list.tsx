import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AiSession, SessionStatus } from "../mock-data";

const STATUS_LABEL: Record<SessionStatus, string> = {
  needs_clarification: "확인 필요",
  in_progress: "진행 중",
  completed: "완료",
};

const STATUS_VARIANT: Record<SessionStatus, "outline" | "secondary" | "default"> = {
  needs_clarification: "outline",
  in_progress: "secondary",
  completed: "default",
};

export function SessionList({ sessions }: { sessions: AiSession[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {sessions.map((session) => (
        <li
          key={session.id}
          className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5"
        >
          <span className="min-w-0 flex-1 truncate text-sm">{session.title}</span>
          <Badge variant={STATUS_VARIANT[session.status]}>{STATUS_LABEL[session.status]}</Badge>
          <span className="text-muted-foreground w-20 shrink-0 text-right text-xs">
            {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true, locale: ko })}
          </span>
          <button type="button" className="text-muted-foreground hover:text-foreground shrink-0">
            <MoreHorizontal className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
