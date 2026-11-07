# Velcro — delivery workflow

Status: operating decisions agreed; local Phase 0 bootstrap authorized.
Design: [Velcro architecture and milestones](velcro.md).
GitHub destination: `charm-ux/velcro`, public only after the privacy preflight; not created yet.
Initial mode: local bootstrap execution authorized; external operations remain
supervised. The coordinator is proceeding, not waiting for another requirements
round. Stop before remote creation/first push with the reviewed evidence bundle.

## Privacy prerequisite

Follow [the security/privacy design](security-privacy.md). No remote creation,
first push, public PR, package upload, or CI artifact upload before the relevant
privacy gate passes and the operation is authorized. This includes commit author/
committer metadata and history, not merely current file contents. The existing
local-only history must not be pushed unchanged.

Public task plans use relative paths. Generate machine-specific runtime briefs
and ledgers only in ignored local scratch; never copy them wholesale into PRs,
commit messages, release notes, or CI artifacts. Check the sanitized summaries
separately. Do not substitute hidden/redacted display for removal from Git history.

## 1. Roles and concurrency

The coordinator reads the approved plan, assigns work, checks evidence, rules on
review findings, maintains the dependency graph, and manages authorized PR/merge
operations. The coordinator does not become an unreviewed implementer.

Run implementation agents through roost, with an explicit available model/harness
and a brief that stands alone. A fresh task gets a fresh implementer; fixes return
to the same implementer. At most **three coding agents** run concurrently. A task
in its fix cycle still consumes an implementation slot while the agent is working.

Reviewers use a **separate capacity budget**. Do not count them against the three
coding slots. Size each flock to the change, with independent model/harness choices
where useful. A small non-risky change may use the skill's solo strongest-reviewer
path; compatibility-sensitive behavior needs at least two strong independent
reviewers. Use relevant lenses for larger phase reviews. Follow flock's current
large-diff and cost gates: propose the shape, exact count, and models before a fleet
that needs approval. No unlimited review fleet is implied by separate capacity.

Check installed harness/model availability before dispatch; do not silently omit
a prescribed reviewer or invent a model name. Report substitutions and reduced
independence. Only the coordinator opens human-facing review panes.

## 2. Task contracts and worktree ownership

Each task or coherent task batch receives:

- exact repository, worktree, branch, and base commit;
- one implementer owner and a bounded file/directory ownership set;
- prerequisite task IDs and required merged commits;
- acceptance criteria, runnable checks, and required evidence artifacts;
- review risk/shape and PR scope;
- explicit stop conditions, including any needed core changes;
- allowed operations and the current approval mode.

Create worktrees inside the repository at
`<repository-root>/.worktrees/<branch-with-slashes-replaced>`.
A worker already in its assigned worktree stays there. Never nest another worker
worktree inside that worker's checkout. Verify repository root and branch before
starting and before every commit. Each worktree has its own dependencies/artifacts.
No code, installs, or build outputs in the primary `main` checkout.

After remote bootstrap, task branches start from the latest merged dependency set
on `origin/main`. Before any remote exists, the authorized local bootstrap uses
separate worker branches from the recorded local checkpoint and a single bootstrap
integration branch. Task results are reviewed individually before local integration;
this is not authorization for remote merges or publication.
Avoid stacked task PRs by default: a dependent task becomes runnable after its
prerequisites merge. Independent tasks may share a base and run concurrently.
Serialize ownership of package manifests, lockfiles, root configuration, and
shared generators. Do not solve shared-file conflicts by letting agents race.
Approved changes in core use that repository's own nested worktrees and PRs.

The planning/coordinator worktree must outlive the worker worktrees. Keep the
runtime ledger there, under `.airig/<plan>/`, with task states, pane/turn IDs,
worktree/branch, commit range, test evidence, review rounds, PR number, and merge
commit. Carry durable decisions and a concise review/check summary into the PR
and a versioned phase report before deleting runtime scaffolding. Never put the
only copy of an unresolved decision in a worktree scheduled for removal.

## 3. Scheduling and roost operation

A task is ready only when its dependencies have merged, its files are available,
its phase is authorized, and its acceptance checks are defined. A merged PR is
not permission to cross a closed human phase gate.

1. Select ready tasks within the current phase and available implementation slots.
2. Verify each worktree and write task briefs before spawning agents.
3. Spawn/send all independent briefs, then wait using the returned pane/turn IDs.
4. Allow one outstanding prompt per pane; never resend solely because a turn
   number was not returned after a successful submission.
5. Require reports written to files with commit SHAs and actual command results.
   Terminal screenshots/scrapes are not evidence of completion or review.
