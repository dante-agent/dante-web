"use client";

import { useRef, useState, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";

type Item = { value: string; label: string };

export function SwitcherRow({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
    >
      {children}
    </button>
  );
}

export function HeaderSwitcher({
  icon,
  value,
  items,
  findLabel,
  onSelect,
  footer,
}: {
  icon: ReactNode;
  value: string;
  items: Item[];
  findLabel: string;
  onSelect: (v: string) => void;
  footer?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const anchorRef = useRef<HTMLSpanElement>(null);
  const current = items.find((i) => i.value === value);
  const needle = q.trim().toLowerCase();
  const filtered = needle ? items.filter((i) => i.label.toLowerCase().includes(needle)) : items;

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (!open) setQ("");
      }}
    >
      <Popover.Trigger className="hover:bg-muted flex items-center gap-2.5 rounded-md px-2 py-1 text-sm leading-none outline-none">
        {icon}
        <span className="font-medium">{current?.label ?? value}</span>
        {/* 팝업은 이 아이콘에 붙는다 (Supabase 처럼) */}
        <span ref={anchorRef} className="flex">
          <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0 translate-y-[0.5px]" />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchorRef}
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50"
        >
          <Popover.Popup className="border-border bg-popover data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-top-1 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-64 origin-[var(--transform-origin)] overflow-hidden rounded-lg border shadow-md duration-100 outline-none">
            <div className="border-border relative border-b">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={findLabel}
                className="placeholder:text-muted-foreground h-9 w-full bg-transparent pr-3 pl-8 text-sm outline-none"
              />
            </div>

            <ul className="max-h-64 overflow-y-auto p-1">
              {filtered.map((i) => (
                <li key={i.value}>
                  <button
                    type="button"
                    onClick={() => onSelect(i.value)}
                    className="hover:bg-muted flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                  >
                    <span className="truncate">{i.label}</span>
                    {i.value === value && <Check className="size-4 shrink-0" />}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="text-muted-foreground px-2 py-2 text-center text-xs">No match</li>
              )}
            </ul>

            {footer && <div className="border-border border-t p-1">{footer}</div>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
