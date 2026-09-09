import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ⚠️ 서버 전용. ENCRYPTION_KEY 를 읽으므로 클라이언트에서 import 하면 안 된다.
//
// 사용자 API 키·GitHub 토큰은 평문으로 두지 않는다(AGENTS.md). DB 가 통째로
// 새도 이 값들만은 못 읽게 하려는 것이라, 열쇠는 DB 밖(환경변수)에 둔다.
//
// AES-256-GCM 을 쓰는 이유: CBC 같은 모드는 암호문을 조작해도 복호화가 그냥
// 되기 때문에 별도 MAC 을 붙여야 한다. GCM 은 authTag 로 위조 검사까지 같이
// 해줘서 실수할 여지가 적다.

const ALGORITHM = "aes-256-gcm";
/** GCM 표준 권장 길이. 12바이트를 벗어나면 내부적으로 한 번 더 해싱해 느려진다. */
const IV_BYTES = 12;
/** 열쇠를 갈아끼울 때 옛 암호문을 알아보려고 붙인다. 지금은 v1 하나뿐. */
const VERSION = "v1";

function encryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY 가 없습니다. .env.example 참고.");

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY 는 base64 로 인코딩한 32바이트여야 합니다. .env.example 참고.");
  }
  return key;
}

/**
 * 저장용 문자열 하나로 묶어서 돌려준다: `v1.<iv>.<authTag>.<암호문>` (각 base64).
 *
 * 컬럼을 4개로 쪼개지 않는 이유: 세 조각은 항상 같이 쓰이고 따로 조회할 일이
 * 없다. 한 컬럼이면 스키마를 안 건드리고 형식을 바꿀 수 있다(그래서 버전 접두).
 */
export function encryptSecret(plaintext: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    body.toString("base64"),
  ].join(".");
}

/** encryptSecret 의 역. 값이 변조됐으면 복호화가 실패하며 throw 한다. */
export function decryptSecret(payload: string) {
  const [version, iv, authTag, body] = payload.split(".");
  if (version !== VERSION || !iv || !authTag || !body) {
    throw new Error("암호문 형식이 올바르지 않습니다.");
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString(
    "utf8"
  );
}
