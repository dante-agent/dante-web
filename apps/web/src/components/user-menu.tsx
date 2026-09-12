"use client";

// 헤더 오른쪽 끝의 프로필. 아바타를 누르면 계정 설정·로그아웃이 드롭다운으로 열린다.
//
// 프로젝트 셸(app-header)과 계정 셸(account/layout) 양쪽 헤더가 같은 컴포넌트를
// 쓴다 — 어느 화면에 있든 계정으로 가는 문이 같은 자리에 있어야 한다.

import { useState } from "react";
import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { UserAvatar } from "@/components/user-avatar";

/** 헤더가 쓰는 사용자 정보만. Supabase User 를 통째로 클라이언트에 넘기지 않는다. */
export type HeaderUser = { name: string; avatarUrl: string | null };

const ROW =
  "hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm";

export function UserMenu({ user }: { user: HeaderUser }) {
  // 링크를 눌러도 Popover 는 저절로 닫히지 않아서 열림 상태를 직접 쥔다.
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${user.name} profile`}
        className="focus-visible:ring-ring/50 cursor-pointer rounded-full opacity-100 transition-opacity outline-none hover:opacity-80 focus-visible:ring-2"
      >
        <UserAvatar src={user.avatarUrl} name={user.name} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="border-border bg-popover data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-top-1 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-56 origin-[var(--transform-origin)] overflow-hidden rounded-lg border shadow-md duration-100 outline-none">
            <div className="border-border border-b px-3 py-2.5">
              <p className="text-muted-foreground/70 font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
                Signed in as
              </p>
              <p className="mt-0.5 truncate text-sm font-medium" title={user.name}>
                {user.name}
              </p>
            </div>

            <div className="p-1">
              <Link href="/account/settings/general" onClick={() => setOpen(false)} className={ROW}>
                <Settings className="text-muted-foreground size-4" />
                Account settings
              </Link>

              {/* 서버 액션이라 <form> 이 필요하다. 로그아웃은 리다이렉트로 끝나므로
                  Popover 를 따로 닫지 않는다. */}
              <form action={signOut}>
                <button type="submit" className={ROW}>
                  <LogOut className="text-muted-foreground size-4" />
                  Sign out
                </button>
              </form>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
