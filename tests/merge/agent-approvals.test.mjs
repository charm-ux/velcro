import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CONTEXT, DESCRIPTION, gitRunner, main } from '../../scripts/merge/agent-approvals.mjs';

const script = new URL('../../scripts/merge/agent-approvals.mjs', import.meta.url).pathname;
// Pinned from a real queue run (#36): its head, and the main tip GitHub built its queue entry on. GitHub named that
// entry's branch gh-readonly-queue/main/pr-36-<main tip>, after the base, not the head.
const head = '1d1f8c6c42d1720328f71ea4b4b1396c0b432e64';
const main$ = 'b48b57e7f68bbded8b47d0a2a5702ce07be097b6';
const realQueueBranch = 'gh-readonly-queue/main/pr-36-b48b57e7f68bbded8b47d0a2a5702ce07be097b6';
const group = 'e'.repeat(40);
const tree = '7'.repeat(40);
// The tree of the approved head merged onto a main that moved after the approval.
const merged = '9'.repeat(40);
const repo = 'fixture-org/fixture';

// A scratch coordinator layout: <root>/approvals/<n>.json and <root>/reviews/<round>/reports/<reviewer>.md.
function layout(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'velcro-approvals-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'reviews/r2/reports'), { recursive: true });
  mkdirSync(path.join(root, 'approvals'));
  const report = (name, text = `APPROVED\n\nReviewed ${head}.\n`) => { writeFileSync(path.join(root, 'reviews/r2/reports', name), text); return `reviews/r2/reports/${name}`; };
  const binding = (value, name = '7.json') => {
    const file = path.join(root, 'approvals', name);
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
    return file;
  };
  return { root, report, binding };
}

// The pull request as GitHub's GraphQL API reports it, with its merge-queue entry.
const entry = (fields = {}, pull = {}) => ({ data: { repository: { pullRequest: { headRefOid: head,
  mergeQueueEntry: { state: 'AWAITING_CHECKS', headCommit: { oid: group }, baseCommit: { oid: main$ }, ...fields }, ...pull } } } });

// A scripted GitHub: answers by request, records every call, and keeps each commit's statuses (newest first) so a POST
// is visible to the next listing. `overrides` replaces answers by request key; `statuses` seeds earlier statuses.
const me = 'owner-fixture';
function github(overrides = {}, { statuses = {}, afterPost = () => {} } = {}) {
  const calls = [];
  const lists = {};
  const list = sha => (lists[sha] ??= [...(statuses[sha] ?? [])]);
  let id = 100;
  const answers = {
    user: { login: me },
    [`repos/${repo}/pulls/7`]: { state: 'open', draft: false, head: { sha: head, repo: { full_name: repo } }, base: { ref: 'main', repo: { full_name: repo } } },
    // GitHub's GraphQL answer for the pull request's queue entry (the shape `gh api graphql` prints).
    graphql: entry(),
    [`repos/${repo}/git/ref/heads/main`]: { object: { sha: main$ } },
    [`repos/${repo}/commits/${group}`]: { sha: group, parents: [{ sha: main$ }], commit: { tree: { sha: tree } } },
    [`repos/${repo}/commits/${head}`]: { sha: head, parents: [{ sha: main$ }], commit: { tree: { sha: tree } } },
    [`repos/${repo}/compare/${main$}...${head}`]: { status: 'ahead', ahead_by: 1, behind_by: 0 },
    ...overrides,
  };
  const gh = args => {
    calls.push(args.join(' '));
    if (args[1] === '--method') {
      const sha = args[3].split('/').pop();
      list(sha).unshift({ id: id++, context: CONTEXT, state: 'success', creator: { login: me } });
      afterPost(list(sha));
      return { state: 'success' };
    }
    const key = args[1];
    const listing = /^repos\/[^/]+\/[^/]+\/commits\/([0-9a-f]{40})\/statuses\?per_page=100$/.exec(key);
    if (listing && !Object.hasOwn(answers, key)) return list(listing[1]);
    if (!Object.hasOwn(answers, key)) throw new Error(`unexpected request ${key}`);
    if (answers[key] instanceof Error) throw answers[key];
    return answers[key];
  };
  return { gh, calls };
}

