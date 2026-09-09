"use client";

import { useState } from "react";
import Link from "next/link";

// 온보딩 단계 스트립.
//
// coderabbit.ai 히어로 아래의 확장형 패널(01 Review / 02 Prioritize / …)을
// 실측해서 가져왔다.
//   flex-grow      1 → 4.75
//   확장 전환      0.42s cubic-bezier(0.16, 1, 0.3, 1)   ← expo-out, 느리게
//   색·테두리      0.18s ease                            ← 빠르게
//   활성 표시      아래쪽 액센트 선
//
// 마우스를 올린 칸이 펼쳐지고 나머지는 접힌다. 아무 데도 안 올렸으면 현재
// 단계가 펼쳐져 있다. 앞으로 올 단계도 미리 볼 수 있어서 "몇 개나 남았지"에
// 답이 된다.

type Step = {
  label: string;
  /** 펼쳤을 때만 따라붙는 꼬리말. CodeRabbit 도 활성 탭에서만 뒷말을 보여준다. */
  detail: string;
  /** 아직 만들지 않은 단계는 href 가 없다 — 링크가 아니라 표시만 한다. */
  href?: string;
};

// 라벨은 접혔을 때도 읽혀야 해서 한 낱말로 줄였다. 설명은 detail 이 맡는다
// (CodeRabbit 도 Review / Prioritize / Understand / Secure 로 한 낱말이다).
const STEPS: Step[] = [
  { label: "프로젝트", detail: "코드가 어디 있는지", href: "/projects/new" },
  { label: "GitHub", detail: "어떤 레포로 시작할지", href: "/projects/new/github" },
  { label: "러너", detail: "vitest 인지 jest 인지" },
  { label: "API 키", detail: "어떤 모델로 만들지" },
];

// 펼친 칸이 가져가는 비율. CodeRabbit 은 4.75 인데 그건 스트립이 1370px 일
// 때다. 우리 콘텐츠 폭은 688px 이라 4.75 를 쓰면 접힌 칸이 89px 로 좁아져
// 라벨이 잘린다. 688/(4+3) ≈ 98px 이 되도록 4 로 낮췄다.
const EXPANDED_RATIO = 4;
const TOTAL_RATIO = EXPANDED_RATIO + (STEPS.length - 1);

/**
 * 칸 너비를 flex-basis 퍼센트로 준다.
 *
 * flex-grow 로 하면 안 된다 — CodeRabbit 이 transition-property 에 flex-grow 를
 * 걸어둬서 그대로 옮겼다가, 브라우저가 flex-grow 를 아예 보간하지 않는 걸
 * 확인했다(transition 자체가 생성되지 않고 최종값으로 점프한다). 그쪽은 JS 로
 * 매 프레임 스타일을 쓰는 방식일 것이다.
 * flex-basis 는 길이라서 정상적으로 보간된다. grow/shrink 를 0 으로 묶어
 * 너비가 basis 와 같아지게 한다.
 */
function basisFor(isExpanded: boolean) {
  const ratio = isExpanded ? EXPANDED_RATIO : 1;
  return `${((100 * ratio) / TOTAL_RATIO).toFixed(4)}%`;
}

// 지속시간 420ms 는 CodeRabbit 실측값 그대로. 이징은 바꿨다.
//
// 실측 곡선 cubic-bezier(0.16,1,0.3,1) 은 expo-out 이라 42ms 에 49%,
// 84ms 에 75% 까지 가버린다. CodeRabbit 스트립은 231→975px(744px)을 움직여
// 꼬리가 보이지만, 우리는 98→393px(295px)이라 같은 곡선이 순간이동으로 보인다
// (실제로 "애니메이션이 하나도 없다"는 피드백을 받았다).
// cubic-bezier(0.2,0,0,1) 은 60ms 32% · 120ms 67% · 180ms 83% 로 고르게 퍼진다.
const EXPAND = "transition-[flex-basis] duration-[420ms] ease-[cubic-bezier(0.2,0,0,1)]";
const TINT = "transition-[color,border-color,opacity] duration-[180ms] ease-out";

export function StepStrip({ current }: { current: number }) {
  // null 이면 "아무 데도 안 올림" → 현재 단계가 펼쳐진다.
  const [focused, setFocused] = useState<number | null>(null);
  const expanded = focused ?? current;

  return (
    <ol className="flex">
      {STEPS.map((step, index) => {
        const number = index + 1;
        const isExpanded = expanded === number;
        const isCurrent = current === number;
        const isDone = number < current;

        const content = (
          <>
            <span
              className={`font-mono text-xs font-bold tracking-[0.1em] ${TINT} ${
                isCurrent
                  ? "text-[#ff801f]"
                  : isDone
                    ? "text-foreground/70"
                    : "text-muted-foreground"
              }`}
            >
              {String(number).padStart(2, "0")}
            </span>
            <span
              className={`shrink-0 text-[13px] whitespace-nowrap ${TINT} ${
                isExpanded ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
            {/* 꼬리말은 펼쳐졌을 때만 보인다. 접히면 부모의 overflow-hidden 이
                잘라내므로 폭을 따로 접지 않고 투명도만 바꾼다
                (여기서도 flex-grow 는 보간되지 않는다). */}
            <span
              aria-hidden={!isExpanded}
              className={`text-muted-foreground min-w-0 text-[13px] whitespace-nowrap ${TINT} ${
                isExpanded ? "opacity-100" : "opacity-0"
              }`}
            >
              {step.detail}
            </span>
          </>
        );

        const shared = `flex w-full items-baseline gap-2.5 overflow-hidden border-b-2 pt-1 pb-2.5 text-left ${TINT} ${
          isCurrent ? "border-[#ff570a]" : "border-border"
        }`;

        return (
          <li
            key={step.label}
            style={{ flexGrow: 0, flexShrink: 0, flexBasis: basisFor(isExpanded) }}
            className={`min-w-0 ${EXPAND} motion-reduce:transition-none`}
            onMouseEnter={() => setFocused(number)}
            onMouseLeave={() => setFocused(null)}
          >
            {step.href ? (
              <Link
                href={step.href}
                aria-current={isCurrent ? "step" : undefined}
                className={`${shared} hover:border-input focus-visible:ring-ring/40 rounded-none outline-none focus-visible:ring-2`}
                onFocus={() => setFocused(number)}
                onBlur={() => setFocused(null)}
              >
                {content}
              </Link>
            ) : (
              // 아직 없는 단계. 링크가 아니므로 커서도 바뀌지 않는다.
              <div className={shared}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
