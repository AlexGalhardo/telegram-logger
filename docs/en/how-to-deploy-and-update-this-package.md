# How to publish and update this package (npm + JSR)

> 🇧🇷 [Leia em português](../pt-br/how-to-deploy-and-update-this-package.md)

The package is published to two registries from the same code:

| Registry | What gets published                                     | How it authenticates                         |
| -------- | ------------------------------------------------------- | -------------------------------------------- |
| **npm**  | `dist/` (ESM + CJS + `.d.ts`), built by `bun run build` | Trusted Publishing (OIDC), no token          |
| **JSR**  | The `.ts` sources in `src/` as is, defined in `jsr.json` | Linked GitHub repository (OIDC), no token   |

Releases are automated with [release-please](https://github.com/googleapis/release-please). No secrets are stored on GitHub.

---

## How it works, day to day

```
you make commits (feat:, fix:...) → push to main
        │
        ▼
the "Release" GitHub Action opens/updates a "chore(main): release 0.2.0" PR
(version bump in package.json + jsr.json, and a generated CHANGELOG.md)
        │
        ▼  you review and merge that PR
        │
        ▼
release-please creates the v0.2.0 tag + GitHub Release
        │
        ▼
"publish" job: tests, builds, and publishes to npm (with provenance) and JSR
```

You **don't** change the version by hand. It is calculated from the commit messages.

### 1. Write commits following Conventional Commits

| Commit                                     | Example                                  | Before 1.0             | After 1.0                 |
| ------------------------------------------ | ---------------------------------------- | ---------------------- | ------------------------- |
| `fix: ...`                                 | `fix: escape & inside meta keys`         | patch `0.1.0 → 0.1.1`  | patch `1.2.0 → 1.2.1`     |
| `feat: ...`                                | `feat: add sendPhoto method`             | minor `0.1.0 → 0.2.0`  | minor `1.2.0 → 1.3.0`     |
| `feat!: ...` or a `BREAKING CHANGE:` footer | `feat!: rename chatIds to routes`       | minor `0.1.0 → 0.2.0`  | **major** `1.2.0 → 2.0.0` |
| `docs:`, `chore:`, `test:`, `refactor:`, `ci:` | `docs: improve Next.js example`      | no release             | no release                |

Commits that trigger a release show up in the CHANGELOG. A commit that doesn't follow the convention is ignored. Nothing breaks.

### 2. Push to `main`

You can commit straight to main or open a PR (ideally with "Squash and merge", using a Conventional Commits title).

```bash
git add .
git commit -m "feat: add photo support"
git push
```

### 3. Merge the release PR

A `chore(main): release X.Y.Z` PR shows up under **Pull requests**. It updates itself on every new push to main, so you can pile up several changes before releasing.

When you want to release, click **Merge**. Within 1 to 2 minutes the new version is on both sites. To follow along, go to **Actions → Release**.

> The release PR is created by `GITHUB_TOKEN`. Because of a GitHub limitation, this does **not** trigger the CI workflow on it. That's not a problem: the publish job runs the tests and the build before publishing.

### 4. Check

```bash
npm view @alexgalhardo/telegram-logger version
```

- npm: https://www.npmjs.com/package/@alexgalhardo/telegram-logger (should show the "Provenance" badge)
- JSR: https://jsr.io/@alexgalhardo/telegram-logger (also check the **Score** tab)

---

## Special cases

### Releasing 1.0.0, or forcing a specific version

Add a `Release-As` footer to a commit:

```bash
git commit --allow-empty -m "chore: release 1.0.0" -m "Release-As: 1.0.0"
git push
```

The next release PR will use exactly that version.

### Publishing failed (network, registry down, configuration)

1. Fix the cause.
2. Go to **Actions → Release → Run workflow** (branch `main`).

The job publishes the version in `package.json`. If that version already exists on a registry, it skips that registry. So you can run it as many times as you need.

### Validate everything locally before pushing

```bash
bun install
bun run check       # lint + typecheck + tests + build + publint + are-the-types-wrong
bun run check:jsr   # simulates the JSR publish (slow types, included files)
npm pack --dry-run  # lists exactly which files go to npm
```

### Deprecating a buggy version

- **npm:** `npm deprecate @alexgalhardo/telegram-logger@0.3.0 "Bug X, use 0.3.1"`.
  `npm unpublish` is only allowed within the first 72h and should be avoided.
- **JSR:** go to jsr.io → package → **Versions** → **Yank** on that version.

Then publish the fix normally, with a `fix:` commit.

---

## Initial setup (done once)

This was already done when the project was created. It's recorded here in case you need to redo it, for example when transferring the repo or recreating the package.

### A. GitHub

1. Repository: https://github.com/AlexGalhardo/telegram-logger
2. **Settings → Actions → General → Workflow permissions:**
   - check **Read and write permissions**
   - check **Allow GitHub Actions to create and approve pull requests** (release-please needs this)

   From the terminal:

   ```bash
   gh api -X PUT repos/AlexGalhardo/telegram-logger/actions/permissions/workflow \
     -f default_workflow_permissions=write -F can_approve_pull_request_reviews=true
   ```

### B. JSR

1. Go to https://jsr.io and sign in with GitHub.
2. At https://jsr.io/new, create the `@alexgalhardo` scope and the `telegram-logger` package.
3. In the package, go to **Settings → GitHub Repository** and link `AlexGalhardo/telegram-logger`. This is what lets GitHub Actions publish via OIDC, without a token.
4. Still in **Settings**, fill in the description and check the compatible runtimes: Node.js, Deno, Bun, Cloudflare Workers and Browsers. This adds points to the JSR Score.

### C. npm

Trusted Publishing can only be configured on a package that already exists. So the **first** version was published by hand:

```bash
npm login
bun install && bun test && bun run build
npm publish --access public --provenance=false   # provenance only works inside CI
```

After that:

1. Go to https://www.npmjs.com/package/@alexgalhardo/telegram-logger/access, or the package **Settings**.
2. Under **Trusted Publisher**, choose **GitHub Actions** and fill in:
   - Organization or user: `AlexGalhardo`
   - Repository: `telegram-logger`
   - Workflow filename: `release.yml`
   - Environment: leave empty
3. Recommended: under **Publishing access**, check *"Require two-factor authentication and disallow tokens"*. From then on, only CI can publish.

### D. Mark the initial version for release-please

release-please needs to know where to start from. For that, the `v0.1.0` release was created pointing at the initial commit:

```bash
gh release create v0.1.0 --title "v0.1.0" --notes "Initial release"
```

---

## Files involved

| File                                    | Purpose                                                              |
| --------------------------------------- | -------------------------------------------------------------------- |
| `.github/workflows/ci.yml`              | Lint, typecheck, tests, build, npm/JSR validation, smoke tests on Node 18–24 and Deno |
| `.github/workflows/release.yml`         | release-please + npm/JSR publishing                                  |
| `release-please-config.json`            | Release type (node), `jsr.json` bump, pre-1.0 rules                  |
| `.release-please-manifest.json`         | Last released version. Updated by release-please; don't edit it.     |
| `package.json` / `jsr.json`             | Version (always the same; release-please updates both)               |
| `CHANGELOG.md`                          | Generated automatically                                              |
| `scripts/build.ts`                      | npm build: ESM, CJS, `.d.ts` and `.d.cts`                            |
