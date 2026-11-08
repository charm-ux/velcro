// Sets the `agent-approvals` commit status that the merge queue requires, only for the exact head two agent reviews
// approved. The binding is a JSON file kept outside the repository by the coordinator:
//   { "head": "<full 40-hex OID>", "approvals": 2, "reviews": ["<report path relative to --root>", ...] }
// Every listed report must sit inside --root, be a distinct regular file, start with the line `APPROVED` and name the
// approved head's full OID (so a report from an earlier round cannot be reused); there must be at least two and
// exactly `approvals` of them. Anything else refuses before GitHub is contacted.
//
//   node scripts/merge/agent-approvals.mjs check     <binding.json> --head <oid> --root <dir>
//   node scripts/merge/agent-approvals.mjs set       <binding.json> --head <oid> --root <dir> --repo <owner/name> --pr <n>
//   node scripts/merge/agent-approvals.mjs set-group <binding.json> --head <oid> --root <dir> --repo <owner/name> --pr <n> --group <oid>
//
// `set` marks the open pull request's head (it must still be <oid>, based on main). `set-group` marks the merge-queue
// commit GitHub built for that pull request, as GitHub reports it (the pull request's mergeQueueEntry; no branch name
// is derived), only when the entry is awaiting checks on main's current tip and its commit is the --group commit the
// caller scanned and has that tip as its single parent. Its tree must then be either exactly the approved head's tree
// (when the head already contains that tip) or the conflict-free result of `git merge-tree --write-tree <tip> <head>`,
// so it lands the approved changes on main and nothing else. The merge is computed by Git in the current directory,
// which must be a clone of the repository holding both commits (fetch main first); a missing commit refuses.
// Neither marks a commit that already carries an `agent-approvals` status from another account (a workflow token,
// for example), and each confirms afterwards that its own success is the newest one.
// Output is fixed status lines with OIDs only: no paths, report text or GitHub responses.
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const CONTEXT = 'agent-approvals';
export const DESCRIPTION = 'Two agent reviews approved this exact head';
const OID = /^[0-9a-f]{40}$/;

class Refusal extends Error {}
const refuse = reason => { throw new Refusal(reason); };

// Returns the number of approving reports, or throws a Refusal with a fixed reason.
export function validateBinding(binding, head, root) {
  if (!OID.test(head ?? '')) refuse('the head must be a full lowercase 40-hex OID');
  if (binding === null || typeof binding !== 'object' || Array.isArray(binding)) refuse('the binding is not a JSON object');
  if (binding.head !== head) refuse('the binding names a different head');
  const { approvals, reviews } = binding;
  if (!Number.isInteger(approvals) || approvals < 2) refuse('the binding records fewer than two approvals');
  if (!Array.isArray(reviews) || reviews.length !== approvals) refuse('the binding must list exactly one report per approval');
  let base;
  try { base = realpathSync(root); } catch { refuse('the report root is unreadable'); }
  const seen = new Set();
  reviews.forEach((entry, index) => {
    const label = `report ${index + 1}`;
    if (typeof entry !== 'string' || entry === '' || path.isAbsolute(entry)) refuse(`${label} is not a relative path`);
    let file;
    try { file = realpathSync(path.join(base, entry)); } catch { refuse(`${label} is missing`); }
    const relative = path.relative(base, file);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) refuse(`${label} is outside the report root`);
    if (!lstatSync(file).isFile()) refuse(`${label} is not a regular file`);
    if (seen.has(file)) refuse(`${label} repeats another report`);
    seen.add(file);
    const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    if (text.split(/\r?\n/, 1)[0].trimEnd() !== 'APPROVED') refuse(`${label} does not start with APPROVED`);
    if (!new RegExp(`(?<![0-9a-fA-F])${head}(?![0-9a-fA-F])`).test(text)) refuse(`${label} does not name the approved head`);
  });
  return reviews.length;
}

export function readBinding(file) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { refuse('the binding is unreadable'); }
  try { return JSON.parse(text); } catch { refuse('the binding is not valid JSON'); }
}

