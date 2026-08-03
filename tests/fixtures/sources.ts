export const sourceFixture = {
  name: "sources/github/acme/widget-app",
  id: "github/acme/widget-app",
  githubRepo: {
    owner: "acme",
    repo: "widget-app",
    isPrivate: true,
    defaultBranch: { displayName: "main" },
    branches: [{ displayName: "main" }, { displayName: "feature/foo" }],
  },
};

export const sourceListFixture = {
  sources: [sourceFixture],
  nextPageToken: "page-2-token",
};
