"use client";

import { useEffect } from "react";
import { CircleCheck } from "lucide-react";

// 프로젝트를 지운 직후 목록 위에 한 번 뜨는 안내.
//
// 토스트 기반이 없고 새 의존성은 사람 승인이 필요해서(AGENTS.md) 쿼리 파라미터로
// 넘긴다. 삭제 액션이 /projects?deleted=<설치 ID> 로 보내고, 목록 페이지가 그 ID 를
// DB 에서 다시 읽어 이 컴포넌트에 넘긴다.
//
// 할 말은 하나다: 프로젝트는 지웠지만 GitHub App 은 아직 설치돼 있다. 설치는 일부러
// 남긴다(settings/general/actions.ts). 사용자가 "다 끊겼다"고 믿고 떠나면 안 되니
// 완전히 끊는 곳을 같이 알려준다.
export function DeletedNotice({
  installation,
}: {
  /** null = 설치가 이미 GitHub 에서 지워졌다. 끊으라고 안내할 것이 없다. */
  installation: { accountLogin: string; settingsUrl: string } | null;
}) {
  // "한 번"을 지키려고 그린 직후 주소창에서 ?deleted 를 걷어낸다. 남겨 두면
  // 새로고침할 때마다 다시 떠서 "또 지워졌나"로 읽힌다.
  //
  // router.replace 가 아니라 history.replaceState 인 이유: router 는 서버에 다시
  // 요청하고, 그러면 방금 그린 이 안내가 곧바로 사라진다. Next 는 네이티브
  // replaceState 를 라우터 상태와 맞춰 준다.
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    // role="status": 사용자가 방금 한 행동의 결과라 스크린리더가 읽어야 한다.
    <section role="status" className="border-border bg-card mb-6 border p-5">
      <div className="flex gap-3.5">
        <CircleCheck className="text-brand-mint mt-0.5 size-4 shrink-0" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {/* 제목 태그를 쓰지 않는다 — 페이지 h1(Projects)보다 앞에 놓여 헤딩 순서가 뒤집힌다. */}
          <p className="text-[15px] leading-snug font-medium">Project deleted</p>

          {installation ? (
            <>
              <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
                The Dante GitHub App is still installed on @{installation.accountLogin}, so you can
                connect a repository again without reinstalling. To cut Dante off completely,
                uninstall it on GitHub.
              </p>
              {/* 새 탭: GitHub 에서 지우고 돌아올 자리가 남아 있어야 한다. */}
              <a
                href={installation.settingsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-muted-foreground hover:text-foreground mt-4 inline-block font-mono text-[11px] tracking-wide transition-colors duration-[180ms] ease-out"
              >
                MANAGE ON GITHUB <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </>
          ) : (
            <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">
              Everything Dante stored for it is gone.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
