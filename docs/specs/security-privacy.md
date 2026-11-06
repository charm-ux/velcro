# Velcro — security and privacy foundation

Status: enforcement direction and narrow exceptions approved; local bootstrap
execution authorized. Hooks, scanners, and GitHub controls are not yet verified.
Related: [architecture](velcro.md) and [delivery workflow](delivery-workflow.md).

## 1. Requirement and publication gate

Security and privacy are blocking requirements from the start. Public visibility
for `charm-ux/velcro` is acceptable only after the relevant privacy controls pass.
A clean working tree is not proof of clean Git history, and a public repository
must not be used as the first place to discover sensitive data.

Prevent accidental publication of:

- machine-specific absolute filesystem paths, home-directory expansions, local
  checkout locations, hostnames, usernames, private email addresses, and personal
  identifying information unrelated to an approved public purpose;
- credentials, tokens, private keys, session identifiers, private endpoints, and
  confidential configuration;
- agent briefs, transcripts, review scratch, terminal captures, personal tool
  configuration, local caches, or diagnostic dumps;
- identifying commit author/committer/tagger metadata or messages outside the
  approved project identity policy;
- the same information hidden inside generated documentation, source maps,
  archives, screenshots, image metadata, package manifests, or CI artifacts.

The rule applies to public source, Git objects/refs being uploaded, PR titles and
bodies/comments, release notes, packages, website output, and workflow logs and
artifacts. It also applies to newly authored changes in another repository when
working on Velcro; it does not authorize rewriting that repository's existing
public history or deleting upstream attribution.

Filesystem paths are distinct from public web routes, URLs, module specifiers,
and import paths. Use repository-relative paths and dynamically resolved roots;
do not hardcode a contributor's workstation layout. If a standard interpreter
shebang or another unavoidable system path is needed, it requires a narrow,
reviewed rule for that exact syntactic use, not a blanket absolute-path exclusion.

No scanner can recognize every possible person's name, indirect identifier, or
novel secret. Combine deterministic detection, secret scanning, minimal collected
metadata, approved identities, and independent human review. Do not promise
mathematical proof of the absence of all PII based on a regex pass.

## 2. Public versus local-only material

Public plans, agent instructions, examples, reports, and scripts must be portable.
Name repository-relative files and branch names; resolve the checkout root at
runtime. Do not bake a machine location into a generated report or package.

Some execution skills require absolute-path plan headers or briefs. Satisfy those
requirements only in a local runtime copy generated under ignored `.airig/`.
The portable public plan remains separate. These copies must not be committed,
packed, attached to a PR, or uploaded with workflow artifacts. Runtime records
may contain local context but must never store credentials unnecessarily.

Ignore and exclude `.airig/`, `.worktrees/`, local environment files, harness
sessions, caches, coverage, browser traces, and generated build output from source
commits unless a particular artifact is deliberately part of the public package.
Use explicit publication allowlists for package files, docs assets, and uploaded
artifacts. Git ignore alone is insufficient: already tracked files and deliberately
staged ignored files still need scanning.

For shared human review, generate a fresh sanitized summary from structured facts:
relative file/line, finding, test outcome, and approved public revision identifiers.
Never paste a raw tool response or transcript and hope GitHub redaction catches it.
Do not publish links or hashes referring to private scratch commits unnecessarily.

## 3. Agent and contributor rules

The foundation task creates a repository-root `AGENTS.md` containing:

- the privacy boundary, relative-path rule, approved identity requirement, and
  prohibition on copying local agent context into source or PR content;
- the security check commands and required evidence before staging, committing,
  pushing, opening PRs, uploading artifacts, or publishing;
- the rule that a detected leak or scanner failure stops the operation;
- no bypass with skipped hooks, disabled checks, broad allowlists, suppressed
  findings, or an admin override merely to make progress;
- protected policy/identity/allowlist/workflow changes require human review;
- no secret retrieval for debugging, no sensitive-value echoes, and no credentials
  embedded into scripts, remote URLs, prompts, examples, or generated files;
- a recovery route: report sanitized location/category, preserve evidence privately,
  resolve or escalate, and rerun checks before continuing.

Every roost implementation/review brief repeats this boundary. Code-writing agents
must use the approved project identity and must not inherit personal Git identity
silently. A clean environment with no configured identity should refuse to commit,
not auto-detect a workstation name/email. Repository instructions complement,
but do not replace, executable checks.

## 4. Local blocking checks

Implement one documented security/privacy check interface, shared by local hooks,
explicit commands, and CI. The executable plan will choose pinned tools and exact
commands after policy approval. Use an established secret scanner plus project
privacy rules; do not rely on a bespoke regex list to detect all credentials.

### Before commit

- Scan the exact staged blobs, staged paths, renames, and generated tracked files,
  not just the working copy. A safe unstaged file can conceal an unsafe staged blob.
- Validate the effective author and committer against approved project metadata;
  verify message/footer fields too. Catch environment overrides and automatic
  Git identity inference rather than checking repository config alone.
