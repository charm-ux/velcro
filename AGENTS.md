# Agent and contributor instructions

Velcro is developed privacy-first. These rules apply to every human and agent
contributor. Design background: `docs/specs/security-privacy.md`.

## Privacy boundary

- Never commit machine-specific absolute paths, home directories, hostnames,
  usernames, private emails, credentials, tokens, keys, or personal information.
- Use repository-relative paths and resolve the checkout root at runtime. Web
  routes, URLs and module specifiers are fine; workstation layouts are not.
- Agent briefs, transcripts, review scratch, terminal captures and local plan
  copies live only under ignored `.airig/` (or OS temp files). Never copy them
  into source, docs, commits, PR text, release notes or artifacts.
- Do not echo sensitive values or retrieve secrets for debugging. Never embed
  credentials in scripts, remote URLs, prompts, examples or generated files.
- Synthetic negative-test data is generated at runtime, not committed.

## Identity

Commits use only the approved project identity: the owner's public GitHub
username and matching `users.noreply.github.com` address, configured
repository-locally with `user.useConfigOnly=true`. Never change global Git
identity, and never let Git infer one from the workstation.

## Worktree-only development

Primary checkouts stay on a clean default branch for reading and `git pull`.
All changes happen in a worktree at `.worktrees/<branch-dir>` inside the
repository (branch name with `/` replaced by `-`). Run Git with `git -C <worktree>`
and verify the top-level and branch before each commit. Never use `git stash`.
Stage explicit paths only, never `git add -A`.

A component needs its Litro docs page, example, product spec and `packages/docs/catalog.jsonl` entry, enforced by `verify:source` (`docs/contributing.md`, "Adding a component").

## Security checks

Run these explicitly and keep the evidence tied to the exact content/head:

- `node scripts/security/privacy.mjs files <path...>` — content privacy rules
- `node scripts/security/gitleaks.mjs install` — acquire the pinned scanner into ignored scratch (once)
- `node scripts/security/gitleaks.mjs dir <path>` / `git <repo> [range]` — secret scan
- `node scripts/security/git-privacy.mjs staged | identity | message <file> | history [range] | pre-push`
  (a range base must be the fetched `origin/main` or its ancestor; exit 3: the published range
  exceeds 1,000 changed files and needs owner approval; the pre-push hook hides the code, so rerun explicitly)
- `node scripts/security/artifacts.mjs <path...>` — explicit plain UTF-8 `.txt`/`.md` outbound text
  (PR title/body, release notes) only; archives, images, packages and site artifacts are not supported

Run them before staging, committing, pushing, opening PRs, uploading artifacts,
or publishing. These tools arrive with the privacy tasks; until a check exists
and has passed, do not treat that operation as cleared. Hooks complement but do
not replace these commands. Scanning is pattern-based and cannot recognize all
personal data; independent human review still applies.

## Failures and no bypass

A detected leak or scanner failure stops the operation. Do not bypass with
`--no-verify`, skipped or disabled hooks, disabled checks, broad allowlists,
suppressed findings, or admin overrides to make progress. Recovery: report the
sanitized location and category, preserve evidence privately, resolve or
escalate, then rerun the checks before continuing.

Never set `VELCRO_HISTORY_APPROVED` or `VELCRO_HISTORY_APPROVER`, or apply the
`history-scan-approved` label.
They are the owner's exact-head approval for a history scan over 1,000 changed
files (`docs/contributing.md`, "History scan approval"); on exit 3, stop and report.

## Protected changes

Changes to security policy, identity settings, allowlists/exceptions, scanner
or hook scripts, workflows, artifact collectors, ruleset configuration, and
this file require explicit human review. Do not self-approve them.

## Releases

Record changes with Changesets (`pnpm changeset`). Packages are private; do not
add publish, tag or automatic versioning steps. Use Node and pnpm versions
pinned in `.nvmrc` and `package.json`.