const posts = calls => calls.filter(call => call.startsWith('api --method POST'));
const post = sha => `api --method POST repos/${repo}/statuses/${sha} -f state=success -f context=${CONTEXT} -f description=${DESCRIPTION}`;
// A scripted local Git: records every call and answers `git merge-tree` with `answer` (or throws it, if an Error).
function localGit(answer = { status: 0, stdout: `${merged}\n` }) {
  const calls = [];
  const git = args => {
    calls.push(args.join(' '));
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { git, calls };
}
const run = (args, gh, git = localGit().git) => {
  const out = [];
  const code = main(args, { gh, git, write: text => out.push(text) });
  return { code, out: out.join('').trim() };
};

test('check accepts two distinct APPROVED reports bound to the exact head', t => {
  const { root, report, binding } = layout(t);
  const reviews = [report('opus.md', `APPROVED\n\n# Review\nHead reviewed: ${head} (base ${main$}).\n`),
    report('sol.md', `\uFEFFAPPROVED \r\n## Findings\nReviewed \`${main$}..${head}\`.\n`)];
  const file = binding({ head, approvals: 2, reviews, owner: 'notes are ignored' });
  assert.deepEqual(run(['check', file, '--head', head, '--root', root]), { code: 0, out: `agent-approvals: 2 approvals bind ${head}` });
  const three = binding({ head, approvals: 3, reviews: [...reviews, report('third.md')] }, 'three.json');
  assert.equal(run(['check', three, '--head', head, '--root', root]).code, 0);
});

test('check refuses anything short of two approvals for the exact head, without naming paths', t => {
  const { root, report, binding } = layout(t);
  const a = report('opus.md');
  const b = report('sol.md');
  const cases = [
    [{ head, approvals: 2, reviews: [a, b] }, 'd'.repeat(40), 'the binding names a different head'],
    [{ head: head.slice(0, 12), approvals: 2, reviews: [a, b] }, head, 'the binding names a different head'],
    [{ head: head.toUpperCase(), approvals: 2, reviews: [a, b] }, head.toUpperCase(), 'the head must be a full lowercase 40-hex OID'],
    [{ head, approvals: 1, reviews: [a] }, head, 'the binding records fewer than two approvals'],
    [{ head, approvals: '2', reviews: [a, b] }, head, 'the binding records fewer than two approvals'],
    [{ head, reviews: [a, b] }, head, 'the binding records fewer than two approvals'],
    [{ head, approvals: 2, reviews: 'reviews/r2' }, head, 'the binding must list exactly one report per approval'],
    [{ head, approvals: 2, reviews: [a] }, head, 'the binding must list exactly one report per approval'],
    [{ head, approvals: 2, reviews: [a, b, a] }, head, 'the binding must list exactly one report per approval'],
    [{ head, approvals: 2, reviews: [a, a] }, head, 'report 2 repeats another report'],
    [{ head, approvals: 2, reviews: [a, 'reviews/r2/reports/./opus.md'] }, head, 'report 2 repeats another report'],
    [{ head, approvals: 2, reviews: [a, report('changes.md', `CHANGES_NEEDED\n${head}\n`)] }, head, 'report 2 does not start with APPROVED'],
    // A report must name the approved head in full: an earlier round's report, a short OID or a longer hex run fails.
    [{ head, approvals: 2, reviews: [a, report('nohead.md', 'APPROVED\n\nLooks good.\n')] }, head, 'report 2 does not name the approved head'],
    [{ head, approvals: 2, reviews: [a, report('short.md', `APPROVED\n@ ${head.slice(0, 7)}\n`)] }, head, 'report 2 does not name the approved head'],
    [{ head, approvals: 2, reviews: [a, report('older.md', `APPROVED\nHead reviewed: ${'d'.repeat(40)}\n`)] }, head, 'report 2 does not name the approved head'],
    [{ head, approvals: 2, reviews: [a, report('longer.md', `APPROVED\n${head}0\n`)] }, head, 'report 2 does not name the approved head'],
    [{ head, approvals: 2, reviews: [a, report('late.md', `# Review\nAPPROVED\n${head}\n`)] }, head, 'report 2 does not start with APPROVED'],
    [{ head, approvals: 2, reviews: [a, report('prefixed.md', `APPROVED_WITH_NOTES\n${head}\n`)] }, head, 'report 2 does not start with APPROVED'],
    [{ head, approvals: 2, reviews: [a, report('indented.md', ` APPROVED\n${head}\n`)] }, head, 'report 2 does not start with APPROVED'],
    [{ head, approvals: 2, reviews: [a, report('empty.md', `\n${head}\n`)] }, head, 'report 2 does not start with APPROVED'],
    [{ head, approvals: 2, reviews: [a, 'reviews/r2/reports/missing.md'] }, head, 'report 2 is missing'],
    [{ head, approvals: 2, reviews: [a, path.join(root, b)] }, head, 'report 2 is not a relative path'],
    [{ head, approvals: 2, reviews: [a, ''] }, head, 'report 2 is not a relative path'],
    [{ head, approvals: 2, reviews: [a, 7] }, head, 'report 2 is not a relative path'],
    [{ head, approvals: 2, reviews: [a, 'reviews/r2/reports'] }, head, 'report 2 is not a regular file'],
    [[head], head, 'the binding is not a JSON object'],
  ];
  // A report reached through a link that leaves the root, and an approved report outside the root.
  const outside = mkdtempSync(path.join(tmpdir(), 'velcro-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(path.join(outside, 'x.md'), `APPROVED\n${head}\n`);
  symlinkSync(path.join(outside, 'x.md'), path.join(root, 'reviews/r2/reports/linked.md'));
  cases.push([{ head, approvals: 2, reviews: [a, 'reviews/r2/reports/linked.md'] }, head, 'report 2 is outside the report root']);
  cases.push([{ head, approvals: 2, reviews: [a, path.relative(root, path.join(outside, 'x.md'))] }, head, 'report 2 is outside the report root']);
  for (const [value, flagHead, reason] of cases) {
    const result = run(['check', binding(value), '--head', flagHead, '--root', root]);
    assert.deepEqual(result, { code: 1, out: `agent-approvals: refused (${reason})` }, JSON.stringify(value));
  }
  assert.deepEqual(run(['check', binding('{'), '--head', head, '--root', root]), { code: 1, out: 'agent-approvals: refused (the binding is not valid JSON)' });
  assert.deepEqual(run(['check', path.join(root, 'none.json'), '--head', head, '--root', root]), { code: 1, out: 'agent-approvals: refused (the binding is unreadable)' });
  assert.deepEqual(run(['check', binding({ head, approvals: 2, reviews: [a, b] }), '--head', head, '--root', path.join(root, 'none')]),
    { code: 1, out: 'agent-approvals: refused (the report root is unreadable)' });
});

test('usage errors refuse before reading anything', t => {
  const { root, report, binding } = layout(t);
  const file = binding({ head, approvals: 2, reviews: [report('a.md'), report('b.md')] });
  for (const args of [
    [], ['check'], ['check', file], ['check', file, '--head', head], ['approve', file, '--head', head, '--root', root],
    ['check', file, '--head', head, '--root', root, '--repo', repo],
    ['check', file, '--head', head, '--root', root, '--head', head],
    ['check', file, '--head', head, '--root', root, '--force', '1'],
    ['set', file, '--head', head, '--root', root], ['set', file, '--head', head, '--root', root, '--repo', repo],
    ['set', file, '--head', head, '--root', root, '--repo', 'bad repo', '--pr', '7'],
    ['set', file, '--head', head, '--root', root, '--repo', repo, '--pr', '07'],
    ['set-group', file, '--head', head, '--root', root, '--repo', repo, '--pr', '-1', '--group', group],
    // set-group needs the scanned queue commit; nothing else accepts one.
    ['set-group', file, '--head', head, '--root', root, '--repo', repo, '--pr', '7'],
    ['set-group', file, '--head', head, '--root', root, '--repo', repo, '--pr', '7', '--group', group.slice(0, 12)],
    ['set', file, '--head', head, '--root', root, '--repo', repo, '--pr', '7', '--group', group],
    ['check', file, '--head', head, '--root', root, '--group', group],
  ]) {
    const { gh, calls } = github();
    assert.deepEqual(run(args, gh), { code: 1, out: 'agent-approvals: refused (usage)' }, args.join(' '));
    assert.deepEqual(calls, []);
  }
});

test('set marks only the open pull request whose head is the approved head', t => {
  const { root, report, binding } = layout(t);
  const good = binding({ head, approvals: 2, reviews: [report('a.md'), report('b.md')] });
  const args = file => ['set', file, '--head', head, '--root', root, '--repo', repo, '--pr', '7'];
  const ok = github();
  assert.deepEqual(run(args(good), ok.gh), { code: 0, out: `agent-approvals: success set on ${head}` });
  assert.deepEqual(posts(ok.calls), [post(head)]);
  // An invalid binding never reaches GitHub.
  const bad = binding({ head, approvals: 2, reviews: [report('c.md'), report('d.md', 'CHANGES_NEEDED\n')] }, 'bad.json');
  const none = github();
  assert.equal(run(args(bad), none.gh).code, 1);
  assert.deepEqual(none.calls, []);
  const pull = github().gh(['api', `repos/${repo}/pulls/7`]);
  for (const [changed, reason] of [
    [{ ...pull, head: { ...pull.head, sha: 'd'.repeat(40) } }, 'the pull request head is not the approved head'],
    [{ ...pull, state: 'closed' }, 'the pull request is not open and ready'],
    [{ ...pull, draft: true }, 'the pull request is not open and ready'],
    [{ ...pull, base: { ...pull.base, ref: 'release' } }, 'the pull request does not target main'],
    [{ ...pull, head: { ...pull.head, repo: { full_name: 'fork/fixture' } } }, 'the pull request is not within the repository'],
  ]) {
    const { gh, calls } = github({ [`repos/${repo}/pulls/7`]: changed });
    assert.deepEqual(run(args(good), gh), { code: 1, out: `agent-approvals: refused (${reason})` });
    assert.deepEqual(posts(calls), []);
  }
  // Earlier statuses from this account do not stop it; the newest is its own success.
  const own = { id: 5, context: CONTEXT, state: 'success', creator: { login: me } };
  const again = github({}, { statuses: { [head]: [own, { id: 4, context: 'other', state: 'failure', creator: { login: 'github-actions[bot]' } }] } });
  assert.equal(run(args(good), again.gh).code, 0);
  // An agent-approvals status from any other account (a workflow token, another writer) means the context was minted
  // elsewhere: refuse, and post nothing.
  for (const creator of [{ login: 'github-actions[bot]' }, { login: 'other-fixture' }, null]) {
    const foreign = { id: 6, context: CONTEXT, state: 'pending', creator };
    const { gh, calls } = github({}, { statuses: { [head]: [own, foreign] } });
    assert.deepEqual(run(args(good), gh), { code: 1, out: 'agent-approvals: refused (another account already set agent-approvals on this commit)' });
    assert.deepEqual(posts(calls), []);
  }
  // After posting, a newer status from another account, a newest status that is not success, an unlistable or
  // possibly truncated listing, an unresolvable account or a failed request all refuse.
  const after = [
    list => list.unshift({ id: 999, context: CONTEXT, state: 'success', creator: { login: 'github-actions[bot]' } }),
    list => list.unshift({ id: 999, context: CONTEXT, state: 'failure', creator: { login: me } }),
    list => list.splice(0, list.length),
    // An older foreign status that appears while posting (the newest is still this account's success).
    list => list.push({ id: 1, context: CONTEXT, state: 'success', creator: { login: 'github-actions[bot]' } }),
  ];
  for (const afterPost of after) assert.equal(run(args(good), github({}, { afterPost }).gh).code, 1);
  const full = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, context: 'other', state: 'success', creator: { login: me } }));
  for (const [overrides, reason] of [
    [{ [`repos/${repo}/commits/${head}/statuses?per_page=100`]: full }, 'the commit statuses could not be listed completely'],
    [{ [`repos/${repo}/commits/${head}/statuses?per_page=100`]: {} }, 'the commit statuses could not be listed completely'],
    [{ user: {} }, 'the GitHub account could not be resolved'],
  ]) {
    const { gh, calls } = github(overrides);
    assert.deepEqual(run(args(good), gh), { code: 1, out: `agent-approvals: refused (${reason})` });
    assert.deepEqual(posts(calls), []);
  }
  assert.equal(run(args(good), github({ user: new Error('down') }).gh).code, 1);
});

