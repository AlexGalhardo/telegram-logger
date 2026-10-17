# telegram-logger

[![JSR](https://jsr.io/badges/@galhardoalex/telegram-logger)](https://jsr.io/@galhardoalex/telegram-logger)
[![JSR Score](https://jsr.io/badges/@galhardoalex/telegram-logger/score)](https://jsr.io/@galhardoalex/telegram-logger)
[![npm](https://img.shields.io/npm/v/@galhardoalex/telegram-logger)](https://www.npmjs.com/package/@galhardoalex/telegram-logger)
[![CI](https://github.com/AlexGalhardo/telegram-logger/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexGalhardo/telegram-logger/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Send errors, warnings, events and contact-form submissions to your **Telegram** chats and channels.

- **Zero dependencies**: uses the native `fetch`.
- **Runs anywhere**: Node.js 18+, Bun, Deno, Next.js (Node and Edge), Cloudflare Workers.
- **Never throws**: a failed delivery never crashes your app or your `catch` block.
- **Fully typed**: written in TypeScript, ships ESM, CommonJS and type declarations.
- **Readable messages**: emoji levels, app name, environment, metadata, stack traces and causes.
- **Safe**: user content is HTML-escaped and every message is kept under Telegram's 4096-character limit.

```text
🔴 ERROR · my-site · production
TypeError: Cannot read properties of undefined (reading 'id')

route: /api/checkout
userId: 42

at POST (app/api/checkout/route.ts:12:20)
...
🕒 2026-10-15T14:40:00.000Z
```

## Install

**npm**

```bash
npm install @galhardoalex/telegram-logger
```

**pnpm**

```bash
pnpm add @galhardoalex/telegram-logger
```

**yarn**

```bash
yarn add @galhardoalex/telegram-logger
```

**bun**

```bash
bun add @galhardoalex/telegram-logger
```

**deno**

```bash
deno add jsr:@galhardoalex/telegram-logger
```

**From JSR, with any package manager**

```bash
npx jsr add @galhardoalex/telegram-logger
```

## Get a bot token and a chat id

1. Open [@BotFather](https://t.me/BotFather), send `/newbot`, and copy the **token**.
2. Add the bot to your channel or group. In a channel, make it an **admin** so it can post.
3. Send any message in that chat, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id`.
4. Put both values in your environment:

```bash
TELEGRAM_BOT_TOKEN=123456789:AAH...
TELEGRAM_CHAT_ID=1477312914
```

> ⚠️ Keep the token on the **server**. Never expose it to the browser (no `NEXT_PUBLIC_` prefix).

## Usage

```ts
import { createTelegramLogger } from "@galhardoalex/telegram-logger";

export const logger = createTelegramLogger({
  botToken: process.env.TELEGRAM_BOT_TOKEN, // optional: falls back to TELEGRAM_BOT_TOKEN
  chatId: process.env.TELEGRAM_CHAT_ID, // optional: falls back to TELEGRAM_CHAT_ID
  appName: "my-site",
  environment: process.env.NODE_ENV,
});

// Errors: pass whatever you caught. Error objects include their stack and cause.
try {
  await chargeCustomer();
} catch (err) {
  await logger.error(err, { route: "/api/checkout", userId: 42 });
}

// Other levels
await logger.debug("Cache miss", { key: "home" });
await logger.info("Cron job finished", { durationMs: 1234 });
await logger.success("New subscription 🎉", { plan: "pro" });
await logger.warn("404 Not Found", { path: "/old-page" });
await logger.fatal(new Error("Database unreachable"));

// Contact forms
await logger.contact({
  name: "Ana",
  email: "ana@example.com",
  phone: "+55 11 99999-9999",
  message: "I'd like a quote for a new website.",
  budget: "R$ 5.000", // any extra field is listed too
});
```

> In serverless functions (Vercel, Netlify, AWS Lambda...) always **`await`** the call. Otherwise the function may be frozen before the message is sent.

## Different chats per message type

```ts
const logger = createTelegramLogger({
  chatId: "100111", // default chat
  chatIds: {
    error: "100222", // errors and fatals go to #alerts
    fatal: "100222",
    contact: "100333", // leads go to #leads
  },
});

await logger.info("Goes to -100111");
await logger.error("Goes to -100222");
await logger.warn("Goes to -100444", {}, { chatId: "-100444" }); // per-call override
```

## Options

| Option                 | Type                               | Default                    | Description                                                                          |
| ---------------------- | ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `botToken`             | `string`                           | `env.TELEGRAM_BOT_TOKEN`   | Bot token from @BotFather.                                                           |
| `chatId`               | `string \| number`                 | `env.TELEGRAM_CHAT_ID`     | Default chat.                                                                        |
| `chatIds`              | `{ [kind]: chatId }`               | `{}`                       | Per-kind chats (`debug`, `info`, `success`, `warn`, `error`, `fatal`, `contact`).    |
| `appName`              | `string`                           | none                       | Shown in the message header.                                                         |
| `environment`          | `string`                           | none                       | Shown in the message header.                                                         |
| `enabled`              | `boolean`                          | `true`                     | `false` turns every method into a no-op.                                             |
| `minLevel`             | `LogLevel`                         | `"debug"`                  | Skip lower levels. `contact` is never skipped.                                       |
| `timeoutMs`            | `number`                           | `5000`                     | Timeout of each request to Telegram.                                                 |
| `maxRetryAfterSeconds` | `number`                           | `5`                        | On HTTP 429, wait `retry_after` and retry once if it is at most this. `0` disables.  |
| `disableNotification`  | `boolean`                          | `false`                    | Send silently.                                                                       |
| `messageThreadId`      | `number`                           | none                       | Topic id in forum supergroups.                                                       |
| `onError`              | `(error: TelegramLoggerError) => void` | none                   | Called when a message fails to send.                                                 |
| `fetch`                | `(url, init) => Promise<Response>` | `globalThis.fetch`         | Custom fetch (proxies, tests).                                                       |
| `apiBaseUrl`           | `string`                           | `https://api.telegram.org` | Custom Bot API server.                                                               |

Every method also accepts per-call options as its last argument: `{ chatId, title, disableNotification, messageThreadId }`.

## Methods

| Method                                        | Description                                         |
| --------------------------------------------- | --------------------------------------------------- |
| `debug` / `info` / `success` / `warn` / `error` / `fatal` `(input, meta?, options?)` | Log at that level. `input` can be an `Error`, a string or any value. |
| `log(level, input, meta?, options?)`          | Log with a dynamic level.                           |
| `contact(data, options?)`                     | Format a contact-form submission.                   |
| `send(html, options?)`                        | Send your own [Telegram HTML](https://core.telegram.org/bots/api#html-style) as is. Escape user input with `escapeHtml`. |

All methods return `Promise<SendResult>` and **never reject**:

```ts
const result = await logger.error(err);
if (!result.ok) {
  // result.reason: "disabled" | "below_min_level" | "missing_config" | "telegram_error" | "network_error" | "timeout"
  console.warn("Telegram delivery failed:", result.reason, result.error?.message);
}
```

The formatters are exported too (`formatLog`, `formatContact`, `escapeHtml`), in case you want to build messages yourself.

## Recipes

- **Disable in development:** `enabled: process.env.NODE_ENV === "production"`.
- **Only important stuff:** `minLevel: "warn"`.
- **Custom title:** `logger.error(err, meta, { title: "💳 Checkout failed" })`.

## Documentation

| Guide                                                        | 🇺🇸 English                                                                                                                 | 🇧🇷 Português                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Usage guide**: Next.js, React, Express, Hono, Workers, Deno... | [docs/en/setup.md](https://github.com/AlexGalhardo/telegram-logger/blob/main/docs/en/setup.md)                           | [docs/pt-br/setup.md](https://github.com/AlexGalhardo/telegram-logger/blob/main/docs/pt-br/setup.md)                           |
| **Releasing**: publishing and updating on npm and JSR        | [docs/en/how-to-deploy-and-update-this-package.md](https://github.com/AlexGalhardo/telegram-logger/blob/main/docs/en/how-to-deploy-and-update-this-package.md) | [docs/pt-br/how-to-deploy-and-update-this-package.md](https://github.com/AlexGalhardo/telegram-logger/blob/main/docs/pt-br/how-to-deploy-and-update-this-package.md) |

## Contributing

```bash
bun install
bun run check   # lint + typecheck + tests + build + package validation
```

See [CONTRIBUTING.md](https://github.com/AlexGalhardo/telegram-logger/blob/main/CONTRIBUTING.md). To report a vulnerability, see [SECURITY.md](https://github.com/AlexGalhardo/telegram-logger/blob/main/SECURITY.md).

## License

[MIT](LICENSE) © Alex Galhardo
