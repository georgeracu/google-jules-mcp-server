import { describe, expect, it } from "vitest";

import { errorResult, textResult, wrap } from "../../src/core/tool-result.js";

describe("textResult", () => {
  it("creates a result with standard text content", () => {
    const result = textResult("Hello world");
    expect(result).toEqual({
      content: [{ type: "text", text: "Hello world" }],
    });
  });

  it("sanitizes text content", () => {
    const secret = "AKIA0123456789ABCDEF";
    const result = textResult(`Here is my key: ${secret}`);
    expect(result.content[0].text).toContain("[REDACTED]");
    expect(result.content[0].text).not.toContain(secret);
  });
});

describe("errorResult", () => {
  it("creates a result with standard error content", () => {
    const result = errorResult("An error occurred");
    expect(result).toEqual({
      content: [{ type: "text", text: "An error occurred" }],
      isError: true,
    });
  });

  it("sanitizes error text content", () => {
    const secret = "ghp_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const result = errorResult(`Error with key: ${secret}`);
    expect(result.content[0].text).toContain("[REDACTED]");
    expect(result.content[0].text).not.toContain(secret);
    expect(result.isError).toBe(true);
  });
});

describe("wrap", () => {
  it("returns the result of a successful function", async () => {
    const result = await wrap("test_label", async () => textResult("success"));
    expect(result).toEqual({
      content: [{ type: "text", text: "success" }],
    });
  });

  it("catches errors and formats them with the provided label", async () => {
    const result = await wrap("operation_failed", async () => {
      throw new Error("something went wrong");
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "operation_failed: something went wrong" }],
      isError: true,
    });
  });

  it("includes the suffix in formatted errors", async () => {
    const result = await wrap(
      "operation_failed",
      async () => {
        throw new Error("something went wrong");
      },
      ". Please try again."
    );
    expect(result).toEqual({
      content: [{ type: "text", text: "operation_failed: something went wrong. Please try again." }],
      isError: true,
    });
  });

  it("handles non-Error objects thrown", async () => {
    const result = await wrap("unknown_error", async () => {
      throw "string error";
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "unknown_error: An unknown error occurred" }],
      isError: true,
    });
  });
});
