import { BackLink } from "@/components/projects/back-link";
import { StepHeader } from "@/components/projects/step-header";
import { Skeleton } from "@/components/ui/skeleton";

// 온보딩 2단계의 로딩 화면.
//
// page.tsx 는 설치마다 GitHub 에 레포 목록을 물어봐서 1초를 넘기기도 한다. 그동안
// 빈 화면 대신 이걸 먼저 보낸다.
//
// 되돌아가기 링크·머리말은 page.tsx 와 같은 문구로 그대로 두고(바꾸면 둘 다 바꾼다),
// 목록 자리만 뼈대로 채운다. SplitShell 이 본문을 세로 중앙에 놓기 때문에 높이가
// 크게 달라지면 머리말이 위아래로 튄다. 그래서 치수는 RepoPicker 를 따른다:
//   필터 줄 h-9 · 목록 mt-3 · 행 px-6 py-4 · 이름 15px 한 줄 + mt-1 + 메타 11px 한 줄
// 행 오른쪽에는 버튼이 없다 — 행 전체가 클릭 대상이라 뼈대도 왼쪽 두 줄만 그린다.
// 줄 높이는 h-[1lh] 로 잡는다 — 그 글자 크기의 line-height 와 정확히 같아진다.
const NAME_WIDTHS = ["w-40", "w-28", "w-48", "w-32", "w-36"];

export default function Loading() {
  return (
    <>
      <div className="mb-6">
        <BackLink href="/projects/new">Change provider</BackLink>
      </div>

      <StepHeader
        title="Which repository?"
        description="One is enough to start. You can add more projects later"
      />

      <div role="status" className="mt-8">
        <span className="sr-only">Loading repositories</span>

        <div aria-hidden="true">
          {/* 계정 선택 + 검색 입력 */}
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 shrink-0 rounded-[4px]" />
            <Skeleton className="h-9 flex-1 rounded-[4px]" />
          </div>

          <ul className="border-border divide-border bg-card mt-3 divide-y border">
            {NAME_WIDTHS.map((width) => (
              <li key={width} className="flex items-center gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex h-[1lh] items-center text-[15px]">
                    <Skeleton className={`h-3.5 rounded-[2px] ${width}`} />
                  </div>
                  <div className="mt-1 flex h-[1lh] items-center text-[11px]">
                    <Skeleton className="h-2.5 w-24 rounded-[2px]" />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* 목록 아래 "Missing a repository? / organization?" 두 줄 */}
          <div className="mt-4 space-y-1.5 text-[11px]">
            <div className="flex h-[1lh] items-center">
              <Skeleton className="h-2.5 w-56 rounded-[2px]" />
            </div>
            <div className="flex h-[1lh] items-center">
              <Skeleton className="h-2.5 w-60 rounded-[2px]" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