6. Respect blocked permission dialogs; do not use roost to approve or force past
   them. Missing/failed agents are reported and their tasks remain incomplete.

Use the installed roost instructions and exit-code contracts when implementing
the dispatcher. No new custom orchestration framework is required to begin.

## 4. Review and fix loop

For each completed task/batch, use airig flock against an explicit immutable
base/head range. Reviewers receive the complete scope, requirements, test evidence,
and their independent report destinations. They do not edit the implementation
or see one another's reports before submitting their own.

The coordinator merges anchored findings, records agreement counts where valid,
checks singleton blockers, resolves contradictory claims, and assigns the outcome:
`APPROVED` or `CHANGES_NEEDED`. Missing reports and excluded files are explicit.
No missing reviewer counts as approval, and no numerical majority erases a
substantiated blocker. Reviewers assess evidence; implementers own test execution.

Return actionable findings to the implementer, then review the resulting diff and
any affected surrounding behavior. Rerun acceptance checks after fixes. A review
is tied to its head SHA; changes after approval require renewed evidence and
appropriately scoped review. Nonblocking findings are fixed, explicitly dismissed
with reasons, or assigned a follow-up; they are never silently lost.

After five nonconverging review/fix rounds, pause the task. The coordinator rules
on disputed claims and records the decision; unresolved genuine blockers go to
the human. Do not manufacture approval to keep the scheduler busy. Independent
unblocked tasks within the authorized phase can still proceed.

At each phase checkpoint, perform an integrated flock review of the phase's
aggregate diff and task interactions, not only the last PR. Include requirement
coverage, cross-task consistency, public surfaces, test quality, and any risky
areas. If changes have already merged, findings become new blocking follow-up
PRs before the next phase; do not rewrite merged history.

## 5. GitHub CI and branch protection

CI, Changesets configuration, and the package changelog are foundation
deliverables, not end-of-project cleanup. Require release-relevant changesets from
the first package PR, with a reviewed exemption for test/tooling/internal-only
changes. Verify generated versions/changelogs in isolation, and derive the docs
release history from the package changelog. Versioning and publication are distinct;
no ordinary task merge may publish merely because Changesets is installed.

After the local privacy preflight and before authorized remote setup, verify
organization permissions and Actions/protection availability for the intended
public repository. The prior private-repository plan is superseded conditionally
by public visibility; never publish the current local history to obtain enforcement.
If any required control is unavailable, stop rather than claim workflow YAML alone
protects `main`. Resolve the separate PR-author/human-approver identity decision
before configuring required reviews.

Configure squash merges and protected PR-based changes to `main`. Enforce required
checks, resolution of conversations, and applicable reviews without routine admin
bypass. Do not configure unattended publishing/deployment as a side effect of
merging ordinary task PRs. Release/deploy workflows remain separately gated.

The planned check set grows with the approved milestone's executable surfaces:

| Check | Evidence |
| --- | --- |
| Privacy/security | Candidate source, publishable history/identity, generated output, package/source-map/asset metadata, sanitized PR content; no sensitive-value echoes |
| Quality | Frozen install, lint/format, TypeScript, repository/worktree exclusions |
| Library build | ESM/declarations, browser CDN build, deterministic manifest/wrappers/assets |
| Component behavior | Chromium, Firefox, WebKit test results and traces |
| Compatibility | Pinned reference/candidate differential traces and contract inventory coverage |
| Packed consumers | Clean alias/deep/class-only/React imports, assets and autoloading |
| Docs | Litro production SSG, static route/link/anchor checks, live examples, hydration/no-JS checks |
| Visual/accessibility | Controlled screenshots and diffs, axe and keyboard/focus assertions |
| Release hygiene | Changeset coverage/exemptions, isolated version/changelog generation, private-package exclusion, licensing/provenance, no upstream runtime leakage |
| Required aggregate | Explicit success of all expected jobs and matrix members |

Privacy checks are mandatory and fail closed, including policy/scanner failures.
Protect scanner, workflow, hook, allowlist, and agent-policy changes with human
review; a PR must not be able to weaken its own acceptance policy unnoticed.

Use a stable always-scheduled required aggregate job. It checks dependency results
explicitly and fails on failure, cancellation, timeout, missing evidence, or an
unexpected skip. If path filtering is introduced, define the expected job set in
a tested policy; do not skip the workflow containing the required check. Silence
is not green. Test the gate with intentionally failing and skipped-job scenarios
before accepting the foundation. Do not turn the gate off to merge bootstrap work.

