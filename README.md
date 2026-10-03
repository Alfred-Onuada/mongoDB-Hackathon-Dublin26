# DocDrift

DocDrift finds the documentation that a code change makes incorrect. Send code
to the service. The service sends back a review comment with the documentation
sections to update.

Live service: <https://mongodb-hackathon-dublin26-git-wzji4n5axq-ew.a.run.app>

![Architecture diagram](docs/images/architecture.png)

## Quick start

1. Copy `server/.env.example` to `server/.env` and set the values.
2. Start the server:

   ```sh
   cd server && deno task dev
   ```

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Setup](docs/setup.md)
