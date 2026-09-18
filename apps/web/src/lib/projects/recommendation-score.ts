// 테스트 없는 파일 하나에 "테스트가 급한 정도" 점수를 매긴다. 순수 함수다.
//
// 점수 = 종류 배수 × (신호마다 0~1 로 정규화한 값의 가중합)
//   - 분기 수     : 경우의 수가 많을수록 테스트 없이 깨지기 쉽다
//   - 피참조 수   : 많이 import 될수록 깨졌을 때 번지는 범위가 넓다
//   - 크기        : 로직의 양
//   - 도메인 위험 : 인증·결제·권한처럼 틀리면 크게 다치는 영역
//   - 종류 배수   : 타입·상수만 있는 파일, 배럴, 단순 UI 는 깎는다
//
// 코드를 못 읽었으면(tarball 실패·레포가 너무 큼) 경로와 파일 크기만으로 매긴다.
// 사유(reason)는 점수에 가장 크게 기여한 신호로 만든다 — 왜 이 순서인지 화면에서 보이게.

import type { CodeStats } from "./code-analysis.ts";

export type RecommendationPriority = "high" | "medium" | "low";

/** 파일 하나의 입력. code 가 없으면 경로·크기만으로 매긴다. */
export type FileSignals = {
  /** 바이트. 트리 API 가 준다. */
  size?: number;
  code?: CodeStats & { fanIn: number };
};

export type FileScore = {
  score: number;
  priority: RecommendationPriority;
  reason: string;
};

// 틀리면 크게 다치는 도메인. 경로를 단어로 쪼갠 뒤 단어 단위로 맞춘다 — "border" 가 order 로,
// "author" 가 auth 로 걸리지 않게. 복수형은 끝 s 를 떼고 한 번 더 본다.
// "session" 은 넣지 않는다 — 채팅 세션·녹화 세션처럼 인증과 무관한 뜻으로 더 자주 쓰인다.
const DOMAIN_WORDS = new Set([
  "auth",
  "authentication",
  "authorization",
  "authorize",
  "login",
  "logout",
  "signin",
  "signup",
  "password",
  "credential",
  "token",
  "jwt",
  "oauth",
  "payment",
  "checkout",
  "order",
  "billing",
  "invoice",
  "refund",
  "subscription",
  "security",
  "permission",
  "role",
  "crypto",
  "encrypt",
  "decrypt",
  "webhook",
]);

// 대체로 단순한 표현용 UI.
const UI_WORDS = new Set([
  "icon",
  "tooltip",
  "badge",
  "avatar",
  "spinner",
  "skeleton",
  "divider",
  "separator",
]);
// Next.js 의 틀 파일. 대부분 마크업만 있다.
const FRAMEWORK_FILES = new Set(["loading", "not-found", "global-error", "default"]);

/** "src/authForm/useSignIn.tsx" → ["src","auth","form","use","sign","in","signin", ...] (소문자, 인접 단어 붙인 것 포함). */
function words(segment: string): string[] {
  const parts = segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const joined = parts.slice(1).map((p, i) => parts[i] + p);
  return [...parts, ...joined];
}

function isDomainWord(word: string): boolean {
  return DOMAIN_WORDS.has(word) || (word.endsWith("s") && DOMAIN_WORDS.has(word.slice(0, -1)));
}

/** 파일 이름에서 걸리면 1, 폴더에서만 걸리면 0.7. 걸린 단어도 사유에 쓴다. */
function domainRisk(path: string): { value: number; word: string | null } {
  const segments = path.split("/");
  const file = (segments.pop() ?? "").replace(/\.[^.]+$/, "");
  const inFile = words(file).find(isDomainWord);
  if (inFile) return { value: 1, word: inFile };
  for (const dir of segments.reverse()) {
    const hit = words(dir).find(isDomainWord);
    if (hit) return { value: 0.7, word: hit };
  }
  return { value: 0, word: null };
}

function fileBase(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}

/** 종류 배수(0~1)와 깎은 이유. 1 이면 깎지 않는다. */
function kindFactor(
  path: string,
  code: FileSignals["code"]
): { factor: number; reason: string | null } {
  if (code?.barrel) return { factor: 0.1, reason: "Only re-exports other modules" };
  if (code && !code.hasLogic)
    return { factor: 0.2, reason: "No logic to test (types or constants only)" };
  const base = fileBase(path);
  if (/\.stories$/.test(base)) return { factor: 0.1, reason: "Storybook story, not app code" };
  if (FRAMEWORK_FILES.has(base)) return { factor: 0.4, reason: "Framework boilerplate file" };
  const segments = path.split("/");
  if (segments.slice(0, -1).includes("ui") || words(base).some((w) => UI_WORDS.has(w))) {
    return { factor: 0.5, reason: "Simple UI component" };
  }
  return { factor: 1, reason: null };
}

/** log 스케일로 0~1. full 에서 1 이 되고 그 이상은 1. */
function logScale(value: number, full: number): number {
  if (value <= 0) return 0;
  return Math.min(1, Math.log1p(value) / Math.log1p(full));
}

// 소스 한 줄 ≈ 30바이트. 코드를 못 읽었을 때 크기를 줄 수로 환산한다.
const BYTES_PER_LINE = 30;

const WEIGHTS_WITH_CODE = { branches: 0.35, fanIn: 0.25, size: 0.15, domain: 0.25 };
const WEIGHTS_PATH_ONLY = { branches: 0, fanIn: 0, size: 0.5, domain: 0.5 };

export const HIGH_THRESHOLD = 0.5;
export const LOW_THRESHOLD = 0.2;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function scoreFile(path: string, signals: FileSignals): FileScore {
  const { code } = signals;
  const lines = code?.lines ?? (signals.size ?? 0) / BYTES_PER_LINE;
  const domain = domainRisk(path);
  const weights = code ? WEIGHTS_WITH_CODE : WEIGHTS_PATH_ONLY;

  const parts = [
    {
      contribution: weights.fanIn * logScale(code?.fanIn ?? 0, 15),
      label: code && code.fanIn >= 2 ? `used by ${code.fanIn} files` : null,
    },
    {
      contribution: weights.branches * logScale(code?.branches ?? 0, 40),
      label: code && code.branches >= 5 ? `${code.branches} branches` : null,
    },
    {
      contribution: weights.domain * domain.value,
      label: domain.word ? `${domain.word} logic` : null,
    },
    {
      contribution: weights.size * logScale(lines, 400),
      label: code && code.lines >= 80 ? `${code.lines} lines` : null,
    },
  ];

  const kind = kindFactor(path, code);
  const raw = parts.reduce((sum, p) => sum + p.contribution, 0);
  const score = Math.round(kind.factor * raw * 1000) / 1000;

  const priority: RecommendationPriority =
    score >= HIGH_THRESHOLD ? "high" : score < LOW_THRESHOLD ? "low" : "medium";

  const labels = parts
    .filter((p) => p.label && p.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((p) => p.label as string);

  let reason: string;
  if (kind.reason) reason = kind.reason;
  else if (labels.length > 0) reason = capitalize(labels.join(", "));
  else reason = "No test file yet";

  return { score, priority, reason };
}
