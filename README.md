# GitTok

TikTok, but for your GitHub feed. A mobile-first PWA that shows your GitHub activity as full-screen cards you swipe through.

Static, self-hosted, no backend. Bring your own personal access token.

## Run it

```sh
bun install
bun run dev
```

Open the app on your phone, tap the gear, and paste a classic personal access token with the `public_repo` scope. The token stays in your browser's localStorage.

## Host it

`bun run build` writes a static site to `dist/`. Any static host works.

GitHub Pages: the workflow in `.github/workflows/pages.yml` builds and deploys on every push to `main`. Enable Pages with the "GitHub Actions" source in the repo settings. The workflow sets `BASE_PATH=/<repo>/` so the app works under the project path. For a custom domain, set `BASE_PATH=/`.

## Develop

```sh
bun test         # feed builder and client tests
bun run build    # typecheck and build
bun run lint
```

Spec and planning notes live in `.scratch/gittok/`. Glossary in `CONTEXT.md`.
