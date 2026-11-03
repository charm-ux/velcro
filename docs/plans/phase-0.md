# Velcro Phase 0 — local privacy and repository bootstrap

Design: `docs/specs/velcro.md`, `docs/specs/security-privacy.md`, `docs/specs/delivery-workflow.md`
Repository: repository-relative portable plan; generate the absolute runtime header locally.
Branch: `design/velcro` (coordinator); worker branches listed below.
Base: `48cab77f` (resolve the full local revision in the private execution ledger).
Oracle: instrumented.
Unattended: no for external operations; local implementation/review is authorized.

## Outcome and hard stop

Produce a locally verified, independently reviewed foundation that is safe to
propose for public GitHub setup. Do not implement the component catalog or Litro
site yet. Stop before remote creation or any push, PR creation, remote merge,
release, or deployment. Present the exact publishable refs/content and local
privacy/review evidence for the owner's outbound approval.

The first outbound phase is a minimal sanitized main plus a reviewed bootstrap
PR. Its own CI can run before that PR merges. Configure/enforce observed checks,
prove failure cases, and obtain the chosen human approval; no bootstrap CI bypass.

## Fixed decisions for this increment

- Use Node 24.22.1 (available locally) and pnpm 9.15.9, not the globally installed
  pnpm 12. Invoke the pinned pnpm explicitly when necessary.
- Pin `@changesets/cli` 2.29.8 and `tar` 7.5.22; pin Gitleaks 8.30.1 with published
  SHA-256 checksums. No floating dependency installers or publish commands.
- The root and docs workspace are private. Scaffold `@charm-ux/velcro` at 0.1.0
  with `private: true` as a temporary publication lock and `license: UNLICENSED`
  until the owner approves its actual release license. Public GitHub visibility
  is separate from npm's private flag. No claim that components exist yet.
- Use actual Velcro semver for future runtime/CDN version identity; keep the
  Shoelace target 2.20.1 separate. No Changesets pre mode or release is entered
  during bootstrap. Record feature/fix/breaking intent using normal Changesets
  minor/patch/major entries; do not invent releases in the changelog.
- Existing approved owner username/noreply commit identity is the exact metadata
  allowlist. No private workstation identity, arbitrary email allowlist, or bot
  impersonation. Keep `user.useConfigOnly=true`.
- Standard web routes/module specifiers and exact reviewed legal/identity syntax
  are not machine filesystem paths. Detector and negative-test strings must not
  embed real personal values; generate synthetic violations at runtime.
- Use Node built-in tests. Before a task commits, verify root/branch/identity,
  stage only owned files, run focused tests and `git diff --cached --check`, and
  inspect staged content for private data. Automated hooks arrive in Task 6;
  they are not presumed present for earlier task commits.
- Review each task with an independent flock. Risky security work uses two strong
  reviewers, including Fable and another strong model; no author reviews their
  own task. Final integrated review covers all task interactions. Returned fixes
  outrank new task dispatch. Five nonconverging rounds stop the affected task.

## Parallelism, ownership, and integration

Tasks 1, 2, and 3 run independently in three worker worktrees. Tasks 4 and 5
follow their dependencies; Task 6 integrates only reviewed predecessors. The
coordinator retains the private ledger in its own worktree. All runtime plan
headers, briefs, reports, binaries, and recovery material stay in ignored `.airig/`.

Before the remote exists, only the reviewed bootstrap tasks may be integrated
locally on a dedicated bootstrap branch. Record exact dependency SHAs in each
runtime brief. Worker branches are not independently published before the first
privacy gate. After remote setup, return to task PRs based on merged main and
strict current-base validation, with the active skill's update authorization.

### Task 1 — workspace, contributor policy, and release hygiene

**Worker branch:** `bootstrap/workspace`
**Files:** `AGENTS.md`, `.gitignore`, `.nvmrc`, `package.json`, `pnpm-workspace.yaml`,
`pnpm-lock.yaml`, `.changeset/config.json`, `.changeset/README.md`,
`packages/velcro/package.json`, `packages/velcro/CHANGELOG.md`,
`tests/bootstrap/workspace.test.mjs`, `tests/bootstrap/changesets.test.mjs`.
**Depends on:** nothing.