- Check commit-message content before the commit is created, and independently
  verify the resulting commit object before it can be pushed.
- Reject local scratch/session material even if someone explicitly stages it.
- Fail if a required scanner is unavailable or errors. A warning-only hook does
  not satisfy this requirement.

### Before push or other outbound publication

- Scan the exact proposed ref updates and every newly reachable commit's author,
  committer, messages, and relevant blobs, not only the tip or latest diff. Include
  annotated tag metadata for authorized tag publication. Inspect filenames too.
- Reject unapproved refs, mirror/all-branch pushes, and accidental exposure of
  archived local history. Check against the correct remote baseline, not a mutable
  branch name assumed to represent the already-approved head.
- Scan the completed package archive and static-site output before upload. Verify
  source-map `sources`/`sourceRoot`, embedded manifests, compressed text, and asset
  metadata. Exclude unsupported binary artifacts until reviewed or sanitized;
  a text-only scanner cannot certify images and archives.
- Generate PR/release text into a local file, scan it, and only then pass that exact
  content to the GitHub CLI. Check any subsequently edited comments or attachments.
- Apply the same rule to artifact upload scripts and agent-generated evidence.

History scanning is changed-files-only (owner decision). Every commit's raw
metadata and message is checked across the full ancestry, but file content and
paths are checked only where a commit introduces them: a root commit's whole
tree, a non-merge commit's added or modified files, and a merge's paths whose
result differs from every parent (so content found in no parent, an evil merge,
is scanned). Deleted files need no content scan and identical path/blob pairs are
scanned once. Equality to a parent is only trusted when that parent's content is
itself covered: a parent inside the scanned commits is covered by induction, but
a parent outside a range (an older ancestor of the base) is not, because the
range never scanned it and the base may since have removed its content. Such a
parent is therefore replaced by the base tip for the comparison. The invariant,
in topological order, is that every path/blob pair in the tree of a scanned
commit is either scanned or present in the base tip's tree (in full-history mode
there is no base and every pair is scanned). Archives,
`.gitleaksignore`, non-regular files, the empty-exclusion rule and fail-closed
errors apply to every changed file exactly as before.

The range being published is bounded: pre-push scans the commits not reachable
from the fetched `origin/main`, CI scans a PR's commits against its base and a
`main` push's commits since the previous tip. That baseline's content was itself
verified when it was published, so it is not rescanned. An explicit range base
must be the fetched `origin/main` or its ancestor; CI falls back to full-history
mode when its base is not (a PR into another branch, whose tip is unverified, a
force push or a first push). More than 1,000
changed-file entries in that range fail with a distinct exit (3) and
"history scan exceeds 1,000 changed files; owner approval required". Approval
names one exact head: locally `VELCRO_HISTORY_APPROVED=<full head OID>`, in CI
the `history-scan-approved` label applied by the login named in the
`VELCRO_HISTORY_APPROVER` repository variable (an organization-owned repository's
owner is never the labeling user; unset means nobody can approve), which
approves only the head of the labeled run. Agents must never set either.
Approval lifts only this cap, never a finding or another check. Full-history
mode (a single tip, used for deployment and initial trust) scans every commit's
changed files under the existing hard caps instead, because its count grows
with the whole project and a push to `main` has no approval channel.

Git hooks are bypassable and do not intercept every external API. The coordinator
must run the explicit checks and bind results to the exact content/head before
using external tools. CI supplies a second boundary; it cannot undo a public leak
that already occurred in the first push or PR text.

## 5. CI and policy integrity

Add a mandatory privacy/security job and include it in the always-running required
aggregate. A scanner exception, missing evidence, unexpected skip, cancellation,
or timeout fails closed. Protect `main` and review security configuration changes
as human-gated work, even if ordinary component PRs later become delegated.

A candidate PR must not be able to weaken its own scanner policy unnoticed. Use a
trusted base policy or pinned trusted scanner for candidate-content evaluation,
plus an explicit security-owner review of proposed policy changes. New exceptions
are not accepted merely because the PR includes an allowlist edit. Treat changes
to workflows, hook scripts, artifact collectors, `AGENTS.md`, identity settings,
and ruleset configuration as sensitive surfaces.

Bootstrap is special because there is no protected base yet: independently review
and test the initial scanner/policy locally before its first publication. Do not
claim it is protected by CI that does not exist until after that upload.

CI checks cover candidate source and newly publishable history/metadata, generated
code/docs, packed artifacts, and the sanitized PR text available to the job. Fetch
enough history to prove the intended range; a shallow checkout must not silently
omit commits. Trust policy/scanner code separately from untrusted candidate code.
Use read-only permissions and never expose secrets to untrusted PR execution.

Diagnostics contain rule IDs, sanitized repository-relative locations, and counts;
never matched secret/PII values, raw object contents, environment dumps, or private
paths. Redact even filenames if they contain identifiers. Test the diagnostic
format as well as detection. Workflow log masking is a last-resort aid, not a
substitute for avoiding the output. Upload only an explicit, scanned artifact set.

