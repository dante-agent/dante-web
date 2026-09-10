// 목업 데이터 — 화면 레이아웃 확인용. DB·Octokit 연동 PR에서 이 파일은 통째로 삭제한다.
//
// 지금은 GitHub App 설치도, Project 테이블도 없다. 그래서 화면이 어떤 상태를
// 그려야 하는지(프로젝트 0개 / 미연결 / 레포 목록)를 여기서 고정값으로 준다.

import type { FileEntry, FileStatus } from "@/lib/file-tree";

export type MockProject = {
  /** URL 에 쓰는 불투명 식별자. 레포 이름을 쓰지 않는 이유는 rename·이관 때문. */
  ref: string;
  name: string;
  repoFullName: string;
  defaultBranch: string;
  /** 테스트 파일 개수 */
  testCount: number;
  /** 마지막 실행 통과율(0~1). null 이면 아직 한 번도 안 돌린 프로젝트. */
  passRate: number | null;
};

export type MockRepo = {
  /** GitHub 숫자 ID. rename·이관돼도 이걸로 추적한다. */
  id: number;
  owner: string;
  name: string;
  private: boolean;
  language: string | null;
  /** 마지막 푸시 시각 (ISO) */
  pushedAt: string;
  /** 이미 Dante 프로젝트로 등록된 레포인지 */
  importedAs: string | null;
};

export const mockProjects: MockProject[] = [
  {
    ref: "kqv8m2xrp4td",
    name: "web-app",
    repoFullName: "acme/web-app",
    defaultBranch: "main",
    testCount: 128,
    passRate: 0.96,
  },
  {
    ref: "b7fz3nwqj1ls",
    name: "design-system",
    repoFullName: "acme/design-system",
    defaultBranch: "main",
    testCount: 41,
    passRate: 0.78,
  },
  {
    ref: "h4td9cvmk6ea",
    name: "checkout-flow",
    repoFullName: "seojigwon/checkout-flow",
    defaultBranch: "develop",
    testCount: 0,
    passRate: null,
  },
];

export const mockRepos: MockRepo[] = [
  {
    id: 812_004_113,
    owner: "acme",
    name: "web-app",
    private: true,
    language: "TypeScript",
    pushedAt: "2026-09-06T09:12:00Z",
    importedAs: "kqv8m2xrp4td",
  },
  {
    id: 812_004_298,
    owner: "acme",
    name: "api-server",
    private: true,
    language: "Go",
    pushedAt: "2026-09-01T14:30:00Z",
    importedAs: null,
  },
  {
    id: 799_331_007,
    owner: "acme",
    name: "design-system",
    private: false,
    language: "TypeScript",
    pushedAt: "2026-08-19T02:45:00Z",
    importedAs: "b7fz3nwqj1ls",
  },
  {
    id: 765_120_884,
    owner: "acme",
    name: "infra-terraform",
    private: true,
    language: "HCL",
    pushedAt: "2026-07-28T22:10:00Z",
    importedAs: null,
  },
  {
    id: 690_442_015,
    owner: "seojigwon",
    name: "checkout-flow",
    private: false,
    language: "TypeScript",
    pushedAt: "2026-09-07T11:05:00Z",
    importedAs: "h4td9cvmk6ea",
  },
  {
    id: 690_441_772,
    owner: "seojigwon",
    name: "dotfiles",
    private: false,
    language: null,
    pushedAt: "2026-05-02T08:00:00Z",
    importedAs: null,
  },
];

/** 연동된 GitHub 계정 — 개인 계정 + 소속·생성 팀. 최상단 헤더 owner 스위처용. */
export type MockOwner = {
  id: string;
  name: string;
  type: "personal" | "team";
  plan: "free" | "pro";
};
export const mockOwners: MockOwner[] = [
  { id: "seojigwon", name: "seojigwon", type: "personal", plan: "free" },
  { id: "acme", name: "acme", type: "team", plan: "pro" },
];

/** repoFullName("acme/web-app")의 owner 로 프로젝트를 거른다. */
export function projectsByOwner(owner: string): MockProject[] {
  return mockProjects.filter((p) => p.repoFullName.startsWith(`${owner}/`));
}

