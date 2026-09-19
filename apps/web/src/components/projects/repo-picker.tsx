"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Lock, Search } from "lucide-react";
import { importRepo } from "@/app/projects/(onboarding)/new/github/actions";
import { useAnnounce } from "@/components/live-announcer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectFieldLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InstallationRepo } from "@/lib/github/repos";

// 설치가 열어준 레포 목록.
//
// 행 전체가 하나의 클릭 대상이다 (행 안의 Import 버튼을 없앴다). "선택 → 하단
// 버튼" 2단계보다 클릭이 하나 적고, 어떤 레포를 고른 상태인지 기억할 필요가 없다.
// 작은 버튼 하나보다 행 전체가 과녁이면 조준할 필요도 없다.
//
// 생김새는 CodeRabbit 기준 — 각진 테두리(radius 0), 행 사이는 헤어라인,
// 기술적인 메타데이터는 Hack mono (DESIGN.md §3).
//
// bigint 는 서버 컴포넌트에서 클라이언트로 넘길 때 직렬화되지 않는다.
// 그래서 설치 ID·프로젝트 ref 는 문자열 맵으로 받는다.
export function RepoPicker({
  repos,
  refByRepoId,
  installationIdByRepoId,
  settingsUrlByInstallationId,
  initialOwner = "",
}: {
  repos: InstallationRepo[];
  refByRepoId: Record<string, string>;
  installationIdByRepoId: Record<string, string>;
  /** 설치 ID → 그 설치의 GitHub 설정 화면. 계정마다 URL 이 다르다. */
  settingsUrlByInstallationId: Record<string, string>;
  /** 방금 설치를 끝내고 돌아온 계정. 목록에 없으면 무시한다. */
  initialOwner?: string;
}) {
  const [owner, setOwner] = useState<string>(initialOwner);
  const [query, setQuery] = useState("");

  // 설치가 여러 계정(개인 + 조직)에 걸쳐 있을 수 있다.
  const owners = useMemo(() => [...new Set(repos.map((repo) => repo.owner))].sort(), [repos]);
  // 고른 계정이 목록에 없을 수 있다 — 레포를 하나도 안 열어준 설치가 그렇다.
  const activeOwner = owners.includes(owner) ? owner : (owners[0] ?? "");

  // 지금 보고 있는 계정의 레포에서 설치 ID 를 되짚는다. 계정 이름으로 맞추지
  // 않는 이유는 GitHub 이 주는 두 값(레포의 owner.login, 설치의 account.login)의
  // 대소문자가 어긋날 수 있어서다.
  const settingsUrl = useMemo(() => {
    const repo = repos.find((item) => item.owner === activeOwner);
    const installationId = repo ? installationIdByRepoId[String(repo.id)] : undefined;
    return (
      (installationId ? settingsUrlByInstallationId[installationId] : undefined) ??
      Object.values(settingsUrlByInstallationId)[0] ??
      ""
    );
  }, [repos, activeOwner, installationIdByRepoId, settingsUrlByInstallationId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return repos.filter(
      (repo) => repo.owner === activeOwner && (!needle || repo.name.toLowerCase().includes(needle))
    );
  }, [repos, activeOwner, query]);

  return (
    <>
      <div className="flex gap-2">
        {/* 네이티브 <select> 를 쓰다가 교체했다. appearance:auto 면 브라우저가
            화살표를 직접 그리면서 좌우 여백이 어긋나고, 열었을 때 팝업 위치도
            OS 가 정해서 CSS 로 못 맞춘다. 옆의 검색 입력과 글꼴·배경도 달랐다. */}
        <Select value={activeOwner} onValueChange={(value) => setOwner(String(value))}>
          <SelectFieldLabel className="sr-only">GitHub account</SelectFieldLabel>
          {/* SelectTrigger 의 기본 클래스에 data-[size=default]:h-8 이 들어 있어
              h-9 만으로는 안 먹는다(선택자가 달라 tailwind-merge 가 못 합친다).
              옆 검색 입력과 높이를 맞추려면 같은 선택자로 덮어야 한다. */}
          <SelectTrigger className="shrink-0 rounded-[4px] data-[size=default]:h-9">
            <SelectValue />
          </SelectTrigger>
          {/* alignItemWithTrigger 기본값(true)은 선택 항목을 트리거 위에 겹쳐
              띄운다(macOS 네이티브 방식). 트리거를 가리고 옆 입력까지 넘어와서
              아래로 펼치도록 끈다. */}
          <SelectContent alignItemWithTrigger={false} align="start" sideOffset={6}>
            {owners.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search repositories"
            aria-label="Search repositories"
            className="bg-card h-9 rounded-[4px] pl-9 text-sm md:text-sm"
          />
        </div>
      </div>

      <ul className="border-border divide-border bg-card mt-3 divide-y border">
        {visible.map((repo) => (
          <RepoRow
            key={repo.id}
            repo={repo}
            projectRef={refByRepoId[String(repo.id)]}
            installationId={installationIdByRepoId[String(repo.id)]}
          />
        ))}
        {visible.length === 0 && (
          <li className="text-muted-foreground px-6 py-16 text-center text-[15px]">
            {repos.length === 0
              ? "No repositories were opened during install. Add one below."
              : `No repositories match "${query}"`}
          </li>
        )}
      </ul>

      {/* "안 보여요" 두 케이스: 이 설치에 레포 더 열기 / 다른 org·계정에 App 설치.
          라벨 길이가 달라서 그냥 두면 두 링크의 시작점이 어긋난다. grid 의 auto
          칸은 넓은 라벨에 맞춰지니 ch 단위 폭을 손으로 재지 않아도 세로로 떨어진다
          (tracking-wide 가 붙은 mono 라 글자 수로 계산해도 안 맞는다). */}
      <dl className="text-muted-foreground mt-4 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 font-mono text-[11px] tracking-wide">
        {/* 설치가 하나도 없으면 RepoPicker 자체가 안 그려지지만, 설정 URL 이 빈
            문자열로 떨어지면 href="" 는 이 페이지를 다시 여는 죽은 링크가 된다. */}
        {settingsUrl && (
          <>
            <dt>Missing a repository?</dt>
            <dd>
              <a
                href={settingsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={footerLink}
              >
                Add one on GitHub ↗
              </a>
            </dd>
          </>
        )}
        <dt>Missing an organization?</dt>
        <dd>
          {/* ↗ 를 달지 않는다. 새 탭이 아니라 이 탭에서 /api/github/install 로
              가야 한다 — 서버가 state 쿠키를 심고 GitHub 로 넘긴다. */}
          <a href="/api/github/install" className={footerLink}>
            Add another organization
          </a>
        </dd>
      </dl>
    </>
  );
}

// 목록 아래 두 링크. 쉬는 상태는 밝게(주변 라벨이 muted 라 링크만 떠 보인다),
// hover·키보드 포커스에는 행의 액센트와 같은 주황을 쓴다 — 같은 화면에서 두
// 가지 강조색을 쓰지 않는다.
const footerLink =
  "text-foreground underline underline-offset-4 transition-colors duration-[180ms] ease-out hover:text-[#ff570a] focus-visible:text-[#ff570a] focus-visible:outline-none motion-reduce:transition-none";

function RepoRow({
  repo,
  projectRef,
  installationId,
}: {
  repo: InstallationRepo;
  projectRef?: string;
  installationId?: string;
}) {
  // 클릭 대상은 행을 덮는 투명한 레이어다. 이름·메타를 버튼 안에 넣는 방법도
  // 있지만 <button> 은 블록 요소를 담을 수 없고(p 두 줄이 들어간다), 서버 액션
  // 폼도 그대로 써야 한다. 레이어를 콘텐츠 다음에 두면 위로 얹혀서 텍스트를
  // 눌러도 이 레이어가 받는다 — 행 안에 다른 클릭 대상은 없다.
  const overlay = "absolute inset-0 cursor-pointer outline-none disabled:cursor-not-allowed";

  return (
    <li className="group hover:bg-muted/30 has-[:focus-visible]:bg-muted/30 relative flex items-center gap-4 px-6 py-4 transition-colors duration-[180ms] ease-out has-[:focus-visible]:inset-ring-2 has-[:focus-visible]:inset-ring-[#ff570a]/40">
      {/* 왼쪽 액센트 바. 세로로 펼쳐지며 들어온다 — CodeRabbit 활성 표시와 같은 장치.
          420ms expo-out 은 칸 확장용이고, 이런 작은 요소는 180ms 가 맞다. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-0.5 origin-center scale-y-0 bg-[#ff570a] transition-transform duration-[180ms] ease-out group-hover:scale-y-100 group-has-[:focus-visible]:scale-y-100 motion-reduce:transition-none"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[15px] font-medium">
          {repo.name}
          {repo.private && <Lock className="text-muted-foreground size-3 shrink-0" />}
        </p>
        <p className="text-muted-foreground mt-1 font-mono text-[11px] tracking-wide">
          {repo.language ?? "—"}
          {repo.pushedAt && ` · ${formatDistanceToNow(repo.pushedAt, { addSuffix: true })}`}
        </p>
      </div>

      {projectRef && (
        <span className="text-brand-mint font-mono text-[10px] font-bold tracking-[0.12em]">
          CONNECTED
        </span>
      )}

      {/* 버튼이 없어진 자리. 행이 눌리는 곳임을 알려주는 유일한 힌트라서 hover
          뿐 아니라 키보드 포커스에도 같이 나온다. */}
      <ArrowRight
        aria-hidden="true"
        className="text-muted-foreground size-4 shrink-0 -translate-x-1 opacity-0 transition-all duration-[180ms] ease-out group-hover:translate-x-0 group-hover:opacity-100 group-has-[:disabled]:hidden group-has-[:focus-visible]:translate-x-0 group-has-[:focus-visible]:opacity-100 motion-reduce:transition-none"
      />

      {projectRef ? (
        <Link href={`/project/${projectRef}/dashboard`} className={overlay}>
          <span className="sr-only">Open {repo.name}</span>
        </Link>
      ) : (
        // 서버 액션. 폼으로 보내야 CSRF 보호가 자동으로 걸리고 JS 없이도 동작한다.
        <form action={importRepo} className="absolute inset-0">
          <input type="hidden" name="repoId" value={repo.id} />
          <input type="hidden" name="installationId" value={installationId ?? ""} />
          <ImportButton name={repo.name} className={overlay} disabled={!installationId} />
        </form>
      )}
    </li>
  );
}

/**
 * 줄 전체를 덮는 가져오기 버튼. 보내는 동안 막되 disabled 대신 aria-disabled 로 막는다 —
 * disabled 가 되면 방금 누른 버튼이 포커스를 잃는다. 보내는 중이라는 것은 공용 알림으로 읽는다.
 */
function ImportButton({
  name,
  className,
  disabled,
}: {
  name: string;
  className: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  useAnnounce(pending ? `Importing ${name}…` : null);
  return (
    <button
      type="submit"
      className={className}
      disabled={disabled}
      aria-disabled={pending}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <span className="sr-only">Import {name}</span>
    </button>
  );
}
