# Setup

## Prerequisites

- Deno 2
- A MongoDB Atlas cluster
- A Gemini API key

## Configuration

Copy `server/.env.example` to `server/.env`. Then set these variables:

| Variable | Necessary | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | None | The key for the Gemini API. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | The Gemini model. |
| `MONGODB_URL` | Yes | None | The Atlas connection string for the server. |
| `MONGODB_DB_NAME` | No | `hackathon` | The database with the `documentations` collection. |
| `VECTOR_INDEX_NAME` | No | `autoembed_index` | The name of the vector search index. |
| `SIMILARITY_THRESHOLD` | No | `0.7` | The minimum score for a match. Range: 0 to 1. |

## Load the documentation

1. Make the chunks from a folder of `.mdx` files:

   ```sh
   cd server
   deno run --allow-read --allow-write ingest.ts <docs-folder> chunks.json
   ```

2. Set `MONGODB_URI` in `server/.env`. The load script uses this variable.
   It does not use `MONGODB_URL`.
3. Write the chunks into MongoDB:

   ```sh
   deno task load chunks.json
   ```

You can run the load script again. It replaces the chunks that have the same
`_id`. It does not make duplicates.

## Create the vector search index

1. In Atlas, open the `documentations` collection.
2. Create a `vectorSearch` index with the name `autoembed_index`.
3. Add an `autoEmbed` field on the path `chunk_content`.
4. Wait until the index is queryable.

## Run the server

```sh
cd server
deno task dev
```

The server listens on port 8000.

## Run the tests

```sh
cd server
deno task test
```

## Deploy to Cloud Run

The `server/Dockerfile` makes a distroless Deno image. The image exposes port
8000.

1. Build and deploy the image:

   ```sh
   cd server
   gcloud run deploy mongodb-hackathon-dublin26-git \
     --source . --region europe-west1
   ```

2. Set the environment variables on the Cloud Run service.
