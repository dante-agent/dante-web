// 확장자별 파일 아이콘. Material Icon Theme 4개 글리프를 인라인 SVG 로 옮겼다 (라이선스: ./LICENSE).
// SVGR 같은 빌드 설정 없이 쓰려고 컴포넌트로 박아둔다. 그 외 확장자는 lucide FileCode 로 폴백.

import { FileCode } from "lucide-react";
import type { ComponentProps, ReactElement } from "react";

type IconProps = { className?: string };

// react.svg / react_ts.svg — viewBox 0 0 32 32
function ReactAtom({ fill, className }: { fill: string; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill={fill}>
      <path d="M16 12c7.444 0 12 2.59 12 4s-4.556 4-12 4-12-2.59-12-4 4.556-4 12-4m0-2c-7.732 0-14 2.686-14 6s6.268 6 14 6 14-2.686 14-6-6.268-6-14-6" />
      <path d="M16 14a2 2 0 1 0 2 2 2 2 0 0 0-2-2" />
      <path d="M10.458 5.507c2.017 0 5.937 3.177 9.006 8.493 3.722 6.447 3.757 11.687 2.536 12.392a.9.9 0 0 1-.457.1c-2.017 0-5.938-3.176-9.007-8.492C8.814 11.553 8.779 6.313 10 5.608a.9.9 0 0 1 .458-.1m-.001-2A2.87 2.87 0 0 0 9 3.875C6.13 5.532 6.938 12.304 10.804 19c3.284 5.69 7.72 9.493 10.74 9.493A2.87 2.87 0 0 0 23 28.124c2.87-1.656 2.062-8.428-1.804-15.124-3.284-5.69-7.72-9.493-10.74-9.493Z" />
      <path d="M21.543 5.507a.9.9 0 0 1 .457.1c1.221.706 1.186 5.946-2.536 12.393-3.07 5.316-6.99 8.493-9.007 8.493a.9.9 0 0 1-.457-.1C8.779 25.686 8.814 20.446 12.536 14c3.07-5.316 6.99-8.493 9.007-8.493m0-2c-3.02 0-7.455 3.804-10.74 9.493C6.939 19.696 6.13 26.468 9 28.124a2.87 2.87 0 0 0 1.457.369c3.02 0 7.455-3.804 10.74-9.493C25.061 12.304 25.87 5.532 23 3.876a2.87 2.87 0 0 0-1.457-.369" />
    </svg>
  );
}

// typescript.svg / javascript.svg — viewBox 0 0 16 16, 같은 실루엣에 색만 다름
function Square({
  fill,
  d,
  className,
}: {
  fill: string;
  d: string;
  className?: string;
}): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill={fill}>
      <path d={d} />
    </svg>
  );
}

const TS_PATH =
  "M2 2v12h12V2zm4 6h3v1H8v4H7V9H6zm5 0h2v1h-2v1h1a1.003 1.003 0 0 1 1 1v1a1.003 1.003 0 0 1-1 1h-2v-1h2v-1h-1a1.003 1.003 0 0 1-1-1V9a1.003 1.003 0 0 1 1-1";
const JS_PATH =
  "M2 2v12h12V2zm6 6h1v4a1.003 1.003 0 0 1-1 1H7a1.003 1.003 0 0 1-1-1v-1h1v1h1zm3 0h2v1h-2v1h1a1.003 1.003 0 0 1 1 1v1a1.003 1.003 0 0 1-1 1h-2v-1h2v-1h-1a1.003 1.003 0 0 1-1-1V9a1.003 1.003 0 0 1 1-1";

export function iconForFile(name: string, props: IconProps): ReactElement {
  if (name.endsWith(".tsx")) return <ReactAtom fill="#0288d1" {...props} />;
  if (name.endsWith(".jsx")) return <ReactAtom fill="#00bcd4" {...props} />;
  if (name.endsWith(".ts")) return <Square fill="#0288d1" d={TS_PATH} {...props} />;
  if (name.endsWith(".js")) return <Square fill="#ffca28" d={JS_PATH} {...props} />;
  return <FileCode {...(props as ComponentProps<typeof FileCode>)} />;
}
