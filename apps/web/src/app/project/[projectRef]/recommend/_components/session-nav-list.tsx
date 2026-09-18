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

/** 목록(최신순)을 훑어 같은 batchId 가 연이어 나오면 한 그룹으로 묶는다. 단건은 자기 혼자 그룹. */
function groupByBatch(sessions: GeneratedSession[]): GeneratedSession[][] {
  const groups: GeneratedSession[][] = [];
  for (const session of sessions) {
    const last = groups.at(-1);
    if (session.batchId && last && last[0].batchId === session.batchId) last.push(session);
    else groups.push([session]);
  }
  return groups;
}

function SessionRow({ projectRef, session }: { projectRef: string; session: GeneratedSession }) {
  const Icon = STATUS_ICON[session.status];
  return (
    <div className="group hover:bg-sidebar-accent/60 flex items-center gap-1 rounded-md pr-1">
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
}

export function SessionNavList({
  projectRef,
  sessions,
}: {
  projectRef: string;
  sessions: GeneratedSession[];
}) {
  const groups = groupByBatch(sessions);
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
      {groups.map((group) =>
        group.length > 1 ? (
          // 한 프롬프트로 배치 생성된 세션들 — 왼쪽 선과 라벨로 묶어 보여준다.
          <div key={group[0].id} className="border-border ml-2 flex flex-col gap-1 border-l pl-2">
            <p className="text-muted-foreground px-1 text-[10px] font-medium tracking-wide uppercase">
              Batch · {group.length}
            </p>
            {group.map((session) => (
              <SessionRow key={session.id} projectRef={projectRef} session={session} />
            ))}
          </div>
        ) : (
          <SessionRow key={group[0].id} projectRef={projectRef} session={group[0]} />
        )
      )}
    </div>
  );
}
