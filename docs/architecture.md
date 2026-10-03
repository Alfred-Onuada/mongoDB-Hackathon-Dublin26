# Architecture

## Data flow

1. The client sends code to `POST /api/describe`.
2. Gemini writes a prose description of the code.
3. Atlas Vector Search finds the documentation chunks that are near to the
   description.
4. The service removes the chunks with a score below the threshold.
5. Gemini compares the code with the chunks and writes a review comment.

## Why the service changes code to prose

The documentation is prose. Code and prose use different words for the same
idea, so their embeddings are far apart. A prose description uses the words of
the documentation. Its embedding is near to the related documentation.

The description also removes noise, for example variable names and syntax. It
keeps the exact names of libraries, APIs, and functions. The prompt is in
`server/describe-code.ts`.

## Vector search index

The index uses the `autoEmbed` field type on `chunk_content`. Atlas makes the
embeddings. At start, the server stops if the index is missing, has the wrong
type, or is not queryable.
