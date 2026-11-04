import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

/**
 * Hash de senha com scrypt (nativo do Node, resistente a força bruta por GPU).
 * Formato guardado: scrypt$N$r$p$salt$hash (base64). A senha em texto nunca é gravada.
 * Sem "server-only" de propósito: os testes E2E usam este módulo para semear contas.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, n = N, r = R, p = P, keylen = KEYLEN): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize("NFKC"), salt, keylen, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await derive(password, Buffer.from(saltB64, "base64"), Number(n), Number(r), Number(p), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | null = null;
/**
 * Gasta o mesmo tempo de uma verificação real quando o e-mail não existe,
 * para o tempo de resposta não revelar quais e-mails têm conta.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= hashPassword("senha-ficticia-para-igualar-tempo");
  await verifyPassword(password, await dummy);
}
