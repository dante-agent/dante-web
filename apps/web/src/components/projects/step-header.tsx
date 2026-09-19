// 온보딩 왼쪽 컬럼의 머리말.
//
// 단계 번호·진행 상황은 오른쪽 레일(StepRail)이 맡는다. 여기는 "지금 무엇을
// 하는지"만 말한다.
//
// 치수는 CodeRabbit 실측 기준이되 컬럼 폭(~450px)에 맞춰 줄였다:
//   제목  Geist 500 weight, tracking -2%   ← 600 이 아니라 500
//   본문  15px / line-height 1.5
//
// 좁은 화면에서는 레일이 통째로 사라지므로, 몇 번째 단계인지는 제목 앞 sr-only 로 한 번 더 알린다.
export function StepHeader({
  step,
  title,
  description,
}: {
  /** 1~4. 레일(StepRail)의 STEPS 순서와 같다. */
  step: number;
  title: string;
  description: string;
}) {
  return (
    <header>
      <h1 className="font-heading text-[26px] leading-[1.2] font-medium tracking-[-0.02em]">
        <span className="sr-only">Step {step} of 4: </span>
        {title}
      </h1>
      <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">{description}</p>
    </header>
  );
}
