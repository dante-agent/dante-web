import type { ReactNode } from "react";
import type { Coverage } from "@/lib/projects/coverage";
import { getCoverage } from "@/lib/projects/dashboard-queries";
import type { ProjectRepo } from "@/lib/projects/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "./section";

/**
 * 테스트가 없는 칸. 칠하지 않고 테두리 + 빗금으로 "비어 있음"을 그린다 — 회색으로 칠하면
 * 미실행(테스트는 있음)과 구분이 안 된다. 테스트가 있는 칸은 전부 색으로 칠한다.
 */
const EMPTY =
  "ring-1 ring-inset ring-input bg-[repeating-linear-gradient(135deg,var(--input)_0_1.5px,transparent_1.5px_5px)]";

/**
 * 막대·범례 색. 테스트 있음 = 칠함(통과 민트·실패 오렌지·미실행 회색), 없음 = 빈 칸.
 * 미실행은 좋지도 나쁘지도 않은 상태라 중립 회색으로 칠한다 — 파랑은 대시보드에서 "실행 중"의 색이라
 * 여기 쓰면 돌리지 않은 테스트가 진행 중처럼 읽힌다. 테스트 없음(빗금)과는 칠함/비움으로 갈린다.
 */
const SEGMENTS = [
  { key: "passed", label: "Passed", color: "bg-brand-mint" },
  { key: "failed", label: "Failed", color: "bg-brand-orange" },
  { key: "notRun", label: "Not run", color: "bg-muted-foreground/50" },
  { key: "untested", label: "No test file", color: EMPTY },
] as const;

/**
 * 괄호 칸이 이보다 좁으면 라벨을 지운다(괄호 선은 남긴다). 테스트가 몇 개 없는 새 프로젝트에서
 * "Has a test" 가 몇 px 칸에 잘려 옆 라벨과 겹치는 걸 막는다 — 숫자는 아래 범례가 말한다.
 */
const MIN_LABEL_SHARE = 0.15;

/**
 * 섹션 틀과 줄 구조. 불러온 화면·테스트가 없는 화면·불러오는 중(스켈레톤)이 모두 이 틀 하나를 쓴다.
 * 줄마다 높이를 고정해 두어 무엇이 들어와도 섹션 높이가 같다 — 불러온 뒤 아래 섹션이 튀지 않는다.
 *
 *   숫자 줄 h-6 · 괄호 줄 h-[23px] · 막대 h-3 · 범례(항목마다 h-5)
 *
 * 범례는 글자 길이에 따라 줄바꿈하지 않는다 — 작은 화면은 2×2, sm 이상은 한 줄로 배치를 고정한다.
 * 그래야 스켈레톤(글자 없음)과 불러온 화면의 범례 높이가 폭과 상관없이 같다.
 */
