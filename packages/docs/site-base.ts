/**
 * The single build-time base-path input for the docs site.
 *
 * Litro's own `LITRO_BASE_PATH` variable is the input: the framework already reads it to build the `<script>` URL
 * of the app bundle, so reusing it keeps one source of truth. Unset or empty means the site is served from the
 * root. A project site uses a value such as `/velcro` (leading slash, no trailing slash). Anything else is
 * rejected before any build step runs, because Litro reads the raw variable without validating it.
 */
// `(?![\s\S])` is an explicit end-of-input check: no trailing character of any kind (line terminators included)
// may follow the segment, independent of how a given engine treats `$`.
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._~-]*(?![\s\S])/;

export function parseSiteBase(raw: string | undefined): string {
  if (raw === undefined || raw === '') return '';
  const segments = raw.split('/');
  const valid =
    raw.startsWith('/') && !raw.endsWith('/') && segments.slice(1).every(s => SEGMENT.test(s) && s !== '.' && s !== '..');
  if (!valid) {
    throw new Error('LITRO_BASE_PATH must be empty or a path such as /velcro: leading slash, no trailing slash, plain segments only.');
  }
  return raw;
}

export const siteBase = parseSiteBase(process.env.LITRO_BASE_PATH);
