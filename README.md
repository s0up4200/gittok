# GitTok

Swipe through releases, commits, pull requests, and stars from your GitHub feed.

[Open GitTok](https://s0up4200.github.io/gittok/), or run it yourself.

Tap the gear icon and add a classic GitHub personal access token with the `public_repo` scope.
The app stores your token in your browser and sends it only to `api.github.com`. There is no backend.

## Run locally

```sh
bun install
bun run dev
```

## Host it

Run `bun run build` and serve `dist/` with any static host.

For GitHub Pages, select GitHub Actions as the Pages source in repository settings.
The workflow in `.github/workflows/pages.yml` deploys each push to `main` with `BASE_PATH=/<repo>/`.
For a custom domain, set `BASE_PATH=/`.

## Develop

```sh
bun test
bun run build    # typecheck and build
bun run lint
```

See [GLOSSARY.md](GLOSSARY.md) for the project glossary.

## License

MIT. See [LICENSE](LICENSE).
