import { describe, expect, it } from "vitest";
import {
  InvalidDrawError,
  assertValidAssignments,
  createAssignments,
  fisherYatesShuffle,
} from "@/server/draw/derangement";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i + 1}`);

function expectValid(participants: string[], result: { giver: string; receiver: string }[]) {
  expect(result).toHaveLength(participants.length);
  // ninguém tira a si próprio
  for (const a of result) expect(a.receiver).not.toBe(a.giver);
  // cada participante tira exatamente uma pessoa
  expect(new Set(result.map((a) => a.giver))).toEqual(new Set(participants));
  // cada participante é sorteado exatamente uma vez
  const receivers = result.map((a) => a.receiver);
  expect(new Set(receivers).size).toBe(participants.length);
  expect(new Set(receivers)).toEqual(new Set(participants));
}

describe("algoritmo do sorteio", () => {
  for (const n of [2, 3, 10, 50]) {
    it(`gera atribuição válida com ${n} participantes (500 execuções)`, () => {
      const participants = ids(n);
      for (let run = 0; run < 500; run++) {
        expectValid(participants, createAssignments(participants));
      }
    });
  }

  it("com 2 participantes, um tira o outro", () => {
    const result = createAssignments(["a", "b"]);
    expect(result).toEqual([
      { giver: "a", receiver: "b" },
      { giver: "b", receiver: "a" },
    ]);
  });

  it("recusa menos de 2 participantes", () => {
    expect(() => createAssignments([])).toThrow(InvalidDrawError);
    expect(() => createAssignments(["so-eu"])).toThrow(InvalidDrawError);
  });

  it("recusa participantes duplicados", () => {
    expect(() => createAssignments(["a", "b", "a"])).toThrow(/duplicados/);
  });

  it("é aleatório: com 3 pessoas aparecem as 2 atribuições possíveis em proporções parecidas", () => {
    const counts = new Map<string, number>();
    const runs = 4000;
    for (let i = 0; i < runs; i++) {
      const key = createAssignments(["a", "b", "c"]).map((x) => x.receiver).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Derangements de 3: "bca" e "cab"
    expect([...counts.keys()].sort()).toEqual(["bca", "cab"]);
    for (const c of counts.values()) {
      expect(c / runs).toBeGreaterThan(0.45);
      expect(c / runs).toBeLessThan(0.55);
    }
  });

  it("uniforme entre as 9 atribuições válidas de 4 pessoas", () => {
    const counts = new Map<string, number>();
    const runs = 18000;
    for (let i = 0; i < runs; i++) {
      const key = createAssignments(["a", "b", "c", "d"]).map((x) => x.receiver).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(9);
    for (const c of counts.values()) {
      expect(c / runs).toBeGreaterThan(1 / 9 - 0.02);
      expect(c / runs).toBeLessThan(1 / 9 + 0.02);
    }
  });

  it("usa o fallback (Sattolo) e continua válido mesmo com RNG adversarial", () => {
    // RNG que sempre devolve o maior índice: o Fisher-Yates nunca troca nada (identidade = todos
    // tirariam a si mesmos), então todas as tentativas são rejeitadas e o Sattolo assume.
    const participants = ids(5);
    const result = createAssignments(participants, (max) => max - 1, 5);
    expectValid(participants, result);
  });

  it("Fisher-Yates preserva todos os elementos", () => {
    const list = ids(30);
    const shuffled = fisherYatesShuffle(list);
    expect([...shuffled].sort()).toEqual([...list].sort());
  });

  it("validador detecta atribuições inválidas", () => {
    expect(() => assertValidAssignments(["a", "b"], [{ giver: "a", receiver: "a" }, { giver: "b", receiver: "b" }])).toThrow();
    expect(() => assertValidAssignments(["a", "b", "c"], [
      { giver: "a", receiver: "b" },
      { giver: "b", receiver: "a" },
      { giver: "c", receiver: "a" },
    ])).toThrow(/mais de uma vez/);
    expect(() => assertValidAssignments(["a", "b", "c"], [
      { giver: "a", receiver: "b" },
      { giver: "b", receiver: "a" },
    ])).toThrow(/Nem todos/);
  });
});
