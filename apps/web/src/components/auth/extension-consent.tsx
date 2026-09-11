"use client";

import { useState, useTransition } from "react";
import { approveExtension, denyExtension } from "@/app/auth/extension/actions";
import { Button, buttonVariants } from "@/components/ui/button";

type Status =
  | { kind: "asking" }
  | { kind: "failed" }
  | { kind: "cancelled"; url?: string }
  | { kind: "opened"; url: string };

// 익스텐션 로그인 동의. 링크를 여는 것만으로 토큰이 나가지 않게, 사람이 한 번 누르게 한다.
export function ExtensionConsent({
  editor,
  account,
  params,
}: {
  editor: string;
  account: string;
  params: Record<string, string>;
}) {
  const [status, setStatus] = useState<Status>({ kind: "asking" });
  const [pending, startTransition] = useTransition();

  function connect() {
    startTransition(async () => {
      const result = await approveExtension(params);
      if (!result.ok) {
        setStatus({ kind: "failed" });
        return;
      }
      setStatus({ kind: "opened", url: result.url });
      // 커스텀 스킴이라 페이지는 그대로 있고, 브라우저가 "에디터 열기" 확인창을 띄운다.
      window.location.href = result.url;
    });
  }

  function cancel() {
    startTransition(async () => {
      // 에디터에 error=access_denied 를 알려 대기 중인 로그인을 버리게 한다.
      // 실패해도 사용자에게 알릴 일은 아니다 — 취소는 어차피 취소다.
      const result = await denyExtension(params);
      if (!result.ok) {
        setStatus({ kind: "cancelled" });
        return;
      }
      setStatus({ kind: "cancelled", url: result.url });
      window.location.href = result.url;
    });
  }

  if (status.kind === "opened") {
    return (
      <>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Return to {editor}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your browser should ask to open {editor}. Once it does, you can close this tab.
        </p>
        <a
          href={status.url}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "mt-8 h-10 w-full",
          })}
        >
          Open {editor} again
        </a>
      </>
    );
  }

  if (status.kind === "cancelled") {
    return (
      <>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Not connected</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {editor} was not connected. You can close this tab.
        </p>
        {status.url && (
          <a
            href={status.url}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "mt-8 h-10 w-full",
            })}
          >
            Open {editor} again
          </a>
        )}
      </>
    );
  }

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Connect {editor} to Dante?
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        The Dante extension will read your projects and tests and upload test results as{" "}
        <span className="text-foreground">{account}</span>.
      </p>

      {status.kind === "failed" && (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive mt-6 rounded-md border px-3 py-2 text-sm"
        >
          Something went wrong. Start signing in again from your editor.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <Button size="lg" className="h-10 w-full" onClick={connect} disabled={pending}>
          Connect {editor}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="h-10 w-full"
          onClick={cancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>

      {/* 피싱 링크로 들어온 사람이 멈추게 하는 문장. */}
      <p className="text-muted-foreground/80 mt-6 text-[13px] leading-relaxed">
        Only continue if you just started signing in from your editor.
      </p>
    </>
  );
}
