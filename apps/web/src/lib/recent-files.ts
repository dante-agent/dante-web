// Explorer 빈 상태의 "최근 본 파일". projectRef 별 localStorage, MRU 최대 6.
// localStorage 는 프라이빗 모드·차단 등에서 throw 하므로 전부 try/catch.

const MAX = 6;
const key = (projectRef: string) => `dante:recent:${projectRef}`;

export function getRecent(projectRef: string): string[] {
  try {
    const raw = localStorage.getItem(key(projectRef));
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecent(projectRef: string, path: string): void {
  try {
    const next = [path, ...getRecent(projectRef).filter((p) => p !== path)].slice(0, MAX);
    localStorage.setItem(key(projectRef), JSON.stringify(next));
  } catch {
    /* 무시 */
  }
}

export function clearRecent(projectRef: string): void {
  try {
    localStorage.removeItem(key(projectRef));
  } catch {
    /* 무시 */
  }
}
