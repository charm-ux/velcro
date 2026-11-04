# Velcro docs (private prototype)

A Litro static site that documents and runs Velcro's `sl-button`. Light theme only; one component page.

```sh
pnpm install
pnpm --filter @velcro/docs run build      # compiles packages/velcro, then `litro generate` -> packages/docs/dist/static
pnpm --filter @velcro/docs run preview    # serves dist/static on port 4321 (set PORT to change)
pnpm exec playwright test -c tests/product/playwright.config.mjs
```

- Pages and layouts never import Velcro; they must stay safe to evaluate on the server.
- Examples live in `examples/**/*.html`. `scripts/generate-examples.mjs` turns them into an ignored module so the
  displayed source and the executed document are the same file. Each example runs in its own iframe document and
  loads `/_litro/velcro.js` (the `velcro-entry.ts` bundle), so it can use plain `document.querySelector`.
- Only checked-in examples execute. No upstream Shoelace runtime is loaded.
