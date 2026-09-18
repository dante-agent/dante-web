// tar 아카이브(압축 푼 것)에서 원하는 파일의 텍스트만 꺼낸다. 순수 함수다.
//
// GitHub tarball 을 한 번 받아 레포 전체 소스를 읽으려고 둔다(파일마다 API 를 부르면
// 큰 레포에서 레이트 리밋을 다 쓴다). 라이브러리 없이 필요한 만큼만 읽는다:
//   - ustar 헤더(name + prefix)
//   - pax 확장 헤더('x')의 path — GitHub 은 긴 경로를 여기에 넣는다
//   - GNU 긴 이름('L')
// 전역 pax 헤더('g', GitHub 은 커밋 sha 를 넣는다)와 디렉터리·링크는 건너뛴다.
//
// GitHub tarball 은 모든 경로 앞에 `{owner}-{repo}-{sha}/` 폴더가 붙는다. 첫 세그먼트를 떼서
// 레포 루트 기준 경로로 돌려준다.

const BLOCK = 512;

function readString(buf: Buffer, start: number, length: number): string {
  const slice = buf.subarray(start, start + length);
  const end = slice.indexOf(0);
  return slice.subarray(0, end === -1 ? slice.length : end).toString("utf8");
}

function readOctal(buf: Buffer, start: number, length: number): number {
  const text = readString(buf, start, length).trim();
  return text ? parseInt(text, 8) : 0;
}

/** pax 레코드("{len} key=value\n" 반복)에서 path 만. */
function paxPath(data: Buffer): string | null {
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    if (space === -1) break;
    const length = parseInt(data.subarray(offset, space).toString("utf8"), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = data.subarray(space + 1, offset + length - 1).toString("utf8");
    const eq = record.indexOf("=");
    if (eq !== -1 && record.slice(0, eq) === "path") return record.slice(eq + 1);
    offset += length;
  }
  return null;
}

function stripRootDir(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

/**
 * wanted(레포 루트 기준 경로)가 true 인 일반 파일만 텍스트로 꺼낸다.
 * 깨진 아카이브면 거기까지 읽은 것만 돌려준다 — 신호가 일부 비는 편이 추천 전체가 죽는 것보다 낫다.
 */
export function extractTextFiles(
  tar: Buffer,
  wanted: (path: string) => boolean
): Map<string, string> {
  const files = new Map<string, string>();
  let offset = 0;
  let nextPath: string | null = null;

  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    // 끝 표시는 0 으로 채운 블록 두 개다. 하나만 봐도 끝으로 친다.
    if (header.every((b) => b === 0)) break;

    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 0x30);
    const dataStart = offset + BLOCK;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) break;
    const data = tar.subarray(dataStart, dataEnd);
    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;

    if (type === "x") {
      nextPath = paxPath(data);
      continue;
    }
    if (type === "L") {
      nextPath = readString(data, 0, data.length);
      continue;
    }
    if (type === "g") continue;

    const prefix = readString(header, 345, 155);
    const name = readString(header, 0, 100);
    const fullPath = nextPath ?? (prefix ? `${prefix}/${name}` : name);
    nextPath = null;

    // "0" 과 옛 형식의 "\0"(위에서 "0" 으로 바꿈)만 일반 파일이다.
    if (type !== "0") continue;
    const path = stripRootDir(fullPath);
    if (wanted(path)) files.set(path, data.toString("utf8"));
  }

  return files;
}
