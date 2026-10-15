/** Severity levels, from least to most severe. */
export type LogLevel = "debug" | "info" | "success" | "warn" | "error" | "fatal";

/** Every kind of message the logger can send: the log levels plus `contact`. */
export type MessageKind = LogLevel | "contact";

/** A Telegram chat identifier: a numeric id (e.g. `-1001234567890`) or a public `@channelusername`. */
export type ChatId = string | number;

/** Arbitrary key/value context attached to a message (route, userId, request id, ...). */
export type LogMeta = Record<string, unknown>;

/** Configuration for {@linkcode createTelegramLogger}. */
export interface TelegramLoggerOptions {
    /**
     * Bot token from [@BotFather](https://t.me/BotFather).
     * Falls back to the `TELEGRAM_BOT_TOKEN` environment variable.
     */
    botToken?: string;
    /**
     * Default chat that receives every message.
     * Falls back to the `TELEGRAM_CHAT_ID` environment variable.
     */
    chatId?: ChatId;
    /**
     * Per-kind chat overrides. Kinds without an entry use {@linkcode TelegramLoggerOptions.chatId}.
     *
     * @example
     * ```ts
     * chatIds: { error: "-100111", fatal: "-100111", contact: "-100222" }
     * ```
     */
    chatIds?: Partial<Record<MessageKind, ChatId>>;
    /** App name shown in the header of every message (e.g. `"my-site"`). */
    appName?: string;
    /** Environment shown in the header of every message (e.g. `"production"`). */
    environment?: string;
    /** Set to `false` to turn the logger into a no-op (e.g. in local development). Defaults to `true`. */
    enabled?: boolean;
    /** Log levels below this one are skipped. `contact` messages are never filtered. Defaults to `"debug"`. */
    minLevel?: LogLevel;
    /** Timeout in milliseconds for each request to the Telegram API. Defaults to `5000`. */
    timeoutMs?: number;
    /**
     * When Telegram answers `429 Too Many Requests`, wait for `retry_after` and try once more,
     * as long as the wait is at most this many seconds. Set to `0` to disable. Defaults to `5`.
     */
    maxRetryAfterSeconds?: number;
    /** Send messages silently (no notification sound). Defaults to `false`. */
    disableNotification?: boolean;
    /** Topic (thread) id when the target chat is a forum supergroup. */
    messageThreadId?: number;
    /** Called whenever a message fails to send. The logger itself never throws. */
    onError?: (error: TelegramLoggerError) => void;
    /** Custom `fetch` implementation. Defaults to `globalThis.fetch`. */
    fetch?: (url: string, init: RequestInit) => Promise<Response>;
    /** Telegram Bot API base URL. Defaults to `"https://api.telegram.org"`. */
    apiBaseUrl?: string;
}

/** Per-call overrides accepted by every logger method. */
export interface SendOptions {
    /** Send this message to a different chat. */
    chatId?: ChatId;
    /** Replace the default title (first bold line) of the message. */
    title?: string;
    /** Send this message silently. */
    disableNotification?: boolean;
    /** Topic (thread) id when the target chat is a forum supergroup. */
    messageThreadId?: number;
}

/** Data captured by a typical contact form. Extra fields are listed below the known ones. */
export interface ContactData {
    /** Name of the person who submitted the form. */
    name?: string;
    /** E-mail address. */
    email?: string;
    /** Phone number. */
    phone?: string;
    /** Subject line. */
    subject?: string;
    /** Free-text message. */
    message?: string;
    /** Any other form field. */
    [field: string]: unknown;
}

/** Why a message was not delivered. */
export type FailureReason =
    | "disabled"
    | "below_min_level"
    | "missing_config"
    | "telegram_error"
    | "network_error"
    | "timeout";

/** Outcome of a send. Logger methods always resolve, never reject. */
export type SendResult =
    | {
          /** The message was delivered. */
          ok: true;
          /** Id of the message created in the chat. */
          messageId: number;
      }
    | {
          /** The message was not delivered. */
          ok: false;
          /** Why it was not delivered. */
          reason: FailureReason;
          /** Details of the failure, when there is an error behind it. */
          error?: TelegramLoggerError;
      };

/** Error describing a failed delivery. Passed to `onError` and returned in {@linkcode SendResult}. */
export class TelegramLoggerError extends Error {
    /** Machine-readable failure category. */
    readonly reason: FailureReason;
    /** HTTP status code returned by Telegram, when there was a response. */
    readonly status?: number;

    /**
     * @param reason Machine-readable failure category.
     * @param message Human-readable description.
     * @param options Optional HTTP status and underlying cause.
     */
    constructor(reason: FailureReason, message: string, options: { status?: number; cause?: unknown } = {}) {
        super(message, { cause: options.cause });
        this.name = "TelegramLoggerError";
        this.reason = reason;
        this.status = options.status;
    }
}

/** The object returned by {@linkcode createTelegramLogger}. */
export interface TelegramLogger {
    /** Send a message with an explicit level. */
    log(level: LogLevel, input: unknown, meta?: LogMeta, options?: SendOptions): Promise<SendResult>;
    /** ⚪ Debug message. */
    debug(input: unknown, meta?: LogMeta, options?: SendOptions): Promise<SendResult>;
    /** 🔵 Informational message. */
    info(input: unknown, meta?: LogMeta, options?: SendOptions): Promise<SendResult>;
    /** 🟢 Something good happened (a sale, a deploy, a sign-up). */
    success(input: unknown, meta?: LogMeta, options?: SendOptions): Promise<SendResult>;
    /** 🟡 Warning. */
    warn(input: unknown, meta?: LogMeta, options?: SendOptions): Promise<SendResult>;
    /** 🔴 Error. Pass the caught value directly: `Error` objects include their stack and cause. */
    error(input: unknown, meta?: LogMeta, options?: SendOptions): Promise<SendResult>;
    /** 💀 Fatal error. */
    fatal(input: unknown, meta?: LogMeta, options?: SendOptions): Promise<SendResult>;
    /** 📩 Contact form submission. Never filtered by `minLevel`. */
    contact(data: ContactData, options?: SendOptions): Promise<SendResult>;
    /** Send raw Telegram-HTML text as is, without header or formatting. You must escape user input yourself (see `escapeHtml`). */
    send(html: string, options?: SendOptions): Promise<SendResult>;
}
