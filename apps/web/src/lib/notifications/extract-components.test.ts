import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractComponents } from "./extract-components.ts";

// 소스에서 export 된 컴포넌트를 고르는 규칙. 실행: pnpm --filter @dante/web test

const names = (source: string) =>
  extractComponents("src/Sidebar.tsx", source).map(({ exportName, name }) => [exportName, name]);

describe("extractComponents", () => {
  it("함수·화살표 함수 컴포넌트를 찾는다", () => {
    const source = `
      export function Sidebar() { return <nav />; }
      export const SidebarItem = ({ label }: { label: string }) => <li>{label}</li>;
    `;
    assert.deepEqual(names(source), [
      ["Sidebar", "Sidebar"],
      ["SidebarItem", "SidebarItem"],
    ]);
  });

  it("default export 는 선언 이름을 쓰고, 이름이 없으면 null 이다", () => {
    assert.deepEqual(names(`export default function Page() { return <main />; }`), [
      ["default", "Page"],
    ]);
    assert.deepEqual(names(`export default () => <main />;`), [["default", null]]);
  });

  it("memo·forwardRef 로 감싼 컴포넌트도 찾는다", () => {
    const source = `
      import { memo } from "react";
      export const Card = memo(() => <div />);
    `;
    assert.deepEqual(names(source), [["Card", "Card"]]);
  });

  it("훅·상수·JSX 없는 export 는 뺀다", () => {
    const source = `
      export function useSidebar() { return { open: true }; }
      export const SIDEBAR_WIDTH = 240;
      export function Helper() { return 1; }
      export type SidebarProps = { open: boolean };
    `;
    assert.deepEqual(names(source), []);
  });

  it("export 하지 않은 컴포넌트는 뺀다", () => {
    assert.deepEqual(names(`function Inner() { return <div />; }`), []);
  });
});
