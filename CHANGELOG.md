# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-10-15

First stable release. The public API is unchanged from 0.1.1 and is now covered by Semantic Versioning.

### Added

- Conventional Commits enforcement with commitlint (`commit-msg` hook).
- Husky git hooks: `pre-commit` runs lint and typecheck; `pre-push` runs tests, build and package validation.
- `.editorconfig` with 4-space indentation as the default (2 spaces for YAML).
- Automated Keep a Changelog generation (`scripts/changelog.ts`, `bun run changelog`): the release workflow writes the new version section into the release-please PR from the Conventional Commits.
- `AGENTS.md` and `CLAUDE.md` with project context for AI coding agents.

### Changed

- Biome formatter now uses 4-space indentation; the codebase was reformatted.
- `CHANGELOG.md` now follows Keep a Changelog; release-please no longer writes it (`skip-changelog`).
- Removed the pre-1.0 bump rules (`bump-minor-pre-major`, `bump-patch-for-minor-pre-major`) from the release-please config.

## [0.1.1] - 2026-10-15

### Changed

- Renamed the package scope to `@galhardoalex` on npm and JSR.
- Publish to npm and JSR in independent CI jobs.
- Bumped GitHub Actions to their latest majors and switched Dependabot to the bun ecosystem.
- Excluded the release-please-managed `jsr.json` from Biome.

### Documentation

- Split the guides into `docs/en` and `docs/pt-br` and linked them from the README.
- Documented JSR setup details.
- Explained npm Trusted Publisher permissions and the validation window.
- Put each install command in its own code block.

## [0.1.0] - 2026-10-15

### Added

- Initial release: zero-dependency logger that sends errors, warnings, events and contact-form submissions to Telegram chats.
- Support for Node, Bun, Deno, Next.js and edge runtimes, with ESM and CommonJS builds.
- Publishing to npm and JSR via release-please.

[Unreleased]: https://github.com/AlexGalhardo/telegram-logger/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/AlexGalhardo/telegram-logger/compare/v0.1.1...v1.0.1
[0.1.1]: https://github.com/AlexGalhardo/telegram-logger/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AlexGalhardo/telegram-logger/releases/tag/v0.1.0
