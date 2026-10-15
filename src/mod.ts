/**
 * Zero-dependency logger that sends errors, warnings, events and contact-form
 * submissions to your Telegram chats and channels.
 *
 * Works on Node.js 18+, Bun, Deno, Cloudflare Workers and Vercel/Next.js Edge.
 *
 * @example
 * ```ts
 * import { createTelegramLogger } from "@galhardoalex/telegram-logger";
 *
 * const logger = createTelegramLogger({
 *   botToken: process.env.TELEGRAM_BOT_TOKEN,
 *   chatId: process.env.TELEGRAM_CHAT_ID,
 *   appName: "my-site",
 *   environment: "production",
 * });
 *
 * await logger.error(new Error("Payment failed"), { orderId: 42 });
 * await logger.contact({ name: "Ana", email: "ana@example.com", message: "Hi!" });
 * ```
 *
 * @module
 */

export { escapeHtml, type FormatContext, formatContact, formatLog, MAX_MESSAGE_LENGTH } from "./format.ts";
export { createTelegramLogger } from "./logger.ts";
export {
  type ChatId,
  type ContactData,
  type FailureReason,
  type LogLevel,
  type LogMeta,
  type MessageKind,
  type SendOptions,
  type SendResult,
  type TelegramLogger,
  TelegramLoggerError,
  type TelegramLoggerOptions,
} from "./types.ts";
