import { withBase } from './base.js';

export { examples } from './examples.generated.js';

/**
 * Wraps a checked-in, trusted example into a standalone document for an iframe (srcdoc). The same source string
 * is shown on the page and executed, and its script runs in its own document, so ordinary document-level queries
 * work instead of reaching into the docs page's shadow root. A srcdoc document resolves URLs against the parent
 * page, so the asset paths carry the build-time base path explicitly.
 */
export function exampleDocument(source: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="${withBase('/_litro/velcro.css')}">
<script type="module" src="${withBase('/_litro/velcro.js')}"></script>
<style>body{margin:1rem;font-family:var(--sl-font-sans, system-ui, sans-serif)}</style>
</head>
<body>
${source}
</body>
</html>`;
}
