// Upsert chunks.json into MongoDB, keyed on the deterministic _id from ingest.ts.
// Re-running replaces existing chunks instead of duplicating.
//
// Usage:
//   deno run --allow-net --allow-env --allow-read --env-file load.ts [chunks.json]
// Requires MONGODB_URI in .env

import mongoose from "mongoose";
import Documentation from "./schema.ts";

const file = Deno.args[0] ?? "chunks.json";
const uri = Deno.env.get("MONGODB_URI");
if (!uri) throw new Error("MONGODB_URI is not set");

const chunks = JSON.parse(await Deno.readTextFile(file));
console.error(`Upserting ${chunks.length} chunks from ${file} ...`);

await mongoose.connect(uri);

const BATCH = 500;
let written = 0;
for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);
  const res = await Documentation.bulkWrite(
    batch.map((c: { _id: string }) => ({
      replaceOne: { filter: { _id: c._id }, replacement: c, upsert: true },
    })),
    { ordered: false },
  );
  written += res.upsertedCount + res.modifiedCount;
  console.error(`  ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
}

console.error(`Done: ${written} chunks upserted/updated`);
await mongoose.disconnect();
