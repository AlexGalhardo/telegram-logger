// Smoke test of the built ESM bundle (run in CI on every supported Node version).
import assert from "node:assert/strict";
import { createTelegramLogger, formatLog } from "../dist/mod.js";

const calls = [];
const logger = createTelegramLogger({
    botToken: "test",
    chatId: 1,
    fetch: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    },
});
assert.deepEqual(await logger.error(new Error("boom")), { ok: true, messageId: 1 });
assert.match(calls[0].body.text, /🔴 <b>ERROR<\/b>/);
assert.match(formatLog("info", "hi"), /<b>hi<\/b>/);

const failing = createTelegramLogger({ botToken: "t", chatId: 1, timeoutMs: 1, apiBaseUrl: "http://10.255.255.1" });
const result = await failing.error("x");
assert.equal(result.ok, false);
console.log(`ESM OK on Node ${process.version}`);
