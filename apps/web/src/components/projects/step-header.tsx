import { StepStrip } from "@/components/projects/step-strip";

// 온보딩 단계 머리말.
//
// CodeRabbit 브랜드 사이트의 편집디자인 장치를 실측해서 가져왔다:
//   섹션 번호  Hack mono 12px/700, letter-spacing 1.2px, Orange 10 (#ff801f)
//   큰 제목    Geist 500 weight, letter-spacing -2%  ← 600 이 아니라 500 이다
//   본문       16px / line-height 1.5, 폭 제한
//   패널       radius 0, border 1px, padding 32
//
// 48px 제목은 마케팅 페이지 기준이라 앱 화면에서는 32px 로 줄이되
// weight·tracking·행간 비율은 그대로 뒀다.

export function StepHeader({
  step,
  title,
  description,
  projectRef,
}: {
  step: number;
  title: string;
  description: string;
  /** 3단계부터는 프로젝트가 이미 있어서 앞뒤 단계로 오갈 수 있다. */
  projectRef?: string;
}) {
  return (
    <header>
      <SegmentedRule />
      <div className="mt-6">
        <StepStrip current={step} projectRef={projectRef} />
      </div>

      <h1 className="font-heading mt-8 text-[32px] leading-[1.125] font-medium tracking-[-0.02em]">
        {title}
      </h1>
      <p className="text-muted-foreground mt-4 max-w-[488px] text-base leading-relaxed">
        {description}
      </p>
    </header>
  );
}

// 히어로 상단의 얇은 세그먼트 바. CodeRabbit 은 4px 두께로 팔레트 램프 색을
// 끊어 배치한다 — 실측한 색이 우리 DESIGN.md 값과 같았다(Mauve 5, Cobalt 3 …).
// 장식이라 스크린리더는 건너뛴다.
const SEGMENTS = [
  { grow: "flex-[3]", tone: "bg-[#322f37]" }, // Mauve 5
  { grow: "flex-[1]", tone: "bg-[#46e1a5]" }, // Mint 9
  { grow: "flex-[6]", tone: "bg-[#322f37]" },
  { grow: "flex-[2]", tone: "bg-[#687ff5]" }, // Cobalt 9
  { grow: "flex-[4]", tone: "bg-[#322f37]" },
  { grow: "flex-[2]", tone: "bg-[#ff570a]" }, // Orange 9
  { grow: "flex-[5]", tone: "bg-[#4a464f]" }, // Mauve 7
];

function SegmentedRule() {
  return (
    <div aria-hidden="true" className="flex h-1 gap-0.5">
      {SEGMENTS.map((segment, index) => (
        <div key={index} className={`${segment.grow} ${segment.tone}`} />
      ))}
    </div>
  );
}
