import type { Metadata } from "next";
import { ArrowLeft, GitBranch, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProjectContext } from "@/lib/projects/queries";
import { ResizableSplit } from "../[session]/_components/resizable-split";
import { ChatSession } from "./_components/chat-session";

export const metadata: Metadata = { title: "New session" };

/**
 * AI 추천 입력창 제출 직후 바로 여기로 이동한다(확인 다이얼로그 없이). 아직 저장된
 * TestFileVersion 이 없어 세션 id 가 없으므로 프롬프트를 쿼리로 받는다. 좌측은 세션 상세와
 * 같은 채팅 UI 로 계획→추천 사유→생성 확인을 진행하고, 확정되면 실제 세션(/recommend/[session])
 * 으로 옮겨간다.
 */
export default async function NewRecommendSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectRef: string }>;
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { projectRef } = await params;
  const { prompt } = await searchParams;
  const trimmed = prompt?.trim() ?? "";
  if (!trimmed) redirect(`/project/${projectRef}/recommend`);

  const { project } = await requireProjectContext(projectRef);

  return (
    <ResizableSplit
      left={
        <section className="border-border bg-background flex min-w-0 flex-1 flex-col border-r">
          <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <Link
              href={`/project/${projectRef}/recommend`}
              aria-label="Back to AI recommendations"
              className="text-muted-foreground hover:bg-muted hover:text-foreground -ml-2 flex size-8 items-center justify-center rounded-md"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <GitBranch className="text-muted-foreground size-4" />
            <span className="font-mono text-sm">{project.name}</span>
          </div>

          <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <span className="truncate text-sm font-semibold">New test session</span>
            <Sparkles className="text-brand-cobalt ml-auto size-4" />
          </div>

          <ChatSession projectRef={projectRef} initialPrompt={trimmed} />
        </section>
      }
      right={
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-center text-sm">
          Generated test code will appear here once you confirm.
        </div>
      }
    />
  );
}
