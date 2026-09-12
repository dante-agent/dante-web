import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "./section";

/**
 * 커스텀 리포트 자리. 블록을 담을 기능이 아직 없어서 빈 상태만 있다.
 *
 * 버튼을 살려두지 않는 이유: 눌러도 아무 일이 없는 버튼은 "고장났다"로 읽힌다.
 * 제목 줄 버튼은 아예 두지 않고, 가운데 버튼만 disabled 로 남겨 "여기에 생긴다"만 알린다.
 */
export function ReportsSection() {
  return (
    <Section title="Reports">
      <div className="border-border grid min-h-64 place-items-center rounded-lg border border-dashed">
        <div className="flex flex-col items-center gap-1 px-6 text-center">
          <p className="text-sm">Build a custom report</p>
          <p className="text-muted-foreground text-sm">Keep track of your most important metrics</p>
          <Button variant="outline" size="sm" className="mt-3" disabled>
            Add your first block
            <Plus data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </Section>
  );
}
