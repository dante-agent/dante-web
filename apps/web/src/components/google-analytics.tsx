import Script from "next/script";

// GA4(gtag.js). 측정 ID(NEXT_PUBLIC_GA_ID)가 없으면 아무것도 넣지 않는다.
//
// 왜 `@next/third-parties` 의 <GoogleAnalytics /> 를 쓰지 않았나.
// 그 패키지는 Next 문서가 스스로 experimental 이라 적어 두고 next 와 버전을 맞춰
// 올리라고 안내한다. 정작 하는 일은 아래 <Script> 두 개와 같다 — 의존성을 하나 늘리고
// 심사 기간에 버전을 묶을 만한 이득이 없어서 직접 넣는다(AGENTS.md: 몇 줄로 될 일은
// 라이브러리 대신 직접 짠다).
//
// GTM(태그 관리자)이 아니라 GA4 를 직접 부르는 이유도 같다. GTM 은 코드를 다시
// 배포하지 않고 태그를 갈아끼우려고 쓰는 도구인데, 지금 필요한 건 "몇 명이 들어왔나"
// 하나라서 컨테이너를 거칠수록 확인할 것만 는다.
//
// 클라이언트 라우팅(<Link> 이동)의 페이지뷰는 여기서 따로 보내지 않는다. GA4 의
// 향상된 측정(속성 기본값: 켜짐)이 브라우저 히스토리 변경을 페이지뷰로 센다.
// 여기서 또 보내면 같은 이동이 두 번 잡힌다 — 이동이 잦은 화면일수록 어긋난다.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function GoogleAnalytics() {
  // 로컬(next dev)에서는 붙이지 않는다. `vercel env pull` 로 환경변수를 받아오면
  // 측정 ID 도 같이 딸려오는데, 개발하면서 누른 클릭이 실제 지표에 섞이면
  // 사람 수를 셀 수 없게 된다.
  if (!GA_ID || process.env.NODE_ENV !== "production") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      {/*
        인라인 스크립트에는 id 가 필요하다 — next/script 가 이 값으로 중복 실행을 막는다.
        측정 ID 는 JSON.stringify 로 감싼다. 환경변수라 따옴표가 들어올 일은 거의 없지만,
        문자열을 그대로 이어 붙이는 자리는 한 번 어긋나면 스크립트 전체가 깨진다.
      */}
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(GA_ID)});`}
      </Script>
    </>
  );
}
