// 폴더 보기 목업 — 레포 트리·파일 내용 연동(PR B) 전까지 화면 확인용.

import type { FileEntry, FileStatus } from "@/lib/file-tree";

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