test('set-group marks only the merge-queue commit that lands exactly the approved tree on main', t => {
  const { root, report, binding } = layout(t);
  const good = binding({ head, approvals: 2, reviews: [report('a.md'), report('b.md')] });
  const args = ['set-group', good, '--head', head, '--root', root, '--repo', repo, '--pr', '7', '--group', group];
  const ok = github();
  const noMerge = localGit();
  assert.deepEqual(run(args, ok.gh, noMerge.git), { code: 0, out: `agent-approvals: success set on merge group ${group} for ${head}` });
  assert.deepEqual(posts(ok.calls), [post(group)]);
  // The exact tree on a head that already contains main needs no local merge.
  assert.deepEqual(noMerge.calls, []);
  const groupKey = `repos/${repo}/commits/${group}`;
  const built = github().gh(['api', groupKey]);
  // The queue entry is read from GitHub for this pull request; no branch name is derived.
  const query = ok.calls.find(call => call.startsWith('api graphql '));
  assert.match(query, /mergeQueueEntry \{ state headCommit \{ oid \} baseCommit \{ oid \} \}/);
  assert.ok(query.endsWith(' -f owner=fixture-org -f name=fixture -F number=7'), query);
  assert.ok(!ok.calls.some(call => call.includes('gh-readonly-queue')));
  for (const [overrides, reason] of [
    // No entry, an entry not yet built or past its checks, or no commit for it.
    [{ graphql: entry(undefined, { mergeQueueEntry: null }) }, 'the pull request has no merge-queue commit awaiting checks'],
    ...['QUEUED', 'MERGEABLE', 'UNMERGEABLE', 'LOCKED', undefined].map(state => [{ graphql: entry({ state }) }, 'the pull request has no merge-queue commit awaiting checks']),
    [{ graphql: entry({ headCommit: null }) }, 'the pull request has no merge-queue commit awaiting checks'],
    [{ graphql: entry({ headCommit: { oid: group.slice(0, 12) } }) }, 'the pull request has no merge-queue commit awaiting checks'],
    // GraphQL errors, or an answer without the pull request.
    [{ graphql: { ...entry(), errors: [{ message: 'x' }] } }, 'the pull request head is not the approved head'],
    [{ graphql: { data: { repository: null } } }, 'the pull request head is not the approved head'],
    // The entry is for another head (pushed since), or was built on another base than main's current tip.
    [{ graphql: entry(undefined, { headRefOid: 'd'.repeat(40) }) }, 'the pull request head is not the approved head'],
    [{ graphql: entry({ baseCommit: { oid: 'f'.repeat(40) } }) }, 'the merge-queue entry is not built on main'],
    [{ graphql: entry({ baseCommit: null }) }, 'the merge-queue entry is not built on main'],
    // The queue rebuilt the entry after the caller scanned it.
    [{ graphql: entry({ headCommit: { oid: 'f'.repeat(40) } }) }, 'the merge-queue commit is not the scanned commit'],
    [{ [`repos/${repo}/git/ref/heads/main`]: { object: {} } }, 'main could not be resolved'],
    // Queued behind another group, a merge commit, or built on an older main.
    [{ [groupKey]: { ...built, parents: [{ sha: 'f'.repeat(40) }] } }, 'the merge-queue commit is not built directly on main'],
    [{ [groupKey]: { ...built, parents: [{ sha: main$ }, { sha: head }] } }, 'the merge-queue commit is not built directly on main'],
    // Content that differs from the approved head in any way, and from the approved head merged onto main.
    [{ [groupKey]: { ...built, commit: { tree: { sha: '8'.repeat(40) } } } }, 'the merge-queue commit is not the approved head merged onto main'],
    [{ [groupKey]: { ...built, commit: {} } }, 'the merge-queue commit does not have the approved tree'],
    // The approved tree on a head that lacks main's tip would drop main's changes unless the merge equals it.
    [{ [`repos/${repo}/compare/${main$}...${head}`]: { status: 'diverged', ahead_by: 1, behind_by: 1 } }, 'the merge-queue commit is not the approved head merged onto main'],
    [{ [`repos/${repo}/compare/${main$}...${head}`]: { status: 'identical', ahead_by: 0, behind_by: 0 } }, 'the merge-queue commit is not the approved head merged onto main'],
    [{ [`repos/${repo}/pulls/7`]: { ...github().gh(['api', `repos/${repo}/pulls/7`]), state: 'closed' } }, 'the pull request is not open and ready'],
  ]) {
    const { gh, calls } = github(overrides);
    assert.deepEqual(run(args, gh), { code: 1, out: `agent-approvals: refused (${reason})` }, reason);
    assert.deepEqual(posts(calls), []);
  }
  // The caller scanned another commit than the one the queue holds.
  const rebuilt = github();
  assert.deepEqual(run([...args.slice(0, -1), 'f'.repeat(40)], rebuilt.gh),
    { code: 1, out: 'agent-approvals: refused (the merge-queue commit is not the scanned commit)' });
  assert.deepEqual(posts(rebuilt.calls), []);
  // A queue commit that already carries a foreign agent-approvals status is not marked.
  const minted = github({}, { statuses: { [group]: [{ id: 3, context: CONTEXT, state: 'success', creator: { login: 'github-actions[bot]' } }] } });
  assert.deepEqual(run(args, minted.gh), { code: 1, out: 'agent-approvals: refused (another account already set agent-approvals on this commit)' });
  assert.deepEqual(posts(minted.calls), []);
});

