import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";

// 알림 설정 화면의 작은 조각들. 서버·클라이언트 양쪽에서 쓰므로 상태를 두지
// 않는다 — 값과 onChange 는 부르는 쪽이 들고 있다.

/** 설정 화면의 한 묶음. 제목 + 한 줄 설명 + 본문. */
export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-8 max-w-2xl", className)}>
      <h2 className="font-heading text-[15px] leading-tight font-medium">{title}</h2>
      {description && (
        <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">{description}</p>
      )}
      <div className="border-border bg-card mt-3 border">{children}</div>
    </section>
  );
}

/**
 * 켜고 끄는 한 줄.
 *
 * 네이티브 checkbox 를 그대로 쓴다. 폼과 함께 제출되고(FormData), 키보드·스크린
 * 리더 동작을 공짜로 얻는다. 스위치처럼 보이게 하는 건 CSS 몫이다.
 */
export function ToggleRow({
  name,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "border-border flex cursor-pointer items-start gap-3 border-b p-4 last:border-b-0",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-brand-mint mt-0.5 size-4 shrink-0"
      />
      {/* disabled 인 입력은 폼에 실리지 않는다. 그대로 두면 "코멘트 끄기"를
          저장하는 순간 아래 세부 설정이 전부 꺼진 값으로 덮어써진다. */}
      {disabled && checked && <input type="hidden" name={name} value="on" />}
      <span className="min-w-0">
        <span className="block text-[13px] leading-tight">{label}</span>
        {hint && (
          <span className="text-muted-foreground mt-1 block text-[12px] leading-relaxed">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

/** 둘 중 하나를 고르는 줄. 라디오라 폼에 값이 하나만 실린다. */
export function RadioRow({
  name,
  value,
  label,
  hint,
  selected,
  onSelect,
}: {
  name: string;
  value: string;
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <label className="border-border flex cursor-pointer items-start gap-3 border-b p-4 last:border-b-0">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
        className="accent-brand-mint mt-0.5 size-4 shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-[13px] leading-tight">{label}</span>
        {hint && (
          <span className="text-muted-foreground mt-1 block text-[12px] leading-relaxed">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

/** 상태 배지 한 장 (§8). */
export function StatusBadge({
  tone,
  title,
  description,
  action,
}: {
  tone: "warn" | "error";
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div
      className={cn(
        "mt-6 max-w-2xl border p-4",
        tone === "error" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card/40"
      )}
    >
      <p className="text-[13px] leading-tight font-medium">{title}</p>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">{description}</p>
      {action && (
        <a
          href={action.href}
          className="text-foreground mt-2 inline-block text-[13px] underline underline-offset-4"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

/**
 * 저장·테스트 버튼 옆의 상태 자리 하나. 마지막으로 누른 버튼의 결과만 보인다
 * (discord-form.tsx·slack-notifications-form.tsx).
 */
export function FormStatus({
  pending,
  pendingLabel,
  done,
  doneLabel,
  error,
}: {
  pending: boolean;
  pendingLabel: string;
  done?: boolean;
  doneLabel: string;
  error?: string;
}) {
  if (pending) return <span className="text-muted-foreground text-[13px]">{pendingLabel}</span>;
  if (error) {
    return (
      <span role="alert" className="text-destructive text-[13px]">
        {error}
      </span>
    );
  }
  if (!done) return null;
  return (
    <span className="text-brand-mint flex items-center gap-1.5 text-[13px]">
      <Check className="size-3.5" />
      {doneLabel}
    </span>
  );
}
