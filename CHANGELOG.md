# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-10-15

### Added

- Conventional Commits enforcement with commitlint (`commit-msg` hook).
- Husky git hooks: `pre-commit` runs lint and typecheck; `pre-push` runs tests, build and package validation.
- `.editorconfig` with 4-space indentation as the default (2 spaces for YAML).
- Automated Keep a Changelog generation (`scripts/changelog.ts`, `bun run changelog`): the release workflow writes the new version section into the release-please PR from the Conventional Commits, and uses it as the GitHub Release notes.
- `AGENTS.md` and `CLAUDE.md` with project context for AI coding agents.

### Changed

- Renamed the package scope to `@galhardoalex` on npm and JSR.
- Publish to npm and JSR in independent CI jobs.
- Bumped GitHub Actions to their latest majors and switched Dependabot to the bun ecosystem.
- Biome formatter now uses 4-space indentation; the codebase was reformatted.
- `CHANGELOG.md` now follows Keep a Changelog; release-please no longer writes it (`skip-changelog`).
- Removed the pre-1.0 bump rules (`bump-minor-pre-major`, `bump-patch-for-minor-pre-major`) from the release-please config.
- Split the guides into `docs/en` and `docs/pt-br`, linked them from the README, and documented JSR setup and npm Trusted Publisher permissions.

## [1.0.0] - 2026-10-15

### Added

- Initial release: zero-dependency logger that sends errors, warnings, events and contact-form submissions to Telegram chats.
- Support for Node, Bun, Deno, Next.js and edge runtimes, with ESM and CommonJS builds.
- Publishing to npm and JSR via release-please.

[Unreleased]: https://github.com/AlexGalhardo/telegram-logger/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/AlexGalhardo/telegram-logger/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/AlexGalhardo/telegram-logger/releases/tag/v1.0.0
