"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// 온보딩 단계 레일. 분할 화면의 오른쪽 패널에 세로로 선다.
//
// 가로 스트립(CodeRabbit 히어로 방식)에서 세로로 바꾼 이유: 왼쪽 컬럼이
// 로그인 화면과 같은 5fr:8fr 비율이라 콘텐츠 폭이 ~450px 다. 거기에 4칸짜리
// 가로 스트립을 넣으면 한 칸이 74px 로 좁아져 라벨이 잘린다. 오른쪽 패널은
// 넓으니 단계 안내를 그쪽으로 옮기고 왼쪽은 할 일에만 집중하게 했다.
//
// 번호 표기(Hack mono · Orange 10)와 색 전환 180ms 는 CodeRabbit 실측 그대로.
// 액센트 막대는 칸마다 border 를 켜고 끄는 대신 하나만 두고 위치를 옮긴다 —
// 단계가 바뀌면 막대가 미끄러져 이동한다.

const STEPS = [
  { label: "Provider", detail: "Where your code lives" },
  { label: "Repository", detail: "Which repo to start with" },
  { label: "Test runner", detail: "Vitest or Jest" },
  { label: "AI", detail: "Already connected" },
];

const TINT = "transition-colors duration-[180ms] ease-out motion-reduce:transition-none";

// 스트립 확장과 같은 곡선·길이. expo-out 계열은 앞에서 다 끝나 순간이동처럼
// 보여서 고르게 퍼지는 곡선을 쓴다(CodeRabbit 실측 곡선 대신).
const SLIDE =
  "transition-[transform,height] duration-[420ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

/** 경로에서 현재 단계를 읽는다. 레이아웃은 어느 페이지인지 모르기 때문. */
function stepFromPath(pathname: string) {
  if (pathname.endsWith("/new")) return 1;
  if (pathname.endsWith("/new/github")) return 2;
  if (pathname.includes("/setup/") && pathname.endsWith("/framework")) return 3;
  if (pathname.includes("/setup/") && pathname.endsWith("/ai")) return 4;
  return 1;
}

export function StepRail() {
  const current = stepFromPath(usePathname());

  const items = useRef<(HTMLLIElement | null)[]>([]);
  const barRef = useRef<HTMLSpanElement>(null);
  // 첫 렌더에서는 막대가 날아오면 안 된다. 자리를 잡은 뒤부터 애니메이션한다.
  const measured = useRef(false);

  // 막대 위치는 state 가 아니라 DOM 을 직접 고친다.
  //
  // setState 로 하면 애니메이션이 안 걸린다. useLayoutEffect 는 페인트 전에
  // 돌고 그 안의 setState 는 페인트 전에 다시 렌더되므로, 브라우저가 이전
  // 위치를 한 번도 그리지 않는다 — 두 값이 한 페인트로 합쳐져 전환이 생략된다.
  // 인라인 스타일로 두면 라우트가 바뀌어도 React 가 값을 되돌리지 않아서
  // 이전에 그려진 위치가 그대로 남고, 여기서 바꿀 때 전환이 걸린다.
  useLayoutEffect(() => {
    const target = items.current[current - 1];
    const bar = barRef.current;
    if (!target || !bar) return;

    // 첫 배치는 애니메이션 없이 제자리에 놓는다.
    if (!measured.current) bar.style.transition = "none";

    bar.style.transform = `translateY(${target.offsetTop}px)`;
    bar.style.height = `${target.offsetHeight}px`;
    bar.style.opacity = "1";

    if (!measured.current) {
      void bar.offsetHeight; // transition:none 을 적용시킨 뒤 되돌린다
      bar.style.transition = "";
      measured.current = true;
    }
  }, [current]);

  return (
    <div className="w-full max-w-md px-10">
      <SegmentedRule />

      <ol className="relative mt-10">
        {/* 막대 하나가 단계를 따라 움직인다. 위치를 잴 때까지는 숨긴다. */}
        <span
          ref={barRef}
          aria-hidden="true"
          className={`absolute left-0 w-0.5 bg-[#ff570a] opacity-0 ${SLIDE}`}
        />

        {STEPS.map((step, index) => {
          const number = index + 1;
          const isCurrent = current === number;
          const isDone = number < current;

          return (
            <li
              key={step.label}
              ref={(node) => {
                items.current[index] = node;
              }}
              aria-current={isCurrent ? "step" : undefined}
              className="py-4 pl-5"
            >
              <p className="flex items-baseline gap-3">
                <span
                  className={`font-mono text-xs font-bold tracking-[0.1em] ${TINT} ${
                    isCurrent
                      ? "text-[#ff801f]"
                      : isDone
                        ? "text-foreground/60"
                        : "text-muted-foreground"
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
                        : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </p>

              {/* 설명은 현재 단계에서만 읽히게 하되, 자리는 항상 잡아둔다.
                  칸 높이가 들쭉날쭉하면 막대가 미끄러지는 동안 아래 칸들이
                  같이 밀려서 어지럽다. 높이는 고정하고 글자만 페이드한다. */}
              <p
                aria-hidden={!isCurrent}
                className={`text-muted-foreground mt-1.5 pl-8 text-[13px] leading-relaxed ${TINT} ${
                  isCurrent ? "opacity-100" : "opacity-0"
                }`}
              >
                {step.detail}
              </p>
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
