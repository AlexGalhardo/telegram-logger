import { afterEach, describe, expect, test } from "bun:test";
import { createTelegramLogger, TelegramLoggerError, type TelegramLoggerOptions } from "../src/mod.ts";

interface Call {
    url: string;
    body: Record<string, unknown>;
}

function mockFetch(responses: Array<{ status?: number; json: unknown } | Error> = []) {
    const calls: Call[] = [];
    let i = 0;
    const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        const next = responses[i++] ?? { json: { ok: true, result: { message_id: 1 } } };
        if (next instanceof Error) throw next;
        return new Response(JSON.stringify(next.json), { status: next.status ?? 200 });
    }) as typeof globalThis.fetch;
    return { fetch, calls };
}

function make(opts: TelegramLoggerOptions = {}, responses?: Parameters<typeof mockFetch>[0]) {
    const mock = mockFetch(responses);
    const logger = createTelegramLogger({ botToken: "123:abc", chatId: "-100", fetch: mock.fetch, ...opts });
    return { logger, calls: mock.calls };
}

const ENV_KEYS = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] as const;
afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
});

describe("sending", () => {
    test("posts to sendMessage with HTML parse mode", async () => {
        const { logger, calls } = make({ appName: "site" });
        const result = await logger.info("hello");
        expect(result).toEqual({ ok: true, messageId: 1 });
        expect(calls).toHaveLength(1);
        expect(calls[0]?.url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
        expect(calls[0]?.body).toMatchObject({ chat_id: "-100", parse_mode: "HTML", disable_notification: false });
        expect(calls[0]?.body.text).toContain("🔵 <b>INFO</b> · site");
    });

    test("routes by kind and per-call chatId", async () => {
        const { logger, calls } = make({ chatIds: { error: "-err", contact: "-leads" } });
        await logger.error("boom");
        await logger.contact({ name: "Ana" });
        await logger.warn("careful");
        await logger.error("x", {}, { chatId: "-override" });
        expect(calls.map((c) => c.body.chat_id)).toEqual(["-err", "-leads", "-100", "-override"]);
    });

    test("passes thread id and silent flag", async () => {
        const { logger, calls } = make({ messageThreadId: 7 });
        await logger.info("a", {}, { disableNotification: true });
        expect(calls[0]?.body).toMatchObject({ message_thread_id: 7, disable_notification: true });
    });

    test("send() delivers raw html", async () => {
        const { logger, calls } = make();
        await logger.send("<i>raw</i>");
        expect(calls[0]?.body.text).toBe("<i>raw</i>");
    });
});

describe("filtering", () => {
    test("enabled: false skips everything", async () => {
        const { logger, calls } = make({ enabled: false });
        expect(await logger.error("x")).toEqual({ ok: false, reason: "disabled" });
        expect(await logger.contact({ name: "a" })).toEqual({ ok: false, reason: "disabled" });
        expect(calls).toHaveLength(0);
    });

    test("minLevel filters lower levels but never contact", async () => {
        const { logger, calls } = make({ minLevel: "warn" });
        expect(await logger.info("x")).toEqual({ ok: false, reason: "below_min_level" });
        expect((await logger.warn("x")).ok).toBe(true);
        expect((await logger.contact({ name: "a" })).ok).toBe(true);
        expect(calls).toHaveLength(2);
    });
});

describe("configuration", () => {
    test("falls back to environment variables", async () => {
        process.env.TELEGRAM_BOT_TOKEN = "env:token";
        process.env.TELEGRAM_CHAT_ID = "-env";
        const mock = mockFetch();
        const logger = createTelegramLogger({ fetch: mock.fetch });
        await logger.info("x");
        expect(mock.calls[0]?.url).toContain("/botenv:token/");
        expect(mock.calls[0]?.body.chat_id).toBe("-env");
    });

    test("missing config resolves with missing_config and calls onError", async () => {
        const errors: TelegramLoggerError[] = [];
        const mock = mockFetch();
        const logger = createTelegramLogger({ fetch: mock.fetch, onError: (e) => errors.push(e) });
        const result = await logger.error("x");
        expect(result.ok).toBe(false);
        expect(!result.ok && result.reason).toBe("missing_config");
        expect(errors[0]).toBeInstanceOf(TelegramLoggerError);
        expect(mock.calls).toHaveLength(0);
    });
});

describe("failures never throw", () => {
    test("telegram error", async () => {
        const errors: TelegramLoggerError[] = [];
        const { logger } = make({ onError: (e) => errors.push(e) }, [
            { status: 400, json: { ok: false, error_code: 400, description: "Bad Request: chat not found" } },
        ]);
        const result = await logger.error("x");
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error?.status).toBe(400);
        expect(errors[0]?.message).toContain("chat not found");
    });

    test("network error", async () => {
        const { logger } = make({}, [new TypeError("fetch failed")]);
        const result = await logger.error("x");
        expect(!result.ok && result.reason).toBe("network_error");
    });

    test("timeout", async () => {
        const err = new Error("timed out");
        err.name = "TimeoutError";
        const { logger } = make({}, [err]);
        const result = await logger.error("x");
        expect(!result.ok && result.reason).toBe("timeout");
    });

    test("a throwing onError is swallowed", async () => {
        const { logger } = make(
            {
                onError: () => {
                    throw new Error("bad handler");
                },
            },
            [new TypeError("down")],
        );
        expect((await logger.error("x")).ok).toBe(false);
    });

    test("non-JSON response", async () => {
        const fetch = (async () =>
            new Response("<html>bad gateway</html>", { status: 502 })) as unknown as typeof globalThis.fetch;
        const logger = createTelegramLogger({ botToken: "t", chatId: 1, fetch });
        const result = await logger.error("x");
        expect(!result.ok && result.error?.status).toBe(502);
    });
});

describe("rate limiting", () => {
    test("retries once after retry_after", async () => {
        const { logger, calls } = make({}, [
            { status: 429, json: { ok: false, error_code: 429, parameters: { retry_after: 0 } } },
            { json: { ok: true, result: { message_id: 9 } } },
        ]);
        expect(await logger.error("x")).toEqual({ ok: true, messageId: 9 });
        expect(calls).toHaveLength(2);
    });

    test("does not wait when retry_after is above the limit", async () => {
        const { logger, calls } = make({ maxRetryAfterSeconds: 1 }, [
            { status: 429, json: { ok: false, error_code: 429, parameters: { retry_after: 30 } } },
        ]);
        const result = await logger.error("x");
        expect(!result.ok && result.error?.status).toBe(429);
        expect(calls).toHaveLength(1);
    });
});
