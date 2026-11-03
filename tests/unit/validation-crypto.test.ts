import { describe, expect, it } from "vitest";
import { codeSchema, giftInputSchema, registerSchema } from "@/lib/validation";
import { initials, normalizeEmail, toSearchText } from "@/lib/text";
import { decrypt, encrypt, generateLoginCode, hmac, safeEqualHex } from "@/server/crypto";

describe("validação de cadastro", () => {
  it("aceita cadastro válido e normaliza nome e e-mail", () => {
    const r = registerSchema.safeParse({ name: "  Maria   Clara ", email: "  Maria.Clara@Exemplo.COM " });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ name: "Maria Clara", email: "maria.clara@exemplo.com" });
  });

  it("recusa e-mail inválido", () => {
    for (const email of ["maria", "maria@", "@exemplo.com", "maria exemplo.com", ""]) {
      expect(registerSchema.safeParse({ name: "Maria", email }).success).toBe(false);
    }
  });

  it("recusa nome vazio ou com caracteres perigosos", () => {
    for (const name of ["", "   ", "a", "<script>alert(1)</script>", "Ana123"]) {
      expect(registerSchema.safeParse({ name, email: "a@b.com" }).success).toBe(false);
    }
  });

  it("aceita nomes com acento, hífen e apóstrofo", () => {
    for (const name of ["João D'Ávila", "Ana-Lúcia", "Zé"]) {
      expect(registerSchema.safeParse({ name, email: "a@b.com" }).success).toBe(true);
    }
  });
});

describe("validação de presentes", () => {
  const ok = (url: string) => giftInputSchema.safeParse({ title: "Fone", url });

  it("aceita http/https e completa https:// quando falta", () => {
    expect(ok("https://loja.com.br/p?id=1").data?.url).toBe("https://loja.com.br/p?id=1");
    expect(ok("loja.com.br/fone").data?.url).toBe("https://loja.com.br/fone");
  });

  it("bloqueia esquemas perigosos e URLs malformadas", () => {
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox",
      "file:///etc/passwd",
      "ftp://loja.com/x",
      "https://",
      "https://usuario:senha@loja.com",
      "nao é link",
      "",
    ]) {
      expect(ok(url).success, url).toBe(false);
    }
  });

  it("descrição é opcional e limitada", () => {
    expect(giftInputSchema.safeParse({ title: "Livro", url: "https://a.com", description: "" }).data?.description).toBeNull();
    expect(giftInputSchema.safeParse({ title: "Livro", url: "https://a.com", description: "x".repeat(501) }).success).toBe(false);
  });
});

describe("utilitários de texto", () => {
  it("normaliza e-mail, busca e iniciais", () => {
    expect(normalizeEmail("  ANA@X.COM ")).toBe("ana@x.com");
    expect(toSearchText("  João   Ávila ")).toBe("joao avila");
    expect(initials("maria clara souza")).toBe("MS");
    expect(initials("Zé")).toBe("Z");
  });

  it("código aceita espaços e exige 6 dígitos", () => {
    expect(codeSchema.safeParse("123 456").data).toBe("123456");
    expect(codeSchema.safeParse("12345").success).toBe(false);
  });
});

describe("criptografia", () => {
  it("cifra e decifra o destinatário, amarrado ao registro (AAD)", () => {
    const c = encrypt("user_123", "draw1:part1");
    expect(c).not.toContain("user_123");
    expect(decrypt(c, "draw1:part1")).toBe("user_123");
    // Copiar o valor cifrado para outro registro não funciona.
    expect(() => decrypt(c, "draw1:part2")).toThrow();
  });

  it("cada cifragem usa IV aleatório", () => {
    expect(encrypt("x", "a")).not.toBe(encrypt("x", "a"));
  });

  it("HMAC é determinístico por finalidade e a comparação é segura", () => {
    expect(hmac("login-code", "a")).toBe(hmac("login-code", "a"));
    expect(hmac("login-code", "a")).not.toBe(hmac("draw-receiver-hash", "a"));
    expect(safeEqualHex(hmac("login-code", "a"), hmac("login-code", "a"))).toBe(true);
    expect(safeEqualHex(hmac("login-code", "a"), hmac("login-code", "b"))).toBe(false);
  });

  it("códigos de login têm 6 dígitos", () => {
    for (let i = 0; i < 200; i++) expect(generateLoginCode()).toMatch(/^\d{6}$/);
  });
});
