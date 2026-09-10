import { PromptInput } from "./_components/prompt-input";
import { RecommendTabs, type RecommendTab } from "./_components/recommend-tabs";
import { SessionList } from "./_components/session-list";
import { SuggestedList } from "./_components/suggested-list";
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
  const { sessions, recommendations } = recommendMock;

  return (
    <div className="mx-auto flex w-2/3 flex-col gap-8 p-8">
      <PromptInput />

      <RecommendTabs projectRef={projectRef} active={activeTab} />

      {activeTab === "suggested" && <SuggestedList recommendations={recommendations} />}
      {activeTab === "sessions" && <SessionList sessions={sessions} />}
      {activeTab === "scheduled" && (
        <p className="text-muted-foreground py-12 text-center text-sm">
          예약된 테스트 생성 작업이 아직 없습니다.
        </p>
      )}
    </div>
  );
}
