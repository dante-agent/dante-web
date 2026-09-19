"use client";

// 드래그로 크기를 바꾸는 구분선(role="separator")을 키보드로도 움직이게 하는 공용 훅.
// 폴더 보기 좌우 구분선·하단 터미널·AI 채팅 폭·추천 세션의 좌우/상하 구분선이 같이 쓴다.
//
// 드래그(pointer capture)는 각 자리에 그대로 두고, 여기서는 포커스·방향키·aria-value* 만 더한다.
// 반환값을 구분선 요소에 펼쳐 넣는다: <div {...handle} onPointerDown={...} />

import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";

export function useResizeHandle({
  label,
  orientation,
  value,
  min,
  max,
  step,
  onChange,
  grow = "forward",
}: {
  label: string;
  /** 선의 방향. "vertical" = 세로선(좌우로 움직임), "horizontal" = 가로선(위아래로 움직임). */
  orientation: "vertical" | "horizontal";
  value: number;
  min: number;
  max: number;
  /** 방향키 한 번에 움직이는 양(value 와 같은 단위). */
  step: number;
  onChange: (next: number) => void;
  /**
   * 선을 오른쪽·아래로 옮길 때 값이 커지면 "forward", 작아지면 "backward".
   * 오른쪽에 붙은 채팅 폭이나 아래에 붙은 터미널 높이는 선을 왼쪽·위로 옮겨야 커진다.
   */
  grow?: "forward" | "backward";
}) {
  // 아직 재지 못해 max 가 min 보다 작으면(첫 렌더) 범위를 min 한 점으로 둔다.
  const upper = Math.max(min, max);
  const clamp = (n: number) => Math.min(upper, Math.max(min, n));

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const forwardKey = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
    const backwardKey = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
    const sign = grow === "forward" ? 1 : -1;
    let next: number;
    if (e.key === forwardKey) next = value + step * sign;
    else if (e.key === backwardKey) next = value - step * sign;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = upper;
    else return;
    e.preventDefault();
    onChange(clamp(next));
  };

  return {
    role: "separator",
    tabIndex: 0,
    "aria-label": label,
    "aria-orientation": orientation,
    "aria-valuenow": Math.round(clamp(value)),
    "aria-valuemin": Math.round(min),
    "aria-valuemax": Math.round(upper),
    onKeyDown,
  } as const;
}

/** 요소의 현재 크기(px). 구분선의 aria-valuemax 처럼 컨테이너 크기에 따라 정해지는 값에 쓴다. */
export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
