import { describe, expect, it } from "vitest";
import { pickNextFromBag } from "@/server/draw/bag";

describe("pickNextFromBag", () => {
  it("tira alguém que está no saco", () => {
    const bag = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) expect(bag).toContain(pickNextFromBag(bag));
  });

  it("nunca tira quem foi marcado para ficar por último", () => {
    const bag = ["a", "b", "c", "d"];
    for (let i = 0; i < 200; i++) expect(pickNextFromBag(bag, "c")).not.toBe("c");
  });

  it("com 2 no saco e um marcado, tira sempre o outro", () => {
    for (let i = 0; i < 20; i++) expect(pickNextFromBag(["a", "b"], "a")).toBe("b");
  });

  it("ignora a marcação de quem não está mais no saco", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickNextFromBag(["a", "b"], "zzz"));
    expect(seen).toEqual(new Set(["a", "b"]));
  });

  it("sem marcação, todos têm chance (distribuição aproximadamente uniforme)", () => {
    const bag = ["a", "b", "c", "d"];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    const runs = 8000;
    for (let i = 0; i < runs; i++) counts[pickNextFromBag(bag)]++;
    for (const k of bag) expect(counts[k] / runs).toBeGreaterThan(0.2);
  });

  it("usa a fonte de aleatoriedade injetada", () => {
    expect(pickNextFromBag(["a", "b", "c"], null, () => 2)).toBe("c");
    // com "b" reservado, os candidatos são [a, c]
    expect(pickNextFromBag(["a", "b", "c"], "b", () => 1)).toBe("c");
  });

  it("recusa saco com menos de 2 nomes", () => {
    expect(() => pickNextFromBag(["a"])).toThrow();
    expect(() => pickNextFromBag([])).toThrow();
  });
});
