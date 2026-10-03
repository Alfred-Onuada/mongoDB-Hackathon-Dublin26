import mongoose from "mongoose";
import {
  checkSearchIndex,
  DEFAULT_INDEX_NAME,
  type DocMatch,
  DocSearch,
  type SearchIndexInfo,
} from "./doc-search.ts";
import Documentation from "./schema.ts";

export async function createDocSearch(
  indexName = DEFAULT_INDEX_NAME,
): Promise<DocSearch> {
  const url = Deno.env.get("MONGODB_URL");
  if (!url) throw new Error("MONGODB_URL is not set");
  await mongoose.connect(url, { dbName: Deno.env.get("MONGODB_DB_NAME") });

  const collection = Documentation.collection;
  const indexes = await collection.listSearchIndexes()
    .toArray() as SearchIndexInfo[];
  checkSearchIndex(
    indexes,
    indexName,
    `${Documentation.db.name}.${collection.collectionName}`,
  );

  return new DocSearch(
    (pipeline) => collection.aggregate<DocMatch>(pipeline).toArray(),
    indexName,
  );
}