// 폴더 보기 서브 사이드바용. 연결된 레포의 소스 파일 목록 = GitHub `git/trees?recursive=1`
// 응답에서 확장자 필터를 통과한 blob 들. status 는 나중에 테스트 존재/신선도로 계산할 값.
// `*.test.*` 는 항목에 없다 — 소스의 status 로만 표현.
export const mockFileTree: FileEntry[] = [
  { path: "src/app/layout.tsx", status: "none" },
  { path: "src/app/page.tsx", status: "none" },
  { path: "src/app/dashboard/page.tsx", status: "has" },
  { path: "src/app/dashboard/loading.tsx", status: "none" },
  { path: "src/components/Button.tsx", status: "has" },
  { path: "src/components/Card.tsx", status: "none" },
  { path: "src/components/Modal.tsx", status: "none" },
  { path: "src/components/icons/Logo.tsx", status: "none" },
  { path: "src/hooks/useAuth.ts", status: "has" },
  { path: "src/hooks/useDebounce.ts", status: "has" },
  { path: "src/hooks/useLocalStorage.ts", status: "none" },
  { path: "src/lib/api.ts", status: "has" },
  { path: "src/lib/format.ts", status: "has" },
  { path: "src/lib/validate.ts", status: "has" },
  { path: "src/lib/utils.ts", status: "none" },
  { path: "src/features/checkout/steps/Payment.tsx", status: "none" },
  { path: "src/features/checkout/steps/Review.tsx", status: "has" },
  { path: "src/store/cart.ts", status: "has" },
  { path: "src/store/user.ts", status: "none" },
  { path: "src/worker.js", status: "none" },
  { path: "src/legacy/jquery-shim.jsx", status: "none" },
];

// 폴더 본문용 목업 파일 내용. 일부 path 만 채우고 나머지는 getFileContent 가 생성.
// test: null → "테스트 없음" 빈 상태. testDraft → edit 모드 우측 갱신안(test 와 달라야 diff 가 보임).
export type MockFileContent = {
  source: string;
  test: string | null;
  testDraft: string | null;
};

const filledFileContents: Record<string, MockFileContent> = {
  "src/lib/format.ts": {
    source: `// src/lib/format.ts
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "\\u2026" : text;
}
`,
    test: `import { describe, expect, it } from "vitest";
import { formatCurrency, truncate } from "./format";

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });
});

describe("truncate", () => {
  it("leaves short strings untouched", () => {
    expect(truncate("hi", 10)).toBe("hi");
  });
});
`,
    testDraft: `import { describe, expect, it } from "vitest";
import { formatCurrency, truncate } from "./format";

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("respects an explicit currency", () => {
    expect(formatCurrency(1000, "EUR")).toBe("\\u20ac1,000.00");
  });
});

describe("truncate", () => {
  it("leaves short strings untouched", () => {
    expect(truncate("hi", 10)).toBe("hi");
  });

  it("adds an ellipsis when over the limit", () => {
    expect(truncate("hello world", 5)).toBe("hell\\u2026");
  });
});
`,
  },
  "src/components/Button.tsx": {
    source: `// src/components/Button.tsx
import { type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const base = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
  const styles =
    variant === "primary"
      ? "bg-brand-mint text-black hover:opacity-90"
      : "text-muted-foreground hover:text-foreground";
  return <button className={\`\${base} \${styles} \${className}\`} {...props} />;
}
`,
    test: `import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });
});
`,
    testDraft: `import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>저장</Button>);
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies the ghost variant", () => {
    render(<Button variant="ghost">취소</Button>);
    expect(screen.getByRole("button", { name: "취소" }).className).toContain("text-muted-foreground");
  });
});
`,
  },
};

/** path 로 목업 파일 내용을 얻는다. 채워둔 게 없으면 status 에 맞춰 생성한다. */
export function getFileContent(path: string, status: FileStatus): MockFileContent {
  const filled = filledFileContents[path];
  if (filled) return filled;

  const source = `// ${path}
// 목업 소스 — 실제 파일 내용은 GitHub 연동 후 표시됩니다.

export {};
`;
  const test =
    status === "has"
      ? `// ${path} 의 테스트 (목업)
import { describe, expect, it } from "vitest";

describe(${JSON.stringify(path)}, () => {
  it("TODO: 케이스 작성", () => {
    expect(true).toBe(true);
  });
});
`
      : null;

  return { source, test, testDraft: test && `// ✎ 수정 제안 (목업)\n${test}` };
}
