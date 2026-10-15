# Guia de uso: telegram-logger em projetos web full stack JS/TS

Este guia mostra, passo a passo, como colocar o `@alexgalhardo/telegram-logger` para trabalhar em projetos reais:

- formulários de contato
- erros 500
- 404
- warnings
- eventos de negócio

## Sumário

1. [Criar o bot e descobrir o chat id](#1-criar-o-bot-e-descobrir-o-chat-id)
2. [Instalar](#2-instalar)
3. [Variáveis de ambiente](#3-variáveis-de-ambiente)
4. [Criar uma instância compartilhada](#4-criar-uma-instância-compartilhada)
5. [Next.js (App Router)](#5-nextjs-app-router)
6. [React SPA (Vite, CRA)](#6-react-spa-vite-cra)
7. [Express, Fastify e Hono](#7-express-fastify-e-hono)
8. [Cloudflare Workers e Edge](#8-cloudflare-workers-e-edge)
9. [Deno e Bun](#9-deno-e-bun)
10. [Scripts, cron jobs e filas](#10-scripts-cron-jobs-e-filas)
11. [Testes automatizados](#11-testes-automatizados)
12. [Boas práticas](#12-boas-práticas)
13. [Problemas comuns](#13-problemas-comuns)

---

## 1. Criar o bot e descobrir o chat id

1. No Telegram, abra o [@BotFather](https://t.me/BotFather) e envie `/newbot`.
2. Escolha um nome e um username terminado em `bot`.
3. Copie o **token** (formato `123456789:AAH...`).
4. Crie os canais onde você quer receber as mensagens. Por exemplo:
   - `MeuSite • Alertas`, para erros
   - `MeuSite • Leads`, para contatos
5. Adicione o bot em cada canal:
   - **Canal:** Configurações → Administradores → Adicionar administrador → selecione o bot → permissão **Publicar mensagens**.
   - **Grupo:** basta adicionar o bot como membro.
6. Mande qualquer mensagem no canal e abra no navegador:

   ```
   https://api.telegram.org/bot<SEU_TOKEN>/getUpdates
   ```

   Procure `"chat":{"id":-100...}`. Esse número negativo é o **chat id**.

   > Se aparecer `"result":[]`, mande outra mensagem no canal e recarregue a página. Outra opção é encaminhar uma mensagem do canal para o [@userinfobot](https://t.me/userinfobot).

7. Teste o envio pelo terminal:

   ```bash
   curl -X POST "https://api.telegram.org/bot<SEU_TOKEN>/sendMessage" \
     -d chat_id=<CHAT_ID> -d text="funcionou"
   ```

## 2. Instalar

```bash
npm install @alexgalhardo/telegram-logger
# ou: pnpm add / yarn add / bun add @alexgalhardo/telegram-logger
# Deno: deno add jsr:@alexgalhardo/telegram-logger
```

## 3. Variáveis de ambiente

`.env.local` (Next.js) ou `.env`:

```bash
TELEGRAM_BOT_TOKEN=123456789:AAH...
TELEGRAM_CHAT_ID=-1001111111111          # canal padrão (alertas)
TELEGRAM_CONTACT_CHAT_ID=-1002222222222  # opcional: canal de leads
```

> ⚠️ **Nunca** use o prefixo `NEXT_PUBLIC_` (ou `VITE_`) no token. Com esse prefixo, o token vai parar no JavaScript do navegador e qualquer pessoa pode usar o seu bot.

Na Vercel, configure as variáveis em **Project → Settings → Environment Variables**. Em outros provedores, use o painel equivalente.

## 4. Criar uma instância compartilhada

Crie a instância **uma vez** e importe onde precisar:

```ts
// lib/logger.ts
import "server-only"; // Next.js: dá erro de build se alguém importar este arquivo no client
import { createTelegramLogger } from "@alexgalhardo/telegram-logger";

export const logger = createTelegramLogger({
  // botToken e chatId são lidos automaticamente de TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID
  chatIds: {
    contact: process.env.TELEGRAM_CONTACT_CHAT_ID, // leads em outro canal
  },
  appName: "meu-site",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production", // não manda nada em dev
  onError: (e) => console.error("[telegram-logger]", e.reason, e.message),
});
```

> O pacote `server-only` é opcional: `npm i server-only`. Fora do Next.js, remova essa linha.

## 5. Next.js (App Router)

### 5.1 Formulário de contato com Server Action

```tsx
// app/contato/actions.ts
"use server";

import { logger } from "@/lib/logger";

export type ContactState = { ok: boolean; message: string } | null;

export async function sendContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Honeypot anti-spam: este campo fica escondido no HTML, então só bots o preenchem
  if (formData.get("website")) return { ok: true, message: "Obrigado!" };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return { ok: false, message: "Preencha todos os campos." };
  }

  const result = await logger.contact({ name, email, message, origem: "página /contato" });

  return result.ok
    ? { ok: true, message: "Mensagem enviada! Responderei em breve." }
    : { ok: false, message: "Não foi possível enviar agora. Tente novamente." };
}
```

```tsx
// app/contato/page.tsx
"use client";

import { useActionState } from "react";
import { sendContact } from "./actions";

export default function ContactPage() {
  const [state, action, pending] = useActionState(sendContact, null);

  return (
    <form action={action}>
      <input name="name" placeholder="Nome" required />
      <input name="email" type="email" placeholder="E-mail" required />
      <textarea name="message" placeholder="Mensagem" required />
      <input name="website" tabIndex={-1} autoComplete="off" hidden />
      <button disabled={pending}>{pending ? "Enviando..." : "Enviar"}</button>
      {state && <p>{state.message}</p>}
    </form>
  );
}
```

> Todo conteúdo enviado pelo usuário é escapado automaticamente. Se alguém digitar `<script>` no formulário, isso não quebra a mensagem nem é interpretado como HTML.

### 5.2 Formulário de contato com Route Handler (API)

Use esta opção se o front for outro app, ou se você preferir `fetch("/api/contact")`:

```ts
// app/api/contact/route.ts
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.message) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const result = await logger.contact({
    name: body.name,
    email: body.email,
    phone: body.phone,
    message: body.message,
    ip: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return Response.json({ ok: result.ok }, { status: result.ok ? 200 : 502 });
}
```

### 5.3 Erros dentro de try/catch

```ts
// app/api/checkout/route.ts
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const order = await createOrder(await request.json());
    await logger.success("Nova venda 💰", { orderId: order.id, total: order.total });
    return Response.json(order);
  } catch (err) {
    await logger.error(err, { route: "/api/checkout", method: "POST" });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

### 5.4 Todos os erros 500 automaticamente: `instrumentation.ts`

No Next.js 15 ou superior, o hook `onRequestError` captura todo erro não tratado do servidor. Isso inclui Server Components, Route Handlers, Server Actions e middleware. Assim você não precisa colocar try/catch em todo lugar.

```ts
// instrumentation.ts (na raiz do projeto, ou em src/)
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logger } = await import("./lib/logger");
  await logger.error(err, {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType, // "render" | "route" | "action" | "middleware"
    digest: (err as { digest?: string }).digest,
  });
};

export function register() {}
```

### 5.5 Erros no client (Error Boundary)

O navegador não pode chamar o Telegram diretamente, porque o token ficaria exposto. Por isso, o client envia o erro para uma rota sua, e essa rota é que manda para o Telegram:

```ts
// app/api/client-error/route.ts
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const { message, stack, url, digest } = await request.json().catch(() => ({}));
  await logger.error(String(message ?? "Client error").slice(0, 500), {
    url,
    digest,
    userAgent: request.headers.get("user-agent") ?? undefined,
    stack: typeof stack === "string" ? stack.slice(0, 1500) : undefined,
  }, { title: "🖥️ Erro no navegador" });
  return new Response(null, { status: 204 });
}
```

```tsx
// app/error.tsx
"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, url: location.href }),
    }).catch(() => {});
  }, [error]);

  return (
    <div>
      <h2>Algo deu errado.</h2>
      <button onClick={reset}>Tentar novamente</button>
    </div>
  );
}
```

> Essa rota é pública e pode ser abusada para mandar spam ao seu canal. Considere adicionar rate limit, por exemplo com Upstash Ratelimit ou com o firewall da Vercel.

### 5.6 Monitorar 404

Avisar sobre **todo** 404 gera muito ruído, porque bots varrem `/wp-admin`, `.env` e outros caminhos o tempo todo. Vale a pena avisar apenas sobre rotas que deveriam existir, como links internos quebrados ou slugs que vêm do banco:

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from "next/navigation";
import { logger } from "@/lib/logger";

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    await logger.warn("404: post não encontrado", { slug }, { disableNotification: true });
    notFound();
  }
  return <article>{post.title}</article>;
}
```

### 5.7 Edge Runtime e middleware

A lib usa apenas `fetch`, então funciona igual em `export const runtime = "edge"` e no `middleware.ts`.

## 6. React SPA (Vite, CRA)

Um app React que roda só no navegador **não pode** ter o token. Você precisa de um backend mínimo, que pode ser uma das opções abaixo:

- uma função serverless (Vercel `api/`, Netlify Functions)
- um Cloudflare Worker
- o seu backend Express ou Hono (ver [seção 7](#7-express-fastify-e-hono))

Exemplo com uma Vercel Function em um projeto Vite:

```ts
// api/contact.ts (Vercel detecta automaticamente)
import { createTelegramLogger } from "@alexgalhardo/telegram-logger";

const logger = createTelegramLogger({ appName: "landing-vite" });

export async function POST(request: Request) {
  const data = await request.json();
  const result = await logger.contact(data);
  return Response.json({ ok: result.ok });
}
```

```tsx
// src/ContactForm.tsx
async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));
  await fetch("/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}
```

## 7. Express, Fastify e Hono

### Express

```ts
import express from "express";
import { createTelegramLogger } from "@alexgalhardo/telegram-logger";

const logger = createTelegramLogger({ appName: "api", environment: process.env.NODE_ENV });
const app = express();
app.use(express.json());

app.post("/contact", async (req, res) => {
  const result = await logger.contact(req.body);
  res.status(result.ok ? 200 : 502).json({ ok: result.ok });
});

// 404
app.use((req, res) => {
  logger.warn("404 Not Found", { method: req.method, path: req.originalUrl }, { disableNotification: true });
  res.status(404).json({ error: "Not found" });
});

// 500: o error handler do Express precisa ter 4 argumentos
app.use(async (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  await logger.error(err, { method: req.method, path: req.originalUrl });
  res.status(500).json({ error: "Internal Server Error" });
});

// Erros fora de requests
process.on("unhandledRejection", (reason) => logger.fatal(reason, { source: "unhandledRejection" }));
process.on("uncaughtException", async (err) => {
  await logger.fatal(err, { source: "uncaughtException" });
  process.exit(1);
});

app.listen(3000);
```

### Fastify

```ts
fastify.setErrorHandler(async (error, request, reply) => {
  await logger.error(error, { method: request.method, url: request.url });
  reply.status(500).send({ error: "Internal Server Error" });
});
```

### Hono (Node, Bun, Workers)

```ts
import { Hono } from "hono";
import { createTelegramLogger } from "@alexgalhardo/telegram-logger";

const app = new Hono();
const logger = createTelegramLogger({ appName: "hono-api" });

app.onError(async (err, c) => {
  await logger.error(err, { method: c.req.method, path: c.req.path });
  return c.json({ error: "Internal Server Error" }, 500);
});

app.notFound((c) => {
  logger.warn("404", { path: c.req.path }, { disableNotification: true });
  return c.json({ error: "Not found" }, 404);
});
```

## 8. Cloudflare Workers e Edge

Nos Workers, as variáveis de ambiente chegam em `env`, e não em `process.env`. Passe o token e o chat id explicitamente, e use `ctx.waitUntil` para enviar sem atrasar a resposta:

```ts
import { createTelegramLogger } from "@alexgalhardo/telegram-logger";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const logger = createTelegramLogger({
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatId: env.TELEGRAM_CHAT_ID,
      appName: "worker",
    });
    try {
      return await handle(request);
    } catch (err) {
      ctx.waitUntil(logger.error(err, { url: request.url }));
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
```

Para configurar o token como secret: `wrangler secret put TELEGRAM_BOT_TOKEN`.

> Na Vercel, o equivalente é `waitUntil` de `@vercel/functions`. Fora disso, use `await`.

## 9. Deno e Bun

```ts
// Deno: deno add jsr:@alexgalhardo/telegram-logger
// Rode com: deno run --allow-net --allow-env main.ts
import { createTelegramLogger } from "@alexgalhardo/telegram-logger";

const logger = createTelegramLogger({ appName: "deno-app" });
await logger.info("Olá do Deno 🦕");
```

O Bun funciona exatamente como o Node: `bun add @alexgalhardo/telegram-logger`. O `.env` é carregado automaticamente.

## 10. Scripts, cron jobs e filas

```ts
const logger = createTelegramLogger({ appName: "jobs" });

const started = Date.now();
try {
  const count = await syncProducts();
  await logger.success("Sync de produtos concluído", { count, durationMs: Date.now() - started });
} catch (err) {
  await logger.error(err, { job: "sync-products" });
  process.exitCode = 1;
}
```

## 11. Testes automatizados

Nos testes, desligue o logger:

```ts
createTelegramLogger({ enabled: process.env.NODE_ENV !== "test" });
```

Ou injete um `fetch` falso e confira o que seria enviado:

```ts
const sent: string[] = [];
const logger = createTelegramLogger({
  botToken: "test",
  chatId: 1,
  fetch: async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)).text);
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
  },
});
```

## 12. Boas práticas

- **Sempre use `await` em funções serverless.** Sem isso, a função pode ser congelada antes de a mensagem sair.
- **Use canais separados**: um para alertas (com notificação), outro para leads e outro para eventos (com `disableNotification: true`).
- **Use `minLevel: "warn"` em produção** se o canal estiver barulhento demais.
- **Não envie dados sensíveis**, como senhas, tokens, cartões ou documentos. Os metadados aparecem em texto puro no Telegram.
- **Respeite os limites do Telegram**: cerca de 20 mensagens por minuto em um mesmo grupo ou canal. A lib espera e tenta de novo uma vez em caso de 429. Mesmo assim, não envie logs dentro de loops.
- **O logger nunca lança erro.** Se você precisa saber se a mensagem foi entregue (por exemplo, no formulário de contato), confira `result.ok`.

## 13. Problemas comuns

| Sintoma (`result.error.message`)        | Causa e solução                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `reason: "missing_config"`              | `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_CHAT_ID` não foi definido no ambiente onde o código roda. Lembre que a Vercel tem variáveis separadas para Preview e Production. |
| `401 Unauthorized`                      | Token errado ou revogado. Gere outro com `/token` no @BotFather.                         |
| `400 Bad Request: chat not found`       | O chat id está errado, ou o bot não está no canal. Ids de canal começam com `-100`.      |
| `403 Forbidden: bot is not a member`    | Adicione o bot ao canal ou grupo.                                                        |
| `403 ... not enough rights`             | No canal, o bot precisa ser **admin** com permissão para publicar.                       |
| `400 ... message thread not found`      | O `messageThreadId` não existe nesse grupo.                                              |
| `reason: "timeout"`                     | A rede até `api.telegram.org` está lenta ou bloqueada. Aumente o `timeoutMs`.            |
| Nada chega e `result.reason === "disabled"` | `enabled` está `false`, provavelmente porque `NODE_ENV` não é `production`.          |
| Funciona local, mas não na Vercel       | A função terminou antes do envio. Use `await` ou `waitUntil`.                            |
