// Smoke test of the JSR sources on Deno (no permissions granted on purpose).
import { createTelegramLogger } from "../src/mod.ts";

const logger = createTelegramLogger({
    botToken: "test",
    chatId: 1,
    fetch: () => Promise.resolve(new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }))),
});
const result = await logger.success("deploy finished");
if (!result.ok || result.messageId !== 7) throw new Error(`unexpected result: ${JSON.stringify(result)}`);

// Without --allow-env, reading TELEGRAM_* must not crash.
const fromEnv = await createTelegramLogger().info("x");
if (fromEnv.ok || fromEnv.reason !== "missing_config") throw new Error("env fallback should fail gracefully");
console.log("Deno OK");