// GitHub access through the authenticated GitHub CLI. Raw responses and errors stay inside this process.
export function ghRunner(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) refuse('a GitHub request failed');
  try { return JSON.parse(result.stdout); } catch { refuse('a GitHub response was not JSON'); }
}

// Local Git in `cwd`. Returns the exit status (null when Git could not run) and stdout; stderr is never shown.
export function gitRunner(args, cwd = process.cwd()) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: result.error ? null : result.status, stdout: result.stdout ?? '' };
}

// The tree a conflict-free merge of `head` onto `base` produces, as `git merge-tree --write-tree` computes it (the
// same three-way merge a squash builds). A conflict, a missing commit or any other failure refuses.
function mergedTree(git, base, head) {
  let result;
  try { result = git(['merge-tree', '--write-tree', '--no-messages', base, head]); } catch { result = undefined; }
  if (result?.status === 1) refuse('the approved head conflicts with main');
  const tree = typeof result?.stdout === 'string' ? result.stdout.replace(/\n$/, '') : '';
  if (result?.status !== 0 || !OID.test(tree)) refuse('the merge onto main could not be computed locally');
  return tree;
}

function openPullOnMain(gh, repo, pr, head) {
  const pull = gh(['api', `repos/${repo}/pulls/${pr}`]);
  if (pull?.state !== 'open' || pull.draft !== false) refuse('the pull request is not open and ready');
  if (pull.head?.sha !== head) refuse('the pull request head is not the approved head');
  if (pull.base?.ref !== 'main') refuse('the pull request does not target main');
  if (pull.base?.repo?.full_name !== repo || pull.head?.repo?.full_name !== repo) refuse('the pull request is not within the repository');
}

// The commit's `agent-approvals` statuses, all of them (GitHub lists up to 100 per page, newest first).
function ours(gh, repo, sha) {
  const listed = gh(['api', `repos/${repo}/commits/${sha}/statuses?per_page=100`]);
  if (!Array.isArray(listed) || listed.length >= 100) refuse('the commit statuses could not be listed completely');
  return listed.filter(entry => entry?.context === CONTEXT);
}

// Posts success only when every earlier `agent-approvals` status on the commit came from this account, then confirms
// that the newest one is this account's success.
function setStatus(gh, repo, sha) {
  const login = gh(['api', 'user'])?.login;
  if (typeof login !== 'string' || login === '') refuse('the GitHub account could not be resolved');
  const foreign = entries => entries.some(entry => entry?.creator?.login !== login);
  if (foreign(ours(gh, repo, sha))) refuse('another account already set agent-approvals on this commit');
  gh(['api', '--method', 'POST', `repos/${repo}/statuses/${sha}`,
    '-f', 'state=success', '-f', `context=${CONTEXT}`, '-f', `description=${DESCRIPTION}`]);
  const after = ours(gh, repo, sha);
  const newest = after.filter(entry => Number.isSafeInteger(entry?.id)).sort((a, b) => b.id - a.id)[0];
  if (foreign(after) || newest?.state !== 'success') refuse('GitHub did not record the status');
}

const QUEUE_ENTRY = 'query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) '
  + '{ pullRequest(number: $number) { headRefOid mergeQueueEntry { state headCommit { oid } baseCommit { oid } } } } }';

