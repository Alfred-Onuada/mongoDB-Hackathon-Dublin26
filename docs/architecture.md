# Architecture

## Components

| Component | File | Function |
|---|---|---|
| HTTP handler | `server/handler.ts` | Gets the request, does a check of the input, and calls the other components. |
| Code description | `server/describe-code.ts` | Tells Gemini to write a prose description of the code. |
| Doc search | `server/doc-search.ts` | Sends a `$vectorSearch` query to MongoDB Atlas. |
| Comment writer | `server/write-comment.ts` | Tells Gemini to write the review comment. |
| Gemini client | `server/gemini-client.ts` | Sends prompts to the Gemini API. |
| Schema | `server/schema.ts` | Defines the `documentations` collection. |
| Ingest script | `server/ingest.ts` | Converts `.mdx` files into documentation chunks. |
| Load script | `server/load.ts` | Writes the chunks into MongoDB. |

## Data flow

1. The handler gets a `POST /api/describe` request with code.
2. Gemini writes a description of the code. The description uses the words
   that documentation uses, not code.
3. Atlas embeds the description automatically. Atlas then finds the nearest
   chunks in the `chunk_content` field.
4. The service removes each chunk that has a score less than the similarity
   threshold.
5. Gemini reads the code, the description, and the remaining chunks.
6. Gemini writes a Markdown comment. The comment gives a link to each section
   that needs a change. It also lists the changes.

## Vector search index

The index uses the `autoEmbed` field type on `chunk_content`. Atlas makes the
embeddings. The service does not make embeddings.

At start, the service does a check of the index. The service stops with an
error if one of these conditions is true:

- The index does not exist.
- The index type is not `vectorSearch`.
- The index has no `autoEmbed` field on `chunk_content`.
- The index is not queryable.

## Documentation chunks

Each chunk has these fields:

| Field | Description |
|---|---|
| `_id` | A fixed ID from the file path and the chunk index. |
| `title` | The page title. |
| `source_url` | The URL of the page. |
| `chunk_index` | The position of the chunk in the page. |
| `chunk_content` | The text of the chunk. Atlas embeds this field. |
| `metadata.section` | The heading of the section. |
| `metadata.associated_paths` | The file path, the imported modules, and the installed packages. |
| `metadata.tags` | The tags from the frontmatter. |

A chunk has a maximum of 5000 characters.
