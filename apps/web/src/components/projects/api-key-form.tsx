"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { saveApiKey, skipApiKey } from "@/app/projects/(onboarding)/setup/[projectRef]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AI_PROVIDERS, type AiProviderId } from "@/lib/projects/ai-providers";

// 온보딩 4단계 폼. 두 국면으로 나뉜다.
//
//   고르기 전  세 장의 카드만. 키 입력란도 Finish 버튼도 없다.
//   고른 뒤    카드는 접히고 "이름 · 벤더 — Change" 한 줄만 남는다. 그 아래로
//              키 입력란이 열린다.
//
// 고르기 전에 기본 선택을 두지 않는 이유: 기본값이 있으면 화면에 들어오자마자
// 접혀서 나머지 둘을 볼 기회가 없다. 저장해둔 키가 있을 때만 예외로, 그
// 프로바이더가 고른 상태로 시작한다(두 번째 프로젝트부터는 바로 Finish).
//
// 두 국면 모두 DOM 에 남겨두고 grid-template-rows 0fr↔1fr 로 접는다. 지웠다
// 그렸다 하면 전환이 안 걸리고, 높이를 px 로 재려면 JS 가 필요하다. 접힌 쪽은
// inert 로 포커스·스크린리더에서 통째로 빠진다.
//
// 높이와 투명도를 같은 타이밍에 움직이면 접히는 내내 "반쯤 투명한, 반쯤 잘린"
// 카드가 보인다 — overflow-hidden 이 아래쪽부터 잘라내는 게 그대로 노출된다.
// 그래서 둘을 떼어놓고 순서를 준다:
//
//   0–90ms     나가는 내용이 사라진다 (높이는 아직 그대로)
//   90–390ms   높이가 맞바뀐다 — 이때 보이는 게 없으니 잘릴 것도 없다
//   200–400ms  들어오는 내용이 자리에 뜬다
//
// 들어오는 쪽을 높이가 끝나기 전에 시작시키는 이유: 완전히 기다리면 중간에
// 아무것도 없는 구간이 200ms 넘게 남아 빈 화면처럼 보인다. 쓰는 곡선이
// 앞에서 대부분 끝나는 종류라 200ms 시점이면 높이는 이미 거의 제자리다 —
// 들어오는 내용이 잘려 보이지 않는다.
//
// 높이는 바깥 상자가, 투명도는 안쪽 내용이 맡는다. 한 엘리먼트에 두 속성을
// 서로 다른 duration·delay 로 거는 Tailwind 유틸이 없어서 층을 나눈 것이다.

// 바깥 — 높이만. 곡선은 단계 레일(step-rail.tsx)과 같은 것을 쓴다.
const SHELL =
  "grid transition-[grid-template-rows] duration-[300ms] delay-[90ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

// 안쪽 — 투명도. 나갈 때는 곧바로, 들어올 때는 높이가 자리를 만든 뒤에.
// 살짝 띄웠다 내리면 "잘려나갔다"가 아니라 "물러났다"로 읽힌다.
const LEAVING =
  "-translate-y-1 opacity-0 transition-[opacity,transform] duration-[90ms] ease-out motion-reduce:transition-none";
const ENTERING =
  "translate-y-0 opacity-100 transition-[opacity,transform] duration-[200ms] delay-[200ms] ease-out motion-reduce:transition-none";

const CARD =
  "border-border bg-card hover:border-input block w-full cursor-pointer border p-5 text-left transition-colors duration-[180ms] ease-out focus-visible:ring-2 focus-visible:ring-[#ff570a]/40 focus-visible:outline-none";

