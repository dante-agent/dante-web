import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/user";
import { getRepoTree } from "@/lib/github/tree";
import { getProjectRepo } from "@/lib/projects/queries";

// 헤더 파일 검색이 쓰는 소스 경로 목록. 검색창을 처음 열 때만 부른다 — 프로젝트 페이지마다
// GitHub 트리를 치지 않으려고 레이아웃에서 넘기는 대신 여기로 뺐다.

/** 개인 데이터(연결한 레포의 파일 목록)라 브라우저·CDN 어디에도 남기지 않는다. */
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectRef: string }> }
) {
  const { projectRef } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  // 이 사용자의 프로젝트가 아니면 null — 남의 레포 파일 목록이 새지 않는다.
  const repo = await getProjectRepo(projectRef, user.id);
  if (!repo) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const entries = await getRepoTree(repo);
  return NextResponse.json({ files: entries.map((e) => e.path) }, { headers: NO_STORE });
}
