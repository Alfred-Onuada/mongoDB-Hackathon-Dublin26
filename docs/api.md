# API reference

## GET /api

A health check. It sends back a message and the server time.

## POST /api/describe

Request:

```json
{ "code": "from langchain_openai import ChatOpenAI", "limit": 5 }
```

| Field   | Necessary | Description                                      |
| ------- | --------- | ------------------------------------------------ |
| `code`  | Yes       | The code. Maximum: 100000 characters.            |
| `limit` | No        | The maximum number of matches: 1 to 20. Default: 5. |

The response has three fields:

- `description`: the prose description of the code.
- `matches`: the documentation chunks, each with a `score` from 0 to 1.
- `comment`: the review comment in Markdown.

| Status | Cause                                   |
| ------ | --------------------------------------- |
| 400    | The body or a field is not valid.       |
| 405    | The method is not `POST`.               |
| 413    | `code` is too long.                     |
| 502    | Gemini or Atlas did not send a response. |