export function ApiKeyForm({
  projectRef,
  /** 이미 저장해둔 키의 끝 4자리. 프로바이더 id → "1234" */
  savedKeys,
}: {
  projectRef: string;
  savedKeys: Partial<Record<AiProviderId, string>>;
}) {
  const [selected, setSelected] = useState<AiProviderId | null>(
    () => AI_PROVIDERS.find((provider) => savedKeys[provider.id])?.id ?? null
  );
  // Change 로 선택을 지워도 이 값은 남는다. 접히는 동안 보여줄 내용이 없으면
  // 그 사이 서브트리가 통째로 사라져서 전환이 걸릴 대상이 없어진다.
  const [lastShown, setLastShown] = useState<AiProviderId>(
    () => AI_PROVIDERS.find((provider) => savedKeys[provider.id])?.id ?? AI_PROVIDERS[0].id
  );
  const [revealed, setRevealed] = useState(false);
  // 입력란을 제어 컴포넌트로 두는 이유: 서버 액션이 끝나면 React 가 form 을
  // 초기화한다. 그대로 두면 키가 틀렸을 때 붙여넣은 값까지 같이 날아가서
  // 고치는 게 아니라 처음부터 다시 해야 한다.
  const [apiKey, setApiKey] = useState("");
  const [state, formAction, pending] = useActionState(saveApiKey, null);

  const provider = AI_PROVIDERS.find((item) => item.id === lastShown)!;
  const savedLastFour = savedKeys[lastShown];

  // 프로바이더를 누르면 바로 키를 칠 수 있게 포커스를 넘긴다. 저장해둔 키가
  // 있어서 처음부터 고른 상태로 시작한 경우에는 넘기지 않는다 — 페이지를 열자마자
  // 커서가 튀면 사용자가 부른 적 없는 동작이 된다.
  //
  // preventScroll 이 반드시 필요하다. 이 시점에 바깥 상자는 아직 접혀 있는데,
  // 그냥 focus() 하면 브라우저가 입력란을 보이게 하려고 overflow-hidden 상자를
  // 스크롤해버린다(실측 scrollTop 0 → 108). 높이가 펼쳐진 뒤에도 그 스크롤이
  // 남아서 위쪽 요약 줄이 잘려 보인다.
  const keyInput = useRef<HTMLInputElement>(null);
  const picked = useRef(false);
  useEffect(() => {
    if (!picked.current) return;
    picked.current = false;
    keyInput.current?.focus({ preventScroll: true });
  }, [selected]);

  function pick(id: AiProviderId) {
    picked.current = true;
    setSelected(id);
    setLastShown(id);
  }

  return (
    <>
      <form action={formAction} className="mt-6">
        <input type="hidden" name="projectRef" value={projectRef} />
        {/* 값은 여기로 나간다. 카드는 라디오가 아니라 버튼이라 — 누르면 고르는
            동시에 목록이 접히므로, 토글이 아니라 "고르고 넘어가는" 동작이다. */}
        <input type="hidden" name="provider" value={selected ?? ""} />

        {/* ── 고르기 전 ─────────────────────────────────────────────── */}
        <div className={`${SHELL} ${selected ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
          <div className="overflow-hidden" inert={selected !== null}>
            <div className={`flex flex-col gap-3 ${selected ? LEAVING : ENTERING}`}>
              {AI_PROVIDERS.map((item) => (
                <button key={item.id} type="button" onClick={() => pick(item.id)} className={CARD}>
                  <span className="flex items-baseline gap-3">
                    <span className="font-heading text-lg leading-tight font-medium">
                      {item.name}
                    </span>
                    <span className="text-muted-foreground flex-1 text-[13px]">{item.vendor}</span>
                    {savedKeys[item.id] && (
                      <span className="text-brand-mint font-mono text-[10px] font-bold tracking-[0.12em]">
                        SAVED ····{savedKeys[item.id]}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground mt-2 block text-[13px] leading-relaxed">
                    {item.tagline}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 고른 뒤 ───────────────────────────────────────────────── */}
        <div className={`${SHELL} ${selected ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden" inert={selected === null}>
            <div className={selected ? ENTERING : LEAVING}>
              <div className="border-border flex items-baseline gap-2 border-b pb-3">
                <span className="font-heading text-lg leading-tight font-medium">
                  {provider.name}
                </span>
                <span className="text-muted-foreground flex-1 text-[13px]">
                  · {provider.vendor}
                </span>
                {savedLastFour && (
                  <span className="text-brand-mint font-mono text-[10px] font-bold tracking-[0.12em]">
                    SAVED ····{savedLastFour}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground hover:text-foreground text-[13px] underline underline-offset-4 transition-colors duration-[180ms] ease-out"
                >
                  Change
                </button>
              </div>

              <div className="mt-5">
                <label htmlFor="apiKey" className="text-[13px] font-medium">
                  {provider.vendor} API key
                </label>

                {/* 눈 아이콘은 입력란 안쪽 오른쪽에 겹쳐 놓는다. 붙여넣은 값이
                      맞는지 확인할 길이 없으면 오타 하나에 이유 없이 막힌다. */}
                <div className="relative mt-2">
                  <Input
                    ref={keyInput}
                    id="apiKey"
                    name="apiKey"
                    type={revealed ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={
                      savedLastFour
                        ? `····${savedLastFour} — leave blank to keep`
                        : provider.placeholder
                    }
                    aria-invalid={state ? true : undefined}
                    className="h-10 rounded-[4px] pr-10 font-mono text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setRevealed((value) => !value)}
                    aria-label={revealed ? "Hide API key" : "Show API key"}
                    className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center transition-colors duration-[180ms] ease-out"
                  >
                    {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                {/* 에러가 떠도 도움말은 남긴다 — 키를 틀린 사람에게 가장 필요한
                      게 바로 그 발급 링크다. */}
                {state && (
                  <p role="alert" className="text-destructive mt-2 text-[13px]">
                    {state.error}
                  </p>
                )}

                <p className="text-muted-foreground mt-2 text-[13px]">
                  Need one?{" "}
                  <a
                    href={provider.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground underline underline-offset-4 transition-colors duration-[180ms] ease-out"
                  >
                    Create a key in the {provider.vendor} console
                  </a>
                  . Stored encrypted — we only ever show the last four digits.
                </p>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={pending}
                className="mt-6 w-full rounded-[4px]"
              >
                {pending ? "Checking the key..." : "Finish setup"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* 건너뛰기는 별도 form. 위 form 안에 두면 useActionState 가 감싼 action 과
          formAction 이 엇갈려서 키 검증을 건너뛴 채 제출되는 경로가 생긴다. */}
      <form action={skipApiKey} className="mt-3">
        <input type="hidden" name="projectRef" value={projectRef} />
        <Button type="submit" variant="ghost" size="lg" className="w-full rounded-[4px]">
          Skip for now
        </Button>
      </form>
    </>
  );
}
