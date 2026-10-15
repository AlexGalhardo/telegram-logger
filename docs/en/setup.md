# Usage guide: telegram-logger in full stack JS/TS web projects

> 🇧🇷 [Leia em português](../pt-br/setup.md)

This guide shows, step by step, how to put `@galhardoalex/telegram-logger` to work in real projects:

- contact forms
- 500 errors
- 404s
- warnings
- business events

## Table of contents

1. [Create the bot and find the chat id](#1-create-the-bot-and-find-the-chat-id)
2. [Install](#2-install)
3. [Environment variables](#3-environment-variables)
4. [Create a shared instance](#4-create-a-shared-instance)
5. [Next.js (App Router)](#5-nextjs-app-router)
6. [React SPA (Vite, CRA)](#6-react-spa-vite-cra)
7. [Express, Fastify and Hono](#7-express-fastify-and-hono)
8. [Cloudflare Workers and Edge](#8-cloudflare-workers-and-edge)
9. [Deno and Bun](#9-deno-and-bun)
10. [Scripts, cron jobs and queues](#10-scripts-cron-jobs-and-queues)
11. [Automated tests](#11-automated-tests)
12. [Best practices](#12-best-practices)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Create the bot and find the chat id

1. In Telegram, open [@BotFather](https://t.me/BotFather) and send `/newbot`.
2. Pick a name and a username that ends in `bot`.
3. Copy the **token** (format `123456789:AAH...`).
4. Create the channels where you want to receive messages. For example:
   - `MySite • Alerts`, for errors
   - `MySite • Leads`, for contacts
5. Add the bot to each channel:
   - **Channel:** Settings → Administrators → Add admin → pick the bot → **Post messages** permission.
   - **Group:** just add the bot as a member.
6. Send any message in the channel and open this in your browser:

   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```

   Look for `"chat":{"id":-100...}`. That negative number is the **chat id**.

   > If you see `"result":[]`, send another message in the channel and reload the page. Another option is to forward a message from the channel to [@userinfobot](https://t.me/userinfobot).

7. Test it from the terminal:

   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/sendMessage" \
     -d chat_id=<CHAT_ID> -d text="it works"
   ```

## 2. Install

```bash
npm install @galhardoalex/telegram-logger
# or: pnpm add / yarn add / bun add @galhardoalex/telegram-logger
# Deno: deno add jsr:@galhardoalex/telegram-logger
```

## 3. Environment variables

`.env.local` (Next.js) or `.env`:

```bash
TELEGRAM_BOT_TOKEN=123456789:AAH...
TELEGRAM_CHAT_ID=-1001111111111          # default channel (alerts)
TELEGRAM_CONTACT_CHAT_ID=-1002222222222  # optional: leads channel
```

> ⚠️ **Never** use the `NEXT_PUBLIC_` (or `VITE_`) prefix for the token. With that prefix, the token ends up in the browser's JavaScript and anyone can use your bot.

On Vercel, set the variables in **Project → Settings → Environment Variables**. On other providers, use the equivalent panel.

## 4. Create a shared instance

Create the instance **once** and import it wherever you need it:

```ts
// lib/logger.ts
import "server-only"; // Next.js: fails the build if this file is imported on the client
import { createTelegramLogger } from "@galhardoalex/telegram-logger";

export const logger = createTelegramLogger({
  // botToken and chatId are read automatically from TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
  chatIds: {
    contact: process.env.TELEGRAM_CONTACT_CHAT_ID, // leads go to another channel
  },
  appName: "my-site",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production", // sends nothing in dev
  onError: (e) => console.error("[telegram-logger]", e.reason, e.message),
});
```

> The `server-only` package is optional: `npm i server-only`. Outside Next.js, remove that line.

## 5. Next.js (App Router)

### 5.1 Contact form with a Server Action

```tsx
// app/contact/actions.ts
"use server";

import { logger } from "@/lib/logger";

export type ContactState = { ok: boolean; message: string } | null;

export async function sendContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Anti-spam honeypot: this field is hidden in the HTML, so only bots fill it in
  if (formData.get("website")) return { ok: true, message: "Thanks!" };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return { ok: false, message: "Please fill in every field." };
  }

  const result = await logger.contact({ name, email, message, source: "/contact page" });

  return result.ok
    ? { ok: true, message: "Message sent! I'll get back to you soon." }
    : { ok: false, message: "Could not send right now. Please try again." };
}
```

```tsx
// app/contact/page.tsx
"use client";

import { useActionState } from "react";
import { sendContact } from "./actions";

export default function ContactPage() {
  const [state, action, pending] = useActionState(sendContact, null);

  return (
    <form action={action}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="E-mail" required />
      <textarea name="message" placeholder="Message" required />
      <input name="website" tabIndex={-1} autoComplete="off" hidden />
      <button disabled={pending}>{pending ? "Sending..." : "Send"}</button>
      {state && <p>{state.message}</p>}
    </form>
  );
}
```

> All user content is escaped automatically. If someone types `<script>` in the form, it doesn't break the message and isn't interpreted as HTML.

### 5.2 Contact form with a Route Handler (API)

Use this option if the front end is another app, or if you prefer `fetch("/api/contact")`:

```ts
// app/api/contact/route.ts
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.message) {
    return Response.json({ error: "Invalid data" }, { status: 400 });
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

### 5.3 Errors inside try/catch

```ts
// app/api/checkout/route.ts
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const order = await createOrder(await request.json());
    await logger.success("New sale 💰", { orderId: order.id, total: order.total });
    return Response.json(order);
  } catch (err) {
    await logger.error(err, { route: "/api/checkout", method: "POST" });
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### 5.4 Every 500 error automatically: `instrumentation.ts`

On Next.js 15 or later, the `onRequestError` hook captures every unhandled server error. This includes Server Components, Route Handlers, Server Actions and middleware. So you don't need try/catch everywhere.

```ts
// instrumentation.ts (at the project root, or in src/)
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

### 5.5 Client-side errors (Error Boundary)

The browser cannot call Telegram directly, because the token would be exposed. So the client sends the error to a route of yours, and that route sends it to Telegram:

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
  }, { title: "🖥️ Browser error" });
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
      <h2>Something went wrong.</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

> This route is public and can be abused to spam your channel. Consider adding a rate limit, for example with Upstash Ratelimit or the Vercel firewall.

### 5.6 Monitoring 404s

Alerting on **every** 404 creates a lot of noise, because bots scan `/wp-admin`, `.env` and other paths all the time. It's worth alerting only on routes that should exist, such as broken internal links or slugs that come from the database:

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from "next/navigation";
import { logger } from "@/lib/logger";

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    await logger.warn("404: post not found", { slug }, { disableNotification: true });
    notFound();
  }
  return <article>{post.title}</article>;
}
```

### 5.7 Edge Runtime and middleware

The library only uses `fetch`, so it works the same with `export const runtime = "edge"` and in `middleware.ts`.

## 6. React SPA (Vite, CRA)

A React app that runs only in the browser **cannot** hold the token. You need a minimal backend, which can be one of these:

- a serverless function (Vercel `api/`, Netlify Functions)
- a Cloudflare Worker
- your Express or Hono backend (see [section 7](#7-express-fastify-and-hono))

Example with a Vercel Function in a Vite project:

```ts
// api/contact.ts (Vercel picks it up automatically)
import { createTelegramLogger } from "@galhardoalex/telegram-logger";

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

## 7. Express, Fastify and Hono

### Express

```ts
import express from "express";
import { createTelegramLogger } from "@galhardoalex/telegram-logger";

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

// 500: Express error handlers must take 4 arguments
app.use(async (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  await logger.error(err, { method: req.method, path: req.originalUrl });
  res.status(500).json({ error: "Internal Server Error" });
});

// Errors outside of requests
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
import { createTelegramLogger } from "@galhardoalex/telegram-logger";

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

## 8. Cloudflare Workers and Edge

In Workers, environment variables arrive in `env`, not in `process.env`. Pass the token and chat id explicitly, and use `ctx.waitUntil` to send without delaying the response:

```ts
import { createTelegramLogger } from "@galhardoalex/telegram-logger";

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

To store the token as a secret: `wrangler secret put TELEGRAM_BOT_TOKEN`.

> On Vercel, the equivalent is `waitUntil` from `@vercel/functions`. Anywhere else, use `await`.

## 9. Deno and Bun

```ts
// Deno: deno add jsr:@galhardoalex/telegram-logger
// Run with: deno run --allow-net --allow-env main.ts
import { createTelegramLogger } from "@galhardoalex/telegram-logger";

const logger = createTelegramLogger({ appName: "deno-app" });
await logger.info("Hello from Deno 🦕");
```

Bun works exactly like Node: `bun add @galhardoalex/telegram-logger`. The `.env` file is loaded automatically.

## 10. Scripts, cron jobs and queues

```ts
const logger = createTelegramLogger({ appName: "jobs" });

const started = Date.now();
try {
  const count = await syncProducts();
  await logger.success("Product sync finished", { count, durationMs: Date.now() - started });
} catch (err) {
  await logger.error(err, { job: "sync-products" });
  process.exitCode = 1;
}
```

## 11. Automated tests

In tests, turn the logger off:

```ts
createTelegramLogger({ enabled: process.env.NODE_ENV !== "test" });
```

Or inject a fake `fetch` and check what would be sent:

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

## 12. Best practices

- **Always `await` in serverless functions.** Without it, the function may be frozen before the message goes out.
- **Use separate channels**: one for alerts (with notifications), another for leads, and another for events (with `disableNotification: true`).
- **Use `minLevel: "warn"` in production** if the channel gets too noisy.
- **Don't send sensitive data**, such as passwords, tokens, credit cards or ID documents. Metadata shows up as plain text in Telegram.
- **Respect Telegram's limits**: about 20 messages per minute to the same group or channel. The library waits and retries once on a 429. Even so, don't log inside loops.
- **The logger never throws.** If you need to know whether the message was delivered (for example, in a contact form), check `result.ok`.

## 13. Troubleshooting

| Symptom (`result.error.message`)        | Cause and fix                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `reason: "missing_config"`              | `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` isn't set in the environment where the code runs. Remember that Vercel has separate variables for Preview and Production. |
| `401 Unauthorized`                      | Wrong or revoked token. Generate a new one with `/token` in @BotFather.                  |
| `400 Bad Request: chat not found`       | The chat id is wrong, or the bot isn't in the channel. Channel ids start with `-100`.    |
| `403 Forbidden: bot is not a member`    | Add the bot to the channel or group.                                                     |
| `403 ... not enough rights`             | In a channel, the bot must be an **admin** with permission to post.                      |
| `400 ... message thread not found`      | The `messageThreadId` doesn't exist in that group.                                       |
| `reason: "timeout"`                     | The network to `api.telegram.org` is slow or blocked. Increase `timeoutMs`.              |
| Nothing arrives and `result.reason === "disabled"` | `enabled` is `false`, probably because `NODE_ENV` isn't `production`.         |
| Works locally but not on Vercel         | The function ended before the message was sent. Use `await` or `waitUntil`.              |
