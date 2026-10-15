import { describe, expect, test } from "bun:test";
import { escapeHtml, formatContact, formatLog, MAX_MESSAGE_LENGTH } from "../src/mod.ts";

const now = new Date("2026-10-15T14:40:00.000Z");

describe("escapeHtml", () => {
    test("escapes &, < and >", () => {
        expect(escapeHtml("<b>a & b</b>")).toBe("&lt;b&gt;a &amp; b&lt;/b&gt;");
    });
});

describe("formatLog", () => {
    test("string input with header and meta", () => {
        const text = formatLog(
            "warn",
            "Disk almost full\nOnly 2% left",
            { host: "web-1", pct: 98 },
            {
                appName: "api",
                environment: "production",
                now,
            },
        );
        expect(text).toBe(
            [
                "🟡 <b>WARNING</b> · api · production",
                "<b>Disk almost full</b>",
                "",
                "Only 2% left",
                "",
                "<b>host:</b> web-1",
                "<b>pct:</b> 98",
                "",
                "🕒 2026-10-15T14:40:00.000Z",
            ].join("\n"),
        );
    });

    test("Error input includes stack frames and cause", () => {
        const err = new TypeError("Cannot read 'id'", { cause: new Error("db down") });
        const text = formatLog("error", err, {}, { now });
        expect(text).toContain("<b>TypeError: Cannot read 'id'</b>");
        expect(text).toContain("<pre>");
        expect(text).toContain("Caused by: Error: db down");
    });

    test("escapes user content", () => {
        const text = formatLog("info", "<script>", { "<k>": "a & b" }, { now });
        expect(text).toContain("<b>&lt;script&gt;</b>");
        expect(text).toContain("<b>&lt;k&gt;:</b> a &amp; b");
    });

    test("serializes objects, bigint and circular values", () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        const text = formatLog("info", { a: 1 }, { big: 10n, circular, skip: undefined }, { now });
        expect(text).toContain('<b>{"a":1}</b>');
        expect(text).toContain("<b>big:</b> 10");
        expect(text).toContain("<b>circular:</b> [object Object]");
        expect(text).not.toContain("skip");
    });

    test("custom title keeps the original as body", () => {
        const text = formatLog("error", new Error("boom"), {}, { title: "Checkout failed", now });
        expect(text).toContain("<b>Checkout failed</b>\n\nError: boom");
    });

    test("never exceeds Telegram's limit", () => {
        const huge = "x<".repeat(10_000);
        const err = new Error(huge);
        err.stack = `Error: ${huge}\n${"    at fn (file.ts:1:1)\n".repeat(2000)}`;
        const meta = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, huge]));
        const text = formatLog("fatal", err, meta, { now });
        expect(text.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
        expect(text).toContain("💀 <b>FATAL</b>");
        expect(text).toContain("🕒");
    });
});

describe("formatContact", () => {
    test("known fields first, extras after, message quoted", () => {
        const text = formatContact(
            { message: "I want a quote", budget: "5k", email: "ana@example.com", name: "Ana" },
            { appName: "landing", now },
        );
        expect(text).toBe(
            [
                "📩 <b>NEW CONTACT</b> · landing",
                "<b>From Ana</b>",
                "",
                "<b>name:</b> Ana",
                "<b>email:</b> ana@example.com",
                "<b>budget:</b> 5k",
                "",
                "<blockquote>I want a quote</blockquote>",
                "",
                "🕒 2026-10-15T14:40:00.000Z",
            ].join("\n"),
        );
    });

    test("works without a name or message", () => {
        const text = formatContact({ email: "x@y.z" }, { now });
        expect(text).toContain("<b>New message</b>");
        expect(text).not.toContain("blockquote");
    });
});
