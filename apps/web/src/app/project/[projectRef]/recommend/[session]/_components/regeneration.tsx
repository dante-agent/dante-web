"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useGenerationPerformance } from "@/components/generation/use-generation-performance";

// 세션 상세에서 채팅으로 테스트를 고칠 때의 연출 상태. 요청은 좌측 채팅(FollowUp)이 보내고,
// 코드가 써지는 모습은 우측 코드 패널(GeneratedTestsPanel)이 그린다 — 서로 다른 칸이라 context 로 나눠 쓴다.
export type RegeneratedFile = { versionId: string; testPath: string; code: string };

type Regeneration = ReturnType<typeof useGenerationPerformance<RegeneratedFile>>;

const RegenerationContext = createContext<Regeneration | null>(null);

/** 타이핑이 끝나고 새 버전으로 넘어가기 전 잠깐 멈춤 — 완성된 코드를 한 번 보여준다. */
const OPEN_DELAY_MS = 600;

export function RegenerationProvider({
  projectRef,
  children,
}: {
  projectRef: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const finish = useCallback(
    async (files: RegeneratedFile[]) => {
      await new Promise((resolve) => setTimeout(resolve, OPEN_DELAY_MS));
      // 고친 새 버전(대화 이어받음)으로 이동한다. 실행은 사용자가 Run 을 눌러 한다.
      router.push(`/project/${projectRef}/recommend/${files[0].versionId}`);
      // 좌측 사이드바는 레이아웃이라 이동만으로는 다시 그리지 않는다. 새 세션이 목록에 뜨게 새로고침한다.
      router.refresh();
    },
    [projectRef, router]
  );
  const regeneration = useGenerationPerformance<RegeneratedFile>({ finish });
  return (
    <RegenerationContext.Provider value={regeneration}>{children}</RegenerationContext.Provider>
  );
}

export function useRegeneration(): Regeneration {
  const value = useContext(RegenerationContext);
  if (!value) throw new Error("useRegeneration 은 RegenerationProvider 안에서만 쓴다.");
  return value;
}

/** 연출이 도는 중인지(시작했고 실패하지 않음). */
export const isRegenerating = ({ stage }: Pick<Regeneration, "stage">) =>
  stage !== null && stage !== "error";
