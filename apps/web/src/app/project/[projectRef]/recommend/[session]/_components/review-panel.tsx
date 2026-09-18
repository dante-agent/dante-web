import { ArrowLeft, GitBranch, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "../../_components/chat-thread";
import type { SessionDetail } from "../session-detail";
import { FeedbackButtons } from "./feedback-buttons";
import { FollowUp } from "./follow-up";

// 중앙 리뷰 패널 — Jules 가운데 컬럼. 헤더(레포·태스크) 아래는 채팅 하나로 채운다:
// 추천 입력에서 넘어온 프롬프트·추천 사유부터 후속 대화까지 한 스레드로 쌓인다(FollowUp).
// 초기 대화(initialMessages)는 서버가 DB 에서 읽어 넘긴다.
export function ReviewPanel({
  projectName,
  projectRef,
  session,
  initialMessages,
  feedback,
}: {
  projectName: string;
  projectRef: string;
  session: SessionDetail;
  initialMessages: ChatMessage[];
  feedback: "up" | "down" | null;
}) {
  return (
    <section className="border-border bg-background flex min-w-0 flex-1 flex-col border-r">
      {/* repo 바 */}
      <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Link
          href={`/project/${projectRef}/recommend`}
          aria-label="Back to AI recommendations"
          className="text-muted-foreground hover:bg-muted hover:text-foreground -ml-2 flex size-8 items-center justify-center rounded-md"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <GitBranch className="text-muted-foreground size-4" />
        <span className="font-mono text-sm">{projectName}</span>
      </div>

      {/* 태스크 타이틀 바 */}
      <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <span className="truncate text-sm font-semibold">{session.title}</span>
        {session.readOnly && (
          <Badge variant="outline" className="gap-1">
            <Lock className="size-3" />
            Read-only
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <FeedbackButtons projectRef={projectRef} versionId={session.id} initial={feedback} />
          <Sparkles className="text-brand-cobalt size-4" />
        </div>
      </div>

      {/* 대화 — 프롬프트·추천 사유·후속 요청이 한 채팅으로 이어진다. */}
      <FollowUp projectRef={projectRef} sessionId={session.id} initialMessages={initialMessages} />
    </section>
  );
}
