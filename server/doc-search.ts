export const DEFAULT_INDEX_NAME = "autoembed_index";
// Field the Atlas autoEmbed index is defined on (see schema.ts).
export const EMBEDDED_PATH = "chunk_content";

export interface DocMatch {
  _id: string;
  title: string;
  source_url: string;
  chunk_index: number;
  chunk_content: string;
  metadata?: {
    section?: string;
    page_number?: number;
    associated_paths?: string[];
    tags?: string[];
  };
  score: number;
}

export interface SearchOptions {
  limit?: number;
  // Drop chunks below this vectorSearchScore (0-1, higher is more similar).
  minScore?: number;
}

export interface AggregateFn {
  (pipeline: Record<string, unknown>[]): Promise<DocMatch[]>;
}

export class DocSearch {
  constructor(
    private readonly aggregate: AggregateFn, // for testability
    private readonly indexName = DEFAULT_INDEX_NAME,
  ) {}

  search(
    text: string,
    { limit = 5, minScore = 0 }: SearchOptions = {},
  ): Promise<DocMatch[]> {
    return this.aggregate([
      {
        $vectorSearch: {
          index: this.indexName,
          path: EMBEDDED_PATH,
          query: { text },
          limit,
          numCandidates: limit * 20,
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
      { $match: { score: { $gte: minScore } } },
    ]);
  }
}

// Shape of an entry from listSearchIndexes().
export interface SearchIndexInfo {
  name: string;
  type?: string;
  queryable?: boolean;
  latestDefinition?: { fields?: { type?: string; path?: string }[] };
}

// $vectorSearch silently returns no results for a missing index, so verify
// the index up front and fail with an actionable message instead.
export function checkSearchIndex(
  indexes: SearchIndexInfo[],
  indexName: string,
  namespace: string,
): void {
  const index = indexes.find((i) => i.name === indexName);
  if (!index) {
    const available = indexes.map((i) => i.name).join(", ") || "none";
    throw new Error(
      `Vector search index "${indexName}" not found on ${namespace} ` +
        `(available: ${available}). Check MONGODB_DB_NAME and VECTOR_INDEX_NAME.`,
    );
  }
  if (index.type !== "vectorSearch") {
    throw new Error(
      `Search index "${indexName}" on ${namespace} is not a vectorSearch index`,
    );
  }
  const autoEmbedsPath = index.latestDefinition?.fields?.some((field) =>
    field.type === "autoEmbed" && field.path === EMBEDDED_PATH
  );
  if (!autoEmbedsPath) {
    throw new Error(
      `Vector search index "${indexName}" on ${namespace} has no autoEmbed ` +
        `field on ${EMBEDDED_PATH}`,
    );
  }
  if (!index.queryable) {
    throw new Error(
      `Vector search index "${indexName}" on ${namespace} is not queryable ` +
        `yet; wait for Atlas to finish building it`,
    );
  }
}
