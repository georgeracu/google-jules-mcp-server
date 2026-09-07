import { describe, expect, it } from "vitest";
import { sanitizeText } from "../../src/core/sanitize.js";
import { errorResult } from "../../src/core/tool-result.js";

describe("sanitizeText", () => {
  it("leaves ordinary short text unchanged", () =>
    expect(sanitizeText("hello world")).toBe("hello world"));
  it("redacts common secret formats", () => {
    const text =
      "AKIA1234567890ABCDEF ghp_abcdefghijklmnopqrstuvwxyz1234567890 sk-abcdefghijklmnopqrstuvwxyz1234 Bearer abcdefghijklmnopqrstuvwxyz eyJabc.def_ghi.jkl";
    const result = sanitizeText(text);
    expect(result).not.toContain("AKIA");
    expect(result).not.toContain("ghp_");
    expect(result).not.toContain("sk-");
    expect(result).not.toContain("Bearer");
    expect(result).not.toContain("eyJ");
    expect(result.match(/\[REDACTED\]/g)).toHaveLength(5);
  });
  it("truncates oversized text with the number removed", () => {
    const result = sanitizeText("x".repeat(10_005));
    expect(result).toContain("… [truncated 5 characters]");
    expect(result.length).toBe(10_026);
  });
});

it("sanitizes error results too", () => {
  const result = errorResult(`failure AKIA1234567890ABCDEF ${"x".repeat(10_001)}`);
  expect(result.content[0].text).not.toContain("AKIA");
  expect(result.content[0].text).toContain("[truncated");
});
