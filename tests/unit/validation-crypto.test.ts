import { describe, expect, it } from "vitest";
import { giftInputSchema, passwordSchema, registerSchema } from "@/lib/validation";
import { initials, normalizeEmail, toSearchText } from "@/lib/text";
import { decrypt, encrypt, hmac, safeEqualHex } from "@/server/crypto";
import { hashPassword, verifyPassword } from "@/server/password";

const PW = "senha-boa-123";

describe("validação de cadastro", () => {
  it("aceita cadastro válido e normaliza nome e e-mail (a senha não é alterada)", () => {
    const r = registerSchema.safeParse({ name: "  Maria   Clara ", email: "  Maria.Clara@Exemplo.COM ", password: " com espaço " });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ name: "Maria Clara", email: "maria.clara@exemplo.com", password: " com espaço " });
  });

  it("recusa e-mail inválido", () => {
    for (const email of ["maria", "maria@", "@exemplo.com", "maria exemplo.com", ""]) {
      expect(registerSchema.safeParse({ name: "Maria", email, password: PW }).success).toBe(false);
    }
  });

  it("recusa nome vazio ou com caracteres perigosos", () => {
    for (const name of ["", "   ", "a", "<script>alert(1)</script>", "Ana123"]) {
      expect(registerSchema.safeParse({ name, email: "a@b.com", password: PW }).success).toBe(false);
    }
  });

  it("aceita nomes com acento, hífen e apóstrofo", () => {
    for (const name of ["João D'Ávila", "Ana-Lúcia", "Zé"]) {
      expect(registerSchema.safeParse({ name, email: "a@b.com", password: PW }).success).toBe(true);
    }
  });

  it("exige senha no cadastro", () => {
    expect(registerSchema.safeParse({ name: "Maria", email: "a@b.com" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Maria", email: "a@b.com", password: "curta" }).success).toBe(false);
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

  it("senha: mínimo 8, sem as mais comuns e sem caractere repetido", () => {
    expect(passwordSchema.safeParse("correta-cavalo-bateria").success).toBe(true);
    expect(passwordSchema.safeParse("Ab1!xyzW").success).toBe(true);
    for (const weak of ["", "1234567", "12345678", "Senha123", "aaaaaaaa", "amigosecreto"]) {
      expect(passwordSchema.safeParse(weak).success, weak).toBe(false);
    }
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
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
    expect(hmac("rate-limit", "a")).toBe(hmac("rate-limit", "a"));
    expect(hmac("rate-limit", "a")).not.toBe(hmac("draw-receiver-hash", "a"));
    expect(safeEqualHex(hmac("rate-limit", "a"), hmac("rate-limit", "a"))).toBe(true);
    expect(safeEqualHex(hmac("rate-limit", "a"), hmac("rate-limit", "b"))).toBe(false);
  });

  it("senha vira hash scrypt com sal e só confere com a senha certa", async () => {
    const a = await hashPassword("minha senha boa");
    const b = await hashPassword("minha senha boa");
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(a).not.toContain("minha senha boa");
    expect(a).not.toBe(b); // sal diferente a cada hash
    expect(await verifyPassword("minha senha boa", a)).toBe(true);
    expect(await verifyPassword("minha senha errada", a)).toBe(false);
    expect(await verifyPassword("qualquer", null)).toBe(false);
    expect(await verifyPassword("qualquer", "formato-invalido")).toBe(false);
  });
});
