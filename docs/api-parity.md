# Shoelace API parity

Every documented Shoelace 2.20.1 attribute/property, method, event, slot, CSS part and CSS custom property of each
implemented component, compared with Velcro's Custom Elements Manifest (name, attribute name, type, default and
reflection, read-only; method signatures; event detail types where Shoelace declares one; CSS property defaults where
declared). Shoelace members count when its own docs would list them (described and not private). Type comparison
ignores only whitespace, quote style and union order. Missing and mismatched entries form the ledger
`docs/api/api-parity-ledger.json`, which may only shrink.

Each component's report is generated into its own file, `docs/api/parity/<name>.md`, by `pnpm sync`
(`scripts/api/parity.mjs`), from the component sources and the Shoelace manifest subset
`docs/api/shoelace-2.20.1.custom-elements.json`; a test fails when one is stale. The reports list each component's
missing and mismatched entries, its Velcro-only API and the extras it inherits from `@charm-ux/core`.
`node scripts/api/parity.mjs summary` prints the totals and the per-component counts; they are not committed, so adding
a component never edits a shared report.
