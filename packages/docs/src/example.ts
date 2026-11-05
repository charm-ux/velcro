import { withBase } from './base.js';

export { examples } from './examples.generated.js';

/**
 * Mirrors the docs page's theme class (sl-theme-dark / sl-theme-light) onto the example document, now and whenever the
 * reader changes it. A srcdoc document is same-origin with its parent, so it can observe the parent's root element.
 * In dark mode the example surface and text come from the component theme tokens (--sl-color-neutral-0/-900), so
 * text and component panels (card, ...) always pair: light while only the light tokens exist, dark once a dark theme
 * redefines them under .sl-theme-dark.
 */
const FOLLOW_PARENT_THEME =
  '(function(){var d=document.documentElement;function s(){try{var c=parent.document.documentElement.classList,k=c.contains("sl-theme-dark");' +
  'd.classList.toggle("sl-theme-dark",k);d.classList.toggle("sl-theme-light",!k)}catch(e){}}s();' +
  'try{new MutationObserver(s).observe(parent.document.documentElement,{attributes:true,attributeFilter:["class"]})}catch(e){}})();';

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
<style>body{margin:1rem;font-family:var(--sl-font-sans, system-ui, sans-serif)}:root.sl-theme-dark body{background:var(--sl-color-neutral-0);color:var(--sl-color-neutral-900)}</style>
<script>${FOLLOW_PARENT_THEME}</script>
</head>
<body>
${source}
</body>
</html>`;
}
