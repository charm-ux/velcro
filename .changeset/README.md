# Changesets

Record user-facing changes with `pnpm changeset` (minor for features, patch for
fixes, major for breaking changes). Check pending intent with
`pnpm changeset:status`.

`pnpm changeset:version` consumes pending changesets, bumps versions and writes
changelog entries. It does not commit, tag or publish. Packages are currently
private, so nothing is released from this repository.
