# Velcro

Velcro extends [Charm Core](https://github.com/charm-ux/core) (`@charm-ux/core`) toward compatibility with
[Shoelace 2.20.1](https://github.com/shoelace-style/shoelace/tree/v2.20.1): Shoelace-style `sl-*` web components that
Charm users can adopt without rewriting application markup or event handlers. That is the goal, not the current state.

## Status

Velcro is an **unreleased early prototype**; its packages are marked `private: true` and are not released. It is not a drop-in replacement for Shoelace and not a
completed 58-component library. The current implementation is a partial slice:

- sixteen components, `sl-badge`, `sl-button`, `sl-card`, `sl-divider`, `sl-format-bytes`, `sl-format-date`, `sl-format-number`, `sl-mutation-observer`, `sl-progress-bar`, `sl-progress-ring`, `sl-relative-time`, `sl-resize-observer`, `sl-skeleton`, `sl-spinner`, `sl-switch` and `sl-visually-hidden` (`packages/velcro`, package `@charm-ux/velcro`), built on `@charm-ux/core`;
- the Shoelace light and dark themes (`packages/velcro/themes/light.css` and `dark.css`, copied from Shoelace 2.20.1 and token-checked against it);
- a Litro static documentation site (`packages/docs`, package `@velcro/docs`) with the home page and one route per
  component (`/components/<name>` for each of the sixteen, as listed in `packages/docs/catalog.jsonl`).

Nothing is published or deployed, and the validation described here is local; this README reports no hosted CI or
publication result. This slice has no upstream Shoelace runtime dependency: no Shoelace runtime is loaded or included.
It does contain Shoelace-derived material adapted into source (the components' API documentation wording, structure and styles (see the notices file for the exact list), and the light and dark theme files), whose upstream notice is retained in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (see Licensing and notices).

## Prerequisites

- Node `24.22.1` and pnpm `9.15.9`, as pinned in `.nvmrc` and `package.json`.
- Chromium, Firefox and WebKit for Playwright, installed explicitly once (they are never installed automatically):
  `pnpm exec playwright install chromium firefox webkit` (add `--with-deps` on Linux). Needed only for the browser tests.
- The committed `.npmrc` and lockfile default to public npm. An operator-approved local registry override is possible, but
  it must stay out of committed and public content.

## Quickstart

Work in a repository-local `.worktrees/<branch-dir>` checkout (see [AGENTS.md](AGENTS.md)); dependencies are per-worktree.

```sh
pnpm install --frozen-lockfile
pnpm --filter @velcro/docs run build     # builds @charm-ux/velcro, then generates the static site in packages/docs/dist/static
pnpm --filter @velcro/docs run preview   # serves that output on port 4321 (set PORT to change; the product tests use VELCRO_PRODUCT_PORT)
pnpm --filter @velcro/docs run build:prefixed   # same site for a project URL prefix (default /velcro) in dist/static-prefixed
```

The preview server binds to the loopback interface only. Keep it that way: it is a small local file server for the
static build, not a hosting feature, so do not expose it on other interfaces.

## Checks

```sh
pnpm test                 # Node tests under tests/
pnpm verify:source        # pinned tools, hooks, scanner, tests, proposed index
pnpm verify:product       # build, root and prefixed static builds, typecheck and the Playwright suite in Chromium, Firefox and WebKit
pnpm verify               # both of the above
```

`verify:source` needs the pinned Gitleaks scanner (`node scripts/security/gitleaks.mjs install`, when network
acquisition is authorized). See [docs/contributing.md](docs/contributing.md) for the full list of explicit privacy
checks, and [AGENTS.md](AGENTS.md) for the rules every contributor must follow (privacy boundary, identity,
worktrees, no check bypass). Record changes with `pnpm changeset`.

## Documentation

- [docs/specs/velcro.md](docs/specs/velcro.md): design and scope
- [docs/specs/security-privacy.md](docs/specs/security-privacy.md): privacy and security design
- [docs/specs/delivery-workflow.md](docs/specs/delivery-workflow.md): delivery workflow
- [docs/plans/phase-0.md](docs/plans/phase-0.md): phase 0 plan
- [packages/docs/README.md](packages/docs/README.md): the documentation site

## Licensing and notices

- Velcro's own license is **undecided**: the packages are marked `UNLICENSED` pending an owner release decision. No
  license grants rights to Velcro code yet. That does not revoke or alter the licenses of retained upstream material.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) retains the required notices for Shoelace v2.20.1 (MIT) and the
  Litro scaffold (Apache-2.0). Its scope is only material copied or adapted into this repository's **source**.
- It is not a complete inventory of third-party code bundled into built artifacts (for example Lit, `@charm-ux/core`
  and its dependencies). The complete runtime-bundle license inventory and notices remain a **mandatory gate** before
  any package, CDN or site artifact is published, uploaded or deployed.
