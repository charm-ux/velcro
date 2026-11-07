// Local oracle for the CI `required` aggregate (the workflow carries its own inline copy; tests keep them equal).
import { readFileSync } from 'node:fs';

const JOBS = ['verify', 'product', 'site', 'security'];

// This list is fixed rather than inferred from the jobs that happened to run.
const named = needs => needs !== null && typeof needs === 'object' && !Array.isArray(needs)
  && Object.keys(needs).sort().join(',') === 'product,security,site,verify';

export function accepted(needs) {
  return named(needs) && JOBS.every(job => needs[job]?.result === 'success');
}

// The run name ci.yml gives a full (analysis) pull request run; a title/body edit's run ends in `(repeat)` instead.
export const fullRunTitle = (pr, base) => `CI pr ${pr} into ${base} (full)`;

// A title or body edit skips the analysis jobs; the aggregate then repeats the newest full run of ci.yml for the same
// head, PR and base branch. `listing` is that workflow's runs for the head. Newest means the highest run number
// (creation order), never the latest completion, so a newer pending or failed run is never overtaken by an older one.
export function latestFullRun(listing, { head, pr, base, run }) {
  return listing.workflow_runs
    .filter(r => Number.isSafeInteger(r.id) && String(r.id) !== run && r.path === '.github/workflows/ci.yml'
      && r.event === 'pull_request' && r.head_sha === head && r.display_title === fullRunTitle(pr, base)
      && Number.isSafeInteger(r.run_number))
    .sort((a, b) => b.run_number - a.run_number)[0];
}

export function carried(needs, listing, context) {
  const { head, pr, base, run } = context;
  const valid = /^[0-9a-f]{40}$/.test(head ?? '') && /^[1-9][0-9]*$/.test(pr ?? '') && /^[0-9]+$/.test(run ?? '')
    && typeof base === 'string' && base !== '';
  const latest = latestFullRun(listing, context);
  return valid && named(needs) && JOBS.every(job => needs[job]?.result === 'skipped')
    && latest?.status === 'completed' && latest.conclusion === 'success';
}

if (import.meta.main) {
  let green = false;
  try {
    const needs = JSON.parse(process.env.VELCRO_CI_NEEDS);
    const { VELCRO_CI_HEAD: head, VELCRO_CI_PR: pr, VELCRO_CI_BASE: base, VELCRO_CI_RUN: run } = process.env;
    green = process.env.VELCRO_CI_CARRY === 'true'
      ? carried(needs, JSON.parse(readFileSync(process.env.VELCRO_CI_PRIOR, 'utf8')), { head, pr, base, run })
      : accepted(needs);
  } catch { /* fail closed */ }
  process.stdout.write(green ? 'ci-gate: all required jobs succeeded\n' : 'ci-gate: required evidence missing or unsuccessful\n');
  process.exitCode = green ? 0 : 1;
}