function Layout({
  headline,
  brackets,
  bar,
  legend,
  status,
}: {
  headline: ReactNode;
  brackets: ReactNode;
  bar: ReactNode;
  /** 범례 한 칸의 내용. 스켈레톤은 막대 하나를 넣는다. */
  legend: (segment: (typeof SEGMENTS)[number]) => ReactNode;
  /** 불러오는 중이면 스크린리더에 알릴 문구. */
  status?: string;
}) {
  return (
    <Section title="Test coverage">
      <div
        role={status ? "status" : undefined}
        aria-label={status}
        className="border-border bg-card flex flex-col gap-3.5 rounded-lg border px-[18px] py-4"
      >
        {/* div: 스켈레톤 막대(ui/skeleton 은 div)가 들어가므로 p 로 두면 HTML 규칙 위반(하이드레이션 에러). */}
        <div className="flex h-6 items-baseline gap-2">{headline}</div>
        <div className="flex flex-col gap-1.5">
          <div aria-hidden className="flex h-[23px] gap-0.5">
            {brackets}
          </div>
          {bar}
        </div>
        <ul className="grid grid-cols-2 gap-x-5 gap-y-2 sm:flex">
          {SEGMENTS.map((s) => (
            <li
              key={s.key}
              className="text-muted-foreground flex h-5 min-w-0 items-center gap-2 text-[12.5px]"
            >
              {legend(s)}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/** 막대 위 괄호 한 칸. 막대와 같은 비율로 폭을 나눈다. */
function Bracket({ grow, children }: { grow: number; children?: ReactNode }) {
  return (
    <span
      className="border-input text-muted-foreground truncate border-b pb-1.5 text-[11.5px]"
      style={{ flex: `${grow} 1 0%` }}
    >
      {children}
    </span>
  );
}

/**
 * 소스 파일 중 테스트가 있는 파일 수, 그 테스트들의 마지막 실행 결과.
 * GitHub 트리를 기다리므로 페이지가 Suspense 로 감싸고 CoverageSkeleton 을 먼저 보낸다.
 */
export async function CoverageSection({
  repo,
  projectId,
}: {
  repo: ProjectRepo;
  projectId: string;
}) {
  let coverage: Coverage;
  try {
    coverage = await getCoverage(repo, projectId);
  } catch (error) {
    // 조회와 호출 사이에 레포가 사라졌을 수 있다. 섹션만 빼고 페이지는 그린다.
    console.error("[dashboard] coverage", error);
    return null;
  }

  const summary = SEGMENTS.map((s) => `${coverage[s.key]} ${s.label.toLowerCase()}`).join(", ");
  const share = (count: number) => count / Math.max(coverage.sources, 1);

  return (
    <Layout
      headline={
        <>
          <span className="font-mono text-[22px] leading-none tabular-nums">{coverage.tested}</span>
          <span className="text-muted-foreground text-[13px]">
            of <span className="font-mono tabular-nums">{coverage.sources}</span> source files have
            a test
          </span>
        </>
      }
      brackets={
        coverage.tested === 0 ? (
          // 테스트가 하나도 없으면 괄호 한 칸이 전부 "없음"이다. 그 자리에 시작할 곳을 적는다.
          <Bracket grow={1}>No test file yet — pick a file from Up next to start</Bracket>
        ) : (
          <>
            <Bracket grow={coverage.tested}>
              {share(coverage.tested) >= MIN_LABEL_SHARE ? "Has a test" : null}
            </Bracket>
            {coverage.untested > 0 && (
              <Bracket grow={coverage.untested}>
                {share(coverage.untested) >= MIN_LABEL_SHARE ? "No test file" : null}
              </Bracket>
            )}
          </>
        )
      }
      bar={
        <div
          role="img"
          aria-label={`${coverage.sources} source files: ${summary}.`}
          className="flex h-3 gap-0.5 overflow-hidden rounded-[3px]"
        >
          {coverage.tested === 0 ? (
            <span className={`${EMPTY} flex-1 rounded-[2px]`} />
          ) : (
            SEGMENTS.filter((s) => coverage[s.key] > 0).map((s) => (
              <span
                key={s.key}
                className={`${s.color} rounded-[2px]`}
                style={{ flex: `${coverage[s.key]} 1 0%` }}
              />
            ))
          )}
        </div>
      }
      legend={(s) => (
        <>
          <span aria-hidden className={`${s.color} size-2.5 shrink-0 rounded-[2px]`} />
          <span className="text-foreground font-mono text-[13px] tabular-nums">
            {coverage[s.key]}
          </span>
          <span className="truncate">{s.label}</span>
        </>
      )}
    />
  );
}

/**
 * 불러오는 동안의 뼈대. 실제와 같은 Layout 이라 줄 높이가 구조적으로 같다.
 * 글자 자리는 components/ui/skeleton 막대로 그린다. 막대 길이는 실제 문구보다 조금 짧게 둔다 —
 * 길게 두면 불러온 뒤 오른쪽 끝이 줄어드는 것처럼 보인다.
 */
const LEGEND_WIDTH = ["w-16", "w-14", "w-16", "w-24"];

export function CoverageSkeleton() {
  return (
    <Layout
      status="Loading test coverage"
      headline={<Skeleton className="h-[18px] w-52 self-center" />}
      brackets={<Bracket grow={1} />}
      bar={<Skeleton className="h-3 rounded-[3px]" />}
      legend={(s) => <Skeleton className={`h-3.5 ${LEGEND_WIDTH[SEGMENTS.indexOf(s)]}`} />}
    />
  );
}
