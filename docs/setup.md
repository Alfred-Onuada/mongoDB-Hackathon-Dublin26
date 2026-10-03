# Setup

## Configuration

Set these variables in `server/.env`:

| Variable               | Default            | Description                      |
| ---------------------- | ------------------ | -------------------------------- |
| `GEMINI_API_KEY`       | None               | The Gemini API key.              |
| `GEMINI_MODEL`         | `gemini-2.5-flash` | The Gemini model.                |
| `MONGODB_URL`          | None               | The Atlas connection string.     |
| `MONGODB_DB_NAME`      | `hackathon`        | The database name.               |
| `VECTOR_INDEX_NAME`    | `autoembed_index`  | The vector search index.         |
| `SIMILARITY_THRESHOLD` | `0.7`              | The minimum match score: 0 to 1. |

## Load the documentation

1. Make chunks from a folder of `.mdx` files:

   ```sh
   cd server
   deno run --allow-read --allow-write ingest.ts <docs-folder> chunks.json
   ```

2. Set `MONGODB_URI` in `server/.env`. The load script uses this name.
3. Load the chunks:

   ```sh
   deno task load chunks.json
   ```

4. In Atlas, create a `vectorSearch` index with an `autoEmbed` field on
   `chunk_content`.

## Run the tests

```sh
cd server && deno task test
```
