import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { env } from "./env";

/**
 * Toda a criptografia da aplicação passa por aqui.
 * Uma única APP_SECRET gera chaves independentes por finalidade (HKDF),
 * então vazar o hash de um código não ajuda a decifrar resultados, e vice-versa.
 */
type KeyPurpose =
  | "login-code"
  | "draw-receiver-hash"
  | "draw-receiver-cipher"
  | "draw-message-cipher"
  | "rate-limit";

type CipherPurpose = "draw-receiver-cipher" | "draw-message-cipher";

const keyCache = new Map<KeyPurpose, Buffer>();

function key(purpose: KeyPurpose): Buffer {
  let k = keyCache.get(purpose);
  if (!k) {
    k = Buffer.from(hkdfSync("sha256", env().APP_SECRET, "laco-amigo-secreto", purpose, 32));
    keyCache.set(purpose, k);
  }
  return k;
}

export function hmac(purpose: KeyPurpose, value: string): string {
  return createHmac("sha256", key(purpose)).update(value).digest("hex");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Comparação em tempo constante de dois hashes hex. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Código numérico de 6 dígitos com aleatoriedade criptográfica. */
export function generateLoginCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Token de sessão: 256 bits aleatórios. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * AES-256-GCM. O "aad" amarra o texto cifrado ao registro (sorteio + participante):
 * copiar o valor cifrado de uma linha para outra faz a decifragem falhar.
 */
export function encrypt(plaintext: string, aad: string, purpose: CipherPurpose = "draw-receiver-cipher"): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function decrypt(payload: string, aad: string, purpose: CipherPurpose = "draw-receiver-cipher"): string {
  if (!payload.startsWith("v1.")) throw new Error("Formato de cifra desconhecido");
  const raw = Buffer.from(payload.slice(3), "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(purpose), iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
