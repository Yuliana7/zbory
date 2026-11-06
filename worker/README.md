# Jar lookup worker

Turns the short id in a `send.monobank.ua/jar/…` link into the jar's long id, which is what the app
reads amounts with. A browser app can't make this call itself because Monobank's endpoint has no CORS
headers.

It stores nothing and sees no tokens. It answers `GET /<shortId>` with `{ "longId": "…", "mainJar": "…" }`,
where `mainJar` is the short id of the jar a helper jar feeds into. It relies on an unofficial endpoint,
so pasting a long id by hand must keep working.

## Deploy

Needs a free Cloudflare account. From this folder:

    npx wrangler login
    npx wrangler deploy

The second command prints the worker's address.