// Main moved after the approval: the queue squashes the approved head onto the new tip, so the queued tree is the
// merge, not the head's tree. GitHub answers for that state; `behind` is the compare of the new tip with the head.
const behind = { status: 'diverged', ahead_by: 1, behind_by: 1 };
const moved = (overrides = {}) => ({
  [`repos/${repo}/commits/${group}`]: { sha: group, parents: [{ sha: main$ }], commit: { tree: { sha: merged } } },
  [`repos/${repo}/compare/${main$}...${head}`]: behind,
  ...overrides,
});

test('set-group marks the queue commit that is the approved head merged cleanly onto a main that moved', t => {
  const { root, report, binding } = layout(t);
  const good = binding({ head, approvals: 2, reviews: [report('a.md'), report('b.md')] });
  const args = ['set-group', good, '--head', head, '--root', root, '--repo', repo, '--pr', '7', '--group', group];
  const ok = github(moved());
  const local = localGit();
  assert.deepEqual(run(args, ok.gh, local.git), { code: 0, out: `agent-approvals: success set on merge group ${group} for ${head}` });
  assert.deepEqual(posts(ok.calls), [post(group)]);
  // The merge is computed from the queue entry's base (main's tip, the single parent) and the approved head only.
  assert.deepEqual(local.calls, [`merge-tree --write-tree --no-messages ${main$} ${head}`]);
  // When main's new changes are already in the head, the merge is the head's own tree, which is then accepted too.
  assert.equal(run(args, github({ [`repos/${repo}/compare/${main$}...${head}`]: behind }).gh, localGit({ status: 0, stdout: `${tree}\n` }).git).code, 0);

  const groupKey = `repos/${repo}/commits/${group}`;
  const built = moved()[groupKey];
  const conflicted = { status: 1, stdout: `${merged}\n100644 ${'a'.repeat(40)} 1\tshared.txt\n` };
  for (const [overrides, answer, reason, merges] of [
    // A tampered tree: neither the approved tree nor the merge.
    [{ [groupKey]: { ...built, commit: { tree: { sha: '8'.repeat(40) } } } }, undefined, 'the merge-queue commit is not the approved head merged onto main', 1],
    // The approved tree without main's new changes.
    [{ [groupKey]: { ...built, commit: { tree: { sha: tree } } } }, undefined, 'the merge-queue commit is not the approved head merged onto main', 1],
    // A conflicted merge, even when the queue commit carries Git's conflicted tree.
    [{}, conflicted, 'the approved head conflicts with main', 1],
    [{ [groupKey]: { ...built, commit: { tree: { sha: merged } } } }, { status: 1, stdout: `${merged}\n` }, 'the approved head conflicts with main', 1],
    // Git could not compute the merge: a missing commit, no Git, a crash or unexpected output.
    [{}, { status: 128, stdout: '' }, 'the merge onto main could not be computed locally', 1],
    [{}, { status: null, stdout: '' }, 'the merge onto main could not be computed locally', 1],
    [{}, new Error('spawn failed'), 'the merge onto main could not be computed locally', 1],
    [{}, { status: 0, stdout: `${merged}\nextra\n` }, 'the merge onto main could not be computed locally', 1],
    [{}, { status: 0, stdout: merged.slice(0, 12) }, 'the merge onto main could not be computed locally', 1],
    // A stale approval: the pull request's head moved after the approval (GitHub's REST and GraphQL views).
    [{ graphql: entry(undefined, { headRefOid: 'd'.repeat(40) }) }, undefined, 'the pull request head is not the approved head', 0],
    [{ [`repos/${repo}/pulls/7`]: { ...github().gh(['api', `repos/${repo}/pulls/7`]), head: { sha: 'd'.repeat(40), repo: { full_name: repo } } } },
      undefined, 'the pull request head is not the approved head', 0],
    // Extra parents: a merge commit, or a commit stacked on another queue entry.
    [{ [groupKey]: { ...built, parents: [{ sha: main$ }, { sha: head }] } }, undefined, 'the merge-queue commit is not built directly on main', 0],
    [{ [groupKey]: { ...built, parents: [] } }, undefined, 'the merge-queue commit is not built directly on main', 0],
    // The wrong base: a parent that is not main's tip, or an entry built on another base than main's tip.
    [{ [groupKey]: { ...built, parents: [{ sha: 'f'.repeat(40) }] } }, undefined, 'the merge-queue commit is not built directly on main', 0],
    [{ graphql: entry({ baseCommit: { oid: 'f'.repeat(40) } }) }, undefined, 'the merge-queue entry is not built on main', 0],
    [{ [`repos/${repo}/git/ref/heads/main`]: { object: { sha: 'f'.repeat(40) } } }, undefined, 'the merge-queue entry is not built on main', 0],
  ]) {
    const { gh, calls } = github(moved(overrides));
    const local = localGit(answer);
    assert.deepEqual(run(args, gh, local.git), { code: 1, out: `agent-approvals: refused (${reason})` }, reason);
    assert.deepEqual(posts(calls), [], reason);
    assert.equal(local.calls.length, merges, reason);
  }
  // A binding for an earlier head never reaches GitHub or Git.
  const stale = binding({ head: 'd'.repeat(40), approvals: 2, reviews: [report('c.md', `APPROVED\n${'d'.repeat(40)}\n`), report('d.md', `APPROVED\n${'d'.repeat(40)}\n`)] }, 'stale.json');
  const none = github(moved());
  const untouched = localGit();
  assert.deepEqual(run([...args.slice(0, 1), stale, ...args.slice(2)], none.gh, untouched.git),
    { code: 1, out: 'agent-approvals: refused (the binding names a different head)' });
  assert.deepEqual([none.calls, untouched.calls], [[], []]);
});

