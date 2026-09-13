import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changedComponentFiles, fileComponentName, isComponentPath } from "./changed-components.ts";

// 경로만으로 컴포넌트 후보 파일을 고르는 규칙. 실행: pnpm --filter @dante/web test

describe("isComponentPath", () => {
  it("tsx·jsx 만 컴포넌트로 본다", () => {
    assert.equal(isComponentPath("src/components/Sidebar.tsx"), true);
    assert.equal(isComponentPath("src/components/Button.jsx"), true);
    assert.equal(isComponentPath("src/hooks/useSidebar.ts"), false);
    assert.equal(isComponentPath("README.md"), false);
  });

  it("테스트·스토리·빌드 산출물은 뺀다", () => {
    assert.equal(isComponentPath("src/Sidebar.test.tsx"), false);
    assert.equal(isComponentPath("src/Sidebar.stories.tsx"), false);
    assert.equal(isComponentPath("src/__tests__/Sidebar.tsx"), false);
    assert.equal(isComponentPath("node_modules/lib/Button.tsx"), false);
  });
});

describe("changedComponentFiles", () => {
  it("README 만 고친 PR 은 빈 목록이다", () => {
    assert.deepEqual(changedComponentFiles([{ filename: "README.md", status: "modified" }]), []);
  });

  it("파일 상태를 added·changed·removed 로 접는다", () => {
    const result = changedComponentFiles([
      { filename: "src/Sidebar.tsx", status: "modified" },
      { filename: "src/Header.tsx", status: "added" },
      { filename: "src/Footer.tsx", status: "removed" },
      { filename: "src/Nav.tsx", status: "renamed" },
    ]);

    assert.deepEqual(
      result.map(({ filePath, change }) => [filePath, change]),
      [
        ["src/Sidebar.tsx", "changed"],
        ["src/Header.tsx", "added"],
        ["src/Footer.tsx", "removed"],
        ["src/Nav.tsx", "changed"],
      ]
    );
  });

  it("같은 경로가 두 번 와도 하나로 센다", () => {
    const result = changedComponentFiles([
      { filename: "src/Sidebar.tsx", status: "modified" },
      { filename: "src/Sidebar.tsx", status: "modified" },
    ]);
    assert.equal(result.length, 1);
  });
});

describe("fileComponentName", () => {
  it("확장자를 떼고, index 파일은 폴더 이름을 쓴다", () => {
    assert.equal(fileComponentName("src/Sidebar.tsx"), "Sidebar");
    assert.equal(fileComponentName("src/components/Sidebar/index.tsx"), "Sidebar");
  });
});
