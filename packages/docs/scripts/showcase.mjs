// Every catalog component must have exactly one showcase snippet that uses its tag; a missing or stray one fails the build.
export function showcaseProblems(names, files, read) {
  const problems = [];
  for (const { name, tag } of names) {
    if (!files.includes(`${name}.html`)) problems.push(`${name}: missing showcase/${name}.html`);
    else if (!new RegExp(`<${tag}[\\s>/]`).test(read(`${name}.html`))) problems.push(`${name}: showcase does not use <${tag}>`);
  }
  for (const f of files) if (!names.some(c => `${c.name}.html` === f)) problems.push(`${f}: showcase file has no catalog entry`);
  return problems;
}
