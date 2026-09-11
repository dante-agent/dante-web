"use client";

import { setSnooze } from "@/app/project/[projectRef]/settings/notifications/actions";
import { Button } from "@/components/ui/button";

// 스누즈를 켜는 자리 (§6.3). 적용 범위 섹션 아래에 둔다.
//
// 클라이언트 컴포넌트인 이유는 "오늘"이 사용자의 시계 기준이어야 해서다. 서버는
// UTC 라 서버가 자정을 잡으면 한국에서는 오전 9시에 풀린다. 그래서 제출할 때
// 브라우저의 시간대 차이를 폼에 실어 보낸다.

const OPTIONS = [
  { value: "1h", label: "1 hour" },
  { value: "today", label: "Today" },
  { value: "1w", label: "1 week" },
  { value: "forever", label: "Until I turn it off" },
];

export function SnoozeControl({ projectRef }: { projectRef: string }) {
  const submit = (formData: FormData) => {
    formData.set("tzOffset", String(new Date().getTimezoneOffset()));
    return setSnooze(formData);
  };

  return (
    <form action={submit} className="mt-4 flex max-w-2xl flex-wrap items-center gap-3">
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
