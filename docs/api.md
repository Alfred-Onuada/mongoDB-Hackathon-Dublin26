# API reference

Base URL: <https://mongodb-hackathon-dublin26-git-wzji4n5axq-ew.a.run.app>

## GET /api

This endpoint is a health check. It sends back a message and the server time.

```json
{ "message": "Hello, world!", "time": "2026-10-03T12:00:00.000Z" }
```

## POST /api/describe

This endpoint finds the documentation that the code can make incorrect.

### Request

| Field | Type | Necessary | Description |
|---|---|---|---|
| `code` | string | Yes | The code to examine. Maximum: 100000 characters. |
| `limit` | integer | No | The maximum number of matches. Range: 1 to 20. Default: 5. |

```json
{ "code": "from langchain_openai import ChatOpenAI", "limit": 5 }
```

### Response

| Field | Type | Description |
|---|---|---|
| `description` | string | The prose description of the code from Gemini. |
| `matches` | array | The documentation chunks that agree with the description. |
| `comment` | string | The review comment in Markdown. |

Each item in `matches` has `_id`, `title`, `source_url`, `chunk_index`,
`chunk_content`, `metadata`, and `score`. The score is from 0 to 1. A high
score shows a near match.

If no chunk has a score above the threshold, the comment tells you that no
documentation is affected.

### Errors

| Status | Cause |
|---|---|
| 400 | The body is not valid JSON, `code` is empty, or `limit` is not valid. |
| 405 | The method is not `POST`. |
| 413 | `code` has more than 100000 characters. |
| 502 | Gemini or MongoDB Atlas did not give a correct response. |

Each error response has an `error` field with a message.
