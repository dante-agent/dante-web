import { ArrowRight } from "lucide-react";

export function PromptInput() {
  return (
    <form className="bg-card border-border flex items-center gap-3 rounded-xl border p-2 pl-4">
      <input
        type="text"
        placeholder="Describe which component you need tests for..."
        className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
      />
      <button
        type="submit"
        className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
      >
        <ArrowRight className="size-4" />
      </button>
    </form>
  );
}
