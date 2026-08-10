# argus

Self-hosted page watcher. Points at a URL, checks it on a schedule, and tells you
what changed — in text, in one element, or pixel by pixel.

Runs on **marko**, port **8797**, `http://argus.lan`.

## Why not changedetection.io

It is the only serious self-hosted option, and argus borrows its shape (fetch →
extract → diff → notify). The gaps argus exists to close:

- **Noise control that works on its own.** argus watches its own history: a line
  that changes on most checks is a clock or a counter, not news, so it proposes a
  ready-made ignore rule instead of leaving you to reverse-engineer the noise.
- **Visual diff as a first-class mode**, with changed regions boxed, a swipe
  compare, and a jump list of the regions that moved.
- **A real element picker** — the target page is proxied script-free, so you click
  the thing you care about instead of hand-writing a selector.
- **Notifications that route themselves** through `robot ping` rather than
  hand-composed Apprise URLs.

## Modes

| Mode | Compares | Use it for |
|---|---|---|
| `text` | readable text of the whole page | articles, docs, changelogs |
| `element` | text inside one CSS selector | a price, a status, a listing table |
| `visual` | screenshots, pixel by pixel | layout, images, anything visual |

`visual` always renders in a browser. `text`/`element` use a plain HTTP fetch
unless the watch turns on **Load with a browser**, which is needed for pages that
build their content in JavaScript.

## Adding a watch

`/new` is a full page, not a dialog. Read a URL once, then the right-hand panel
shows **exactly what argus will compare** and re-renders whenever you change what
you're comparing: extracted text for `text`/`element`, the real capture for
`visual`. Selector iteration reuses the cached fetch, so trying selectors is
instant; only a visual preview of a specific element re-captures.

`picker.ts` deliberately refuses unstable ids — numeric, long digit runs, hex
hashes, framework-generated (`ember`/`react-`/`:r`). Anchoring to one silently
breaks the watch on the next render: Hacker News story rows carry a numeric `id`
that changes every time the front page updates.

## Stack

TypeScript throughout, deliberately dependency-light:

- **No build step on the server** — Node 26 runs the `.ts` sources directly.
- **No native modules** — storage is Node's built-in `node:sqlite`, not
  better-sqlite3.
- **No bundled browser download** — `playwright-core` drives the system Chrome
  already on marko, which matters on a box at 88% disk.
- Fastify + React/Vite/Tailwind, IBM Plex bundled locally so the UI works offline.

## Layout

```
server/src
  index.ts       fastify bootstrap, static SPA, shutdown
  scheduler.ts   due-watch tick, concurrency + per-host rate limiting
  check.ts       one check: capture → extract → diff → persist → notify
  capture.ts     HTTP vs browser dispatch
  render.ts      playwright pool, animation freezing, lazy-load settling
  extract.ts     HTML → comparable text
  diff.ts        line diff with collapsed context
  visual.ts      pixelmatch + region clustering + overlay painting
  suggest.ts     ignore-rule proposals from a watch's own history
  retention.ts   what to keep, what to shed
  picker.ts      script-free page proxy for the element picker
web/src          board, detail view, controls, diff viewers
```

## Running it

```sh
make install      # deps
make deploy       # build UI, install the systemd user unit, restart
make logs         # follow
make dev          # backend with reload (pair with `make dev-web`)
```

Config is environment-driven — see `server/src/config.ts`. Anything you want to
override goes in `argus.env` beside the Makefile (git-ignored).

Useful knobs: `ARGUS_DATA` (default `~/.local/share/argus`), `ARGUS_CONCURRENCY`,
`ARGUS_HOST_GAP_MS` (politeness gap per host), `ARGUS_RETAIN_CHANGED`,
`ARGUS_WATCH_BYTE_CAP`, `ARGUS_CDP` (attach to an existing Chrome for
logged-in pages), `ARGUS_NOTIFY=0` (silence Telegram).

## Retention

marko is disk-tight, so this is enforced, not advisory:

- Unchanged checks are deleted wholesale beyond the newest few.
- Changed checks keep their row forever but shed their artifacts past
  `ARGUS_RETAIN_CHANGED`, so *when* something changed is never lost.
- A per-watch byte cap drops the oldest artifacts first.
- The newest successful check is never pruned — it is the baseline the next diff
  compares against.

## Not built yet

Semantic summaries (a local model on tardis reading the diff), multi-user,
browser steps for login flows, RSS/JSON watch types, region-level ignore masks
for visual mode.
