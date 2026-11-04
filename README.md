# Laço — Amigo Secreto

Plataforma web de amigo secreto: cadastro com nome, e-mail e senha, recuperação de senha por link no e-mail, lista de desejos com links, sorteio feito no servidor, revelação individual (só a própria pessoa vê quem tirou) e mensagens anônimas entre cada par do sorteio.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 17 · Prisma 7 · Zod 4 · Nodemailer · sharp · Vitest · Playwright.

---

## Rodar localmente (≈ 5 minutos)

Pré-requisitos: **Node.js 20.19+** e **Docker** (para o Postgres).

```bash
# 1. Dependências (já gera o Prisma Client)
npm install

# 2. Variáveis de ambiente
cp .env.example .env
#    → preencha APP_SECRET (comando de geração está no arquivo)
#    → coloque seu e-mail em ORGANIZER_EMAILS

# 3. Banco de dados (Postgres na porta 5434 + banco de testes)
npm run db:up

# 4. Migrations
npm run db:migrate

# 5. Servidor
npm run dev
```

Abra http://localhost:3000 e crie sua conta com nome, e-mail e senha. Em desenvolvimento (`MAIL_TRANSPORT=console`), os e-mails (confirmação de e-mail e link de nova senha) **aparecem no terminal** do `npm run dev` e também ficam salvos em `.mail-outbox/`.

**Primeiro organizador:** cadastre-se com o e-mail que está em `ORGANIZER_EMAILS` e clique no link "Confirmar meu e-mail" que chega no cadastro. Só depois da confirmação a conta recebe a permissão de organizador (criar sorteios, adicionar/remover participantes e sortear). Isso impede que outra pessoa se cadastre com o seu e-mail e vire organizadora.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão do Postgres. |
| `APP_URL` | sim | URL pública (usada nos links dos e-mails). |
| `APP_SECRET` | sim | ≥ 32 caracteres. Deriva as chaves de **cifra dos resultados e das mensagens** e do rate limit. ⚠️ Não troque depois do primeiro sorteio. |
| `MAIL_TRANSPORT` | sim | `console` (dev; bloqueado em produção) ou `smtp`. |
| `MAIL_FROM` | sim | Remetente, ex.: `Laço <nao-responda@seudominio.com.br>`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | com `smtp` | Credenciais do provedor de e-mail. |
| `ORGANIZER_EMAILS` | recomendada | E-mails (separados por vírgula) que viram organizadores ao entrar. |
| `MAIL_OUTBOX_DIR` | não | Só dev/teste: grava os e-mails como `.json`. |

## Configurar o envio de e-mails (produção)

Qualquer provedor SMTP funciona. Exemplos:

- **Google Workspace / Gmail:** `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=seu@dominio`, `SMTP_PASSWORD=<senha de app>` (crie em *Conta Google → Segurança → Senhas de app*; exige verificação em 2 etapas).
- **Resend:** `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=resend`, `SMTP_PASSWORD=<API key>`.
- **Brevo / Amazon SES / Mailgun:** use os dados SMTP do painel.

Para os e-mails não caírem no spam, configure **SPF, DKIM e DMARC** do domínio do `MAIL_FROM` no provedor escolhido.

---

## Testes

```bash
npm run db:up        # o Postgres precisa estar no ar (usa o banco laco_test)
npm test             # unitários + integração (Vitest, banco real)
npm run test:e2e     # ponta a ponta no navegador (Playwright: desktop + celular)
npm run typecheck && npm run lint
```

Na primeira vez do E2E: `npx playwright install chromium`.

| Suíte | O que cobre |
|---|---|
| `tests/unit` | Algoritmo do sorteio (2, 3, 10, 50 pessoas; uniformidade; fallback), validações (e-mail, nome, URLs perigosas), criptografia. |
| `tests/integration` | Cadastro com senha (fraca, duplicada), login (senha errada e e-mail inexistente com a mesma resposta, limite de tentativas), nova senha por link (uso único, expirado, encerra sessões), confirmação de e-mail e organizador, troca de senha, sessões (expirada, falsa, renovação, logout), presentes (CRUD, propriedade), sorteio (execução, duplicada, **simultânea**, falha no meio da transação, privacidade), mensagens anônimas, triggers do banco. |
| `tests/e2e` | Navegação, redirecionamento de páginas privadas, cadastro com senha → presentes → sair → entrar, senha errada, "Esqueci minha senha" com link do e-mail, sorteio completo com revelação e troca de mensagens anônimas, entrar/sair de sorteio, menu móvel, ausência de rolagem horizontal, cabeçalhos de segurança. |

