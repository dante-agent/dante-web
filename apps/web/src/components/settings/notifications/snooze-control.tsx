"use client";

import { setSnooze } from "@/app/project/[projectRef]/settings/notifications/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

      {/* 네이티브 <select> 대신 온보딩 레포 선택기(repo-picker.tsx)와 같은 것을
          쓴다. 네이티브는 OS 가 화살표를 그려서 좌우 여백이 어긋난다.
          name 을 주면 Base UI 가 숨은 input 을 만들어 폼에 값이 실린다.
          items 는 SelectValue 가 "1h" 대신 "1 hour" 를 그리게 한다.
          폭을 고정하는 이유는 "Until I turn it off" 를 고르면 옆 버튼이 밀려서다.
          pr-2.5 는 기본값(pl-2.5 / pr-2)의 좌우 여백을 같게 맞춘다. */}
      <Select name="duration" defaultValue="1h" items={OPTIONS}>
        <SelectTrigger size="sm" className="w-40 pr-2.5 text-[13px] data-[size=sm]:rounded-[4px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" size="sm" variant="outline" className="rounded-[4px]">
        Snooze
      </Button>
    </form>
  );
}
