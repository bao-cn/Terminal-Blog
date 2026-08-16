import { describe, expect, it } from "vitest";

import {
  buildReleaseNotes,
  extractChangelogSection,
  normalizeIssueReferences,
} from "../.github/scripts/prepare-release-notes.mjs";

const changelog = `# Changelog

## [Unreleased]

## [0.2.0] - 2026-08-17

### Added

- A newer feature.

## [0.1.0-beta.1] - 2026-08-16

### Added

- Initial beta.

### Security

- Hardened requests.

[0.1.0-beta.1]: https://example.com
`;

describe("release notes", () => {
  it("extracts only the requested changelog version", () => {
    expect(extractChangelogSection(changelog, "0.1.0-beta.1")).toBe(
      "### Added\n\n- Initial beta.\n\n### Security\n\n- Hardened requests.\n\n[0.1.0-beta.1]: https://example.com",
    );
  });

  it("normalizes and deduplicates related issue numbers", () => {
    expect(normalizeIssueReferences("#12, 34 #12")).toEqual(["#12", "#34"]);
  });

  it("keeps changelog, issues, pull requests, and contributors", () => {
    const notes = buildReleaseNotes({
      changelog,
      generatedBody: "## What's Changed\n\n- Fix terminal title by @bao-cn in #7",
      relatedIssues: "12, #34",
      version: "0.1.0-beta.1",
    });

    expect(notes).toContain("## Changelog");
    expect(notes).toContain("- Initial beta.");
    expect(notes).toContain("## Related Issues\n\n- #12\n- #34");
    expect(notes).toContain("@bao-cn in #7");
  });

  it("rejects a missing version section", () => {
    expect(() => extractChangelogSection(changelog, "9.9.9")).toThrow(/does not contain/);
  });
});
