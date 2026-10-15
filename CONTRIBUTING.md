# Contributing

Thanks for your interest! Bug reports, ideas and pull requests are welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/AlexGalhardo/telegram-logger/issues) first, so we can agree on the approach before you write code.
- **Security problems:** do **not** open an issue. Follow [SECURITY.md](SECURITY.md).
- **Scope:** the library is intentionally small and has zero dependencies. New features should fit the "send passive notifications to Telegram" goal and work on every runtime: Node 18+, Bun, Deno and edge.

## Development setup

Requirements: [Bun](https://bun.sh) 1.2+. Node 18+ is optional, only for the smoke tests.

```bash
git clone https://github.com/AlexGalhardo/telegram-logger.git
cd telegram-logger
bun install
```

`bun install` also installs the git hooks (Husky):

| Hook         | Runs                                                       |
| ------------ | ---------------------------------------------------------- |
| `pre-commit` | `bun run lint` and `bun run typecheck`                     |
| `commit-msg` | commitlint (Conventional Commits)                          |
| `pre-push`   | `bun test`, `bun run build` and `bun run check:package`    |

Indentation is 4 spaces (2 for YAML), defined in `.editorconfig` and enforced by Biome.

| Command             | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `bun test`          | Run the unit tests                                         |
| `bun run lint`      | Lint and format check (Biome)                              |
| `bun run format`    | Auto-fix lint and formatting                               |
| `bun run typecheck` | TypeScript type check                                      |
| `bun run build`     | Build `dist/` for npm (ESM, CJS and type declarations)     |
| `bun run check`     | All of the above, plus package validation (publint, attw)  |
| `bun run check:jsr` | Dry-run of the JSR publish (slow types, included files)    |

## Project layout

```
src/
  mod.ts       public entry point (the only file exports go through)
  logger.ts    createTelegramLogger: config, routing, HTTP, retries
  format.ts    message formatting (HTML escaping, truncation)
  types.ts     public types and TelegramLoggerError
tests/         bun:test unit tests (fetch is always mocked)
scripts/       build script and runtime smoke tests
```

## Guidelines

- **Keep zero runtime dependencies.** Use only web-standard APIs (`fetch`, `AbortSignal`, `Response`).
- **Never throw from public methods.** Failures must resolve to `{ ok: false, reason, error }`.
- **Escape all user content** with `escapeHtml` before it goes into a message.
- **Document every export with JSDoc.** JSR scores packages on this.
- **Use explicit return types** on exported functions, so there are no "slow types" on JSR.
- **Add tests** for every bug fix and feature.
- **Update `README.md`** when you change the public API.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org). Versions follow [Semantic Versioning](https://semver.org) and are calculated from them. The `commit-msg` hook rejects messages that don't follow the format:

```
fix: escape ampersands in meta keys        → patch release
feat: add sendPhoto method                 → minor release
feat!: rename chatIds option to routes     → breaking change
docs: / test: / chore: / refactor: / ci:   → no release
```

`CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com)) is generated from these messages when a release is prepared, so write the subject as a user-facing sentence. Optional extra notes can go under `## [Unreleased]`.

When you open a pull request, use the same format for its title. PRs are squash-merged, so the title becomes the commit message.

## Pull request checklist

- [ ] `bun run check` passes
- [ ] Tests were added or updated
- [ ] README updated, if the public API changed
- [ ] PR title follows Conventional Commits

Releases are automated, so do not bump versions yourself. See [docs/en/how-to-deploy-and-update-this-package.md](docs/en/how-to-deploy-and-update-this-package.md) ([pt-br](docs/pt-br/how-to-deploy-and-update-this-package.md)).

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
