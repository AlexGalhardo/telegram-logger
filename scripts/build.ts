// Builds the npm package: ESM + CJS bundles and .d.ts/.d.cts declarations.
// JSR does not use this; it publishes the TypeScript sources in src/ directly.

import { readdir, rm } from "node:fs/promises";
import { $ } from "bun";

await rm("dist", { recursive: true, force: true });

for (const [format, ext] of [
  ["esm", "js"],
  ["cjs", "cjs"],
] as const) {
  const result = await Bun.build({
    entrypoints: ["src/mod.ts"],
    outdir: "dist",
    format,
    target: "browser", // platform-neutral: only uses fetch, no Node built-ins
    naming: `[name].${ext}`,
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
}

await $`tsc -p tsconfig.build.json`;

// Mirror declarations for the CommonJS entry (.d.ts -> .d.cts with .cjs specifiers).
for (const file of await readdir("dist")) {
  if (!file.endsWith(".d.ts")) continue;
  const source = await Bun.file(`dist/${file}`).text();
  const esm = source.replace(/(from\s+["']\.\/[\w-]+)\.ts(["'])/g, "$1.js$2");
  await Bun.write(`dist/${file}`, esm);
  await Bun.write(
    `dist/${file.replace(/\.d\.ts$/, ".d.cts")}`,
    esm.replace(/(from\s+["']\.\/[\w-]+)\.js(["'])/g, "$1.cjs$2"),
  );
}

console.log("Built:", (await readdir("dist")).sort().join(", "));
