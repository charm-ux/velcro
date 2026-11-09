# Deploying the documentation site to GitHub Pages

Status: automatic on push to `main`; manual dispatch is the fallback. Pages must be
enabled with the `github-pages` environment restricted to `main` (repository settings, not part of this change).

## Workflow

`.github/workflows/pages.yml` deploys automatically on every push to `main` (no path filter, so the site always reflects
`main` and a newly added component page appears at https://charm-ux.github.io/velcro/), with a manual `workflow_dispatch`
on `main` as a fallback. There is no pull-request, schedule, tag or other-branch trigger and no input; both jobs also
refuse any ref other than `main`, and the `github-pages` environment is restricted to `main`. Every job before `deploy`
has read-only permissions, checks out the exact pushed or dispatched SHA and installs with the frozen lockfile from the
public registry. `checks` runs the history scan and `verify:source`. `product` calls `.github/workflows/product.yml`, which
CI uses too: its build job builds the library and the docs once (the project-site output with `LITRO_BASE_PATH=/velcro`),
scans that output and shares exactly the scanned bytes with the later jobs as a one-day workflow artifact; each engine then runs in four
Playwright shards, and the upstream gate runs in its own job, all on that same output and without rebuilding it (those jobs
run in the official Playwright container image pinned by digest; `docs/contributing.md`, "Playwright container image"). `build`
needs both, records the tested-bytes evidence (below) and runs the site preparation on that same output. Only then does it
upload the Pages artifact. The `deploy` job is the only one with `pages: write` and `id-token: write`; it runs just the
pinned `actions/deploy-pages` and executes no repository scripts. Deployments are serialized and never cancelled.
`ci.yml` runs the same product jobs and preparation (no upload) on every PR.

## Site preparation (`node scripts/site/prepare.mjs`)

1. The docs build records its client module/package closure (`packages/docs/closure-plugin.ts`) into ignored
   `packages/docs/dist/closure/`: logical ids, per-package name/version/declared license and the sha256 of every emitted
   file. No source text, no source maps, no absolute paths. Injected helpers are classified explicitly; anything
   unrecognised blocks.
2. `THIRD_PARTY_RUNTIME_NOTICES.md` is generated from that closure (`scripts/site/notices.mjs`): exact names and versions,
   the license text each package requires, provenance where it is not the package's own file. It fails on a missing,
   unrecognised or mismatched license. It is separate from the source notices in `THIRD_PARTY_NOTICES.md`.
3. A fresh private directory (`.airig/site/<n>/site`) is staged from `dist/static-prefixed` with a text-only allowlist
   (`*.html`, `_litro/**.js|css`, the source notices, and the icon assets: `assets/icons/<name>.svg`, `icons.json` and
   `LICENSE` from the package's Bootstrap Icons, and `assets/images/sprite.svg`), bounded in entries, depth, file and
   total size. Symlinks, special files, maps, `sourceMappingURL`, archives, other images, other formats and unsafe names
   are rejected. Only `nitro.json` and
   the byte-identical duplicate `_litro/THIRD_PARTY_NOTICES.md` are omitted (the docs build no longer emits that
   duplicate: Vite's public directory copy is disabled, so `public/` ships once, at the site root). Icon assets must
   match the package's `SHA256SUMS` and pinned hashes. `tests/product/site-output.spec.mjs` runs the real prefixed
   build through this walk. `404.html`, the runtime notices and an empty
   `.nojekyll` are added. Shipped bundle files must match the closure hashes exactly.
4. The exact staged bytes and every outbound name are scanned with the repository's privacy rules (logical `site/<path>`
   labels) and the pinned Gitleaks engine, with no exclusions (Gitleaks scans a private mirror of the staged bytes in which
   `.svg` names get a `.txt` suffix, because its stock path allowlist would skip SVG files). Any finding, missing scanner or incomplete scan blocks, and
   the staged tree is re-hashed afterwards. `manifest.json` records per-file and aggregate hashes, the source SHA (clean
   tracked tree required) and the closure hash. A failure removes all partial output.

`@charm-ux/core` 0.5.2 ships no license file. Its notice is a **curated fallback**: standard MIT text credited to
`charm-ux`, as its official tagged README does, with the owner's explicit approval; no year or other holder is asserted.

The `__decorate` helper has narrow, evidence-bound coverage. The oxc runtime source copies it from Microsoft TypeScript's
emit helpers (commit `d85767a`, Apache-2.0). Three things are checked, and anything else blocks preparation:

- **Bundler-injected copy** (`@oxc-project+runtime@0.139.0/helpers/esm/decorate`): bound to the exact helper id and version, the hash
  of the module source the build saw, the hash of the body embedded in the installed rolldown, and the hash of each text shipped:
  the TypeScript Apache-2.0 text (words unchanged; only line endings and trailing spaces normalized; the retrieved file's hash is
  recorded; it contains no copyright line and none is invented), the oxc project's MIT license at the pinned tag, and the installed
  rolldown 1.1.5 LICENSE (the bundler whose dist injects the bytes). Any other helper of that package, an ordinary module of it mixed
  in, another version, or a changed body or license blocks.
- **Compiled-in copies**: the same body is emitted by tsc inside ordinary modules (Velcro's own output, `@charm-ux/core`,
  `@beatzball/litro`). The build records, per module, whether its source holds exactly the pinned TypeScript body; the notices name these
  carriers with module counts under the TypeScript attribution, give the emitting compiler version only where known (Velcro: the
  workspace's pinned `typescript`), and state it is not recorded for the others. A module with any other decorate form blocks.
- **Shipped bytes**: preparation counts the helper's API mentions in the staged JavaScript and requires exactly the recorded copies plus
  the one reviewed non-copy use (Lit's `Reflect.decorate` feature check, pinned by package, version, module and hash). An extra copy
  blocks.

No Babel attribution is claimed and no legal conclusion is drawn. Remaining gap: the license files inside the published runtime
package were not retrieved; that package is not what ships. This coverage is **not** covered by the owner's core 0.5.2 approval and
needs human review before first deployment. Velcro itself stays UNLICENSED.

## Tested-bytes binding

`pnpm verify:product` records, before the browser checks, the hash of every file in `dist/static-prefixed` (HTML included)
and of the closure record. It deletes any earlier evidence first, re-reads both after the checks pass, and only then writes
`.airig/product/tested-prefixed.json` (source SHA, base, hashes). Preparation refuses to stage unless that evidence exists,
matches HEAD and the base, and every staged byte and the closure hash equal it. The source must also have been clean (no tracked change, no non-ignored untracked file) and the same commit at the start, at the
snapshot and after the checks; otherwise `verify:product` still passes for local development but records no evidence, so a build from dirty
source that is reverted afterwards cannot be prepared. Nothing is rebuilt between verification and
preparation in either workflow. The closure record is read once (bounded), that buffer is hashed and parsed, and it is
compared again after the scans.

In CI the checks are split across jobs, so the binding goes through a digest. `verify:product --stage build` requires a
clean source that is the same commit at the start, at the snapshot and at the end of the build (a build that changes or
adds a source file prints no digest), checks that the snapshot did not change during the rest of the build, and prints the
build digest: every file of both dist trees (path, size and SHA-256) and the source commit (`scripts/ci/build-output.mjs`).
The build output scan checks that digest, scans those bytes and stages exactly them for the upload. Every browser shard,
the upstream job and `--stage evidence` (`--stage browser`, `--stage upstream`, `--stage evidence`) refuse to run unless
their checkout is clean and the downloaded output with it has that digest, and check both again afterwards. The evidence
stage, run only in a job that needs every product job to have succeeded, then writes the same evidence file for the
snapshot, which preparation requires as above.

The upload action runs with `include-hidden-files: true` so the empty `.nojekyll` marker is included; only the vetted
staged directory is uploaded.
