import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import {
  checkSearchIndex,
  DocSearch,
  type SearchIndexInfo,
} from "./doc-search.ts";

Deno.test("search runs an autoEmbed $vectorSearch on chunk_content", async () => {
  const pipelines: Record<string, unknown>[][] = [];
  const docSearch = new DocSearch((pipeline) => {
    pipelines.push(pipeline);
    return Promise.resolve([]);
  }, "test-index");

  await docSearch.search("Adds two numbers.", { limit: 3, minScore: 0.7 });

  assertEquals(pipelines, [[
    {
      $vectorSearch: {
        index: "test-index",
        path: "chunk_content",
        query: { text: "Adds two numbers." },
        limit: 3,
        numCandidates: 60,
      },
    },
    {
      $project: {
        title: 1,
        source_url: 1,
        chunk_index: 1,
        chunk_content: 1,
        metadata: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
    { $match: { score: { $gte: 0.7 } } },
  ]]);
});

Deno.test("search keeps every result when no minScore is given", async () => {
  const pipelines: Record<string, unknown>[][] = [];
  const docSearch = new DocSearch((pipeline) => {
    pipelines.push(pipeline);
    return Promise.resolve([]);
  });

  await docSearch.search("text");

  assertEquals(pipelines[0].at(-1), { $match: { score: { $gte: 0 } } });
  assertEquals(
    (pipelines[0][0].$vectorSearch as { limit: number }).limit,
    5,
  );
});

const readyIndex: SearchIndexInfo = {
  name: "autoembed_index",
  type: "vectorSearch",
  queryable: true,
  latestDefinition: {
    fields: [
      { type: "autoEmbed", path: "chunk_content" },
      { type: "filter", path: "metadata.tags" },
    ],
  },
};

Deno.test("checkSearchIndex accepts a ready autoEmbed index", () => {
  checkSearchIndex([readyIndex], "autoembed_index", "BotDB.documentations");
});

Deno.test("checkSearchIndex rejects unusable indexes", () => {
  const cases: [string, SearchIndexInfo[], string][] = [
    ["missing", [readyIndex], 'index "other" not found'],
    ["none at all", [], "(available: none)"],
    [
      "wrong type",
      [{ ...readyIndex, name: "other", type: "search" }],
      "not a vectorSearch",
    ],
    [
      "no autoEmbed field",
      [{ ...readyIndex, name: "other", latestDefinition: { fields: [] } }],
      "no autoEmbed field",
    ],
    [
      "still building",
      [{ ...readyIndex, name: "other", queryable: false }],
      "not queryable",
    ],
  ];
  for (const [name, indexes, message] of cases) {
    const err = assertThrows(
      () => checkSearchIndex(indexes, "other", "test.documentations"),
      Error,
      undefined,
      name,
    );
    assertStringIncludes(err.message, message, name);
  }
});
