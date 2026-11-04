import { describe, expect, it } from "vitest";
import { suggestTitleFromUrl as s } from "@/lib/product-title";

describe("nome do produto a partir do link", () => {
  it("Mercado Livre (catálogo, anúncio e com parâmetros)", () => {
    expect(s("https://www.mercadolivre.com.br/fone-de-ouvido-jbl-tune-520bt-preto/p/MLB25591473")).toBe(
      "Fone de ouvido jbl tune 520bt preto",
    );
    expect(s("https://produto.mercadolivre.com.br/MLB-3412345678-cafeteira-eletrica-oster-inox-_JM#position=2")).toBe(
      "Cafeteira eletrica oster inox",
    );
    expect(s("mercadolivre.com.br/kindle-11-geracao/p/MLB19713421?pdp_filters=item_id")).toBe("Kindle 11 geracao");
  });

  it("Amazon com nome no link (inclusive acentos codificados)", () => {
    expect(s("https://www.amazon.com.br/Fone-Ouvido-JBL-Tune-520BT/dp/B0C5RH1234?ref=abc")).toBe("Fone Ouvido JBL Tune 520BT");
    expect(s("https://www.amazon.com.br/Cafeteira-El%C3%A9trica-Oster-Prata/dp/B08XYZ1234/ref=sr_1_1")).toBe(
      "Cafeteira Elétrica Oster Prata",
    );
  });

  it("Amazon sem nome no link devolve null", () => {
    expect(s("https://www.amazon.com.br/dp/B0C5RH1234")).toBeNull();
    expect(s("https://www.amazon.com.br/gp/product/B0C5RH1234")).toBeNull();
    expect(s("https://amzn.to/3xYz12a")).toBeNull();
    expect(s("https://a.co/d/abc1234")).toBeNull();
  });

  it("Magalu, Casas Bahia e lojas VTEX", () => {
    expect(s("https://www.magazineluiza.com.br/smartphone-samsung-galaxy-a15-128gb-azul/p/237866100/te/ga15/")).toBe(
      "Smartphone samsung galaxy a15 128gb azul",
    );
    expect(s("https://www.casasbahia.com.br/air-fryer-mondial-4l-preta/p/55062451")).toBe("Air fryer mondial 4l preta");
    expect(s("https://www.americanas.com.br/caixa-de-som-jbl-go-3/p")).toBe("Caixa de som jbl go 3");
  });

  it("Shopee e Kabum", () => {
    expect(s("https://shopee.com.br/Fone-de-Ouvido-Bluetooth-Sem-Fio-i.123456789.2345678901")).toBe(
      "Fone de Ouvido Bluetooth Sem Fio",
    );
    expect(s("https://www.kabum.com.br/produto/123456/headset-gamer-hyperx-cloud-stinger")).toBe(
      "Headset gamer hyperx cloud stinger",
    );
  });

  it("loja genérica: usa o trecho mais longo e tira códigos de SKU do fim", () => {
    expect(s("https://www.netshoes.com.br/tenis-nike-revolution-6-masculino-preto-JD8-6789-006")).toBe(
      "Tenis nike revolution 6 masculino preto",
    );
    expect(s("https://loja.exemplo.com.br/livro-o-pequeno-principe.html")).toBe("Livro o pequeno principe");
  });

  it("links sem nome ou inválidos devolvem null", () => {
    for (const url of [
      "",
      "não é link",
      "javascript:alert(1)",
      "https://www.exemplo.com.br/produto",
      "https://pt.aliexpress.com/item/1005001234567890.html",
      "https://loja.com/12345678",
      "https://loja.com/",
    ]) {
      expect(s(url), url).toBeNull();
    }
  });

  it("respeita o limite de tamanho do nome", () => {
    const longo = `https://www.mercadolivre.com.br/${"palavra-".repeat(40)}fim/p/MLB1`;
    const r = s(longo)!;
    expect(r.length).toBeLessThanOrEqual(120);
    expect(r.endsWith(" ")).toBe(false);
  });
});