**Do:**
1. Create the minimal private workspace with the fixed versions above, a heading-only
   package changelog, and Changesets configured to version private packages but
   not tag/publish them. There are no component exports or fake implementations.
2. Root scripts: `test` runs Node test files under `tests/`; `changeset`,
   `changeset:status`, and `changeset:version` invoke the installed CLI. Add no
   automatic versioning or publication lifecycle. Task 6 owns final verify wiring.
3. Document approved identity, portable paths, private runtime data, explicit scan
   commands, no bypass, protected policy changes, and worktree-only development in
   AGENTS. Ignore local scratch/worktrees/dependencies/build output; avoid ignores
   that conceal intentionally tracked security files from security checks.
4. Test workspace shape and independent Changesets versioning in disposable fixtures:
   version increment and changelog entry appear, no unreleased placeholder survives,
   no tag/publish runs, private non-library fixtures are not accidentally released.
   Do not consume real pending changesets to run the test.
5. Install dependencies only in the assigned worktree using pnpm 9.15.9. Own the
   sole initial lockfile; other tasks must not edit dependency manifests.

**Check:** `node --test tests/bootstrap/workspace.test.mjs tests/bootstrap/changesets.test.mjs`
plus `npx --yes pnpm@9.15.9 install --frozen-lockfile` → all tests and frozen install
pass. Report test-first failure and passing counts. No source/runtime claims beyond scaffold.
**Commit:** `chore: initialize private workspace and release hygiene`

### Task 2 — content privacy rules and redacted diagnostics

**Worker branch:** `bootstrap/privacy-content`
**Files:** `security/policy.json`, `scripts/security/privacy.mjs`,
`tests/security/privacy.test.mjs`.
**Depends on:** nothing.

**Do:**
1. Build a dependency-free ESM privacy engine and CLI. Export
   `scanText(text, label, options = {})`, returning findings with `rule`, sanitized
   `path`, and 1-based `line`, and `formatFindings(findings)`, returning safe text.
   Export `loadPolicy(root)` to validate/load the tracked policy. Findings must
   never include matched content. Other tasks import these exact functions.
2. Policy records the approved public GitHub identity, forbidden runtime directories,
   and narrowly scoped exceptions. Do not allow every noreply address or every
   file in a directory. A policy parse/load failure is a blocking infrastructure error.
3. Detect machine filesystem locations across Unix, drive/UNC and home-expansion
   forms; email-shaped/private endpoint or hostname forms; unsafe filenames; and
   useful escaped/encoded representations. Preserve legitimate web routes, package
   imports, version strings, and the exact approved policy metadata context.
4. CLI `node scripts/security/privacy.mjs files <path...>` scans only explicitly
   supplied regular files/directories, refuses symlink escapes and unaudited binary
   content, and uses repository-relative redacted labels. Exit 0 is clean, 1 is
   findings, 2 is a scanner/policy/input failure. Root is resolved dynamically.
5. Tests synthesize private paths, identifiers and emails at runtime. Include
   positive public-route/import/approved-identity cases and ensure both stdout and
   stderr with hostile input contain neither its sensitive value nor absolute path.
   Document that this is pattern-based protection, not universal PII recognition.

**Check:** `node --test tests/security/privacy.test.mjs` → positive/negative,
malformed-policy, binary/symlink, and diagnostic-leak tests pass. Add CLI subprocess
assertions for exit codes, not only calls to the exported function.
**Commit:** `feat: add fail-closed content privacy checks`

### Task 3 — pinned secret scanner acquisition and safe execution

**Worker branch:** `bootstrap/secret-scanner`
**Files:** `scripts/security/gitleaks.mjs`, `security/gitleaks-checksums.json`,
`tests/security/gitleaks.test.mjs`.
**Depends on:** nothing.