## 6. Identity and allowed public information

The owner approved their public GitHub username and matching GitHub noreply
address as the commit author/committer identity. Repository-local explicit identity
is configured and automatic identity inference is disabled. The bootstrap policy
records this narrowly approved public metadata; it does not permit personal
workstation identity or private addresses. This is not an anonymous identity and
no separate automation account or GitHub App has been provisioned.

Use a separate PR-author identity if native required human approval is desired;
the human cannot approve a PR authored through the same account. This connects
the privacy requirement to the unresolved review-enforcement decision. The commit identity is now approved; remote operations still require their
separate authorization. Do not claim that this creates a separate PR author.
Never change global Git identity as an incidental project setup action.

Owner-approved narrow exception categories (individual scope still reviewed):

- legally required public copyright, license, and attribution notices;
- intentionally public project/package names, official upstream provenance URLs,
  and approved project automation metadata;
- unavoidable standard tool/shebang syntax, scoped to its exact use.

Public availability alone does not make arbitrary personal information acceptable.
Do not scrape contributor profiles or copy personal contact information into docs.
Exceptions are recorded with purpose and exact scope. Prefer a path/rule-level
exception for a specific legal notice over allowing a name or email everywhere.
Do not remove required license notices to satisfy a privacy regex. Escalate that
conflict instead. Synthetic negative-test inputs are generated locally at runtime
rather than committing realistic personal data or reusable secret-looking values.

## 7. Existing local history and initial public bootstrap

The initial local audit found workstation paths and identifying metadata. At the
owner's request, all three local commits were rewritten with the approved GitHub
identity and historical workstation paths removed. Current branches/tags no longer
reach the old commits; an ignored private recovery bundle/reflogs remain local.
No remote is configured and nothing has been pushed. The full new privacy toolchain
must still audit all publishable refs and artifacts before external publication.
Local review reports contain machine context and remain private runtime artifacts.

Use only the sanitized reachable history and reviewed portable files for the
public handoff. Preserve the ignored recovery material privately; never upload it
or create a publishable ref to the old commits. Future cleanup must not merely
add a commit that exposes earlier sensitive data through ancestry. No forced remote
update or deletion of recovery material is authorized by local bootstrap execution.

Initial sequence:

1. Approve identity, exception policy, and this privacy contract. Inventory the
   exact source and public artifacts to be exported; retain private runtime context
   outside that export.
2. Implement/test local checks in an authorized worktree, independently review the
   controls and sanitized export, and record redacted evidence. Construct intended
   public commit objects with the approved identity and audit their full ancestry.
3. Obtain authorization for creating the public remote and the exact initial push.
   Do not use a convenience create-and-push command against the current local refs.
4. Establish a minimal clean remote main and a reviewed foundation PR carrying the
   privacy tooling, CI, agent policy, Changesets/changelog scaffold, and portable
   design. Scan each outbound operation before it happens.
5. Run the initial PR's workflows, install required rules using observed check
   names and the approved author/reviewer model, and prove that failure/skip cases
   cannot satisfy the aggregate. Make the bootstrap PR green again without
   disabling the gate, then use the authorized squash-merge flow.
6. Only after the foundation/privacy checkpoint passes may ordinary parallel task
   dispatch and public PR work proceed. All later scopes reuse the same checks.

The public repository resolves the private-Free-plan capability issue only after
these controls pass. Privacy approval is not automatically GitHub App creation,
credential provisioning, paid-plan purchase, publishing, or deployment approval.

## 8. Verification and stopping conditions

Negative tests must demonstrate rejection of:

- synthetic home/temporary/drive/UNC filesystem paths, including escaped and
  URL-encoded representations where the publishing surface can carry them;
- private email/identifier patterns and representative scanner test credentials;
- unsafe staged content despite a clean working copy;
- an unsafe earlier commit under an otherwise clean tip, and unapproved author,
  committer, tagger, footer, or message metadata;
- private runtime files explicitly staged, private refs proposed for push, and
  absolute source-map/asset metadata inside built or compressed output;
- contaminated PR/release text, raw transcript artifacts, and diagnostics that
  echo a detected value or personal filename;
- missing scanners, malformed policy, unexpected skipped jobs, and a candidate PR
  that attempts to weaken its own checks.

Positive tests demonstrate acceptance of relative paths, public web routes/module
imports, reviewed legal notices, approved project identity, and clean generated
artifacts. Confirm first-version changelog generation does not reintroduce local
paths or preserve a misleading unreleased placeholder beneath real releases.

At the privacy checkpoint, a separate flock reviews the scanner threat model,
actual negative-test evidence, outbound guard coverage, identity policy, and the
public export/history. Human signoff is required for exceptions and policy changes.
Keep the review summaries sanitized too.

A failure halts the affected commit/push/PR/upload/merge operation. If something
sensitive has already become public, stop publication, privately notify the owner,
rotate affected credentials when relevant through the authorized incident process,
and coordinate history/artifact/cache remediation. Do not promise that deleting a
commit or making the repository private erases copies already taken by others.
