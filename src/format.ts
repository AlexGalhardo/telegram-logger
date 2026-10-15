import type { ContactData, LogMeta, MessageKind } from "./types.ts";

/** Telegram rejects messages longer than this (after entity parsing). */
export const MAX_MESSAGE_LENGTH = 4096;

const ICONS: Record<MessageKind, string> = {
  debug: "⚪",
  info: "🔵",
  success: "🟢",
  warn: "🟡",
  error: "🔴",
  fatal: "💀",
  contact: "📩",
};

const LABELS: Record<MessageKind, string> = {
  debug: "DEBUG",
  info: "INFO",
  success: "SUCCESS",
  warn: "WARNING",
  error: "ERROR",
  fatal: "FATAL",
  contact: "NEW CONTACT",
};

const CONTACT_FIELDS = ["name", "email", "phone", "subject"] as const;

/**
 * Escape text for Telegram's HTML parse mode.
 *
 * @param text Untrusted text.
 * @returns The text with `&`, `<` and `>` escaped.
 */
export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value === null || typeof value !== "object") {
    return String(value);
  }
  try {
    const json = JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
    return json ?? String(value);
  } catch {
    return String(value);
  }
}

interface Parts {
  title: string;
  body?: string;
  fields: [string, string][];
  block?: string;
  blockIsQuote?: boolean;
}

function describeInput(input: unknown): Pick<Parts, "title" | "body" | "block"> {
  if (input instanceof Error) {
    const stackLines = (input.stack ?? "").split("\n");
    // V8 stacks start with "Name: message"; keep only the frames.
    const frames = stackLines[0]?.includes(input.message) ? stackLines.slice(1) : stackLines;
    let block = frames
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");
    let cause: unknown = input.cause;
    for (let depth = 0; cause !== undefined && depth < 3; depth++) {
      block += `${block ? "\n" : ""}Caused by: ${stringify(cause)}`;
      cause = cause instanceof Error ? cause.cause : undefined;
    }
    return { title: `${input.name}: ${input.message}`, block: block || undefined };
  }
  if (typeof input === "string") {
    const [first = "", ...rest] = input.split("\n");
    return { title: first, body: rest.join("\n").trim() || undefined };
  }
  return { title: stringify(input) };
}

function header(kind: MessageKind, appName?: string, environment?: string): string {
  return [`${ICONS[kind]} <b>${LABELS[kind]}</b>`, appName, environment]
    .filter(Boolean)
    .map((part, i) => (i === 0 ? part : escapeHtml(part as string)))
    .join(" · ");
}

function render(head: string, parts: Parts, budget: number, timestamp: string): string {
  const lines = [head, `<b>${escapeHtml(truncate(parts.title, budget))}</b>`];
  if (parts.body) lines.push("", escapeHtml(truncate(parts.body, budget * 2)));
  if (parts.fields.length > 0) {
    lines.push("");
    for (const [key, value] of parts.fields) {
      lines.push(`<b>${escapeHtml(truncate(key, 64))}:</b> ${escapeHtml(truncate(value, budget))}`);
    }
  }
  if (parts.block) {
    const tag = parts.blockIsQuote ? "blockquote" : "pre";
    lines.push("", `<${tag}>${escapeHtml(truncate(parts.block, budget * 3))}</${tag}>`);
  }
  lines.push("", `🕒 ${timestamp}`);
  return lines.join("\n");
}

function fit(head: string, parts: Parts, timestamp: string): string {
  // Shrink per-section budgets until the whole message fits. Truncation happens before
  // escaping, so HTML tags and entities are never cut in half.
  for (let budget = 1200; budget >= 16; budget = Math.floor(budget / 2)) {
    const text = render(head, parts, budget, timestamp);
    if (text.length <= MAX_MESSAGE_LENGTH) return text;
  }
  return render(head, { title: parts.title, fields: [] }, 16, timestamp);
}

/** Options used by the formatters. */
export interface FormatContext {
  /** App name shown in the header. */
  appName?: string;
  /** Environment shown in the header. */
  environment?: string;
  /** Replaces the default title (first bold line). */
  title?: string;
  /** Clock used for the timestamp. Defaults to `new Date()`. */
  now?: Date;
}

/**
 * Build the Telegram-HTML text for a log message.
 *
 * @param kind Message kind (log level).
 * @param input The value being logged: an `Error`, a string or anything JSON-serializable.
 * @param meta Extra key/value context.
 * @param ctx App name, environment, title override and clock.
 * @returns Text ready to send with `parse_mode: "HTML"`, at most 4096 characters long.
 */
export function formatLog(kind: MessageKind, input: unknown, meta: LogMeta = {}, ctx: FormatContext = {}): string {
  const described = describeInput(input);
  const parts: Parts = {
    ...described,
    title: ctx.title ?? described.title,
    body:
      ctx.title !== undefined && described.title !== ctx.title
        ? [described.title, described.body].filter(Boolean).join("\n")
        : described.body,
    fields: Object.entries(meta)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stringify(v)]),
  };
  const timestamp = (ctx.now ?? new Date()).toISOString();
  return fit(header(kind, ctx.appName, ctx.environment), parts, timestamp);
}

/**
 * Build the Telegram-HTML text for a contact form submission.
 *
 * @param data Form fields.
 * @param ctx App name, environment, title override and clock.
 * @returns Text ready to send with `parse_mode: "HTML"`, at most 4096 characters long.
 */
export function formatContact(data: ContactData, ctx: FormatContext = {}): string {
  const { message, ...rest } = data;
  const known = CONTACT_FIELDS.filter((f) => rest[f] !== undefined && rest[f] !== "");
  const extra = Object.keys(rest).filter(
    (k) => !(CONTACT_FIELDS as readonly string[]).includes(k) && rest[k] !== undefined,
  );
  const parts: Parts = {
    title: ctx.title ?? (typeof data.name === "string" && data.name ? `From ${data.name}` : "New message"),
    fields: [...known, ...extra].map((k) => [k, stringify(rest[k])]),
    block: message === undefined || message === "" ? undefined : stringify(message),
    blockIsQuote: true,
  };
  const timestamp = (ctx.now ?? new Date()).toISOString();
  return fit(header("contact", ctx.appName, ctx.environment), parts, timestamp);
}
