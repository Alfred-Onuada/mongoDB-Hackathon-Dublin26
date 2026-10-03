FROM denoland/deno:2.9.7@sha256:fa335acdf6b72106eda2cb6a8cb5f4187e7630e357467489db4b2e7352d5e432 AS build

WORKDIR /app

COPY deno.json deno.lock ./
RUN deno install --frozen

COPY *.ts ./
RUN deno install --frozen --entrypoint main.ts

FROM denoland/deno:distroless-2.9.7@sha256:16583ef81ce73d6fdf806174fbda68bf4c57e914659ffe6b1c2b600ac2327962

WORKDIR /app

COPY --from=build /deno-dir /deno-dir
COPY --from=build /app /app

USER 65532:65532
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["deno", "eval", "const r = await fetch('http://127.0.0.1:8000/api'); Deno.exit(r.ok ? 0 : 1)"]

CMD ["run", "--cached-only", "--frozen", "--allow-net", "--allow-env", "--allow-read=/app,/deno-dir", "--allow-sys=osRelease", "main.ts"]
