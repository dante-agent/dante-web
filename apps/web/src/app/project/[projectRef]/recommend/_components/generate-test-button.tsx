import { ArrowRight } from "lucide-react";
import Link from "next/link";

// 추천 카드의 클릭 영역. 누르면 바로 생성 화면(/recommend/generate)으로 넘어가, 파일을 AI 로 보내고
// 코드가 써지는 과정을 보여준 뒤 세션 상세(채팅 + Monaco + 실행)로 이어진다. 생성 요청과 오류
// 표시는 생성 화면이 맡는다.
export function generateHref(projectRef: string, filePaths: string[]): string {
  const query = new URLSearchParams(filePaths.map((file) => ["file", file]));
  return `/project/${projectRef}/recommend/generate?${query}`;
}

/** 카드 전체가 "테스트 생성" 링크다. children 이 카드 본문. */
export function GenerateTestButton({
  projectRef,
  filePath,
  componentName,
  children,
}: {
  projectRef: string;
  filePath: string;
  componentName: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={generateHref(projectRef, [filePath])}
      // 생성 화면은 여는 즉시 과금되는 요청을 보내지 않지만(클라이언트에서 시작), 목록의 모든 카드를
      // 미리 받을 이유도 없다.
      prefetch={false}
      aria-label={`Generate tests for ${componentName}`}
      className="group hover:bg-muted/50 flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors"
    >
      {children}
      <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 self-center transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}
