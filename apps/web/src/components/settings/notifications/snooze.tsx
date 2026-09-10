import { setSnooze } from "@/app/project/[projectRef]/settings/notifications/actions";
import { Button } from "@/components/ui/button";

// 스누즈 (§6.3). 대규모 리팩터링 기간에 "GitHub 에 아무것도 쓰지 않기"를 켠다.
//
// 분석은 계속 돌린다 — 분석까지 멈추면 스누즈를 푼 뒤 이력이 비어 있게 되고,
// 그 기간에 무슨 일이 있었는지 되짚을 방법이 없다.

const OPTIONS = [
  { value: "1h", label: "1 hour" },
  { value: "today", label: "Today" },
  { value: "1w", label: "1 week" },
  { value: "forever", label: "Until I turn it off" },
];

/** 스누즈 중일 때 화면 맨 위에 붙는 해제 배너. */
export function SnoozeBanner({ projectRef, until }: { projectRef: string; until: Date }) {
  // 2999년은 "해제할 때까지"의 표시값이다 (actions.ts 참고). 날짜로 보여주면
  // 사용자가 그걸 진짜 만료일로 읽는다.
  const forever = until.getUTCFullYear() > 2100;

  return (
    <div className="border-border bg-card mt-6 flex max-w-2xl flex-wrap items-center gap-3 border p-4">
      <p className="min-w-0 flex-1 text-[13px] leading-relaxed">
        Dante is not writing to GitHub
        {forever ? "" : ` until ${until.toLocaleString()}`}. Analysis keeps running, so the
        dashboard stays up to date.
      </p>

      <form action={setSnooze}>
        <input type="hidden" name="projectRef" value={projectRef} />
        <input type="hidden" name="duration" value="off" />
        <Button type="submit" size="sm" variant="outline" className="rounded-[4px]">
          Resume
        </Button>
      </form>
    </div>
  );
}

/** 스누즈를 켜는 자리. 적용 범위 섹션 아래에 둔다. */
export function SnoozeControl({ projectRef }: { projectRef: string }) {
  return (
    <form action={setSnooze} className="mt-4 flex max-w-2xl flex-wrap items-center gap-3">
      <input type="hidden" name="projectRef" value={projectRef} />
      <span className="text-[13px]">Pause writing to GitHub for</span>
      <select
        name="duration"
        defaultValue="1h"
        className="border-border bg-background border px-2 py-1 text-[13px]"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" className="rounded-[4px]">
        Snooze
      </Button>
    </form>
  );
}
