"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, LoaderCircle, XCircle } from "lucide-react";
import Link from "next/link";
import type { GeneratedSession, SessionStatus } from "@/lib/projects/generated-sessions";
import { cn } from "@/lib/utils";
import { SessionDeleteButton } from "./session-delete-button";

// 상태 필터 칩. 폴더 보기 파일 트리(components/file-tree.tsx)의 필터와 같은 모양·같은 자리를 쓴다.
// 다만 여기 칩은 토글이다 — 켜진 칩을 다시 누르면 꺼지고 전체가 보인다. 그래서 "All" 칩이 없다.
// running 은 몇 초 만에 다른 상태로 바뀌어 칩으로 고를 값이 아니라 뺐다(아이콘으로만 보인다).
const FILTERS: { key: SessionStatus; label: string; title: string }[] = [
  { key: "passed", label: "Passed", title: "Sessions whose tests passed" },
  { key: "failed", label: "Failed", title: "Sessions whose tests failed" },
  { key: "not_run", label: "Not run", title: "Sessions that were never run" },
];

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
        title={session.title}
        className="flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5 text-left"
      >
        <Icon
          className={`mt-px size-3.5 shrink-0 ${STATUS_COLOR[session.status]} ${
            session.status === "running" ? "animate-spin" : ""
          }`}
        />
        {/* 제목은 이 버전을 만든 요청, 아래 줄은 파일·버전 — 같은 파일의 버전끼리도 구분되게. */}
        <span className="flex min-w-0 flex-col">
          <span className="text-sidebar-foreground truncate text-xs">{session.title}</span>
          <span className="text-muted-foreground truncate text-[11px]">{session.meta}</span>
        </span>
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
  // null = 전체. 켜진 칩을 다시 누르면 null 로 돌아간다.
  const [filter, setFilter] = useState<SessionStatus | null>(null);
  const visible = useMemo(
    () => (filter ? sessions.filter((session) => session.status === filter) : sessions),
    [sessions, filter]
  );
  const groups = groupByBatch(visible);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* 접기 버튼(SubSidebar absolute top-2 right-1) 과 같은 선. pr-12 로 겹침 회피 */}
      <div className="-mt-1 flex h-9 items-center gap-1 pr-12">
        {FILTERS.map(({ key, label, title }) => (
          <button
            key={key}
            type="button"
            title={title}
            aria-pressed={filter === key}
            onClick={() => setFilter((prev) => (prev === key ? null : key))}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-xs transition-colors",
              filter === key
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-muted-foreground hover:text-sidebar-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        <p className="text-muted-foreground px-2 text-[11px] font-medium tracking-wide uppercase">
          Recent sessions
        </p>
        {sessions.length === 0 && (
          <p className="text-muted-foreground px-2 py-3 text-xs leading-5">
            No generated test sessions yet.
          </p>
        )}
        {sessions.length > 0 && visible.length === 0 && (
          <p className="text-muted-foreground px-2 py-3 text-xs leading-5">
            No sessions in this state.
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
    </div>
  );
}
