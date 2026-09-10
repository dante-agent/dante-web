// 코멘트·체크에서 단테로 돌아오는 링크.
//
// 절대 URL 이 필요한데 웹훅 처리에는 요청 origin 이 없다(러너 콜백도 마찬가지).
// 그래서 환경변수로 받는다. 없으면 링크를 아예 그리지 않는다 — localhost 주소가
// 남의 PR 에 박히는 것보다 링크가 없는 편이 낫다.
//
//   NEXT_PUBLIC_APP_URL=https://app.dante.dev
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? null;

export function danteLinks(projectRef: string, prNumber: number) {
  const base = appUrl();
  if (!base) return { detailUrl: null, rerunUrl: null };

  const detailUrl = `${base}/project/${projectRef}/pull/${prNumber}`;
  return { detailUrl, rerunUrl: `${detailUrl}?rerun=1` };
}
