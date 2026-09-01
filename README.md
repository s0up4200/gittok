# GitTok

TikTok, but for your GitHub feed. A swipeable, full-screen card interface that displays releases, pushes, pull requests, and stars from the users you follow and repositories you star.

Doomscrolling, except every card is a changelog.

This is a static, self-hosted application with no backend. It requires a personal access token, which is stored locally in your browser and never leaves it.

## Run it

```sh
bun install
bun run dev
```

Open the app on your phone, tap the gear icon, and paste a classic personal access token with the `public_repo` scope. The token is stored in the browser's `localStorage` and is only sent to `api.github.com`.

## Host it

Run `bun run build` to generate the static site in `dist/`, which can be served by any static host.

For GitHub Pages, the workflow in `.github/workflows/pages.yml` builds and deploys on every push to `main`. Enable Pages in repository settings with GitHub Actions as the source. The workflow sets `BASE_PATH=/<repo>/` to serve from the repository path. If deploying to a custom domain, set `BASE_PATH=/`.

## Develop

```sh
bun test         # feed builder and client tests
bun run build    # typecheck and build
bun run lint
```

The specification and planning notes are in `.scratch/gittok/`. The glossary is in `CONTEXT.md`.
