import { describe, expect, it } from "vitest";
import { buildPageQuery, PageParams } from "../../src/shared/pagination.js";
import { z } from "zod";

describe("buildPageQuery", () => {
  it("returns empty string when no arguments are provided", () => {
    expect(buildPageQuery({})).toBe("");
  });

  it("returns query string with pageSize", () => {
    expect(buildPageQuery({ pageSize: 10 })).toBe("?pageSize=10");
  });

  it("returns query string with pageToken", () => {
    expect(buildPageQuery({ pageToken: "token123" })).toBe("?pageToken=token123");
  });

  it("returns query string with filter", () => {
    expect(buildPageQuery({ filter: "status=active" })).toBe("?filter=status%3Dactive");
  });

  it("returns query string with all arguments combined", () => {
    const result = buildPageQuery({ pageSize: 20, pageToken: "next_page", filter: "type=user" });
    expect(result).toBe("?pageSize=20&pageToken=next_page&filter=type%3Duser");
  });

  it("properly URL encodes characters", () => {
    const result = buildPageQuery({ filter: "name=John Doe&age>30" });
    expect(result).toBe("?filter=name%3DJohn+Doe%26age%3E30");
  });
});

describe("PageParams", () => {
  it("has pageSize as optional number schema", () => {
    expect(PageParams.pageSize).toBeDefined();
    expect(PageParams.pageSize instanceof z.ZodOptional).toBe(true);
    // Should parse numbers
    expect(PageParams.pageSize.parse(10)).toBe(10);
    // Should parse undefined
    expect(PageParams.pageSize.parse(undefined)).toBeUndefined();
  });

  it("has pageToken as optional string schema", () => {
    expect(PageParams.pageToken).toBeDefined();
    expect(PageParams.pageToken instanceof z.ZodOptional).toBe(true);
    // Should parse strings
    expect(PageParams.pageToken.parse("token")).toBe("token");
    // Should parse undefined
    expect(PageParams.pageToken.parse(undefined)).toBeUndefined();
  });
});
