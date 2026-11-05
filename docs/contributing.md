# Contributing locally

Use the pinned Node version in `.nvmrc` and pnpm version in `package.json`.
Work only in a repository-local `.worktrees/` checkout; dependencies and scanner
installation are per-worktree. `.npmrc` and the lockfile use only public npm.
Run `pnpm install --frozen-lockfile` and acquire the pinned scanner with
`node scripts/security/gitleaks.mjs install` when network acquisition is authorized.
The installer verifies archive and executable checksums; never fabricate integrity
values or weaken gates to accommodate a registry problem.

## Adding a component

Every component ships its Litro docs page, and therefore its GitHub Pages route. `pnpm generate` (in `packages/velcro`)
scaffolds the component and these pieces; fill them in, and add the `./<name>` entry (exact `types`/`import` targets
under `dist/components/<name>/`; `./<name>/class` is optional) to `packages/velcro/package.json` `exports` by hand:

- `packages/docs/pages/components/<name>.ts`: the docs page.
- `packages/docs/examples/<name>/*.html`: at least one example that uses `<sl-<name>>`.
- `packages/docs/catalog.jsonl`: one line per component, sorted by name (`name`, `title`, `tag` which must be `sl-<name>`, and the
  selector the browser tests wait for: `#id` or a tag name, which must match an element in the component's examples). It is the only list: navigation, home page, required site pages and browser
  routes all derive from it.
- `tests/product/<name>.spec.mjs`: the browser spec. The generated skeleton fails until it is replaced with real checks.

The coverage gate (`tests/bootstrap/catalog.test.mjs`, part of `verify:source`) fails when a component directory has no catalog
entry, an entry has no component, a docs page has no entry, an example selector matches nothing, an export is stray or has
wrong targets, or any piece above or the package/barrel export is missing. The page is published
automatically by the Pages workflow when the change is pushed to `main` (manual dispatch is the fallback); it refuses a site that lacks a catalog page.
Set `VELCRO_PRODUCT_PORT` (integer, 1024-65535, default 4321) to run the product tests on another port, so worktrees can
verify in parallel.

## Explicit checks

- `pnpm verify` runs `verify:source` then `verify:product`. `verify:product`
  builds the library, statically builds the docs (which generates the type inputs),
  type-checks the docs, then runs the
  Chromium-only Playwright suite (at least eight tests, no failures, flakes or
  skips, fresh report required). Raw output stays in ignored `.airig/product/`.
  Install the browser once with `pnpm exec playwright install chromium` (add
  `--with-deps` on Linux); it is never installed automatically. Firefox/WebKit are
  not covered.
- `pnpm verify:source`: pinned tools, complete executable hook files, real scanner,
  meaningful tests with zero skips, and the actual proposed index. Raw test output
  stays under ignored `.airig/verify/`; summaries contain no raw tool errors.
- `node scripts/security/privacy.mjs files <path...>`: working-copy content.
- `node scripts/security/artifacts.mjs <path...>`: explicit outbound **plain text**,
  such as a PR title/body or release notes saved as `.txt` or `.md` files. It runs
  the trusted privacy rules and the pinned Gitleaks scan over private in-memory
  snapshots of the exact bytes (numbered `.txt` copies, so stock path exclusions
  cannot apply; any exclusion or incomplete scan fails) and, when clean, prints
  each input's byte/line counts and SHA-256 plus an ordered-set hash. A clean
  result applies only to those exact bytes: send the same bytes you scanned, and
  rescan after any edit or tool-side reformatting. At most 16 inputs, 1 MiB each,
  4 MiB total. Directories, symlinks, special files, archives, images, binaries,
  other file types, empty, oversized, non-UTF-8 and unreadable inputs fail closed,
  and there are no options or skip flags. Output is fixed text (logical labels such
  as `outbound/text-1.txt`, rule names, line numbers, counts); matched text, input
  paths and raw errors are never printed. Exit 0 clean, 1 findings, 2 failure. This
  is **not** artifact, bundle, package or site certification, it never sends or
  uploads anything, and pattern scanning does not detect all credentials or personal
  data. Archives, screenshots and package/site artifacts remain gated.
- `node scripts/security/git-privacy.mjs staged`: all exact staged blobs/paths,
  including an alternate `GIT_INDEX_FILE`, never substituted working-copy files.
- `node scripts/security/git-privacy.mjs identity`: repository-local explicit
  approved identity and effective author/committer, including environment overrides.
- `node scripts/security/git-privacy.mjs message <file>`: exact message/footer text.
- `node scripts/security/git-privacy.mjs history [revision-or-range]`: raw commit
  metadata/messages and every source tree in the selected tip's full ancestry.
  A range is deliberately stronger than a diff: its lower bound is not trusted to
  conceal history. Replace refs, presentation settings and mailmaps cannot change
  inspected objects; shallow repositories and legacy grafts are refused.
- `node scripts/security/git-privacy.mjs pre-push [origin]`: consume Git's proposed
  updates on stdin; accept one feature-branch creation or fast-forward update to
  the same branch name on `origin`, never an ordinary direct push to `main`.
  Inspect the supplied full OID, not the current named local branch, and scan its
  full ancestry, metadata and ref name. Require a direct, already fetched
  `refs/remotes/origin/main` commit included in that ancestry. For an update,
  require the exact fetched `refs/remotes/origin/<feature>` OID to match Git's
  proposed old OID; for creation, no existing fetched feature ref may conflict.
  Missing, stale, symbolic or non-commit baselines fail. Deletion, bulk/mirror,
  non-fast-forward, tag and other-remote updates are refused. This command never
  fetches: refresh trusted refs separately when authorized, then check again.
  The coordinator must use an explicit single feature refspec, never `--mirror`.
  Git's hook protocol exposes ref updates, not the original command flags:
  configured mirror mode and mirror/bulk ref sets are rejected, but an explicit
  mirror invocation that happens to propose only the same allowed update cannot
  be distinguished locally. Checking the authorized outbound command is still
  required; the hook is not a generic command-authorization system.
- `node scripts/security/git-privacy.mjs policy <base-oid> <head-oid>`: **report**
  protected scanner, policy, workflow, hook, test and identity/tooling changes,
  including edits later reverted. Exit 0 means the comparison completed, not
  content clearance or human approval. A protected-change notice does not block
  creating a privacy-clean PR branch; it requires separate human merge/publication
  review. The pre-push command emits the same notice after mandatory data checks.

Source publication supports UTF-8 regular text files only. Archives, binaries,
symlinks, submodules, runtime material, tags and broad ref pushes are not certified.
Content is bounded and secret-scanned with numbered text names so stock path
exclusions cannot hide lockfiles or other source files. This is not a general
release-archive processor. Build/pack output is local-only, not publication-approved.
No package, site, test output, or workflow artifact is uploaded by this increment.

## Hooks are explicit and shared

Hook files are checked even when not installed; absence is never a successful
check. Do **not** install while parallel worktrees lack the same engines and
pinned scanner. After the manual initial trust anchor exists, coordinating all
lanes and obtaining independent human review, use
`pnpm hooks:install` to opt in with repository-local `core.hooksPath=.githooks`.
The installer refuses a missing or symbolic fetched main baseline. That setting
is shared across worktrees. It never changes global configuration.
The three executable shell hooks omit interpreter paths and use Git's shell
fallback; they run identity/staged, message, and proposed-OID guards respectively.
Hooks are bypassable and never replace explicit checks before outbound operations.

## Local development history versus publication

Clean local commits require current-file privacy/secret checks, exact staged-object
and effective-identity checks, message checks, and tests. They do not certify every
ancestor of a private development branch. Pre-commit checks staged source;
pre-push checks the proposed tip's ancestry. Never substitute one result for the
other or add a skip-history switch.

Keep private development history intact. Obsolete detector/test snapshots may
continue to trigger privacy rules even after current source is corrected. Before
first publication, the coordinator must construct a separately reviewed clean
publication branch from the sanitized initial root and reviewed current tree.
Scan that exact proposed public ancestry explicitly with `history <tip-oid>` before
any outbound operation. A clean working tree, clean staged result, or local
development commit is not publication approval. Classify findings privately as
real sensitive values versus detector/test literals; do not broaden exceptions or
rewrite every active branch merely to silence history checks.

## Manual first-publication trust anchor

The first public main cannot depend on a fetched baseline that does not yet exist.
There is deliberately no bootstrap-approval flag or alternate unscanned push path.
Before the repository exists, the owner/coordinator must independently review the
clean export, select the single allowed initial `refs/heads/main` and its full OID,
and explicitly authorize
that exact initial publication. Freeze those refs and run trusted `history <oid>`
for every proposed public tip, with the same source, secret, author/committer,
message and complete ancestry checks used for routine publication. Verify the
frozen ref-to-OID mapping again immediately before the authorized operation; any
change invalidates the evidence and approval. Scan outbound text separately too,
with `artifacts.mjs` on the exact final bytes (plain text only).
Nothing in this document authorizes an outbound command or claims GitHub controls
already exist.

Required hooks are installed only after the clean main exists and its separately
authorized fetch establishes the trusted `origin/main` ref. A local ref's existence
does not prove its origin or human approval; that initial trust is the owner's
explicit external responsibility. Future authorized fetches update the anchor;
routine feature pushes must include that known main. The routine pre-push guard
still rejects direct main updates. Bootstrap publication and later GitHub web
merges are distinct operations, not disabled privacy checks.

## Historical platform metadata and future merge commands

Local effective author and committer must always equal the owner identity in the
trusted policy. Raw historical commits additionally permit only the canonical
GitHub web-merge **committer** pair encoded in the guard: name `GitHub`, email
assembled as `['noreply', 'github.com'].join('@')`. This is a narrow public-platform
metadata exception, not an email-domain allowance. GitHub is not an allowed author;
mismatched names, emails and roles fail. Messages, footers, source and filenames
receive no platform-email exception. Metadata alone does not authenticate that
GitHub created a commit.

When a future merge is explicitly authorized, resolve `APPROVED_AUTHOR_EMAIL`
from the independently trusted owner's policy, never a personal Git default, and
bind the operation to the reviewed PR head. The intended command shape is:

```sh
gh pr merge "$PR_NUMBER" --squash --author-email "$APPROVED_AUTHOR_EMAIL" --match-head-commit "$REVIEWED_HEAD_OID"
```

This command is not run by the local tooling. Before routine remote merges are
approved, verify the platform's actual resulting raw commit author/committer and
message against these constraints. An unexpected author/footer or platform pair
is a blocker; do not broaden the exception to make a generated commit pass.

## CI and trust limitations

CI pins actions, Node and pnpm; public-npm frozen install remains required. The
`required` aggregate runs with `always()` and accepts exactly `verify`, `product` and
`security` with successful results. Missing, skipped, failed or cancelled jobs
block. Security scans PR objects with engines from the base checkout, not
candidate-modified engines; a base lacking the guard fails closed.

Protected changes are reported for a separate, mandatory human merge/publication
gate; green data checks do not satisfy that gate. Candidate policy files are
scanned as data with base-owned rules, never adopted as active policy. Exact owner
identity and standard interpreter metadata in the supported policy schema are
recognized without exempting arbitrary field values or new exception targets.
Malformed/unsupported policies fail conservatively. There is no self-approval
environment flag. Independent human review and a separately approved trusted-base
transition remain necessary for bootstrap and future protected updates. A base
without the scanner is an explicit manual initial CI-trust transition, not an
always-green substitute job. The current public commit identity does not provide a
separate PR author; native GitHub self-approval is not possible. Workflow changes
can also change the workflow gate itself, so external rules/review controls must
be installed and proven on GitHub before claiming enforcement. Local tests do not
prove remote CI, rulesets or approval behavior. First push and all publication
remain blocked pending full source/history checks, independent review and explicit
authorization. Never bypass a failed scanner or missing approval.
