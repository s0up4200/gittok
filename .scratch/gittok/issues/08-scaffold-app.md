# Scaffold the app shell

Type: task
Status: resolved
Blocked by: 04

## Question

Create the Vite + React + TypeScript project with bun, add vite-plugin-pwa with a manifest for iOS standalone mode, set `viewport-fit=cover`, and a full-screen vertical snap container with three placeholder cards. Apply the iOS PWA research findings. This unblocks the card prototype. Record the commands run and the resulting file layout in the answer.

## Answer

Commands run:

```sh
bun create vite tmpl --template react-ts   # in scratch, then copied in
git init -b main
bun add -D vite-plugin-pwa                  # 1.3.0
bun install
bun run build
```

Template leftovers removed: `src/assets`, `src/App.css`, `public/vite.svg`, `public/favicon.svg`, `public/icons.svg`.

Resulting layout:

```
index.html          viewport-fit=cover, apple-* meta tags, apple-touch-icon
vite.config.ts      react + VitePWA({ registerType: 'autoUpdate', manifest })
src/main.tsx        unchanged from template
src/App.tsx         <main class="feed"> with three placeholder cards (Repo, Change, Release)
src/index.css       shell CSS from research checklist: fixed body, 100dvh feed, 100vh in standalone, snap mandatory, snap-stop always, absolute overlays with safe-area padding
public/icon-192.png, icon-512.png, apple-touch-icon.png   black square with "GT", placeholders
CONTEXT.md, .scratch/                                      unchanged
```

Manifest emitted by the build: `name`, `short_name`, `id: "/"`, `start_url: "/"`, `display: "standalone"`, `theme_color`, `background_color`, three icons including one maskable.

Verified in desktop Chromium (window resize is a no-op under Hyprland, so not at phone width): three cards, each card height equals the feed height, `scroll-snap-type: y mandatory`, no horizontal document overflow, manifest linked, service worker registered. Not verified at phone width or on a real iPhone; that is the prototype ticket's job.

Nothing committed. Versions: vite 8.2.2, react 19.2.8, vite-plugin-pwa 1.3.0, typescript 6.0.2, bun 1.4.0. Vite runs on Node via its shebang; no `--bun` flag.
