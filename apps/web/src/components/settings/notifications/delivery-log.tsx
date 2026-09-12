import { formatDistanceToNow } from "date-fns";
import { retryDelivery } from "@/app/project/[projectRef]/settings/notifications/actions";
import { DELIVERY_RETENTION_DAYS } from "@/lib/notifications/store";

// 전달 로그 (§7).
//
// 이게 없으면 "왜 코멘트가 안 달렸지"의 답이 우리 서버 로그 안에만 있다. 실패한
// 건은 GitHub 이 준 문장을 그대로 보여준다 — "403 Resource not accessible by
// integration" 은 번역하는 것보다 원문이 검색하기 좋다.

type Delivery = {
  id: string;
  surface: string;
  prNumber: number | null;
  status: string;
  detail: string | null;
  createdAt: Date;
};

const SURFACE_LABEL: Record<string, string> = {
  github_comment: "comment",
  github_check: "check",
};

// 결과는 글자로 적는다. 기호 하나로 줄이면 스크린리더가 읽을 것이 없고,
// 성공과 건너뜀이 한눈에 구분되지도 않는다.
const STATUS_LABEL: Record<string, string> = {
  ok: "delivered",
  skipped: "skipped",
  failed: "failed",
};

export function DeliveryLog({
  projectRef,
  deliveries,
}: {
  projectRef: string;
  deliveries: Delivery[];
}) {
  return (
    <section id="delivery-log" className="mt-12 max-w-2xl scroll-mt-24">
      <h2 className="font-heading text-[15px] leading-tight font-medium">Delivery log</h2>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
        The last 20 attempts. Kept for {DELIVERY_RETENTION_DAYS} days.
      </p>

      {deliveries.length === 0 ? (
        <p className="border-border bg-card/40 text-muted-foreground mt-3 border p-4 text-[13px] leading-relaxed">
          Nothing yet. The first entry appears when a pull request is opened against a branch this
          project watches.
        </p>
      ) : (
        <div className="border-border divide-border bg-card mt-3 divide-y border">
          {deliveries.map((delivery) => (
            <div key={delivery.id} className="flex items-baseline gap-3 p-3 text-[13px]">
              <span className="text-muted-foreground w-24 shrink-0 text-[12px]">
                {formatDistanceToNow(delivery.createdAt, { addSuffix: true })}
              </span>
              <span className="w-12 shrink-0 font-mono text-[12px]">
                {delivery.prNumber === null ? "—" : `#${delivery.prNumber}`}
              </span>
              <span className="text-muted-foreground w-16 shrink-0 text-[12px]">
                {SURFACE_LABEL[delivery.surface] ?? delivery.surface}
              </span>
              <span className="min-w-0 flex-1 break-words">
                <span
                  className={
                    delivery.status === "failed" ? "text-destructive" : "text-muted-foreground"
                  }
                >
                  {STATUS_LABEL[delivery.status] ?? delivery.status}
                </span>
                {delivery.detail && <> — {delivery.detail}</>}
              </span>

              {/* 재시도는 실패한 건에만. 성공한 걸 다시 보내면 같은 코멘트를
                  한 번 더 덮어쓸 뿐이라 얻는 게 없다. */}
              {delivery.status === "failed" && delivery.prNumber !== null && (
                <form action={retryDelivery} className="shrink-0">
                  <input type="hidden" name="projectRef" value={projectRef} />
                  <input type="hidden" name="prNumber" value={delivery.prNumber} />
                  <button
                    type="submit"
                    className="text-muted-foreground hover:text-foreground text-[12px] underline underline-offset-4"
                  >
                    Retry
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
