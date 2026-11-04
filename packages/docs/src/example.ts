export { examples } from './examples.generated.js';

/**
 * Wraps a checked-in, trusted example into a standalone document for an iframe (srcdoc). The same source string
 * is shown on the page and executed, and its script runs in its own document, so ordinary document-level queries
 * work instead of reaching into the docs page's shadow root.
 */
export function exampleDocument(source: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="/_litro/velcro.css">
<script type="module" src="/_litro/velcro.js"></script>
<style>body{margin:1rem;font-family:var(--sl-font-sans, system-ui, sans-serif)}</style>
</head>
<body>
${source}
</body>
</html>`;
}
