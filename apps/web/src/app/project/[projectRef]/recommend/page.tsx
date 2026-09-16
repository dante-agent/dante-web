import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getGeneratedSessions } from "@/lib/projects/generated-sessions";
import { getProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations } from "@/lib/projects/recommendations";
import { PromptInput } from "./_components/prompt-input";
import { RecommendTabs, type RecommendTab } from "./_components/recommend-tabs";
import { SessionList } from "./_components/session-list";
import { SuggestedSection } from "./_components/suggested-section";

const VALID_TABS: RecommendTab[] = ["suggested", "sessions", "scheduled"];

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
    <div className="mx-auto flex w-2/3 flex-col gap-8 p-8">
      <PromptInput projectRef={projectRef} />

      <RecommendTabs projectRef={projectRef} active={activeTab} />

      {activeTab === "suggested" &&
        (recommendations.length > 0 ? (
          <SuggestedSection projectRef={projectRef} initial={recommendations} />
        ) : (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No files without tests were found.
          </p>
        ))}
      {activeTab === "sessions" &&
        (sessions.length > 0 ? (
          <SessionList projectRef={projectRef} sessions={sessions} />
        ) : (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No generated test sessions yet.
          </p>
        ))}
      {activeTab === "scheduled" && (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No scheduled test generation jobs yet.
        </p>
      )}
    </div>
  );
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
