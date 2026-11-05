/**
 * Base-path helpers shared by the server render and the browser bundle, so both produce identical markup.
 *
 * `__SITE_BASE__` is substituted at build time (vite `define` for the browser bundle, nitro `replace` for the
 * server bundle) from the one validated input in site-base.ts. It is '' (root) or '/segment[/segment...]'.
 * The fallback only applies where no build substitution exists (typecheck, dev server).
 */
declare const __SITE_BASE__: string | undefined;

export const siteBase: string = typeof __SITE_BASE__ === 'string' ? __SITE_BASE__ : '';

/** Prefixes a root-absolute site path ('/components/button') with the base path. */
export function withBase(path: string): string {
  return path === '/' ? `${siteBase}/` : `${siteBase}${path}`;
}

/**
 * Route path as the client router matches it against location.pathname. Litro's router strips a trailing slash and
 * has no base-path option, so the home route '/' must become the bare base ('/velcro') under a prefix.
 */
export function routePath(path: string): string {
  return path === '/' ? siteBase || '/' : `${siteBase}${path}`;
}
