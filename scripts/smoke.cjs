// Smoke test of the built CommonJS bundle.
const assert = require("node:assert/strict");
const { createTelegramLogger, escapeHtml } = require("../dist/mod.cjs");

assert.equal(typeof createTelegramLogger, "function");
assert.equal(escapeHtml("<a>"), "&lt;a&gt;");
createTelegramLogger({ enabled: false })
  .info("x")
  .then((r) => {
    assert.deepEqual(r, { ok: false, reason: "disabled" });
    console.log(`CJS OK on Node ${process.version}`);
  });
