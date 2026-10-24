# GitTok

## Deploy and check

The Pages workflow deploys each push to `main`. To follow the deploy, run `gh run watch` on the run whose `headSha` is the pushed commit.

The user checks each deploy on a phone. When the installed app comes back to the foreground, it looks for a new build and reloads. If the phone still shows the old build, tell the user to force-quit the app and open it again.

For a layout bug, ask the user to turn on "Viewport readout" in settings and send what the feed shows. It shows the build commit, the viewport heights, and the safe-area insets. Base the layout fix on these numbers.

- Use icons from `@heroicons/react`.
- Do not add a fade at the bottom of a card.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `s0up4200/gittok`. Use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the five default triage labels and the `wayfinder:*` labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repo has one context, with `GLOSSARY.md` and `docs/adr/` at the root. See `docs/agents/domain.md`.
