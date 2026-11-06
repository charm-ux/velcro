// Adapted from Shoelace v2.20.1 (src/components/include/request.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT
// License. See THIRD_PARTY_NOTICES.md. The behavior is Shoelace's, including its quirks (each one is marked "Upstream
// quirk" below and listed on the docs page). Shoelace publishes this module at dist/components/include/request.js;
// Velcro publishes it at the `@charm-ux/velcro/include/request` entry point.

/** The outcome of an include request: the response's `ok` and `status`, and its body as text. */
export interface IncludeFile {
  ok: boolean;
  status: number;
  html: string;
}

// Upstream quirk: the cache is keyed by `src` alone and is never cleared. A failed response (404, 500, ...) and a
// network failure (the cached promise stays rejected) are cached as well, so a `src` that failed once keeps failing
// until the page is reloaded, and a later request with a different `mode` gets the first request's result.
const includeFiles = new Map<string, IncludeFile | Promise<IncludeFile>>();

/** Fetches an include file from a remote source. Caching is enabled so the origin is only pinged once. */
export function requestInclude(src: string, mode: 'cors' | 'no-cors' | 'same-origin' = 'cors'): Promise<IncludeFile> {
  const prev = includeFiles.get(src);
  if (prev !== undefined) {
    // Promise.resolve() transparently unboxes prev if it was a promise.
    return Promise.resolve(prev);
  }
  const fileDataPromise = fetch(src, { mode: mode }).then(async response => {
    const res = {
      ok: response.ok,
      status: response.status,
      html: await response.text(),
    };
    // Replace the cached promise with its result to avoid having buggy browser Promises retain memory (Shoelace #1284 and #1249).
    includeFiles.set(src, res);
    return res;
  });
  // Cache the promise to only fetch() once per src
  includeFiles.set(src, fileDataPromise);
  return fileDataPromise;
}
