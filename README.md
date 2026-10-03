# Doc Drift Finder

This service finds documentation that a code change can make incorrect. You
send code to the service. The service gives a review comment. The comment
tells you which documentation sections to update.

The service uses Google Gemini and MongoDB Atlas Vector Search.

## Live service

The service runs on Google Cloud Run:

<https://mongodb-hackathon-dublin26-git-wzji4n5axq-ew.a.run.app>

## Architecture diagram

![Architecture diagram](docs/images/architecture.png)

## How the service works

1. The client sends code to `POST /api/describe`.
2. Gemini writes a plain-text description of the code.
3. Atlas Vector Search finds the documentation chunks that are near to the
   description.
4. Gemini compares the code with these chunks.
5. The service sends back the description, the matches, and a review comment.

## Quick start

1. Install Deno 2.
2. Copy `server/.env.example` to `server/.env`.
3. Write your values in `server/.env`.
4. Start the server:

   ```sh
   cd server
   deno task dev
   ```

5. Send a request:

   ```sh
   curl -X POST https://mongodb-hackathon-dublin26-git-wzji4n5axq-ew.a.run.app/api/describe \
     -H 'content-type: application/json' \
     -d '{"code": "from langchain_openai import ChatOpenAI", "limit": 5}'
   ```

## Documentation

| Document                             | Contents                                             |
| ------------------------------------ | ---------------------------------------------------- |
| [Architecture](docs/architecture.md) | The components and the data flow                     |
| [API reference](docs/api.md)         | The endpoints, the request, and the response         |
| [Setup](docs/setup.md)               | The configuration, the data load, and the deployment |
