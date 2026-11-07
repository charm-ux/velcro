// Local oracle for the CI `required` aggregate (the workflow carries its own inline copy; tests keep them equal).
import { readFileSync } from 'node:fs';

const JOBS = ['verify', 'product', 'site', 'security'];

// This list is fixed rather than inferred from the jobs that happened to run.
const named = needs => needs !== null && typeof needs === 'object' && !Array.isArray(needs)
  && Object.keys(needs).sort().join(',') === 'product,security,site,verify';

export function accepted(needs) {
  return named(needs) && JOBS.every(job => needs[job]?.result === 'success');
}

// A title or body edit skips the analysis jobs; the aggregate then repeats the latest completed `required` check run
// that GitHub Actions recorded for the same head in another run of the workflow. `listing` is the check-runs response
// for that head; an incomplete listing, a foreign app, another head or this run's own check run never counts.
export function priorResult(listing, head, runId) {
  const runs = listing?.check_runs;
  if (!Array.isArray(runs) || runs.length !== listing.total_count) return undefined;
  const own = `/actions/runs/${runId}/`;
  const at = run => Date.parse(run.completed_at);
  return runs
    .filter(run => run.name === 'required' && run.app?.slug === 'github-actions' && run.status === 'completed'
      && run.head_sha === head && typeof run.html_url === 'string' && !run.html_url.includes(own)
      && Number.isFinite(at(run)))
    .sort((a, b) => at(b) - at(a))[0]?.conclusion;
}

export function carried(needs, listing, head, runId) {
  return named(needs) && /^[0-9a-f]{40}$/.test(head ?? '') && /^[0-9]+$/.test(runId ?? '')
    && JOBS.every(job => needs[job]?.result === 'skipped') && priorResult(listing, head, runId) === 'success';
}

if (import.meta.main) {
  let green = false;
  try {
    const needs = JSON.parse(process.env.VELCRO_CI_NEEDS);
    green = process.env.VELCRO_CI_CARRY === 'true'
      ? carried(needs, JSON.parse(readFileSync(process.env.VELCRO_CI_PRIOR, 'utf8')), process.env.VELCRO_CI_HEAD, process.env.VELCRO_CI_RUN)
      : accepted(needs);
  } catch { /* fail closed */ }
  process.stdout.write(green ? 'ci-gate: all required jobs succeeded\n' : 'ci-gate: required evidence missing or unsuccessful\n');
  process.exitCode = green ? 0 : 1;
}
