import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getProjectRepo } from "@/lib/projects/queries";
import { getTestRecommendations } from "@/lib/projects/recommendations";
import { PromptInput } from "./_components/prompt-input";
import { SuggestedSection } from "./_components/suggested-section";

export const metadata: Metadata = { title: "AI Recommendations" };

export default async function RecommendPage({
  params,
}: PageProps<"/project/[projectRef]/recommend">) {
  const { projectRef } = await params;
  const recommendations = await loadRecommendations(projectRef);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
      {/* 화면에 제목 글자가 없어(카드가 곧 본문) 스크린리더용 제목만 둔다. */}
      <h1 className="sr-only">AI Recommendations</h1>
      <div className="bg-card/40 border-border flex flex-col gap-4 rounded-2xl border p-4">
        <PromptInput projectRef={projectRef} />

        <section className="border-border bg-background/60 flex flex-col gap-3 rounded-xl border p-4">
          {recommendations.length > 0 ? (
            <SuggestedSection projectRef={projectRef} initial={recommendations} />
          ) : (
            <>
              <h2 className="text-foreground text-[15px] font-medium tracking-[-0.01em]">
                Suggested
              </h2>
              <p className="text-muted-foreground py-10 text-center text-sm">
                Every file already has tests, or none were detected. Use the prompt above to
                describe what you want tested.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

async function loadRecommendations(projectRef: string) {
  const user = await requireUser();
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) notFound();
  return getTestRecommendations(repo);
}