// The merge-queue commit for this pull request, asked of GitHub rather than derived from a branch name (GitHub names
// the queue branch after the base it builds on, gh-readonly-queue/main/pr-<n>-<base>, which is no binding to the
// head). The entry must be awaiting checks for the approved head, built on main's current tip, and be the scanned
// commit; that commit must have that tip as its single parent. Its tree must be the approved head's tree with a head
// that already contains that tip, or else exactly the conflict-free merge of the approved head onto that tip.
// Returns the merge-group commit OID.
function mergeGroup(gh, git, repo, pr, head, expected) {
  const main = gh(['api', `repos/${repo}/git/ref/heads/main`])?.object?.sha;
  if (!OID.test(main ?? '')) refuse('main could not be resolved');
  const [owner, name] = repo.split('/');
  const answer = gh(['api', 'graphql', '-f', `query=${QUEUE_ENTRY}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${pr}`]);
  const pull = answer?.errors === undefined ? answer?.data?.repository?.pullRequest : undefined;
  if (pull?.headRefOid !== head) refuse('the pull request head is not the approved head');
  const entry = pull.mergeQueueEntry;
  const group = entry?.headCommit?.oid;
  if (entry?.state !== 'AWAITING_CHECKS' || !OID.test(group ?? '')) refuse('the pull request has no merge-queue commit awaiting checks');
  if (entry.baseCommit?.oid !== main) refuse('the merge-queue entry is not built on main');
  if (group !== expected) refuse('the merge-queue commit is not the scanned commit');
  const built = gh(['api', `repos/${repo}/commits/${group}`]);
  const approved = gh(['api', `repos/${repo}/commits/${head}`]);
  if (built?.sha !== group || approved?.sha !== head) refuse('a commit could not be resolved');
  const parents = Array.isArray(built.parents) ? built.parents.map(parent => parent?.sha) : [];
  if (parents.length !== 1 || parents[0] !== main) refuse('the merge-queue commit is not built directly on main');
  const tree = built.commit?.tree?.sha;
  if (!OID.test(tree ?? '')) refuse('the merge-queue commit does not have the approved tree');
  // Exact path: the approved head already contains main's tip and the queue commit has its tree.
  if (tree === approved.commit?.tree?.sha) {
    const compare = gh(['api', `repos/${repo}/compare/${main}...${head}`]);
    if (compare?.status === 'ahead' && compare.behind_by === 0) return group;
  }
  // Merge path: main moved since the approval; the queue commit must be exactly the approved head merged onto it.
  if (tree !== mergedTree(git, main, head)) refuse('the merge-queue commit is not the approved head merged onto main');
  return group;
}

function options(args) {
  const [command, file, ...rest] = args;
  const flags = {};
  for (let index = 0; index < rest.length; index += 2) {
    const [flag, value] = [rest[index], rest[index + 1]];
    if (!/^--(?:head|root|repo|pr|group)$/.test(flag) || value === undefined || Object.hasOwn(flags, flag.slice(2))) refuse('usage');
    flags[flag.slice(2)] = value;
  }
  const remote = command === 'set' || command === 'set-group';
  if (!(command === 'check' || remote) || !file || !flags.head || !flags.root) refuse('usage');
  if (remote && !(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(flags.repo ?? '') && /^[1-9][0-9]*$/.test(flags.pr ?? ''))) refuse('usage');
  if (!remote && (flags.repo !== undefined || flags.pr !== undefined)) refuse('usage');
  if ((command === 'set-group') !== (flags.group !== undefined)) refuse('usage');
  if (flags.group !== undefined && !OID.test(flags.group)) refuse('usage');
  return { command, file, ...flags };
}

export function main(args, { gh = ghRunner, git = gitRunner, write = text => process.stdout.write(text) } = {}) {
  try {
    const { command, file, head, root, repo, pr, group: scanned } = options(args);
    const count = validateBinding(readBinding(file), head, root);
    if (command === 'check') {
      write(`agent-approvals: ${count} approvals bind ${head}\n`);
    } else if (command === 'set') {
      openPullOnMain(gh, repo, pr, head);
      setStatus(gh, repo, head);
      write(`agent-approvals: success set on ${head}\n`);
    } else {
      openPullOnMain(gh, repo, pr, head);
      const group = mergeGroup(gh, git, repo, pr, head, scanned);
      setStatus(gh, repo, group);
      write(`agent-approvals: success set on merge group ${group} for ${head}\n`);
    }
    return 0;
  } catch (error) {
    write(`agent-approvals: refused (${error instanceof Refusal ? error.message : 'unexpected error'})\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