---

## Deploy

Funciona em qualquer hospedagem Node.js com Postgres. Caminho recomendado:

1. **Banco:** crie um Postgres gerenciado (Neon, Supabase, Railway, RDS…). Copie a `DATABASE_URL` (com `sslmode=require`).
2. **App na Vercel:** importe o repositório → configure as variáveis da tabela acima em *Settings → Environment Variables* (`MAIL_TRANSPORT=smtp`).
3. **Migrations:** rode uma vez contra o banco de produção (localmente ou no CI):
   ```bash
   DATABASE_URL="<url de produção>" npm run db:deploy
   ```
   Repita a cada nova migration (pode virar um passo do CI).
4. Faça o deploy. O build roda `prisma generate && next build`.

Servidor próprio/VPS: `npm ci && npm run db:deploy && npm run build && npm start` atrás de um proxy reverso com HTTPS (Nginx/Caddy) que **sobrescreva** o header `X-Forwarded-For` (o rate limit por IP usa o primeiro valor dele).

---

## Arquitetura

```
src/
├── app/                      # Rotas (App Router)
│   ├── page.tsx              # Home: hero + participantes (busca, paginação)
│   ├── entrar/ cadastro/     # Login e cadastro (e-mail + senha)
│   ├── esqueci-senha/ redefinir-senha/ confirmar-email/  # Links enviados por e-mail
│   ├── meus-presentes/       # CRUD da própria lista (privada)
│   ├── participantes/[id]/   # Lista pública de presentes de alguém
│   ├── sorteios/ [id]/       # Listagem, detalhes, painel do organizador
│   ├── meu-resultado/        # Revelação do próprio amigo secreto
│   ├── conta/ (+ dados/)     # Nome, exportar dados (JSON), excluir conta
│   ├── privacidade/          # Política LGPD
│   └── actions/              # Server Actions (camada fina: sessão → serviço → revalidação)
├── components/               # UI reutilizável (ui/, auth/, gifts/, draws/, result/, layout/)
├── lib/                      # Código compartilhado cliente/servidor (validação Zod, texto, formatos)
├── server/                   # Só servidor
│   ├── services/             # Regras de negócio (auth, users, gifts, draws) — testáveis sem Next
│   ├── draw/derangement.ts   # Algoritmo do sorteio (puro)
│   ├── auth/                 # Sessões no banco + leitura do cookie (Data Access Layer)
│   ├── mail/                 # Transporte SMTP/console + templates
│   ├── crypto.ts             # HMAC, AES-256-GCM, tokens
│   └── rate-limit.ts         # Rate limit em Postgres
├── generated/prisma/         # Prisma Client (gerado, fora do git)
└── proxy.ts                  # Redirecionamento otimista de rotas privadas
prisma/
├── schema.prisma
└── migrations/               # init + triggers de integridade
tests/ (unit, integration, e2e)
```

**Regra de ouro:** toda regra de negócio e de permissão mora em `src/server/services`. O frontend só valida para dar feedback rápido; o servidor revalida tudo.

### Banco de dados

| Tabela | Papel |
|---|---|
| `users` | Nome, e-mail normalizado (único), hash da senha, `search_name` (busca sem acento), papel (`USER`/`ORGANIZER`), `email_verified_at` (e-mail confirmado por link). |
| `gifts` | Presentes (título, URL validada, descrição) — FK para `users` com cascade. |
| `sessions` | Sessões: id = SHA-256 do token do cookie, expiração deslizante (30 dias). |
| `auth_tokens` | Links de uso único enviados por e-mail (nova senha: 30 min; confirmação de e-mail: 48 h), guardados só como SHA-256. |
| `user_avatars` | Foto de perfil opcional, já reprocessada no servidor (WebP 256×256, sem metadados como GPS). Servida em `/api/avatar/<id>?v=<versão>`. |
| `rate_limits` | Contadores de janela fixa (chaves com HMAC de e-mail/IP). |
| `draws` | Sorteio (nome, valor sugerido, data, status `OPEN`/`COMPLETED`). Base para múltiplos grupos. |
| `draw_participants` | Quem participa — único por (sorteio, usuário). |
| `draw_results` | 1 linha por participante: destinatário **cifrado** (AES-256-GCM, amarrado à linha) + HMAC único por sorteio (garante que ninguém é sorteado 2x sem revelar quem). |
| `draw_messages` | Mensagens anônimas do par. Pertencem ao resultado de quem presenteia; guardam só a direção (`TO_RECEIVER`/`TO_GIVER`), nunca o id do autor. Texto cifrado (AES-256-GCM). |

