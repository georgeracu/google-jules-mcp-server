import { z } from "zod";

/** Reused as `{ ...PageParams }` in the inputSchema object of every list_* tool. */
export const PageParams = {
  pageSize: z.number().optional().describe("Number of items per page"),
  pageToken: z.string().optional().describe("Token for pagination to get the next page"),
};

export function buildPageQuery(params: {
  pageSize?: number;
  pageToken?: string;
  filter?: string;
}): string {
  const query = new URLSearchParams();
  if (params.pageSize !== undefined) query.set("pageSize", String(params.pageSize));
  if (params.pageToken) query.set("pageToken", params.pageToken);
  if (params.filter) query.set("filter", params.filter);
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}
