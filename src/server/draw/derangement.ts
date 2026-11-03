import { randomInt } from "node:crypto";

/**
 * Algoritmo do sorteio (puro, sem banco — fácil de testar).
 *
 * 1. Fisher-Yates com crypto.randomInt (aleatoriedade criptográfica) gera uma permutação uniforme.
 * 2. Rejeitamos permutações em que alguém tira a si mesmo e embaralhamos de novo.
 *    Resultado: distribuição uniforme entre TODAS as atribuições válidas
 *    (em média ~2,7 embaralhamentos; independe do número de pessoas).
 * 3. Rede de segurança: se, por azar extremo, passar do limite de tentativas,
 *    usamos o algoritmo de Sattolo, que sempre gera um ciclo único válido.
 * 4. O resultado é verificado antes de ser devolvido.
 */

export type RandomInt = (maxExclusive: number) => number;

export const secureRandomInt: RandomInt = (maxExclusive) => randomInt(maxExclusive);

export type Assignment = { giver: string; receiver: string };

export class InvalidDrawError extends Error {}

export function fisherYatesShuffle<T>(items: readonly T[], rand: RandomInt = secureRandomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Sattolo: gera uma permutação cíclica (nunca há ponto fixo). */
function sattoloCycle<T>(items: readonly T[], rand: RandomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rand(i); // j < i — diferença essencial em relação ao Fisher-Yates
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createAssignments(
  participantIds: readonly string[],
  rand: RandomInt = secureRandomInt,
  maxAttempts = 1000,
): Assignment[] {
  if (participantIds.length < 2) {
    throw new InvalidDrawError("São necessários pelo menos 2 participantes.");
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new InvalidDrawError("Há participantes duplicados.");
  }

  let receivers: string[] | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = fisherYatesShuffle(participantIds, rand);
    if (candidate.every((receiver, i) => receiver !== participantIds[i])) {
      receivers = candidate;
      break;
    }
  }
  receivers ??= sattoloCycle(participantIds, rand);

  const assignments = participantIds.map((giver, i) => ({ giver, receiver: receivers[i] }));
  assertValidAssignments(participantIds, assignments);
  return assignments;
}

/** Garante: cada um tira exatamente 1 pessoa, cada um é tirado exatamente 1 vez, ninguém tira a si. */
export function assertValidAssignments(participantIds: readonly string[], assignments: readonly Assignment[]): void {
  const ids = new Set(participantIds);
  const givers = new Set<string>();
  const receivers = new Set<string>();
  for (const { giver, receiver } of assignments) {
    if (!ids.has(giver) || !ids.has(receiver)) throw new InvalidDrawError("Atribuição com pessoa desconhecida.");
    if (giver === receiver) throw new InvalidDrawError("Alguém tirou a si mesmo.");
    if (givers.has(giver)) throw new InvalidDrawError("Alguém tirou mais de uma pessoa.");
    if (receivers.has(receiver)) throw new InvalidDrawError("Alguém foi tirado mais de uma vez.");
    givers.add(giver);
    receivers.add(receiver);
  }
  if (givers.size !== ids.size || receivers.size !== ids.size) {
    throw new InvalidDrawError("Nem todos os participantes receberam um amigo secreto.");
  }
}
