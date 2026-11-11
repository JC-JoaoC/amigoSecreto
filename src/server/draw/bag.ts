import { type RandomInt, secureRandomInt } from "./derangement";

/**
 * Regra do sorteio do saco (pura, sem banco, fácil de testar).
 *
 * Tira um nome por vez, com crypto.randomInt. Quem sobra sozinho no saco é o vencedor,
 * então só dá para tirar enquanto houver pelo menos 2 nomes.
 * `reserved` (opcional) é quem o organizador marcou para ficar por último: nunca sai
 * enquanto houver outro nome no saco. Se não estiver mais no saco, é ignorado.
 */
export function pickNextFromBag(
  remaining: readonly string[],
  reserved: string | null = null,
  rand: RandomInt = secureRandomInt,
): string {
  if (remaining.length < 2) {
    throw new Error("O saco precisa de pelo menos 2 nomes para tirar um.");
  }
  const candidates = reserved && remaining.includes(reserved) ? remaining.filter((id) => id !== reserved) : remaining;
  const picked = candidates[rand(candidates.length)];
  if (picked === undefined) throw new Error("Falha ao escolher o próximo nome.");
  return picked;
}
