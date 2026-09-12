import { cn } from "cn";

// 불러오는 동안 자리만 잡아두는 막대. shadcn skeleton 과 같은 모양이다.
// 움직임을 줄이도록 설정한 사용자에게는 깜빡이지 않고 멈춘 막대로 보인다.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
