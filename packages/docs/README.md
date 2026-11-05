# Velcro docs (private prototype)

A Litro static site that documents and runs every Velcro component listed in `catalog.jsonl`. Light theme only; one page per component.

```sh
pnpm install
pnpm --filter @velcro/docs run build      # compiles packages/velcro, then `litro generate` -> packages/docs/dist/static
pnpm --filter @velcro/docs run preview    # serves dist/static on port 4321 (set PORT to change)
```

Browser tests need **both** outputs, built in this order (the prefixed helper consumes `dist/static`, see below), or run
`pnpm verify:product` from the repository root, which does this for you with the base path pinned:

```sh
pnpm --filter @velcro/docs run build:prefixed   # first: leaves dist/static-prefixed (and no dist/static)
pnpm --filter @velcro/docs run build            # then: the root site in dist/static
pnpm exec playwright test -c tests/product/playwright.config.mjs
```

The product tests serve the preview on port 4321; set `VELCRO_PRODUCT_PORT` (an integer from 1024 to 65535) to use another port,
so separate worktrees can verify in parallel.

`catalog.jsonl` is the single component list (one JSON object per line, sorted by `name`: `name`, `title`, `tag` and the `example`
selector the browser tests wait for). It drives the navigation, the home page, the required site pages and the browser routes.

## Base path (project-site hosting)

By default the site is built for the host root. To build for a project URL such as `https://<owner>.github.io/<repo>/`,
set one input, `LITRO_BASE_PATH`, to the path prefix: empty (root) or a value like `/velcro` (leading slash, no trailing
slash, plain segments). It is Litro's own variable (the framework already uses it for the app script URL) and is
validated by `site-base.ts` before the build; anything else fails the build.

```sh
pnpm --filter @velcro/docs run build:prefixed                       # LITRO_BASE_PATH defaults to /velcro; output: dist/static-prefixed
LITRO_BASE_PATH=/velcro pnpm --filter @velcro/docs run preview      # serves dist/static-prefixed under /velcro/ only
```

`build:prefixed` is a thin helper, not a separate output pipeline: it runs the normal build, which writes `dist/static`,
then moves that directory to `dist/static-prefixed`. Consequently it **replaces any root build** already in
`dist/static` (rebuild the root site afterwards), and if the build fails part-way it leaves partial output in
`dist/static` and does not touch an existing `dist/static-prefixed`; a root `preview` would then serve that partial
prefixed output, so rebuild before previewing. A redesign into separate output directories is deliberately not done here.

The output layout never changes: files sit at the root of `dist/static*` and the host supplies the prefix. What the
input changes:

- `vite.config.ts`: `base` becomes `<prefix>/_litro/` and `__SITE_BASE__` is defined for the browser bundle.
- `nitro.config.ts`: Nitro's `baseURL` and a `replace` of `__SITE_BASE__` for the server render, so the prerenderer
  requests and crawls the prefixed URLs and writes the files without the prefix. `server/handlers/pages.ts` strips the
  prefix from the request path before matching routes.
- `src/base.ts` (`withBase`, `routePath`): used by the shell, the home page and the example iframe `srcdoc`
  documents (a `srcdoc` resolves URLs against the parent page, so the asset URLs are explicit).
- `app-main.ts`: Litro's client router (`@beatzball/litro-router` 0.3.1) has no base-path option and matches
  `location.pathname` literally, so the generated route paths are prefixed before they are handed to `<litro-outlet>`;
  the home route becomes the bare prefix because the router strips trailing slashes. This is the one local adaptation
  of framework behavior; no dependency is patched.

`tests/product/base-path.spec.mjs` checks both layouts against production output served by prefix-only loopback servers.

- Pages and layouts never import Velcro; they must stay safe to evaluate on the server.
- Examples live in `examples/**/*.html`. `scripts/generate-examples.mjs` turns them into an ignored module so the
  displayed source and the executed document are the same file. Each example runs in its own iframe document and
  loads `<base>/_litro/velcro.js` (the `velcro-entry.ts` bundle), so it can use plain `document.querySelector`.
- Only checked-in examples execute. No upstream Shoelace runtime is loaded.
