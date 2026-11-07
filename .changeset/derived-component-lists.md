---
'@charm-ux/velcro': patch
---

Derive every per-component list from the component catalog so parallel component branches no longer edit shared files. The package root (`src/index.ts`), the Custom Elements Manifest and the package's `THIRD_PARTY_NOTICES.md` are now build output (not committed): the barrel registers every catalog component, the manifest is analyzed at build time as before, and the notices are the repository's notices plus each component's `NOTICE.md` entry. The package export map is unchanged in content; it is written by `pnpm sync`, one entry per line, and its description no longer lists components. Components declare the inherited core events they never emit (`@inheritedEventDropped`) and inherited entries they keep (`@inheritedKept`) on their own class instead of in a shared table; the manifest output is unchanged.
