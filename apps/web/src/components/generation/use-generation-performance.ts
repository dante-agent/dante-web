"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 테스트 생성 연출(추천 생성 화면·폴더 보기 공용). 생성은 한 번의 서버 액션이라 진행 상황이 오지 않는다.
// 그래서 단계는 연출이다: 읽기 → 전송(최소 시간을 채움) → 작성(AI 응답을 기다린 뒤 받은 코드를 한 글자씩
// 보여줌) → 마무리(finish 가 끝날 때까지).
export type Stage = "read" | "send" | "write" | "open" | "error";

const READ_MS = 700;
const SEND_MS = 1500;
/** 코드 한 파일을 타이핑하는 시간. 길이에 비례하되 이 범위로 자른다. */
const TYPE_MIN_MS = 1200;
const TYPE_MAX_MS = 3000;

export type GenerationOutcome<T extends { code: string }> =
  { ok: true; files: T[] } | { ok: false; message: string };

/** 코드 길이에 맞춘 타이핑 시간(ms). 모션 줄이기 설정이면 0. */
export function typeDuration(length: number, reduced: boolean): number {
  return reduced ? 0 : Math.min(TYPE_MAX_MS, Math.max(TYPE_MIN_MS, length * 3));
}

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const FAILED_MESSAGE = "Couldn't run test generation. Please try again in a moment.";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * start(generate) 로 생성과 연출을 함께 시작한다. 코드를 받으면 files 가 채워지고 파일마다 차례로
 * 타이핑(typing)한 뒤, stage 를 "open" 으로 두고 finish 를 부른다(이동·새로고침 등).
 * generate 를 start 에 넘기는 건 채팅처럼 부를 때마다 요청 내용이 바뀌는 곳이 있어서다.
 */
export function useGenerationPerformance<T extends { code: string }>({
  finish,
}: {
  finish: (files: T[]) => Promise<void> | void;
}) {
  const [stage, setStage] = useState<Stage | null>(null);
  const [files, setFiles] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 타이핑 진행: 몇 번째 파일을, 몇 글자까지 보여줬는지.
  const [typing, setTyping] = useState({ index: 0, chars: 0 });
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  const start = useCallback((generate: () => Promise<GenerationOutcome<T>>) => {
    setStage("read");
    setFiles(null);
    setError(null);
    setTyping({ index: 0, chars: 0 });

    const reduced = prefersReducedMotion();
    const stages = (async () => {
      await wait(reduced ? 0 : READ_MS);
      setStage((s) => (s === "read" ? "send" : s));
      await wait(reduced ? 0 : SEND_MS);
      setStage((s) => (s === "send" ? "write" : s));
    })();

    void (async () => {
      let outcome: GenerationOutcome<T>;
      try {
        outcome = await generate();
      } catch {
        // redirect()/notFound() 같은 프레임워크 신호는 호출부(generate)가 먼저 되던진다.
        setError(FAILED_MESSAGE);
        setStage("error");
        return;
      }
      if (!outcome.ok) {
        setError(outcome.message);
        setStage("error");
        return;
      }
      await stages;
      setFiles(outcome.files);
    })();
  }, []);

  // 코드를 받으면 파일마다 차례로 타이핑하고, 다 쓰면 finish 를 부른다.
  useEffect(() => {
    if (!files) return;
    const reduced = prefersReducedMotion();
    let frame = 0;
    let cancelled = false;

    const typeFile = (index: number) =>
      new Promise<void>((resolve) => {
        const length = files[index].code.length;
        const duration = typeDuration(length, reduced);
        const begin = performance.now();
        const tick = (now: number) => {
          if (cancelled) return;
          const progress = duration === 0 ? 1 : Math.min(1, (now - begin) / duration);
          setTyping({ index, chars: Math.round(length * progress) });
          if (progress < 1) frame = requestAnimationFrame(tick);
          else resolve();
        };
        frame = requestAnimationFrame(tick);
      });

    void (async () => {
      for (let i = 0; i < files.length; i += 1) await typeFile(i);
      if (cancelled) return;
      setStage("open");
      await finishRef.current(files);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [files]);

  return { stage, files, typing, error, start };
}
