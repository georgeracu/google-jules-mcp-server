import { describe, expect, it } from "vitest";

import { formatSource, formatSourceList } from "../../../src/resources/sources/format.js";
import { sourceFixture, sourceListFixture } from "../../fixtures/sources.js";

describe("formatSourceList", () => {
  it("renders a helpful message when there are no sources", () => {
    expect(formatSourceList({})).toContain("No repositories connected to Jules");
  });

  it("renders repo owner/name, privacy, and branches", () => {
    const text = formatSourceList(sourceListFixture);
    expect(text).toContain("acme/widget-app (private)");
    expect(text).toContain("main, feature/foo");
    expect(text).toContain(sourceFixture.name);
  });

  it("notifies when the output limit is reached", () => {
    const text = formatSourceList(sourceListFixture);
    expect(text).toContain(`output limit was reached`);
  });

  it("falls back to name/id when githubRepo is absent", () => {
    const text = formatSourceList({ sources: [{ name: "sources/other", id: "other" }] });
    expect(text).toContain("- sources/other (other)");
  });

  it("marks a non-private repo as public and falls back to unknown branches", () => {
    const text = formatSourceList({
      sources: [{ name: "sources/other", id: "other", githubRepo: { owner: "o", repo: "r" } }],
    });
    expect(text).toContain("o/r (public)");
    expect(text).toContain("Branches: unknown");
  });
});

describe("formatSource", () => {
  it("renders full repo details including default branch", () => {
    const text = formatSource(sourceFixture);
    expect(text).toContain("acme/widget-app (private)");
    expect(text).toContain("Default branch: main");
    expect(text).toContain("Branches: main, feature/foo");
  });

  it("falls back to name/id when githubRepo is absent", () => {
    expect(formatSource({ name: "sources/other", id: "other" })).toBe("sources/other (other)");
  });

  it("marks a non-private repo as public and falls back to unknown for missing branch info", () => {
    const text = formatSource({
      name: "sources/other",
      id: "other",
      githubRepo: { owner: "o", repo: "r" },
    });
    expect(text).toContain("o/r (public)");
    expect(text).toContain("Default branch: unknown");
    expect(text).toContain("Branches: unknown");
  });
});
