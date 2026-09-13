"use client";

import { useState, useTransition } from "react";
import { approveExtension, denyExtension } from "@/app/auth/extension/actions";
import { Button, buttonVariants } from "@/components/ui/button";

type Status =
  | { kind: "asking" }
  | { kind: "failed" }
  | { kind: "cancelled"; url?: string }
  | { kind: "opened"; url: string }
  | { kind: "code"; code: string; expiresAt: Date };

// 익스텐션 로그인 동의. 링크를 여는 것만으로 토큰이 나가지 않게, 사람이 한 번 누르게 한다.
//
// manual 이면 에디터로 보내지 않고 code 를 보여준다. 사용자가 그걸 에디터 입력창에 붙여넣는다.
export function ExtensionConsent({
  editor,
  account,
  manual,
  params,
}: {
  editor: string;
  account: string;
  manual: boolean;
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
      if (result.issued.kind === "manual") {
        setStatus({ kind: "code", code: result.issued.code, expiresAt: result.issued.expiresAt });
        return;
      }
      setStatus({ kind: "opened", url: result.issued.url });
      // 커스텀 스킴이라 페이지는 그대로 있고, 브라우저가 "에디터 열기" 확인창을 띄운다.
      window.location.href = result.issued.url;
    });
  }

  function cancel() {
    startTransition(async () => {
      // 에디터에 error=access_denied 를 알려 대기 중인 로그인을 버리게 한다.
      // 실패해도 사용자에게 알릴 일은 아니다 — 취소는 어차피 취소다.
      const result = await denyExtension(params);
      if (!result.ok || !result.url) {
        setStatus({ kind: "cancelled" });
        return;
      }
      setStatus({ kind: "cancelled", url: result.url });
      window.location.href = result.url;
    });
  }

  if (status.kind === "code") {
    return <PairingCode editor={editor} code={status.code} expiresAt={status.expiresAt} />;
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
          {editor} was not connected. You can close this tab
          {manual && " and the prompt in your editor"}.
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
      {manual && (
        <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
          Your editor can&apos;t be opened from here, so you&apos;ll get a code to paste into it
          instead.
        </p>
      )}
    </>
  );
}

function PairingCode({
  editor,
  code,
  expiresAt,
}: {
  editor: string;
  code: string;
  expiresAt: Date;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // 권한이 없으면 복사 버튼만 조용히 실패한다. 코드는 화면에 그대로 있어 옮겨 적으면 된다.
    }
  }

  return (
    <>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Paste this code in {editor}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Enter it where the Dante extension asked for a code. It works once and expires at{" "}
        {expiresAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.
      </p>

      <p className="border-border bg-card mt-8 border px-4 py-5 text-center font-mono text-2xl font-semibold tracking-[0.15em] select-all">
        {code}
      </p>

      <Button variant="outline" size="lg" className="mt-3 h-10 w-full" onClick={copy}>
        {copied ? "Copied" : "Copy code"}
      </Button>

      {/* 누가 이 코드를 달라고 하면 그게 곧 계정 탈취 시도다. */}
      <p className="text-muted-foreground/80 mt-6 text-[13px] leading-relaxed">
        Don&apos;t share this code. Anyone who asks for it is trying to get into your account.
      </p>
    </>
  );
}
