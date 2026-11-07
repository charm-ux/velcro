import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CONTEXT, DESCRIPTION, main } from '../../scripts/merge/agent-approvals.mjs';

const script = new URL('../../scripts/merge/agent-approvals.mjs', import.meta.url).pathname;
const head = 'c'.repeat(40);
const main$ = 'a'.repeat(40);
const group = 'e'.repeat(40);
const tree = '7'.repeat(40);
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

// A scripted GitHub: answers by request, records every call, and keeps each commit's statuses (newest first) so a POST
// is visible to the next listing. `overrides` replaces answers by request key; `statuses` seeds earlier statuses.
const me = 'owner-fixture';
function github(overrides = {}, { statuses = {}, afterPost = () => {} } = {}) {
  const calls = [];
  const lists = { [head]: [...(statuses[head] ?? [])], [group]: [...(statuses[group] ?? [])] };
  let id = 100;
  const answers = {
    user: { login: me },
    [`repos/${repo}/pulls/7`]: { state: 'open', draft: false, head: { sha: head, repo: { full_name: repo } }, base: { ref: 'main', repo: { full_name: repo } } },
    [`repos/${repo}/git/matching-refs/heads/gh-readonly-queue/main/pr-7-${head}`]: [{ ref: `refs/heads/gh-readonly-queue/main/pr-7-${head}`, object: { type: 'commit', sha: group } }],
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
      lists[sha].unshift({ id: id++, context: CONTEXT, state: 'success', creator: { login: me } });
      afterPost(lists[sha]);
      return { state: 'success' };
    }
    const key = args[1];
    const listing = /^repos\/[^/]+\/[^/]+\/commits\/([0-9a-f]{40})\/statuses\?per_page=100$/.exec(key);
    if (listing && !Object.hasOwn(answers, key)) return lists[listing[1]];
    if (!Object.hasOwn(answers, key)) throw new Error(`unexpected request ${key}`);
    if (answers[key] instanceof Error) throw answers[key];
    return answers[key];
  };
  return { gh, calls };
}

const posts = calls => calls.filter(call => call.startsWith('api --method POST'));
const post = sha => `api --method POST repos/${repo}/statuses/${sha} -f state=success -f context=${CONTEXT} -f description=${DESCRIPTION}`;
const run = (args, gh) => { const out = []; const code = main(args, { gh, write: text => out.push(text) }); return { code, out: out.join('').trim() }; };

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
  assert.deepEqual(run(args, ok.gh), { code: 0, out: `agent-approvals: success set on merge group ${group} for ${head}` });
  assert.deepEqual(posts(ok.calls), [post(group)]);
  const refKey = `repos/${repo}/git/matching-refs/heads/gh-readonly-queue/main/pr-7-${head}`;
  const groupKey = `repos/${repo}/commits/${group}`;
  const built = github().gh(['api', groupKey]);
  for (const [overrides, reason] of [
    [{ [refKey]: [] }, 'no merge-queue commit for the approved head'],
    // A prefix match for another head, or another pull request, is not this group.
    [{ [refKey]: [{ ref: `refs/heads/gh-readonly-queue/main/pr-7-${head}x`, object: { type: 'commit', sha: group } }] }, 'no merge-queue commit for the approved head'],
    [{ [refKey]: [{ ref: `refs/heads/gh-readonly-queue/main/pr-7-${head}`, object: { type: 'tag', sha: group } }] }, 'no merge-queue commit for the approved head'],
    [{ [`repos/${repo}/git/ref/heads/main`]: { object: {} } }, 'main could not be resolved'],
    // Queued behind another group, a merge commit, or built on an older main.
    [{ [groupKey]: { ...built, parents: [{ sha: 'f'.repeat(40) }] } }, 'the merge-queue commit is not built directly on main'],
    [{ [groupKey]: { ...built, parents: [{ sha: main$ }, { sha: head }] } }, 'the merge-queue commit is not built directly on main'],
    // Content that differs from the approved head in any way.
    [{ [groupKey]: { ...built, commit: { tree: { sha: '8'.repeat(40) } } } }, 'the merge-queue commit does not have the approved tree'],
    [{ [groupKey]: { ...built, commit: {} } }, 'the merge-queue commit does not have the approved tree'],
    [{ [`repos/${repo}/compare/${main$}...${head}`]: { status: 'diverged', ahead_by: 1, behind_by: 1 } }, 'the approved head does not contain main'],
    [{ [`repos/${repo}/compare/${main$}...${head}`]: { status: 'identical', ahead_by: 0, behind_by: 0 } }, 'the approved head does not contain main'],
    [{ [`repos/${repo}/pulls/7`]: { ...github().gh(['api', `repos/${repo}/pulls/7`]), state: 'closed' } }, 'the pull request is not open and ready'],
  ]) {
    const { gh, calls } = github(overrides);
    assert.deepEqual(run(args, gh), { code: 1, out: `agent-approvals: refused (${reason})` }, reason);
    assert.deepEqual(posts(calls), []);
  }
  // The queue rebuilt the entry after the caller scanned it: the current queue commit is not the scanned one.
  const rebuilt = github();
  assert.deepEqual(run([...args.slice(0, -1), 'f'.repeat(40)], rebuilt.gh),
    { code: 1, out: 'agent-approvals: refused (the merge-queue commit is not the scanned commit)' });
  assert.deepEqual(posts(rebuilt.calls), []);
  // A queue commit that already carries a foreign agent-approvals status is not marked.
  const minted = github({}, { statuses: { [group]: [{ id: 3, context: CONTEXT, state: 'success', creator: { login: 'github-actions[bot]' } }] } });
  assert.deepEqual(run(args, minted.gh), { code: 1, out: 'agent-approvals: refused (another account already set agent-approvals on this commit)' });
  assert.deepEqual(posts(minted.calls), []);
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