Milestone inventory defines which contracts must already pass. Known unimplemented
features remain visibly incomplete; a green foundation PR is not full-library
compatibility. Verify expected test counts/coverage so an empty test suite cannot
pass a component or phase gate. A deliberately failing reproduction may be retained
as documented probe evidence, not silently counted as a passing compatibility test.

Run checks on PR integration state as well as `main`, and revalidate after base
changes. Use pinned action revisions, least-privilege workflow permissions, no
secrets in untrusted PR execution, explicit timeouts, and browser/font version
control. Retain reports, traces, failure screenshots, and package artifacts as
appropriate. Do not use privileged `pull_request_target` execution for PR code.
CI failure triggers diagnosis/fix and fresh review where needed, not blind reruns.

## 6. PR, merge, and cleanup lifecycle

Prefer one PR per independently verifiable task or tightly related batch. Every
PR contains privacy-scanned task IDs, acceptance evidence, flock verdict/head SHA, deviations,
and the current phase/checkpoint. A green check and an agent's approval are not
substitutes for any configured GitHub review requirements. The approved commit
identity belongs to the owner, so native self-approval is unavailable. Initial
remote setup must explicitly record human merge authorization out of band with
zero native approval requirements, or use a separately authorized PR author.
Confirm that choice at the outbound setup gate rather than creating a bot silently.

Initial supervised mode requires explicit authorization for pushes/PR creation
and the specific PR's merge. After authorization:

1. Serialize the merge lane; ensure approved dependencies are actually on main.
2. If the branch is behind/conflicting, stop and obtain the authorization required
   by the active skill to update it. Revalidate the resulting head/integration
   state, including affected review coverage and CI; do not silently force-push.
3. Land through the GitHub merge queue (squash), which requires `required` and the
   `agent-approvals` status on the PR head and on the queued commit
   (`docs/contributing.md`, "Merge queue and agent approvals"). Refuse drafts,
   failed/pending/missing expected checks, unresolved blockers, or dirty
   mergeability. Never use an admin override or ruleset bypass as a routine repair.
4. Re-fetch the PR head and state immediately before enqueueing. Bind the operation
   to the reviewed head (`expectedHeadOid`, and `agent-approvals` set only for that
   exact head and its queued commit) so a concurrent push cannot slip past approval.
5. Confirm GitHub reports `MERGED`, record the squash commit, and watch any required
   post-merge integration checks before scheduling dependents.
6. End idle worker/reviewer sessions that still refer to the branch, preserve
   durable evidence, and invoke airig `postmerge` for that explicit PR/branch.
7. Fast-forward clean primary main, remove only the merged clean worktree, delete
   only the confirmed merged branch, and prune stale refs. A dirty tree, additional
   unmerged commits, or active worker stops cleanup. Never force-remove it.
8. Fetch the new baseline and dispatch the next ready task in the authorized phase.

Resolve merged PRs by explicit number or `--state merged`/`--state all` when using
`gh pr list`; its default open-only listing cannot prove a merge. Squash merges do
not preserve task commit ancestry, so compare the actual reviewed head, merge
record, and any extra local commits before cleanup rather than relying solely on
`git branch -d`. A task's merged PR does not authorize deleting unrelated work.

## 7. Human authority and checkpoint policy

Start with human approval of PR merges and explicit external-operation gates.
The owner intends to reduce routine review after the review loop proves reliable.
The coordinator may propose that transition at the slice checkpoint, or another
owner-requested checkpoint, with evidence of reviewer effectiveness, CI reliability,
escaped defects, review churn, and unresolved compatibility risks.

**No silent transition.** Shorter reviews, fewer comments, elapsed time, and green
checks do not activate delegation. Before activating any delegated mode, record
explicit owner approval, permitted task classes, repositories/branches, phase
bounds, review/CI floors, external-operation authorization, and revocation/stop
conditions. It must also comply with the active airig skill gates; the current
execute instructions still require stops for operations leaving the worktree.
If needed, reconcile that policy explicitly rather than bypassing it.

In any future delegated mode, human review remains required for:

- core or other cross-repository changes and fundamental architecture decisions;
- compatibility exceptions, breaking behavior/types, or changes to the target version;
- licensing/public naming, publication, deployment, visibility, or credentials;
- security/trust boundaries, privacy policy/allowlist/identity changes, destructive
  operations, or protection/CI weakening;
- material scope/cost expansion or unresolved nonconverging review blockers.

The design's foundation, architecture, slice, family, and release checkpoints are
explicit go/no-go stops. Batch the relevant human visual/accessibility checks and
show working examples, CI evidence, coverage, risks, and a concise phase report.
Changing which checkpoints need a person is itself an explicit policy decision.
