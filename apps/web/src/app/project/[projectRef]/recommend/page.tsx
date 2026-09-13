import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations } from "@/lib/projects/recommendations";
import { PromptInput } from "./_components/prompt-input";
import { RecommendTabs, type RecommendTab } from "./_components/recommend-tabs";
import { SessionList } from "./_components/session-list";
import { SuggestedSection } from "./_components/suggested-section";
import { recommendMock } from "./mock-data";

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
  const { sessions } = recommendMock;

  // 추천 탭에서만 레포 트리를 읽는다 — 다른 탭을 볼 때 GitHub 호출을 아끼려고.
  const recommendations = activeTab === "suggested" ? await loadRecommendations(projectRef) : [];

  return (
    <div className="mx-auto flex w-2/3 flex-col gap-8 p-8">
      <PromptInput />

      <RecommendTabs projectRef={projectRef} active={activeTab} />

      {activeTab === "suggested" &&
        (recommendations.length > 0 ? (
          <SuggestedSection projectRef={projectRef} initial={recommendations} />
        ) : (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No files without tests were found.
          </p>
        ))}
      {activeTab === "sessions" && <SessionList projectRef={projectRef} sessions={sessions} />}
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
