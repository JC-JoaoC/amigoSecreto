import { describe, expect, it } from "vitest";
import { isStoreUrl } from "@/lib/stores";
import { extractImageUrl, isPublicAddress } from "@/server/product-image";

describe("lista de lojas", () => {
  it("aceita lojas conhecidas e seus subdomínios, só em HTTPS", () => {
    expect(isStoreUrl("https://www.mercadolivre.com.br/produto/p/MLB1")).toBe(true);
    expect(isStoreUrl("https://produto.mercadolivre.com.br/MLB-1")).toBe(true);
    expect(isStoreUrl("https://www.kabum.com.br/produto/1")).toBe(true);
    expect(isStoreUrl("http://www.kabum.com.br/produto/1")).toBe(false);
  });

  it("recusa domínios parecidos, porta, usuário e lixo", () => {
    expect(isStoreUrl("https://mercadolivre.com.br.golpe.com/p")).toBe(false);
    expect(isStoreUrl("https://falsomercadolivre.com.br/p")).toBe(false);
    expect(isStoreUrl("https://www.kabum.com.br:8443/p")).toBe(false);
    expect(isStoreUrl("https://user:senha@www.kabum.com.br/p")).toBe(false);
    expect(isStoreUrl("https://www.exemplo.com.br/p")).toBe(false);
    expect(isStoreUrl("não é link")).toBe(false);
  });
});

describe("endereços internos", () => {
  it.each(["127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "lixo"])(
    "%s é recusado",
    (ip) => expect(isPublicAddress(ip)).toBe(false),
  );

  it.each(["8.8.8.8", "172.32.0.1", "151.101.1.1", "2606:4700::1111", "::ffff:8.8.8.8"])("%s é público", (ip) =>
    expect(isPublicAddress(ip)).toBe(true),
  );
});

describe("achar a foto no HTML", () => {
  const page = "https://www.loja.com.br/produto/p";

  it("lê og:image, com atributos em qualquer ordem e &amp;", () => {
    const html = `<head><meta content="https://cdn.loja.com.br/a.jpg?w=1&amp;h=2" property="og:image"></head>`;
    expect(extractImageUrl(html, page)).toBe("https://cdn.loja.com.br/a.jpg?w=1&h=2");
  });

  it("prefere og:image:secure_url e resolve endereço relativo", () => {
    const html = `<meta property="og:image" content="/img/b.png"><meta property="og:image:secure_url" content="/img/c.png">`;
    expect(extractImageUrl(html, page)).toBe("https://www.loja.com.br/img/c.png");
  });

  it("usa twitter:image, image_src e JSON-LD quando não há og:image", () => {
    expect(extractImageUrl(`<meta name="twitter:image" content="https://x.com/t.jpg">`, page)).toBe("https://x.com/t.jpg");
    expect(extractImageUrl(`<link rel="image_src" href="https://x.com/l.jpg">`, page)).toBe("https://x.com/l.jpg");
    const ld = `<script type="application/ld+json">{"@type":"Product","image":["https:\\/\\/x.com\\/j.jpg"]}</script>`;
    expect(extractImageUrl(ld, page)).toBe("https://x.com/j.jpg");
  });

  it("troca http por https e ignora esquemas perigosos", () => {
    expect(extractImageUrl(`<meta property="og:image" content="http://x.com/a.jpg">`, page)).toBe("https://x.com/a.jpg");
    expect(extractImageUrl(`<meta property="og:image" content="javascript:alert(1)">`, page)).toBeNull();
    expect(extractImageUrl(`<meta property="og:image" content="data:image/png;base64,AAAA">`, page)).toBeNull();
    expect(extractImageUrl(`<p>sem foto</p>`, page)).toBeNull();
  });
});
