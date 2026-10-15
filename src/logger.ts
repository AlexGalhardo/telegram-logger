import { formatContact, formatLog } from "./format.ts";
import {
  type ChatId,
  type LogLevel,
  type LogMeta,
  type MessageKind,
  type SendOptions,
  type SendResult,
  type TelegramLogger,
  TelegramLoggerError,
  type TelegramLoggerOptions,
} from "./types.ts";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  success: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRY_AFTER_SECONDS = 5;
const DEFAULT_API_BASE_URL = "https://api.telegram.org";

interface TelegramResponse {
  ok: boolean;
  result?: { message_id: number };
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
}

/** Read an environment variable on Node, Bun, Deno or edge runtimes without crashing anywhere. */
function readEnv(name: string): string | undefined {
  try {
    const g = globalThis as {
      process?: { env?: Record<string, string | undefined> };
      Deno?: { env?: { get(key: string): string | undefined } };
    };
    return g.process?.env?.[name] ?? g.Deno?.env?.get(name) ?? undefined;
  } catch {
    // Deno without --allow-env throws; treat as unset.
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a Telegram logger.
 *
 * Every method returns a promise that always resolves (never rejects) with a {@linkcode SendResult}.
 * In serverless functions, `await` the call so the request finishes before the function is frozen.
 *
 * @example
 * ```ts
 * import { createTelegramLogger } from "@galhardoalex/telegram-logger";
 *
 * const logger = createTelegramLogger({
 *   botToken: process.env.TELEGRAM_BOT_TOKEN,
 *   chatId: process.env.TELEGRAM_CHAT_ID,
 *   appName: "my-site",
 * });
 *
 * try {
 *   await checkout();
 * } catch (err) {
 *   await logger.error(err, { route: "/api/checkout" });
 * }
 * ```
 *
 * @param options Logger configuration. `botToken` and `chatId` fall back to the
 * `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` environment variables.
 * @returns A {@linkcode TelegramLogger}.
 */
export function createTelegramLogger(options: TelegramLoggerOptions = {}): TelegramLogger {
  const {
    appName,
    environment,
    enabled = true,
    minLevel = "debug",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetryAfterSeconds = DEFAULT_MAX_RETRY_AFTER_SECONDS,
    disableNotification = false,
    messageThreadId,
    onError,
    apiBaseUrl = DEFAULT_API_BASE_URL,
  } = options;

  function fail(result: SendResult & { ok: false }): SendResult {
    if (result.error && onError) {
      try {
        onError(result.error);
      } catch {
        // A broken onError must not break the caller either.
      }
    }
    return result;
  }

  async function deliver(kind: MessageKind, text: string, sendOptions: SendOptions): Promise<SendResult> {
    const botToken = options.botToken ?? readEnv("TELEGRAM_BOT_TOKEN");
    const chatId: ChatId | undefined =
      sendOptions.chatId ?? options.chatIds?.[kind] ?? options.chatId ?? readEnv("TELEGRAM_CHAT_ID");
    if (!botToken || chatId === undefined || chatId === "") {
      return fail({
        ok: false,
        reason: "missing_config",
        error: new TelegramLoggerError(
          "missing_config",
          "Missing botToken or chatId. Pass them to createTelegramLogger() or set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
        ),
      });
    }

    const doFetch = options.fetch ?? globalThis.fetch;
    const threadId = sendOptions.messageThreadId ?? messageThreadId;
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      disable_notification: sendOptions.disableNotification ?? disableNotification,
      ...(threadId === undefined ? {} : { message_thread_id: threadId }),
    });

    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await doFetch(`${apiBaseUrl}/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (cause) {
        const isTimeout = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
        const reason = isTimeout ? "timeout" : "network_error";
        const message = isTimeout ? `Telegram did not answer within ${timeoutMs}ms` : "Could not reach Telegram";
        return fail({ ok: false, reason, error: new TelegramLoggerError(reason, message, { cause }) });
      }

      let data: TelegramResponse | undefined;
      try {
        data = (await response.json()) as TelegramResponse;
      } catch {
        data = undefined;
      }

      if (response.ok && data?.ok && data.result) {
        return { ok: true, messageId: data.result.message_id };
      }

      const retryAfter = data?.parameters?.retry_after;
      if (response.status === 429 && attempt === 0 && retryAfter !== undefined && retryAfter <= maxRetryAfterSeconds) {
        await sleep(retryAfter * 1000);
        continue;
      }

      return fail({
        ok: false,
        reason: "telegram_error",
        error: new TelegramLoggerError(
          "telegram_error",
          `Telegram API error ${response.status}: ${data?.description ?? response.statusText}`,
          { status: response.status },
        ),
      });
    }
  }

  function log(level: LogLevel, input: unknown, meta?: LogMeta, sendOptions: SendOptions = {}): Promise<SendResult> {
    if (!enabled) return Promise.resolve({ ok: false, reason: "disabled" });
    if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return Promise.resolve({ ok: false, reason: "below_min_level" });
    const text = formatLog(level, input, meta, { appName, environment, title: sendOptions.title });
    return deliver(level, text, sendOptions);
  }

  return {
    log,
    debug: (input, meta, opts) => log("debug", input, meta, opts),
    info: (input, meta, opts) => log("info", input, meta, opts),
    success: (input, meta, opts) => log("success", input, meta, opts),
    warn: (input, meta, opts) => log("warn", input, meta, opts),
    error: (input, meta, opts) => log("error", input, meta, opts),
    fatal: (input, meta, opts) => log("fatal", input, meta, opts),
    contact(data, sendOptions = {}) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "disabled" });
      const text = formatContact(data, { appName, environment, title: sendOptions.title });
      return deliver("contact", text, sendOptions);
    },
    send(html, sendOptions = {}) {
      if (!enabled) return Promise.resolve({ ok: false, reason: "disabled" });
      return deliver("info", html, sendOptions);
    },
  };
}
