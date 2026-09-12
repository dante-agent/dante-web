import { ENGINES } from "@/lib/ai/engine";

// 엔진 목록 카드. 온보딩 4단계와 계정 설정이 같은 것을 쓴다.
//
// 고를 수 있는 게 하나뿐이라 상호작용이 없다 — Codex 는 처음부터 선택돼 있고
// 나머지는 비활성이다. 그래서 클라이언트 컴포넌트가 아니고 폼에 실어 보낼 값도
// 없다(엔진은 서버가 정한다). 둘 이상 열리는 날 라디오 그룹으로 바꾸면 된다.
//
// 목록으로 짠 이유: 버튼으로 두면 눌리지 않는 버튼이 둘 생기고, 라디오로 두면
// 고를 수 없는 라디오가 둘 생긴다. 지금 이 화면이 하는 일은 "고르기"가 아니라
// "무엇이 붙어 있는지 알리기"라서 목록이 맞다.

export function EngineCards() {
  return (
    <ul className="flex flex-col gap-3">
      {ENGINES.map((engine) => (
        <li
          key={engine.id}
          className={`border p-5 transition-colors duration-[180ms] ease-out ${
            engine.available ? "bg-card border-[#ff570a]" : "border-border bg-card/40"
          }`}
        >
          <div className="flex items-baseline gap-3">
            {/* 선택 표시. 라디오처럼 보이지만 누를 수 없으므로 장식이다 —
                스크린리더에는 아래 COMING SOON 텍스트로만 전달한다. */}
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 translate-y-[-1px] rounded-full ${
                engine.available ? "bg-[#ff570a]" : "border-muted-foreground/40 border"
              }`}
            />
            <span
              className={`font-heading text-lg leading-tight font-medium ${
                engine.available ? "" : "text-muted-foreground"
              }`}
            >
              {engine.name}
            </span>
            <span className="text-muted-foreground/70 flex-1 text-[13px]">{engine.vendor}</span>
            {!engine.available && (
              <span className="text-muted-foreground/70 font-mono text-[10px] font-bold tracking-[0.12em] uppercase">
                Coming soon
              </span>
            )}
          </div>

          <p
            className={`mt-2 pl-5 text-[13px] leading-relaxed ${
              engine.available ? "text-muted-foreground" : "text-muted-foreground/60"
            }`}
          >
            {engine.tagline}
          </p>
        </li>
      ))}
    </ul>
  );
}
