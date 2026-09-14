"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type GenerateResponse = { sessionId: string; sourcePath: string; error?: never };
type ErrorResponse = { error: string };

export function PromptInput({ projectRef }: { projectRef: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || pending) return;

    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectRef)}/recommend/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: value }),
        }
      );
      const result = (await response.json()) as GenerateResponse | ErrorResponse;
      if (!response.ok || "error" in result)
        throw new Error(result.error || "테스트 생성에 실패했습니다.");

      setMessage(`${result.sourcePath}의 테스트를 생성했습니다. 상세 페이지로 이동합니다.`);
      router.push(`/project/${projectRef}/recommend/${result.sessionId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "테스트 생성에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="bg-card border-border flex items-center gap-3 rounded-xl border p-2 pl-4"
      >
        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={pending}
          aria-label="생성할 테스트 설명"
          placeholder="예: src/components/LoginForm.tsx의 유효성 검사 테스트를 만들어줘"
          className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !prompt.trim()}
          aria-label={pending ? "테스트 생성 중" : "테스트 생성"}
          className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowRight className={`size-4 ${pending ? "animate-pulse" : ""}`} />
        </button>
      </form>
      <div aria-live="polite" className="mt-2 min-h-5 px-1 text-xs">
        {pending && (
          <p className="text-muted-foreground">소스 코드를 읽고 테스트를 생성하고 있습니다...</p>
        )}
        {message && <p className="text-foreground">{message}</p>}
        {error && <p className="text-destructive">{error}</p>}
      </div>
    </div>
  );
}
