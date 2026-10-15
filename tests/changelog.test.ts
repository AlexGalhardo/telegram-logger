import { describe, expect, test } from "bun:test";
import { type Commit, classify, insertRelease } from "../scripts/changelog.ts";

const commit = (subject: string, body = ""): Commit => ({ hash: "abcdef1234567890", subject, body });

const BASE = `# Changelog

## [Unreleased]

## [1.0.1] - 2026-10-15

### Added

- Something.

[Unreleased]: https://github.com/AlexGalhardo/telegram-logger/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/AlexGalhardo/telegram-logger/compare/v0.1.1...v1.0.1
`;

describe("classify", () => {
    test("maps types to Keep a Changelog sections", () => {
        expect(classify(commit("feat: add sendPhoto"))?.section).toBe("Added");
        expect(classify(commit("fix(format): escape keys"))?.section).toBe("Fixed");
        expect(classify(commit("perf: faster retries"))?.section).toBe("Changed");
        expect(classify(commit("fix(security): redact token"))?.section).toBe("Security");
    });

    test("ignores non user-facing and non-conventional commits", () => {
        expect(classify(commit("docs: typo"))).toBeNull();
        expect(classify(commit("chore: bump deps"))).toBeNull();
        expect(classify(commit("random message"))).toBeNull();
    });

    test("flags breaking changes", () => {
        const item = classify(commit("feat!: rename chatIds to routes"));
        expect(item?.section).toBe("Changed");
        expect(item?.entry).toStartWith("- **BREAKING:** Rename chatIds to routes");
        expect(classify(commit("fix: x", "BREAKING CHANGE: removed y"))?.entry).toContain("**BREAKING:**");
    });
});

describe("insertRelease", () => {
    test("adds a version section and link references", () => {
        const out = insertRelease(BASE, "1.1.0", "v1.0.1", "2026-11-01", [
            commit("feat: add sendPhoto"),
            commit("fix: escape keys"),
            commit("docs: readme"),
        ]);
        expect(out).toContain("## [Unreleased]\n\n## [1.1.0] - 2026-11-01\n\n### Added\n\n- Add sendPhoto");
        expect(out).toContain("### Fixed\n\n- Escape keys");
        expect(out).not.toContain("Readme");
        expect(out).toContain("[Unreleased]: https://github.com/AlexGalhardo/telegram-logger/compare/v1.1.0...HEAD");
        expect(out).toContain("[1.1.0]: https://github.com/AlexGalhardo/telegram-logger/compare/v1.0.1...v1.1.0");
        expect(out.indexOf("## [1.1.0]")).toBeLessThan(out.indexOf("## [1.0.1]"));
    });

    test("merges manual [Unreleased] notes into the release", () => {
        const withNotes = BASE.replace("## [Unreleased]\n", "## [Unreleased]\n\n### Added\n\n- Manual note.\n");
        const out = insertRelease(withNotes, "1.1.0", "v1.0.1", "2026-11-01", [commit("feat: add sendPhoto")]);
        expect(out).toContain(
            "## [Unreleased]\n\n## [1.1.0] - 2026-11-01\n\n### Added\n\n- Manual note.\n- Add sendPhoto",
        );
    });

    test("is idempotent", () => {
        const once = insertRelease(BASE, "1.1.0", "v1.0.1", "2026-11-01", [commit("feat: a")]);
        expect(insertRelease(once, "1.1.0", "v1.0.1", "2026-11-01", [commit("feat: a")])).toBe(once);
    });

    test("writes a maintenance note when nothing is user-facing", () => {
        const out = insertRelease(BASE, "1.0.2", "v1.0.1", "2026-11-01", [commit("chore: deps")]);
        expect(out).toContain("## [1.0.2] - 2026-11-01\n\n### Changed\n\n- Internal maintenance only");
    });
});
