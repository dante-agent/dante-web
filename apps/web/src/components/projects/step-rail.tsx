"use client";

import { usePathname } from "next/navigation";

// 온보딩 단계 레일. 분할 화면의 오른쪽 패널에 세로로 선다.
//
// 가로 스트립(CodeRabbit 히어로 방식)에서 세로로 바꾼 이유: 왼쪽 컬럼이
// 로그인 화면과 같은 5fr:8fr 비율이라 콘텐츠 폭이 ~450px 다. 거기에 4칸짜리
// 가로 스트립을 넣으면 한 칸이 74px 로 좁아져 라벨이 잘린다. 오른쪽 패널은
// 넓으니 단계 안내를 그쪽으로 옮기고 왼쪽은 할 일에만 집중하게 했다.
//
// 번호 표기(Hack mono · Orange 10)와 색 전환 180ms 는 CodeRabbit 실측 그대로.

const STEPS = [
  { label: "Provider", detail: "Where your code lives" },
  { label: "Repository", detail: "Which repo to start with" },
  { label: "Test runner", detail: "Vitest or Jest" },
  { label: "API key", detail: "Which model writes the tests" },
];

const TINT = "transition-colors duration-[180ms] ease-out motion-reduce:transition-none";

/** 경로에서 현재 단계를 읽는다. 레이아웃은 어느 페이지인지 모르기 때문. */
function stepFromPath(pathname: string) {
  if (pathname.endsWith("/new")) return 1;
  if (pathname.endsWith("/new/github")) return 2;
  if (pathname.includes("/setup/") && pathname.endsWith("/framework")) return 3;
  if (pathname.includes("/setup/") && pathname.endsWith("/api-key")) return 4;
  return 1;
}

export function StepRail() {
  const current = stepFromPath(usePathname());

  return (
    <div className="w-full max-w-md px-10">
      <SegmentedRule />

      <ol className="mt-10">
        {STEPS.map((step, index) => {
          const number = index + 1;
          const isCurrent = current === number;
          const isDone = number < current;

          return (
            <li
              key={step.label}
              aria-current={isCurrent ? "step" : undefined}
              // 현재 단계만 왼쪽에 액센트 선이 선다. 나머지는 자리만 비워
              // 텍스트가 좌우로 흔들리지 않게 한다.
              className={`border-l-2 py-4 pl-5 ${TINT} ${
                isCurrent ? "border-[#ff570a]" : "border-transparent"
              }`}
            >
              <p className="flex items-baseline gap-3">
                <span
                  className={`font-mono text-xs font-bold tracking-[0.1em] ${TINT} ${
                    isCurrent
                      ? "text-[#ff801f]"
                      : isDone
                        ? "text-foreground/60"
                        : "text-muted-foreground/60"
                  }`}
                >
                  {String(number).padStart(2, "0")}
                </span>
                <span
                  className={`text-[15px] ${TINT} ${
                    isCurrent
                      ? "text-foreground font-medium"
                      : isDone
                        ? "text-foreground/60"
                        : "text-muted-foreground/60"
                  }`}
                >
                  {step.label}
                </span>
              </p>
              {/* 설명은 현재 단계에서만. 나머지까지 읽히면 무엇을 해야 할지 흐려진다. */}
              {isCurrent && (
                <p className="text-muted-foreground mt-1.5 pl-8 text-[13px] leading-relaxed">
                  {step.detail}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// CodeRabbit 히어로 상단의 얇은 세그먼트 바. 4px 두께로 팔레트 램프 색을
// 끊어 배치한다 — 실측한 색이 우리 DESIGN.md 값과 같았다(Mauve 5, Cobalt 3 …).
const SEGMENTS = [
  { grow: "flex-[3]", tone: "bg-[#322f37]" }, // Mauve 5
  { grow: "flex-[1]", tone: "bg-[#46e1a5]" }, // Mint 9
  { grow: "flex-[6]", tone: "bg-[#322f37]" },
  { grow: "flex-[2]", tone: "bg-[#687ff5]" }, // Cobalt 9
  { grow: "flex-[4]", tone: "bg-[#322f37]" },
  { grow: "flex-[2]", tone: "bg-[#ff570a]" }, // Orange 9
  { grow: "flex-[5]", tone: "bg-[#4a464f]" }, // Mauve 7
];

function SegmentedRule() {
  return (
    <div aria-hidden="true" className="flex h-1 gap-0.5">
      {SEGMENTS.map((segment, index) => (
        <div key={index} className={`${segment.grow} ${segment.tone}`} />
      ))}
    </div>
  );
}
