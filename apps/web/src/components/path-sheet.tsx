"use client";

// md 아래에서 브레드크럼을 대신하는 버튼 + 바텀시트 (Supabase 모바일 헤더와 같은 형태).
// 경로 세 단계(팀 / 조직 / 레포)가 좁은 화면에서는 한 버튼으로 접히고,
// 누르면 시트가 올라와 탭으로 단계를 고른다. 목록은 데스크톱 팝오버와 같은 SwitcherList 다.

import { useEffect, useState, type ReactNode } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { Tabs } from "@base-ui/react/tabs";
import { ChevronsUpDown } from "lucide-react";
import { SwitcherList, type Item } from "@/components/header-switcher";
import { cn } from "@/lib/utils";

export type PathLevel = {
  kind: "Team" | "Organization" | "Repository";
  icon: ReactNode;
  value: string;
  items: Item[];
  findLabel: string;
  onSelect: (v: string) => void;
  footer?: ReactNode;
};

const labelOf = (level: PathLevel) =>
  level.items.find((i) => i.value === level.value)?.label ?? level.value;

export function PathSheet({ levels, className }: { levels: PathLevel[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const current = levels[levels.length - 1];
  const parent = levels[levels.length - 2];

  // 창을 다시 넓히면 트리거 자체가 사라진다(md:hidden) — 시트만 남아 떠 있지 않게 닫는다.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia("(min-width: 48rem)");
    const close = () => wide.matches && setOpen(false);
    close();
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, [open]);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="down">
      <Drawer.Trigger
        aria-label={`경로 바꾸기: ${levels.map(labelOf).join(" / ")}`}
        className={cn(
          "hover:bg-muted focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left outline-none focus-visible:ring-2",
          className
        )}
      >
        <span className="flex min-w-0 flex-col leading-tight">
          {parent && (
            <span className="text-muted-foreground truncate text-[10px]">{labelOf(parent)}</span>
          )}
          <span className="truncate text-xs font-medium">{current && labelOf(current)}</span>
        </span>
        <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end">
          <Drawer.Popup
            className={cn(
              // 높이 고정. max-h 로 두면 탭마다 항목 수가 달라 시트가 들썩인다.
              "border-border bg-popover flex h-[70dvh] w-full flex-col overflow-hidden rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] outline-none",
              // 스와이프로 내려 닫는다. 열고 닫을 때는 아래에서 올라온다.
              "[transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-300 ease-out",
              "data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]"
            )}
          >
            <Drawer.Content className="flex min-h-0 flex-1 flex-col">
              <Drawer.Title className="sr-only">경로 바꾸기</Drawer.Title>
              <div className="bg-border mx-auto mt-2 mb-1 h-1 w-9 rounded-full" />

              <Tabs.Root defaultValue={current?.kind} className="flex min-h-0 flex-1 flex-col">
                <Tabs.List className="border-border relative flex shrink-0 border-b">
                  {levels.map((level) => (
                    <Tabs.Tab
                      key={level.kind}
                      value={level.kind}
                      className="text-muted-foreground data-selected:text-foreground flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-3 text-xs outline-none"
                    >
                      {level.icon}
                      <span className="max-w-full truncate">{labelOf(level)}</span>
                    </Tabs.Tab>
                  ))}
                  <Tabs.Indicator className="bg-foreground absolute bottom-0 left-0 h-px w-(--active-tab-width) translate-x-(--active-tab-left) transition-[translate,width] duration-200" />
                </Tabs.List>

                {levels.map((level) => (
                  <Tabs.Panel
                    key={level.kind}
                    value={level.kind}
                    className="flex min-h-0 flex-1 flex-col outline-none"
                  >
                    <SwitcherList
                      items={level.items}
                      value={level.value}
                      findLabel={level.findLabel}
                      // 고르면 화면이 바뀌니 시트도 같이 닫는다.
                      onSelect={(v) => {
                        setOpen(false);
                        level.onSelect(v);
                      }}
                      footer={level.footer}
                      listClassName="max-h-none min-h-0 flex-1"
                    />
                  </Tabs.Panel>
                ))}
              </Tabs.Root>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