Triggers no Postgres (migration `db_integrity_guards`): sorteio concluído não reabre; só pode virar `COMPLETED` com 1 resultado por participante (checado no COMMIT); participantes não mudam após o sorteio; resultados são imutáveis.

### Como o sorteio funciona

1. `UPDATE draws SET status='COMPLETED' WHERE id=? AND status='OPEN'` dentro de uma transação — trava a linha; cliques simultâneos esperam e depois recebem "já realizado".
2. Lê os participantes com a trava ativa (ninguém entra/sai no meio).
3. Fisher-Yates com `crypto.randomInt`, rejeitando permutações em que alguém tira a si mesmo → distribuição uniforme entre todas as atribuições válidas. Fallback de Sattolo garante término.
4. Valida (cada um tira 1, cada um é tirado 1 vez, ninguém se tira) e grava os resultados cifrados. Qualquer erro desfaz tudo.
5. Depois do COMMIT, e-mails avisam os participantes (sem o nome sorteado).

O nome sorteado **não vai no HTML**: só é buscado por Server Action quando a pessoa clica em "Revelar", e a busca parte sempre de `(sorteio, usuário da sessão)` — não existe parâmetro para pedir o resultado de outra pessoa. Nem o organizador vê os pares (vê só quantos já revelaram).

### Mensagens anônimas

Depois do sorteio, cada pessoa tem duas conversas em "Meu amigo secreto":

- **Quem eu tirei** — você escreve para quem tirou sem se identificar (ex.: perguntar tamanho ou cor).
- **Quem me tirou** — seu amigo secreto fala com você; você responde sem saber quem é.

A conversa "Quem me tirou" é localizada pelo HMAC do destinatário: o servidor nunca precisa nem devolve a identidade de quem presenteia. Nem o organizador lê as mensagens. Limites: 1.000 caracteres por mensagem, 60 mensagens por hora por pessoa, 500 por conversa. O menu mostra quantas mensagens novas há; a página atualiza sozinha a cada 20 s.

### Identidade visual

Sem cara de template: superfícies brancas e cinza-claro, tinta verde quase preta, vermelho só na ação principal de cada tela e dourado apenas em detalhes (foco). Uma fonte grotesca (Schibsted Grotesk) e uma manuscrita (Caveat) usada só nos nomes escritos nos "papeizinhos" do sorteio — o elemento de assinatura (hero com nomes reais da turma; resultado revelado como um papel que se desdobra). Cantos de 6–8 px, bordas finas em vez de sombras, listas em vez de grades de cards, sem gradientes nem emoji. Tokens em `src/app/globals.css`.

### Segurança

- Foto de perfil: toda imagem é decodificada e regravada pelo servidor (`sharp`), o que descarta arquivos que não são imagem e apaga metadados (EXIF/GPS). Servida com `Content-Security-Policy: sandbox`.
- Senha guardada só como hash **scrypt** com sal; login com mensagem genérica ("E-mail ou senha incorretos.") e o mesmo tempo de resposta exista ou não a conta.
- Rate limit por IP e por e-mail (login, cadastro, pedidos de nova senha). Trocar ou redefinir a senha encerra as outras sessões.
- Cookie `HttpOnly`, `Secure` (produção), `SameSite=Lax`; token opaco de 256 bits, só o hash no banco.
- Server Actions com checagem de origem do Next (CSRF) + sessão validada no banco em cada chamada.
- Zod no servidor; Prisma com queries parametrizadas (SQL injection); React escapa HTML (XSS); URLs só `http/https`, links com `rel="noopener noreferrer nofollow"`.
- Cabeçalhos: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS (produção).
- Erros internos nunca chegam ao usuário; logs sem senhas, tokens ou e-mails.
- LGPD: coleta mínima (nome + e-mail), política em `/privacidade`, exportação dos dados em JSON e exclusão da conta.

## Limitações conhecidas

- **O cadastro revela se o e-mail já tem conta** ("Este e-mail já tem cadastro"). O login e o "Esqueci minha senha" não revelam.
- Organizador não pode **refazer** um sorteio realizado (decisão de segurança). Para corrigir, exclua o sorteio e crie outro.
- Pessoa em sorteio já realizado só exclui a conta depois que o organizador excluir o sorteio.
- Sem upload de foto de perfil (avatar com iniciais).
- `APP_SECRET` não pode ser rotacionado sem perder os resultados já cifrados.
