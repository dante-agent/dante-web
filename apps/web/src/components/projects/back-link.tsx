import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// 온보딩 단계 사이를 되돌아가는 링크.
//
// hover 배경이 균일한 사각형이 아니라 가운데만 밝고 좌우로 흩어진다.
// 각진 패널들 사이에서 이 링크만 둥근 박스가 켜지면 눈에 거슬려서,
// 형태 대신 밝기로만 반응하게 했다.
//
// 배경을 <span> 으로 따로 깐 이유: background-image(그라디언트)는 브라우저가
// 보간하지 않아서 transition 이 안 걸린다. 그라디언트는 고정해두고 opacity 만
// 움직이면 부드럽게 켜진다.
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group text-muted-foreground hover:text-foreground relative -ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors duration-[180ms] ease-out"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,transparent,#ffffff0a,transparent)] opacity-0 transition-opacity duration-[180ms] ease-out group-hover:opacity-100 motion-reduce:transition-none"
      />
      <ArrowLeft className="relative size-3.5" />
      <span className="relative">{children}</span>
    </Link>
  );
}
