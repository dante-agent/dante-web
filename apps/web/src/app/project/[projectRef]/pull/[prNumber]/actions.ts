"use server";

import { redirect } from "next/navigation";
import { prisma } from "@dante/db";
import { requesterLabel, requireUser } from "@/lib/auth/user";
import {
  fetchHeadCommitMessage,
  fetchPullRequest,
  installationClient,
} from "@/lib/github/pull-request";
import { enqueuePullRequestJob } from "@/lib/notifications/pull-request-job";
import { parsePrNumber } from "@/lib/notifications/pull-request-preview";
import { accessibleProjectWhere } from "@/lib/teams/access";

/**
 * PR 코멘트의 Re-run 링크가 여는 화면의 "다시 실행" 버튼.
 *
 * 링크(GET)만으로 돌리지 않는다. 열기만 해도 AI 비용이 나가고, 링크 미리보기·크롤러가
 * 여는 것만으로 작업이 돈다. 사람이 버튼을 눌렀을 때만 여기로 온다.
 *
 * GitHub 체크의 Re-run 버튼(webhook.ts handleCheckRun)과 같은 일을 한다 — PR 의 지금 head
 * 커밋을 다시 읽어 작업을 다시 돌린다. 비용은 PR 작성자가 아니라 누른 사람 한도로 센다
 * (pr-author-rules.ts 의 Payer).
 *
 * TODO(지권): 로그인한 상태로 이 버튼을 눌러, 누른 사람 한도로 생성·실행되는지 검증한다.
 * #129 는 GitHub 체크 Re-run 웹훅으로만 검증했고 이 경로는 타입 검사까지만 했다.
 */
export async function rerunPullRequest(formData: FormData) {
  const projectRef = String(formData.get("projectRef") ?? "");
  const prNumber = parsePrNumber(String(formData.get("prNumber") ?? ""));
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { ref: projectRef, ...accessibleProjectWhere(user.id) },
    select: {
      id: true,
      ref: true,
      repoOwner: true,
      repoName: true,
      defaultBranch: true,
      installationId: true,
      teamId: true,
      testFramework: true,
      installCommand: true,
      testCommand: true,
      testTimeoutMs: true,
    },
  });
  if (!project || prNumber === null) throw new Error("Pull request not found.");

  const ref = { owner: project.repoOwner, repo: project.repoName };
  const octokit = await installationClient(project.installationId);
  const pr = await fetchPullRequest(octokit, ref, prNumber);

  await enqueuePullRequestJob(
    project,
    { ...pr, headCommitMessage: await fetchHeadCommitMessage(octokit, ref, pr.headSha) },
    { kind: "dante-requester", userId: user.id, login: requesterLabel(user) }
  );

  // ?rerun=1 을 떼고 돌아간다. 새로고침으로 같은 요청이 다시 가지 않게.
  redirect(`/project/${project.ref}/pull/${prNumber}`);
}