**Do:**
1. Provide `node scripts/security/gitleaks.mjs install` to acquire Gitleaks 8.30.1
   from its official release into ignored local scratch. Pin SHA-256 per supported
   Darwin/Linux x64/arm64 archive from the official checksums; unsupported targets
   fail clearly. Verify before extraction/execution, select only the executable,
   reject unsafe archive paths, and never install globally.
2. Commands `dir <path>` and `git <repo> [revision-range]` run the pinned binary
   with redacted output and bounded execution. Git range omission scans publishable
   history rather than local reflog/recovery data. No shell interpolation of inputs.
   Support `--max-archive-depth`/`--max-decode-depth` where appropriate after checking
   the pinned CLI. Do not imply secret scanning detects all PII.
3. Suppress raw subprocess/download/extraction output. Return safe finding counts
   and categories/locations only; no secret snippets or machine paths, even on
   errors. Missing/wrong binary, failed checksum, timeout and nonstandard scanner
   exit all fail closed. Store raw reports only in ignored scratch if necessary,
   never expose them as CI artifacts.
4. Tests mock transport/process failures without broad production bypass flags and
   synthesize a known scanner test secret at runtime. Prove a real installed scanner
   rejects that fixture and accepts a clean fixture. Capture no sensitive test value
   in public logs or committed expected-output snapshots.

**Check:** `node --test tests/security/gitleaks.test.mjs`, then
`node scripts/security/gitleaks.mjs install` and real-binary fixture checks → all
pass; evidence includes exact installed version and checksum verification.
**Commit:** `feat: add pinned redacted secret scanning`

### Task 4 — Git object, staged-content, message, and outbound guards

**Worker branch:** `bootstrap/git-privacy`
**Files:** `scripts/security/git-privacy.mjs`, `tests/security/git-privacy.test.mjs`.
**Depends on:** Task 2.

**Do:**
1. Import Task 2's engine. Commands: `staged`, `identity`, `message <file>`,
   `history [revision-range]`, and `pre-push`. Resolve the real repository without
   hardcoding roots; use argument-array Git invocations, never shell expansion.
2. Scan staged blobs/pathnames rather than working copies. Check effective author
   and committer, including environment overrides; enforce approved metadata on
   every historical commit/tag object and scan messages/footers and full relevant
   trees. No range means all publishable branch/tag refs, not reflogs or scratch bundles.
3. `pre-push` parses hook stdin/ref updates, refuses malformed/multiple/unapproved
   ref updates, and scans the actual proposed reachable commit set rather than
   assuming HEAD is the branch being pushed. Do not echo remote URLs or object data.
   Detect archived/private recovery refs; no hook bypass or implicit authorization.
4. Tests create isolated Git repositories with explicit synthetic identities and
   only test-local configuration. Cover unsafe staged/safe working content, bad
   ancestor/clean tip, amended metadata, annotated tags, alternate proposed head,
   malicious arguments, excluded runtime paths, missing objects, and redacted errors.

**Check:** `node --test tests/security/git-privacy.test.mjs` → every adverse scenario
fails with safe diagnostics; approved clean histories pass. Neither this repository's
configuration nor its actual branches may be changed by the tests.
**Commit:** `feat: guard staged content and publishable git history`

### Task 5 — outbound files and package archive privacy

**Worker branch:** `bootstrap/artifact-privacy`
**Files:** `scripts/security/artifacts.mjs`, `tests/security/artifacts.test.mjs`.
**Depends on:** Tasks 1, 2, 3.

**Do:**
1. CLI `node scripts/security/artifacts.mjs <path...>` scans explicit PR/release-text
   files, static-output directories, source maps and npm tarballs using Task 2 and
   Task 3. Use the pinned `tar` library for safe bounded archive inspection; never
   extract untrusted paths over workspace files or follow archive symlinks.
2. Allowlist supported formats, reject unsupported/binary content until a reviewed
   metadata scrub/verification path exists. Bound archive bytes/entries/depth and
   decoded content. Reject traversal, absolute member names, links, and malformed
   compression. This is not general arbitrary-format PII certification.
