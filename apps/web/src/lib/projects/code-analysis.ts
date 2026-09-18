// 소스 코드에서 "테스트가 급한 정도"를 가늠할 신호를 뽑는다. 순수 함수다.
//
// 파서(ts-morph)를 쓰지 않는 이유: 레포 전체(수천 파일)를 요청 안에서 훑어야 해서 AST 를 만들면
// 너무 무겁다. 여기서 필요한 건 정확한 구문이 아니라 대략의 크기다 — 분기가 몇 개인지,
// 누가 이 파일을 import 하는지. 그래서 주석·문자열만 걷어내고 정규식으로 센다.

/** 한 파일에서 뽑은 신호. */
export type CodeStats = {
  /** 주석·빈 줄을 뺀 줄 수. */
  lines: number;
  /** if·case·catch·for·while·&&·||·??·삼항 개수. 테스트 케이스가 몇 개 필요할지의 대리값. */
  branches: number;
  /** 함수나 분기가 하나라도 있는지. 없으면 타입·상수만 있는 파일이다. */
  hasLogic: boolean;
  /** 다른 모듈을 다시 내보내기만 하는 파일(index.ts 배럴). */
  barrel: boolean;
};

const REGEX_PRECEDER = new Set([
  "",
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  "}",
  ";",
  "+",
  "-",
  "*",
  "%",
  "<",
  ">",
  "~",
  "^",
]);

/**
 * 주석을 지우고, strings 가 "blank" 면 문자열·정규식 리터럴 내용도 지운다(따옴표는 남긴다).
 * 줄바꿈은 그대로 둬서 줄 수가 유지된다.
 *
 * 템플릿 리터럴의 `${}` 안은 문자열로 취급한다 — 그 안의 분기는 세지 않는다(드물고, 틀려도 작다).
 */
export function stripCode(src: string, strings: "keep" | "blank"): string {
  let out = "";
  let i = 0;
  let last = "";
  const n = src.length;

  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && src[j] !== ch) {
        if (src[j] === "\\") j++;
        else if (ch !== "`" && src[j] === "\n") break;
        j++;
      }
      const body = src.slice(i + 1, j);
      out += ch + (strings === "keep" ? body : body.replace(/[^\n]/g, "")) + ch;
      i = j + 1;
      last = ch;
      continue;
    }
    // 정규식 리터럴 안의 따옴표가 문자열로 읽히지 않게 통째로 건너뛴다.
    if (ch === "/" && REGEX_PRECEDER.has(last)) {
      let j = i + 1;
      let inClass = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") j++;
        else if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        else if (src[j] === "/" && !inClass) break;
        j++;
      }
      if (j < n && src[j] === "/") {
        j++;
        while (j < n && /[a-z]/i.test(src[j])) j++;
        out += strings === "keep" ? src.slice(i, j) : "/ /";
        i = j;
        last = "/";
        continue;
      }
    }

    out += ch;
    if (!/\s/.test(ch)) last = ch;
    i++;
  }
  return out;
}

const BRANCH_RE = /\b(?:if|for|while|case|catch)\b|&&|\|\||\?\?|\s\?\s/g;
// 타입 선언 안의 `=>`(함수 타입)가 로직으로 세지지 않게 먼저 걷어낸다. 중첩 중괄호는 놓친다.
const TYPE_DECL_RE =
  /\b(?:export\s+)?(?:declare\s+)?(?:type\s+\w+[^=;]*=[^;]*;|interface\s+\w+[^{]*\{[^}]*\})/g;
const LOGIC_RE = /\bfunction\b|=>|\bclass\b/;
const REEXPORT_RE =
  /\b(?:import|export)\b[^;]*?\bfrom\s*["'][^"']*["']\s*;?|\bimport\s*["'][^"']*["']\s*;?/g;

export function analyzeSource(src: string): CodeStats {
  const code = stripCode(src, "blank");
  const lines = code.split("\n").filter((line) => line.trim() !== "").length;
  const branches = (code.match(BRANCH_RE) ?? []).length;
  const hasLogic = branches > 0 || LOGIC_RE.test(code.replace(TYPE_DECL_RE, ""));
  const rest = code.replace(REEXPORT_RE, "").replace(/[\s;]/g, "");
  const barrel = lines > 0 && rest === "";
  return { lines, branches, hasLogic, barrel };
}

const IMPORT_RES = [
  /\b(?:import|export)\s[^;]*?\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
];

/** import·export from·동적 import·require 의 모듈 지정자. 주석 안의 것은 빼고 센다. */
export function parseImports(src: string): string[] {
  const code = stripCode(src, "keep");
  const specs = new Set<string>();
  for (const re of IMPORT_RES) {
    for (const match of code.matchAll(re)) specs.add(match[1]);
  }
  return [...specs];
}

// ── 모듈 해석 ─────────────────────────────────────────────────────────────

