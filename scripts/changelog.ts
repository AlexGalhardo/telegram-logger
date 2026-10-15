// Writes a Keep a Changelog section for a release from the Conventional Commits since the last tag.
// Runs in CI on the release-please PR branch (see .github/workflows/release.yml), so CHANGELOG.md
// never has to be edited by hand. Entries written manually under [Unreleased] are kept and merged.
//
// Usage: bun run changelog [version] [--dry-run]   (version defaults to package.json)
//        bun run changelog [version] --notes       prints that version's section (GitHub Release notes)

import { $ } from "bun";

const REPO_URL = "https://github.com/AlexGalhardo/telegram-logger";

export interface Commit {
    hash: string;
    subject: string;
    body: string;
}

const SECTION_ORDER = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"] as const;
type Section = (typeof SECTION_ORDER)[number];

const HEADER = /^(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/;

/** Maps a commit to a Keep a Changelog section and entry, or null when it isn't user-facing. */
export function classify(commit: Commit): { section: Section; entry: string } | null {
    const match = HEADER.exec(commit.subject);
    if (!match) return null;
    const [, type, scope, bang, description = ""] = match;
    const breaking = bang === "!" || /^BREAKING[ -]CHANGE:/m.test(commit.body);

    let section: Section | null;
    if (scope === "security") section = "Security";
    else if (scope === "deprecate" || scope === "deprecation") section = "Deprecated";
    else if (type === "feat") section = "Added";
    else if (type === "fix") section = "Fixed";
    else if (type === "perf" || type === "refactor") section = "Changed";
    else if (type === "revert") section = "Removed";
    else section = null;

    if (breaking && section !== "Removed") section = "Changed";
    if (!section) return null;

    const text = description.charAt(0).toUpperCase() + description.slice(1);
    const prefix = breaking ? "**BREAKING:** " : "";
    const link = `([${commit.hash.slice(0, 7)}](${REPO_URL}/commit/${commit.hash}))`;
    return { section, entry: `- ${prefix}${text} ${link}` };
}

/** Builds the body of a release section (### headings and entries) from commits plus manual notes. */
export function renderSections(commits: Commit[], manual: string): string {
    const groups = new Map<Section, string[]>();
    for (const commit of commits) {
        const item = classify(commit);
        if (!item) continue;
        const list = groups.get(item.section) ?? [];
        list.push(item.entry);
        groups.set(item.section, list);
    }

    // Manual [Unreleased] notes already use ### headings; merge their bullets into the same sections.
    let current: Section | null = null;
    const extra: string[] = [];
    for (const line of manual.split("\n")) {
        const heading = /^### (.+)$/.exec(line.trim());
        if (heading) {
            current = SECTION_ORDER.find((s) => s === heading[1]) ?? null;
            if (!current) extra.push(line);
            continue;
        }
        if (!line.trim()) continue;
        if (current) {
            const list = groups.get(current) ?? [];
            list.unshift(line);
            groups.set(current, list);
        } else {
            extra.push(line);
        }
    }

    const parts = SECTION_ORDER.filter((s) => groups.has(s)).map((s) => `### ${s}\n\n${groups.get(s)?.join("\n")}`);
    if (extra.length) parts.push(extra.join("\n"));
    if (!parts.length) parts.push("### Changed\n\n- Internal maintenance only; no user-facing changes.");
    return parts.join("\n\n");
}

/** Returns the changelog with a new version section and updated link references. Idempotent. */
export function insertRelease(
    changelog: string,
    version: string,
    previousTag: string,
    date: string,
    commits: Commit[],
): string {
    if (changelog.includes(`## [${version}]`)) return changelog;

    const start = changelog.indexOf("## [Unreleased]");
    if (start === -1) throw new Error("CHANGELOG.md has no '## [Unreleased]' heading");
    const bodyStart = start + "## [Unreleased]".length;
    const next = changelog.slice(bodyStart).search(/\n## \[|\n\[Unreleased\]:/);
    const bodyEnd = next === -1 ? changelog.length : bodyStart + next;
    const manual = changelog.slice(bodyStart, bodyEnd);

    const section = `## [${version}] - ${date}\n\n${renderSections(commits, manual)}`;
    let result = `${changelog.slice(0, bodyStart)}\n\n${section}\n${changelog.slice(bodyEnd)}`;

    const tag = `v${version}`;
    const unreleasedLink = `[Unreleased]: ${REPO_URL}/compare/${tag}...HEAD`;
    const versionLink = `[${version}]: ${REPO_URL}/compare/${previousTag}...${tag}`;
    result = /^\[Unreleased\]: .*$/m.test(result)
        ? result.replace(/^\[Unreleased\]: .*$/m, `${unreleasedLink}\n${versionLink}`)
        : `${result.trimEnd()}\n\n${unreleasedLink}\n${versionLink}\n`;
    return result;
}

/** Returns the body of a version section (without its heading), or null if the version isn't in the changelog. */
export function extractSection(changelog: string, version: string): string | null {
    const heading = `## [${version}]`;
    const start = changelog.indexOf(heading);
    if (start === -1) return null;
    const bodyStart = changelog.indexOf("\n", start) + 1;
    const next = changelog.slice(bodyStart).search(/^## \[|^\[Unreleased\]:/m);
    return changelog.slice(bodyStart, next === -1 ? undefined : bodyStart + next).trim();
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const pkg = (await Bun.file("package.json").json()) as { version: string };
    const version = args.find((a) => !a.startsWith("--")) ?? pkg.version;

    if (args.includes("--notes")) {
        const notes = extractSection(await Bun.file("CHANGELOG.md").text(), version);
        if (notes === null) throw new Error(`CHANGELOG.md has no [${version}] section`);
        console.log(notes);
        return;
    }

    const previousTag = (await $`git describe --tags --abbrev=0 --match "v*"`.text()).trim();
    const raw = await $`git log ${previousTag}..HEAD --format=%H%x1f%s%x1f%b%x1e`.text();
    const commits = raw
        .split("\x1e")
        .map((record) => record.trim())
        .filter(Boolean)
        .map((record) => {
            const [hash = "", subject = "", body = ""] = record.split("\x1f");
            return { hash, subject, body };
        })
        .filter((c) => !/^chore(\([^)]*\))?: release /.test(c.subject));

    const date = new Date().toISOString().slice(0, 10);
    const current = await Bun.file("CHANGELOG.md").text();
    const updated = insertRelease(current, version, previousTag, date, commits);

    if (updated === current) {
        console.log(`CHANGELOG.md already has [${version}]; nothing to do`);
    } else if (dryRun) {
        console.log(updated);
    } else {
        await Bun.write("CHANGELOG.md", updated);
        console.log(`CHANGELOG.md: added [${version}] from ${commits.length} commits since ${previousTag}`);
    }
}

if (import.meta.main) await main();
