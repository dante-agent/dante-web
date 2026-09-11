import { formatDistanceToNow, isPast } from "date-fns";
import { DisconnectEditorForm } from "@/components/settings/extension/disconnect-editor-form";
import { Badge } from "@/components/ui/badge";

// 이 계정으로 로그인한 에디터 목록. 토큰(ExtensionToken) 한 행이 에디터 하나다.
//
// 같은 에디터에서 두 번 로그인하면 두 줄이 된다 — 토큰이 둘이니 사실 그대로다.
// 만료된 것도 숨기지 않는다. 숨기면 "왜 에디터가 401 을 받지"의 답이 화면에서
// 사라지고, 정리할 방법도 없어진다.

/** tokenHash 는 여기까지 오지 않는다. 페이지의 select 가 막는다. */
export type ConnectedEditor = {
  id: string;
  editor: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
};

export function ConnectedEditors({ editors }: { editors: ConnectedEditor[] }) {
  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="font-heading text-[15px] leading-tight font-medium">Connected editors</h2>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
        Every editor signed in to Dante with this account. Disconnecting one signs it out; the
        extension there has to sign in again before it can talk to Dante.
      </p>

      {editors.length === 0 ? (
        <p className="border-border bg-card/40 text-muted-foreground mt-3 border p-4 text-[13px] leading-relaxed">
          No editors connected yet. Sign in from the Dante extension inside your editor and it shows
          up here. The extension ships separately, from the
          <span className="font-mono"> dante-extension </span>
          repo.
        </p>
      ) : (
        <div className="border-border divide-border bg-card mt-3 divide-y border">
          {editors.map((editor) => (
            <EditorRow key={editor.id} editor={editor} />
          ))}
        </div>
      )}
    </section>
  );
}

function EditorRow({ editor }: { editor: ConnectedEditor }) {
  // 서버에서 그리는 화면이라 절대 시각은 서버 시간대로 찍힌다. 상대 시각이면
  // 시간대와 상관없이 같은 뜻이다(snooze.tsx 와 같은 판단).
  const expired = isPast(editor.expiresAt);

  return (
    <div className="p-5">
      <div className="flex items-center gap-2">
        <span className="font-heading text-base leading-tight font-medium">{editor.editor}</span>
        {expired && <Badge variant="destructive">Expired</Badge>}
      </div>

      <dl className="text-muted-foreground mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
        <Meta label="Connected">{formatDistanceToNow(editor.createdAt, { addSuffix: true })}</Meta>
        <Meta label="Last used">
          {editor.lastUsedAt
            ? formatDistanceToNow(editor.lastUsedAt, { addSuffix: true })
            : "Never used"}
        </Meta>
        <Meta label={expired ? "Expired" : "Expires"}>
          {formatDistanceToNow(editor.expiresAt, { addSuffix: true })}
        </Meta>
      </dl>

      <div className="mt-3">
        <DisconnectEditorForm id={editor.id} editor={editor.editor} />
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted-foreground/70 font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
