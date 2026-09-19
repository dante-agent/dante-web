import Image from "next/image";
import Link from "next/link";
import danteLogo from "@/assets/dante-logo.png";

// 약관/방침처럼 "제목 + 조항 나열" 구조가 같은 문서를 하나의 셸로 그린다.
// 본문을 JSX 로 직접 쓰지 않고 데이터로 받는 이유:
//   - 조항 순서·번호가 바뀌어도 마크업을 건드릴 일이 없다
//   - 목차를 본문에서 만들어내므로 둘이 어긋날 수 없다

export type LegalBlock =
  | { kind: "paragraph"; text: string }
  /** 번호가 붙는 항. 법령 문서의 "①②③" 자리다. */
  | { kind: "list"; items: string[] }
  /** 수집 항목·수탁사처럼 표가 원본 형식인 내용. */
  | { kind: "table"; head: string[]; rows: string[][] };

export type LegalSection = {
  /** 목차 링크가 가리킬 앵커. 조 번호가 아니라 내용으로 지어 순서가 바뀌어도 링크가 산다. */
  id: string;
  title: string;
  blocks: LegalBlock[];
};

type LegalDocumentProps = {
  title: string;
  /** 시행일. `<time dateTime>` 에 그대로 들어가므로 YYYY-MM-DD 형식이어야 한다. */
  effectiveDate: string;
  /** 제목 아래 한두 문장. 문서 전체 요약. */
  summary: string;
  sections: LegalSection[];
  /** 문서 끝에서 다른 쪽 문서로 넘어가는 링크. */
  counterpart: { href: "/terms" | "/privacy"; label: string };
};

export function LegalDocument({
  title,
  effectiveDate,
  summary,
  sections,
  counterpart,
}: LegalDocumentProps) {
  return (
    <div className="flex min-h-svh flex-col">
      {/* /projects 셸과 같은 높이(h-14)·같은 로고 처리.
          로그인 여부와 무관한 화면이라 아바타 자리는 두지 않는다. */}
      <header className="border-border bg-background/80 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center px-6">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold">
            {/* 옆에 "Dante" 텍스트가 있으므로 alt 는 비운다 (장식용 이미지). */}
            <Image src={danteLogo} alt="" priority draggable={false} className="h-6 w-4.5" />
            Dante
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        {/* 날짜·메타데이터는 Utility 서체(Hack) — DESIGN.md §3 */}
        <p className="text-muted-foreground mt-3 font-mono text-xs tracking-wide uppercase">
          시행일 <time dateTime={effectiveDate}>{effectiveDate}</time>
        </p>
        <p className="text-muted-foreground mt-6 text-sm leading-relaxed">{summary}</p>

        <nav aria-label="목차" className="border-border bg-card mt-10 rounded-lg border p-5">
          <h2 className="text-xs font-semibold tracking-wide uppercase">목차</h2>
          <ol className="text-muted-foreground mt-3 space-y-1.5 text-sm">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="hover:text-foreground underline-offset-2 hover:underline"
                >
                  <span className="font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>{" "}
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            // scroll-mt: 목차에서 점프했을 때 sticky 헤더(h-14) 뒤로 제목이 숨지 않게 한다.
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <h2 className="font-heading text-lg font-semibold tracking-tight">{section.title}</h2>
              <div className="mt-4 space-y-4">
                {section.blocks.map((block, index) => (
                  <Block key={index} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="border-border text-muted-foreground mt-16 border-t pt-6 text-sm">
          <Link
            href={counterpart.href}
            className="hover:text-foreground underline underline-offset-2"
          >
            {counterpart.label}
          </Link>
        </footer>
      </main>
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "paragraph") {
    return <p className="text-muted-foreground text-sm leading-relaxed">{block.text}</p>;
  }

  if (block.kind === "list") {
    return (
      <ol className="text-muted-foreground marker:text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed">
        {block.items.map((item, index) => (
          <li key={index} className="pl-1">
            {item}
          </li>
        ))}
      </ol>
    );
  }

  // 표는 좁은 화면에서 칸을 짜부라뜨리는 대신 가로로 스크롤시킨다
  // (수탁사·보유기간 표는 폭을 줄이면 읽을 수 없다).
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full min-w-lg border-collapse text-sm">
        <thead>
          <tr className="border-border bg-card border-b">
            {block.head.map((cell) => (
              <th key={cell} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-border/60 border-b last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2.5 align-top leading-relaxed">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
