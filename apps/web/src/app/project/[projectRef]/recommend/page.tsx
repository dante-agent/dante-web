import type { Metadata } from "next";
import { CalendarClock, History, ListChecks } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getGeneratedSessions } from "@/lib/projects/generated-sessions";
import { getProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations } from "@/lib/projects/recommendations";
import { PanelHeader } from "./_components/panel-header";
import { PromptInput } from "./_components/prompt-input";
import { RecommendTabs, type RecommendTab } from "./_components/recommend-tabs";
import { SessionList } from "./_components/session-list";
import { SuggestedSection } from "./_components/suggested-section";

const VALID_TABS: RecommendTab[] = ["suggested", "sessions", "scheduled"];

export const metadata: Metadata = { title: "AI Recommendations" };

export default async function RecommendPage({
  params,
  searchParams,
}: PageProps<"/project/[projectRef]/recommend">) {
  const { projectRef } = await params;
  const { tab } = await searchParams;
  const activeTab: RecommendTab = VALID_TABS.includes(tab as RecommendTab)
    ? (tab as RecommendTab)
    : "suggested";

  // 탭별로 필요한 것만 읽는다 — 추천 탭은 레포 트리(GitHub), 세션 탭은 저장된 버전(DB).
  const recommendations = activeTab === "suggested" ? await loadRecommendations(projectRef) : [];
  const sessions = activeTab === "sessions" ? await loadSessions(projectRef) : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="bg-card/40 border-border flex flex-col gap-4 rounded-2xl border p-4">
        <PromptInput projectRef={projectRef} />

        <RecommendTabs projectRef={projectRef} active={activeTab} />

        <section className="border-border bg-background/60 flex flex-col gap-3 rounded-xl border p-4">
          {activeTab === "suggested" &&
            (recommendations.length > 0 ? (
              <SuggestedSection projectRef={projectRef} initial={recommendations} />
            ) : (
              <>
                <PanelHeader icon={ListChecks} title="Suggested" />
                <Empty>
                  Every file already has tests, or none were detected. Use the prompt above to
                  describe what you want tested.
                </Empty>
              </>
            ))}

          {activeTab === "sessions" && (
            <>
              <PanelHeader icon={History} title="Sessions" />
              {sessions.length > 0 ? (
                <SessionList projectRef={projectRef} sessions={sessions} />
              ) : (
                <Empty>
                  No generated test sessions yet. Describe a component in the prompt above to create
                  one.
                </Empty>
              )}
            </>
          )}

          {activeTab === "scheduled" && (
            <>
              <PanelHeader icon={CalendarClock} title="Scheduled" />
              <div className="text-muted-foreground flex flex-col items-center gap-1 py-10 text-center text-sm">
                <p className="text-foreground font-medium">
                  Scheduled generation isn’t available yet.
                </p>
                <p className="max-w-md">
                  This will let you run test generation on a schedule (e.g. nightly for files that
                  changed) without opening this page. For now, generate tests from the prompt or the
                  Suggested tab.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-10 text-center text-sm">{children}</p>;
}

async function loadRecommendations(projectRef: string) {
  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();
  return getTestRecommendations(repo);
}

async function loadSessions(projectRef: string) {
  const user = await requireUser();
  return getGeneratedSessions(projectRef, user.id);
}
