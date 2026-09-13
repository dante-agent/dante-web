import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, safeNext } from "@/lib/auth/redirect";

// 로그인 없이 볼 수 있는 경로(하위 경로 포함).
// /auth/* 는 OAuth 콜백이라 반드시 열어둬야 한다 — 막으면 로그인 자체가 불가능하다.
const PUBLIC_PREFIXES = ["/auth", "/terms", "/privacy"];

function isPublic(pathname: string) {
  if (pathname === LOGIN_PATH) return true;
  return PUBLIC_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// 공개 경로 중 세션과 아예 무관한 것. /auth 는 로그인 흐름이라 빼면 안 된다.
const STATIC_PUBLIC = ["/terms", "/privacy"];

function isStaticPublic(pathname: string) {
  return STATIC_PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// 매 요청에서 Supabase 세션 쿠키를 갱신한다. src/proxy.ts에서 호출.
export async function updateSession(request: NextRequest) {
  // 약관·개인정보 화면은 로그인 여부로 달라지는 게 없다. 세션을 볼 이유가 없으니 바로 넘긴다.
  if (isStaticPublic(request.nextUrl.pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims()를 호출해야 만료 토큰이 갱신된다. 이 줄과 createServerClient 사이에 로직 넣지 말 것.
  //
  // getUser() 가 아니라 getClaims() 인 이유: getUser() 는 요청마다 Supabase Auth 서버에
  // 왕복한다. getClaims() 는 JWT 서명을 프로젝트 공개키로 여기서 검증하고, 토큰이
  // 만료됐을 때만 갱신하러 나간다. (대칭키(HS256) 프로젝트면 알아서 getUser() 로 떨어진다.)
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname, search } = request.nextUrl;

  // 비로그인 → 로그인 화면. 원래 가려던 곳을 ?next 로 넘겨 로그인 후 되돌려보낸다.
  //
  // GET(문서 요청)에만 건다. 서버 액션은 POST 로 오는데 여기서 307 을 돌려주면
  // 브라우저가 따라가 HTML 을 받고, React 는 액션 응답을 기대했으므로
  // "An unexpected response was received from the server" 로 터진다.
  // 액션 쪽 인증은 각 액션이 부르는 requireUser() 가 맡는다 — 거기서 redirect()
  // 하면 Next 가 클라이언트가 이해하는 형태로 내려준다.
  if (request.method === "GET" && !user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectPreservingCookies(url, response);
  }

  // 이미 로그인했는데 로그인 화면으로 오면 ?next 가 있으면 그쪽, 없으면 대시보드로 보낸다.
  // next 를 버리면 안 된다 — 익스텐션이 연 /auth/extension?state=… 링크가 비로그인이라
  // /?next=… 로 밀려났다가, 다른 탭에서 로그인한 뒤 돌아오면 /projects 로 튕겨 익스텐션 로그인이 끊긴다.
  // safeNext 가 외부 URL 을 걸러주고, next 에 붙은 쿼리는 URL 로 풀어 pathname·search 를 따로 옮긴다.
  if (user && pathname === LOGIN_PATH) {
    const next = new URL(
      safeNext(request.nextUrl.searchParams.get("next")),
      request.nextUrl.origin
    );
    const url = request.nextUrl.clone();
    url.pathname = next.pathname;
    url.search = ""; // 원래 붙어 있던 ?next=… 는 떼고
    url.search = next.search; // next 안에 들어 있던 쿼리(state, code_challenge…)만 싣는다
    return redirectPreservingCookies(url, response);
  }

  return response;
}

// 위에서 만든 response 에는 갱신된 세션 쿠키가 들어 있을 수 있다.
// 리다이렉트 응답을 새로 만들면 그 쿠키가 통째로 사라져 다음 요청에서 다시 로그아웃 취급된다.
// 그래서 쿠키만 옮겨 실어준다.
function redirectPreservingCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
