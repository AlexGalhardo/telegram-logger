# AGENTS.md

Context for AI coding agents working on this repository. Human contributors: see [CONTRIBUTING.md](CONTRIBUTING.md).

## What this is

`@galhardoalex/telegram-logger`: a zero-dependency TypeScript logger that sends errors, warnings, events and
contact-form submissions to Telegram chats via the Bot API. Published to **npm** (built `dist/`, ESM + CJS) and
**JSR** (raw TypeScript from `src/`). Must run unchanged on Node 18+, Bun, Deno, Next.js and edge runtimes.

## Layout

```
src/mod.ts        public entry point; every export goes through here
src/logger.ts     createTelegramLogger: config, routing, HTTP, retries
src/format.ts     message formatting (escapeHtml, truncation, MAX_MESSAGE_LENGTH)
src/types.ts      public types and TelegramLoggerError
tests/            bun:test unit tests (fetch is always mocked; never hit the real API)
scripts/build.ts  npm build: ESM, CJS, .d.ts and .d.cts
scripts/changelog.ts  generates the Keep a Changelog section for a release
scripts/smoke.*   runtime smoke tests used by CI (Node, Deno)
docs/en, docs/pt-br   user guides; keep both languages in sync
```

## Commands (Bun only; do not use npm/yarn/pnpm)

| Command                           | Purpose                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `bun install`                     | Install deps and git hooks (Husky, via `prepare`)       |
| `bun test` / `bun test <file>`    | Unit tests                                              |
| `bun run lint` / `bun run format` | Biome check / auto-fix                                  |
| `bun run typecheck`               | `tsc` (strict, `noUncheckedIndexedAccess`)              |
| `bun run build`                   | Build `dist/`                                           |
| `bun run check`                   | lint + typecheck + test + build + publint/attw          |
| `bun run check:jsr`               | JSR publish dry-run (slow types)                        |
| `bun run changelog [v] --dry-run` | Preview the changelog section for version `v`           |

## Hard rules

- **Zero runtime dependencies.** Only web-standard APIs (`fetch`, `AbortSignal`, `Response`). No Node built-ins in `src/`.
- **Public methods never throw.** Failures resolve to `{ ok: false, reason, error }`.
- **Escape all user content** with `escapeHtml` before it goes into a message (Telegram HTML parse mode).
- **JSDoc on every export and explicit return types** on exported functions (JSR "slow types" score).
- Tests for every fix/feature. Update `README.md` (and `docs/en` + `docs/pt-br`) when the public API changes.
- Formatting: 4 spaces (2 for YAML), LF, double quotes, line width 120. Defined in `.editorconfig` and `biome.json`.

## Git and commits

- **Conventional Commits are enforced** by commitlint in the `commit-msg` hook. Use `feat`, `fix`, `perf`,
  `refactor`, `revert`, `docs`, `test`, `chore`, `ci`, `build`, `style`; `!` or a `BREAKING CHANGE:` footer for breaking changes.
- Hooks: `pre-commit` = lint + typecheck; `pre-push` = test + build + `check:package`. Don't bypass them with `--no-verify`.
- The commit subject becomes a changelog line, so write it as a user-facing sentence for `feat`/`fix`.
- PRs are squash-merged; the PR title must also be a Conventional Commit.

## Releases and versioning (fully automated; don't do these by hand)

- Semantic Versioning. Project is past 1.0: `fix` → patch, `feat` → minor, breaking → major.
- **Never bump versions manually** in `package.json`, `jsr.json` or `.release-please-manifest.json`.
  To force a version, add a `Release-As: x.y.z` footer to a commit.
- Flow (`.github/workflows/release.yml`): push to `main` → release-please opens/updates a release PR (version bump)
  → `scripts/changelog.ts` writes the `CHANGELOG.md` section into that PR → merging it creates the tag and GitHub
  Release → `publish-npm` and `publish-jsr` jobs publish (OIDC; no tokens).
- `CHANGELOG.md` follows Keep a Changelog. release-please has `skip-changelog: true`; do not let it write the file.
  Commit types map to sections: `feat` → Added, `fix` → Fixed, `perf`/`refactor` → Changed, `revert` → Removed,
  scope `security` → Security, scope `deprecate` → Deprecated, breaking → Changed (**BREAKING**). Other types are omitted.
  Optional hand-written notes under `## [Unreleased]` are merged into the next release.
- `jsr.json`, `CHANGELOG.md` and `.release-please-manifest.json` are excluded from Biome (release tooling rewrites them).

## Validation before finishing a task

Run the narrowest relevant checks: `bun run lint`, `bun run typecheck`, `bun test <affected file>`. For packaging
changes also `bun run build && bun run check:package` and `bun run check:jsr`.
