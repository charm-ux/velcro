// This list is fixed rather than inferred from the jobs that happened to run.
export function accepted(needs) {
  return needs !== null && typeof needs === 'object' && !Array.isArray(needs)
    && Object.keys(needs).sort().join(',') === 'product,security,site,verify'
    && ['verify', 'product', 'site', 'security'].every(job => needs[job]?.result === 'success');
}

if (import.meta.main) {
  let green = false;
  try { green = accepted(JSON.parse(process.env.VELCRO_CI_NEEDS)); } catch { /* fail closed */ }
  process.stdout.write(green ? 'ci-gate: all required jobs succeeded\n' : 'ci-gate: required evidence missing or unsuccessful\n');
  process.exitCode = green ? 0 : 1;
}