3. Check source-map sources/sourceRoot and JSON/text metadata as content. Test
   sensitive content inside nested archive members and hostile filenames; return
   only safe findings. Test explicitly supplied untracked text, because PR bodies
   do not need to be tracked to leak data.
4. Produce and scan a real local `pnpm pack` of the bootstrap package, without
   publishing. Packaging must exclude scratch/dependencies/tests/private paths.

**Check:** `node --test tests/security/artifacts.test.mjs` and scan of a clean real
bootstrap tarball → pass; synthetic contaminated source map/archive/PR text and
hostile archive metadata → fail, without printing contaminated values.
**Commit:** `feat: validate outbound text and package artifacts`

### Task 6 — hooks, trusted CI aggregate, and bootstrap verification

**Worker branch:** `bootstrap/privacy-integration`
**Files:** `.githooks/pre-commit`, `.githooks/commit-msg`, `.githooks/pre-push`,
`scripts/security/install-hooks.mjs`, `scripts/verify.mjs`, `scripts/ci-gate.mjs`,
`.github/workflows/ci.yml`, `package.json`, `tests/bootstrap/integration.test.mjs`,
`docs/contributing.md`.
**Depends on:** Tasks 1–5 reviewed and locally integrated.

**Do:**
1. Wire root scripts for focused privacy, staged/history, secret-install, artifact,
   and full verification commands. Hooks resolve paths dynamically and call the
   same fail-closed commands. Only install repo-local hooks explicitly after task
   integration; do not mutate shared hook config while earlier workers still commit.
2. Create CI with pinned action commit SHAs, Node/pnpm pins, frozen install, test,
   staged-independent candidate/history privacy, secret and package checks. Full
   history must be available. No publish/deploy, credentials, or privileged PR-code
   execution. Upload only intentionally sanitized reports, not raw traces/scratch.
3. Use an always-scheduled required `ci-gate` job that verifies every expected
   dependency result is success and missing/cancelled/skipped/failed jobs cannot pass.
   Test the aggregator with all adverse statuses. For later PRs, validate candidate
   content against trusted base policy/scanner code; the initial trusted-policy
   bootstrap must be explicitly distinguished and independently reviewed.
4. Add an explicit human security-review requirement for changes to policy,
   scanner/hooks/workflow/allowlists. Do not pretend CODEOWNERS self-review works
   with the owner as PR author; the actual GitHub approval mechanism is an outbound
   setup decision and not remotely configured by this task.
5. Document the actual commands, supported privacy scope and limitations, clean
   bootstrap order, current-base revalidation, and the precise external hard stop.
   Local tests must prove hook refusal, effective-identity overrides, safe errors,
   and end-to-end CLI composition. Do not claim GitHub enforcement is tested locally.

**Check:** `npx --yes pnpm@9.15.9 verify` → all local tests, current publishable
history/content scans, real secret scan, and clean packed-artifact scan pass.
`node --test tests/bootstrap/integration.test.mjs` → injected failures/skips,
missing tools, hook failures and malicious proposed policy are rejected. Report
GitHub execution/protection as unverified until the authorized outbound phase.
**Commit:** `ci: enforce privacy checks and bootstrap verification`

## Deferred checks and outbound handoff — one pass

1. Owner reviews the privacy report and proposed source/ref allowlist; no raw local
   diagnostics, uncommitted drafts, recovery bundles, or personal metadata included.
2. Confirm public GitHub creation, initial sanitized push, and PR author/approval
   mechanism explicitly. No paid service/account provisioning or bot creation is
   implied. Actual library release license remains a separate owner decision.
3. After remote authorization, run GitHub CI, prove branch-protection enforcement,
   and receive the initial PR's human merge authorization. This is a separate
   stage, not an unchecked task hidden in local verify.

## Completion criteria

Every task has test-first evidence, committed owned files, independent review and
resolved blockers. The integrated branch has a whole-branch flock review and a
clean explicit local verification run. Record all limitations and unverified
remote claims. Only then request the outbound approval; component/Litro architecture
work starts after the foundation gate, not while privacy controls remain uncertain.
