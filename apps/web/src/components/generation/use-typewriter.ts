"use client";

import { useCallback, useEffect, useState } from "react";
import { prefersReducedMotion, typeDuration } from "./use-generation-performance";

/**
 * 이미 받은 코드를 한 글자씩 보여주는 연출만 필요할 때(채팅이 테스트를 고친 직후 등).
 * play(text) 로 시작하고, 도는 동안 shown 에 지금까지 쓴 부분이, 끝나면 null 이 들어온다.
 */
export function useTypewriter() {
  const [text, setText] = useState<string | null>(null);
  const [chars, setChars] = useState(0);

  const play = useCallback((next: string) => {
    setChars(0);
    setText(next);
  }, []);

  useEffect(() => {
    if (text === null) return;
    const duration = typeDuration(text.length, prefersReducedMotion());
    const begin = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - begin) / duration);
      setChars(Math.round(text.length * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setText(null);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text]);

  return { shown: text === null ? null : text.slice(0, chars), play };
}
