// 키보드 사용자가 헤더·레일을 매번 Tab 으로 지나가지 않게 하는 "본문으로 건너뛰기" 링크.
// 루트 레이아웃이 body 맨 앞에 한 번 둔다. 평소에는 sr-only 이고, 포커스를 받으면 왼쪽 위에 뜬다.
// 도착점은 각 화면의 <main id={MAIN_CONTENT_ID}> 다.

export const MAIN_CONTENT_ID = "main-content";

export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="bg-background text-foreground border-border sr-only rounded-md border px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to content
    </a>
  );
}
