# Security Policy

## Supported versions

Only the latest released version of `@galhardoalex/telegram-logger` receives security fixes.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub:
[Security → Report a vulnerability](https://github.com/AlexGalhardo/telegram-logger/security/advisories/new).

Please include:

- the affected version
- a description of the issue and its impact
- steps to reproduce, or a proof of concept

You will get an answer within **7 days**. Once a fix is released, the advisory is published and you are credited, unless you prefer otherwise.

## Scope

In scope:

- HTML injection that escapes the formatting
- leaking the bot token, for example in error messages or `onError` payloads
- crashes that break the "never throws" guarantee
- supply-chain issues in the published packages

Out of scope:

- leaked tokens caused by user misconfiguration, such as exposing `TELEGRAM_BOT_TOKEN` to the browser with a `NEXT_PUBLIC_` prefix
- spam sent through public endpoints you build on top of this library

## Supply chain

- The package has **zero runtime dependencies**.
- npm releases are published from GitHub Actions with **Trusted Publishing** and **provenance**. You can verify a release with `npm audit signatures`.
- JSR releases are published from the linked GitHub repository via OIDC. No long-lived tokens are stored anywhere.
