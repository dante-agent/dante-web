import {
  ArrowLeft,
  ChevronDown,
  GitBranch,
  Lock,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { SessionDetail } from "../mock-data";
import { FollowUp } from "./follow-up";

// 중앙 리뷰 패널 — Jules 가운데 컬럼. 계획 완료 안내 + "Ready for review" 요약 카드 + 잠긴 입력.
export function ReviewPanel({
  projectName,
  projectRef,
  session,
}: {
  projectName: string;
  projectRef: string;
  session: SessionDetail;
}) {
  const { summary } = session;

  return (
    <section className="border-border bg-background flex min-w-0 flex-1 flex-col border-r">
      {/* repo 바 */}
      <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Link
          href={`/project/${projectRef}/recommend`}
          aria-label="AI 추천 목록으로 돌아가기"
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
        <Sparkles className="text-brand-cobalt ml-auto size-4" />
      </div>

      {/* 본문 */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <p className="text-muted-foreground text-sm">
          테스트 생성·검증·리뷰를 위한 사전 단계가 모두 완료되었습니다.
        </p>

        <p className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">대상</span>
          <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
            {session.targetFile}
          </span>
        </p>

        <div>
          <p className="text-sm font-semibold">모든 계획 단계 완료</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            모든 계획 단계가 성공적으로 끝났습니다. 제출 준비가 되었습니다.
          </p>
        </div>

        {/* Ready for review 카드 */}
        <div className="border-border bg-card rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">리뷰 준비 완료 🎉</span>
            <span className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-emerald-400">+{session.code.additions}</span>
              {session.code.deletions > 0 && (
                <span className="text-red-400">-{session.code.deletions}</span>
              )}
            </span>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
              <GitBranch className="size-3.5 shrink-0" />
              <span className="truncate">{session.branch}</span>
            </div>

            <SummaryBlock icon="✍️" title="What" items={summary.what} />
            <SummaryBlock icon="💡" title="Why" items={summary.why} />
            <SummaryBlock icon="✅" title="Verification" items={summary.verification} />
          </div>

          {/* 카드 푸터 */}
          <div className="border-border flex items-center justify-between border-t px-4 py-2.5">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span>이 결과 어땠나요?</span>
              <button type="button" className="hover:text-foreground">
                <ThumbsUp className="size-3.5" />
              </button>
              <button type="button" className="hover:text-foreground">
                <ThumbsDown className="size-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs">Time: {session.timeSpent}</span>
              <button
                type="button"
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium"
              >
                PR 생성
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 후속 메시지 (목업 응답) */}
      <FollowUp />
    </section>
  );
}

function SummaryBlock({ icon, title, items }: { icon: string; title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold">
        {icon} {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-foreground/90 flex gap-2 text-sm">
            <span className="text-muted-foreground shrink-0">–</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