// The same rule against real Git: a scratch repository where main moved after the approval.
const fixtureEmail = ['velcro-test', 'example.invalid'].join('@');
const fixtureEnv = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_SYSTEM: devNull, GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'velcro-test', GIT_AUTHOR_EMAIL: fixtureEmail, GIT_COMMITTER_NAME: 'velcro-test', GIT_COMMITTER_EMAIL: fixtureEmail };
function scratch(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'velcro-queue-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'init.defaultBranch=main', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${devNull}`, ...args],
      { cwd: dir, env: fixtureEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
    assert.equal(r.status, 0, `git ${args[0]} failed`);
    return r.stdout.trim();
  };
  // Commits `files` on top of `parent` (or as a root) and returns its OID.
  const commit = (parent, files, message) => {
    if (parent) git('checkout', '-q', '--detach', parent);
    for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text);
    git('add', '--', ...Object.keys(files));
    git('commit', '-q', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q');
  return { dir, git, commit };
}

test('set-group binds a real squash of the approved head onto a moved main and refuses a conflict or tampering', t => {
  const { dir, git, commit } = scratch(t);
  const base = commit(null, { 'a.txt': 'a\n', 'b.txt': 'b\n' }, 'base');
  const tip = commit(base, { 'a.txt': 'a from main\n' }, 'main moved');
  const approved = commit(base, { 'b.txt': 'b from the pull request\n' }, 'approved change');
  const clashing = commit(base, { 'a.txt': 'a from the pull request\n' }, 'clashing change');
  // What the queue squashes, built independently of merge-tree: main's tip plus the approved change.
  const queued = commit(tip, { 'b.txt': 'b from the pull request\n' }, 'queued squash');
  const treeOf = oid => git('rev-parse', `${oid}^{tree}`);
  const { root, report, binding } = layout(t);
  // GitHub's view of a pull request at `pr` queued on `tip` as `queue` with `queueTree`.
  const view = (pr, queueTree, queue = queued) => {
    const pull = github().gh(['api', `repos/${repo}/pulls/7`]);
    return github({
      [`repos/${repo}/pulls/7`]: { ...pull, head: { ...pull.head, sha: pr } },
      graphql: { data: { repository: { pullRequest: { headRefOid: pr,
        mergeQueueEntry: { state: 'AWAITING_CHECKS', headCommit: { oid: queue }, baseCommit: { oid: tip } } } } } },
      [`repos/${repo}/git/ref/heads/main`]: { object: { sha: tip } },
      [`repos/${repo}/commits/${queue}`]: { sha: queue, parents: [{ sha: tip }], commit: { tree: { sha: queueTree } } },
      [`repos/${repo}/commits/${pr}`]: { sha: pr, parents: [{ sha: base }], commit: { tree: { sha: treeOf(pr) } } },
      [`repos/${repo}/compare/${tip}...${pr}`]: { status: 'diverged', ahead_by: 1, behind_by: 1 },
    });
  };
  const bound = pr => binding({ head: pr, approvals: 2, reviews: [report(`${pr}-a.md`, `APPROVED\n${pr}\n`), report(`${pr}-b.md`, `APPROVED\n${pr}\n`)] }, `${pr}.json`);
  const args = (pr, queue = queued) => ['set-group', bound(pr), '--head', pr, '--root', root, '--repo', repo, '--pr', '7', '--group', queue];
  const real = cwd => args => gitRunner(args, cwd);

  const ok = view(approved, treeOf(queued));
  assert.deepEqual(run(args(approved), ok.gh, real(dir)), { code: 0, out: `agent-approvals: success set on merge group ${queued} for ${approved}` });
  assert.deepEqual(posts(ok.calls), [post(queued)]);
  for (const [pr, queueTree, cwd, reason] of [
    // The approved head's own tree drops main's change; another tree lands something else.
    [approved, treeOf(approved), dir, 'the merge-queue commit is not the approved head merged onto main'],
    [approved, treeOf(tip), dir, 'the merge-queue commit is not the approved head merged onto main'],
    // Both sides changed a.txt.
    [clashing, treeOf(queued), dir, 'the approved head conflicts with main'],
    // A directory without the commits.
    [approved, treeOf(queued), root, 'the merge onto main could not be computed locally'],
  ]) {
    const { gh, calls } = view(pr, queueTree);
    assert.deepEqual(run(args(pr), gh, real(cwd)), { code: 1, out: `agent-approvals: refused (${reason})` }, reason);
    assert.deepEqual(posts(calls), [], reason);
  }
});

// Regression: the queue branch is named after the base GitHub built on, as in #36, not after the pull request head.
// A lookup by `pr-<n>-<head>` finds nothing there; the queue entry GitHub reports is found whatever the branch name.
test('set-group finds the queued commit as GitHub reports it for #36, whose branch is named after its base', t => {
  assert.equal(realQueueBranch, `gh-readonly-queue/main/pr-36-${main$}`);
  assert.ok(!realQueueBranch.includes(head));
  const { root, report, binding } = layout(t);
  const good = binding({ head, approvals: 2, reviews: [report('a.md'), report('b.md')] }, '36.json');
  const pull = github().gh(['api', `repos/${repo}/pulls/7`]);
  // GitHub's state: pull request 36 queued on main's tip, with only the base-named queue branch.
  const real = {
    [`repos/${repo}/pulls/36`]: pull,
    [`repos/${repo}/git/matching-refs/heads/${realQueueBranch}`]: [{ ref: `refs/heads/${realQueueBranch}`, object: { type: 'commit', sha: group } }],
    [`repos/${repo}/git/matching-refs/heads/gh-readonly-queue/main/pr-36-${head}`]: [],
  };
  const args = ['set-group', good, '--head', head, '--root', root, '--repo', repo, '--pr', '36', '--group', group];
  const ok = github(real);
  assert.deepEqual(run(args, ok.gh), { code: 0, out: `agent-approvals: success set on merge group ${group} for ${head}` });
  assert.deepEqual(posts(ok.calls), [post(group)]);
  assert.ok(ok.calls.some(call => call.startsWith('api graphql ') && call.endsWith(' -F number=36')));
});

test('the command line keeps GitHub output private and posts nothing on refusal', t => {
  const { root, report, binding } = layout(t);
  const good = binding({ head, approvals: 2, reviews: [report('a.md'), report('b.md')] });
  const bin = path.join(root, 'bin');
  mkdirSync(bin);
  const log = path.join(root, 'gh.log');
  const secret = ['', 'home', 'u' + 'ser', 'work'].join('/');
  // Stand-in gh: logs its arguments, prints sensitive-looking noise to stderr, then answers or fails per $GH_MODE.
  writeFileSync(path.join(bin, 'gh'), [
    '#!/bin/sh', `echo "$*" >> "${log}"`, `echo "trace ${secret}" >&2`,
    '[ "$GH_MODE" = fail ] && exit 1',
    'case "$*" in',
    `  *"--method POST"*) touch "${log}.posted"; echo '{"state":"success"}' ;;`,
    `  *pulls/7) echo '{"state":"open","draft":false,"head":{"sha":"${head}","repo":{"full_name":"${repo}"}},"base":{"ref":"main","repo":{"full_name":"${repo}"}}}' ;;`,
    `  "api user") echo '{"login":"${me}"}' ;;`,
    `  *"/statuses?per_page=100") if [ -f "${log}.posted" ]; then echo '[{"id":1,"context":"${CONTEXT}","state":"success","creator":{"login":"${me}"}}]'; else echo '[]'; fi ;;`,
    `  *) exit 1 ;;`,
    'esac', '',
  ].join('\n'), { mode: 0o755 });
  const cli = (args, mode = '') => {
    rmSync(log, { force: true });
    rmSync(`${log}.posted`, { force: true });
    const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8',
      env: { ...process.env, GH_MODE: mode, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
    const calls = (() => { try { return readFileSync(log, 'utf8').trim().split('\n'); } catch { return []; } })();
    return { status: r.status, out: `${r.stdout}${r.stderr}`.trim(), calls };
  };
  const set = ['set', good, '--head', head, '--root', root, '--repo', repo, '--pr', '7'];
  const ok = cli(set);
  assert.equal(ok.status, 0);
  assert.equal(ok.out, `agent-approvals: success set on ${head}`);
  assert.equal(ok.calls.filter(call => call.includes('--method POST')).length, 1);
  const failed = cli(set, 'fail');
  assert.deepEqual([failed.status, failed.out], [1, 'agent-approvals: refused (a GitHub request failed)']);
  assert.ok(!failed.out.includes(secret) && !failed.out.includes(root));
  const refused = cli(['set', good, '--head', 'd'.repeat(40), '--root', root, '--repo', repo, '--pr', '7']);
  assert.deepEqual([refused.status, refused.out, refused.calls], [1, 'agent-approvals: refused (the binding names a different head)', []]);
});
