"use client";

import { useState } from "react";
import { ConnectionBanner } from "@/components/settings/github/connection-banner";
import type { ConnectionNotice } from "@/lib/github/connection";

// 배너가 들고 나는 자리.
//
// 배너는 Recheck 로 생기거나 사라진다. 그냥 그리면 그 순간 아래 카드 두 장이
// 통째로 튄다 — 사용자가 누른 결과인데도 "화면이 깨졌나"로 읽힌다. 그래서
// 자리를 접었다 폈다 한다 (0fr ↔ 1fr). 지웠다 그렸다 하면 전환이 안 걸리고,
// 높이를 px 로 재려면 JS 가 필요해서 grid-template-rows 를 쓴다.
//
// 접히는 동안 보여줄 내용을 state 에 남겨두는 게 핵심이다. 서버가 notice 를
// null 로 내려보내면 서브트리가 통째로 사라져서 전환이 걸릴 대상이 없어진다
// — 높이만 0 으로 뚝 떨어지고 애니메이션은 안 걸린다.
//
// 배너를 children 으로 받지 않고 여기서 직접 그리는 이유도 같다. children 으로
// 받으면 서버가 다시 그릴 때마다 안쪽이 갈아끼워져서, 배너 안의 Recheck 버튼이
// 방금 받은 결과 문구를 잃는다.

// 높이는 바깥이, 투명도는 안쪽이 맡는다. 한 엘리먼트에 두 속성을 서로 다른
// 타이밍으로 거는 Tailwind 유틸이 없어서 층을 나눴다.
const SHELL =
  "grid transition-[grid-template-rows] duration-[300ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

// 나갈 때는 곧바로 사라지고(높이가 줄기 전에), 들어올 때는 자리가 만들어진 뒤에
// 뜬다. 같이 움직이면 접히는 내내 "반쯤 투명한, 반쯤 잘린" 상자가 보인다.
const LEAVING =
  "opacity-0 transition-opacity duration-[90ms] ease-out motion-reduce:transition-none";
const ENTERING =
  "opacity-100 transition-opacity duration-[200ms] delay-[150ms] ease-out motion-reduce:transition-none";

export function ConnectionPanel({
  notice,
  projectRef,
}: {
  /** null = 정상. 배너를 그리지 않는다. */
  notice: ConnectionNotice | null;
  projectRef: string;
}) {
  const open = notice !== null;

  // 마지막으로 보여준 배너. 접히는 동안의 내용이다.
  //
  // 렌더 중에 맞춘다 (React 의 "props 가 바뀔 때 state 조정" 패턴). useEffect 로
  // 하면 배너가 한 번 그려진 뒤에 갱신돼서 한 프레임 옛 내용이 비친다.
  // title 로 비교하는 이유: notice 는 서버가 매번 새로 만드는 객체라 참조로
  // 비교하면 렌더마다 다르다고 나온다.
  const [shown, setShown] = useState(notice);
  if (notice && notice.title !== shown?.title) setShown(notice);

  return (
    <div className={`${SHELL} ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      {/* inert: 접힌 배너는 화면에 없는 것과 같아야 한다. 탭 이동·스크린리더에서
          통째로 빠진다. */}
      <div className="overflow-hidden" inert={!open}>
        <div className={open ? ENTERING : LEAVING}>
          {shown && <ConnectionBanner notice={shown} projectRef={projectRef} />}
        </div>
      </div>
    </div>
  );
}