const EXTS = ["ts", "tsx", "js", "jsx", "mjs", "cjs"];

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

/** "a/b" + "../c/./d" → "a/c/d". 루트 위로 나가면 null. */
export function joinPath(base: string, rel: string): string | null {
  const parts = base ? base.split("/") : [];
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join("/");
}

/** tsconfig 는 주석·끝 쉼표를 허용한다. 못 읽으면 null. */
export function parseLooseJson(text: string): unknown {
  try {
    return JSON.parse(stripCode(text, "keep").replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return null;
  }
}

type AliasRule = { prefix: string; wildcard: boolean; targets: string[] };
type AliasScope = { dir: string; rules: AliasRule[] };

/** tsconfig 의 compilerOptions.paths 를 레포 루트 기준 규칙으로. extends 는 따라가지 않는다. */
function aliasScope(tsconfigPath: string, text: string): AliasScope | null {
  const json = parseLooseJson(text) as {
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  } | null;
  const paths = json?.compilerOptions?.paths;
  if (!paths || typeof paths !== "object") return null;

  const dir = dirname(tsconfigPath);
  const base = joinPath(dir, json.compilerOptions?.baseUrl ?? ".") ?? dir;
  const rules: AliasRule[] = [];
  for (const [key, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets)) continue;
    const wildcard = key.endsWith("*");
    rules.push({
      prefix: wildcard ? key.slice(0, -1) : key,
      wildcard,
      targets: targets
        .filter((t): t is string => typeof t === "string")
        .map((t) => joinPath(base, wildcard ? t.replace(/\*$/, "") : t) ?? "")
        .filter(Boolean),
    });
  }
  // 긴 접두사가 먼저 — "@/lib/*" 가 "@/*" 보다 우선.
  rules.sort((a, b) => b.prefix.length - a.prefix.length);
  return { dir, rules };
}

/**
 * import 지정자를 레포 안의 소스 경로로 바꾸는 함수를 만든다.
 * 상대 경로와 tsconfig paths 별칭만 푼다. 패키지(react, @scope/pkg)는 null.
 */
export function createResolver(
  files: ReadonlySet<string>,
  tsconfigs: ReadonlyMap<string, string>
): (importer: string, spec: string) => string | null {
  const scopes = [...tsconfigs]
    .map(([path, text]) => aliasScope(path, text))
    .filter((s): s is AliasScope => s !== null)
    // 깊은 폴더가 먼저 — 가장 가까운 tsconfig 가 이긴다.
    .sort((a, b) => b.dir.length - a.dir.length);

  function probe(base: string): string | null {
    if (files.has(base)) return base;
    // ESM 스타일로 "./foo.js" 라고 쓰고 실제 파일은 foo.ts 인 경우.
    const noExt = base.replace(/\.(?:[cm]?jsx?)$/, "");
    for (const ext of EXTS) if (files.has(`${noExt}.${ext}`)) return `${noExt}.${ext}`;
    for (const ext of EXTS) if (files.has(`${base}/index.${ext}`)) return `${base}/index.${ext}`;
    return null;
  }

  return (importer, spec) => {
    if (spec.startsWith(".")) {
      const base = joinPath(dirname(importer), spec);
      return base === null ? null : probe(base);
    }
    const scope = scopes.find((s) => s.dir === "" || importer.startsWith(`${s.dir}/`));
    if (!scope) return null;
    for (const rule of scope.rules) {
      if (rule.wildcard ? !spec.startsWith(rule.prefix) : spec !== rule.prefix) continue;
      const rest = rule.wildcard ? spec.slice(rule.prefix.length) : "";
      for (const target of rule.targets) {
        const hit = probe(rule.wildcard ? (joinPath(target, rest) ?? "") : target);
        if (hit) return hit;
      }
    }
    return null;
  };
}

export type RepoAnalysis = Record<string, CodeStats & { fanIn: number }>;

/**
 * 소스 전체를 분석한다. fanIn = 이 파일을 import 하는 (자기 자신이 아닌) 소스 파일 수.
 * sources 에는 테스트 파일을 넣지 않는다 — 테스트가 import 하는 건 "쓰임"이 아니다.
 */
export function analyzeRepo(
  sources: ReadonlyMap<string, string>,
  tsconfigs: ReadonlyMap<string, string>
): RepoAnalysis {
  const resolve = createResolver(new Set(sources.keys()), tsconfigs);
  const importers = new Map<string, Set<string>>();

  for (const [path, src] of sources) {
    for (const spec of parseImports(src)) {
      const target = resolve(path, spec);
      if (!target || target === path) continue;
      let set = importers.get(target);
      if (!set) importers.set(target, (set = new Set()));
      set.add(path);
    }
  }

  const result: RepoAnalysis = {};
  for (const [path, src] of sources) {
    result[path] = { ...analyzeSource(src), fanIn: importers.get(path)?.size ?? 0 };
  }
  return result;
}
