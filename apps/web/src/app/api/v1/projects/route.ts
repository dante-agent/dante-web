import { prisma } from "@dante/db";
import { authenticateExtension, unauthorized } from "@/lib/extension/auth";
import { accessibleProjectWhere } from "@/lib/teams/access";

// 익스텐션이 워크스페이스에 맞는 프로젝트를 고르는 목록 (dante-extension 기능 3).
// 응답 모양은 dante-extension 의 src/api/types.ts `Project` 와 맞춘다.
//
// 익스텐션은 새로고침마다 이걸 부르고, 401 이 오면 토큰을 지우고 재로그인을 띄운다.
// 설정에서 연결을 해제한 것을 에디터가 알게 되는 곳이 여기다.
export async function GET(request: Request) {
  const token = await authenticateExtension(request);
  if (!token) return unauthorized();

  const projects = await prisma.project.findMany({
    where: accessibleProjectWhere(token.userId),
    select: { ref: true, name: true, repoOwner: true, repoName: true, defaultBranch: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(
    projects.map((project) => ({
      // UUID(PK)가 아니라 ref 를 준다. 익스텐션은 이 값을 workspaceState 에 저장해
      // 계속 되돌려 보내는데, ref 는 웹 URL(/project/<ref>)과 같은 식별자라
      // 에디터에서 "웹에서 보기" 링크를 서버에 다시 묻지 않고 조립할 수 있다.
      id: project.ref,
      name: project.name,
      // 익스텐션은 이 값을 git remote 파서(normalizeRepo)에 그대로 넣는다. 그 파서는
      // ssh·https URL 만 알아보므로 `owner/name` 으로 주면 매칭이 조용히 실패한다.
      githubRepo: `https://github.com/${project.repoOwner}/${project.repoName}`,
      defaultBranch: project.defaultBranch,
    }))
  );
}
