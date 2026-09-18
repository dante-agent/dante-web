"use client";

import { useState } from "react";
import type { TestRunView } from "@/lib/projects/run-version";
import { cn } from "@/lib/utils";
import type { SessionDetail } from "../session-detail";
import { CodePanel } from "./code-panel";
import { TestRunPanel } from "./test-run-panel";
import { VerticalSplit } from "./vertical-split";

// 배치로 만든 테스트 파일 한 개의 뷰. 탭 하나에 대응한다.
export interface GeneratedFile {
  versionId: string;
  /** 테스트 파일 경로 — 탭 라벨/식별용. */
  path: string;
  /** 생성된 테스트 코드 전체 — Monaco 에디터에 그대로 싣는다. */
  content: string;
  code: SessionDetail["code"];
  initialRun: TestRunView | null;
}

/**
 * 우측 코드+실행 영역. 한 번에 최대 3개까지 생성되므로, 파일이 여럿이면 상단 탭으로 전환한다.
 * 탭을 바꾸면 코드(CodePanel)와 실행 터미널(TestRunPanel)이 그 파일의 버전으로 함께 바뀐다.
 * TestRunPanel 은 versionId 로 remount 해(터미널 key) 파일마다 독립된 실행 상태를 갖는다.
 */
export function GeneratedTestsPanel({
  projectRef,
  files,
  runnerConfigured,
}: {
  projectRef: string;
  files: GeneratedFile[];
  runnerConfigured: boolean;
}) {
  const [active, setActive] = useState(0);
  const file = files[active] ?? files[0];

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      {files.length > 1 && (
        <div className="border-border flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
          {files.map((f, index) => (
            <button
              key={f.versionId}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 font-mono text-xs transition-colors",
                index === active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={f.path}
            >
              {basename(f.path)}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <VerticalSplit
          top={<CodePanel code={file.code} content={file.content} />}
          bottom={
            <TestRunPanel
              // 파일(버전)마다 터미널 실행 상태를 분리한다.
              key={file.versionId}
              projectRef={projectRef}
              versionId={file.versionId}
              initialRun={file.initialRun}
              runnerConfigured={runnerConfigured}
            />
          }
        />
      </div>
    </div>
  );
}

function basename(path: string): string {
  return path.split("/").pop() || path;
}
