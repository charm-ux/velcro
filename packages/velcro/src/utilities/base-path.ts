// The base path contract (setBasePath, getBasePath with an optional subpath, the `data-shoelace` script attribute and the
// returned format without a trailing slash) is adapted from Shoelace v2.20.1 (src/utilities/base-path.ts), Copyright (c)
// 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
let basePath = '';

/** Sets the library's base path to the specified directory. An empty string restores automatic detection. */
export function setBasePath(path: string) {
  basePath = path;
}

// Velcro's own fallback: the package's `dist` directory, which holds `assets/icons`. Resolved from this module's URL
// (dist/utilities/base-path.js), so it works wherever the package is served from without configuration. The relative
// path is held in a variable so that bundlers do not treat it as an asset import.
const PACKAGE_DIST = '..';

/**
 * Gets the library's base path.
 *
 * The base path is used to load assets such as icons. As in Shoelace, the `data-shoelace` attribute on any script on
 * the page wins: its value can be a local folder or a CORS-enabled endpoint.
 *
 *   <script type="module" src="bundle.js" data-shoelace="/custom/base/path"></script>
 *
 * Without it, Velcro uses the directory its own modules are served from (the package's `dist`, which ships
 * `assets/icons`). Shoelace instead looks for a script named shoelace.js or shoelace-autoloader.js and otherwise uses
 * the site root. Set the base path manually with `setBasePath()`.
 *
 * @param subpath - An optional path to append to the base path.
 */
export function getBasePath(subpath = '') {
  if (!basePath) {
    const configScript = [...document.getElementsByTagName('script')].find(script => script.hasAttribute('data-shoelace'));
    setBasePath(configScript ? configScript.getAttribute('data-shoelace')! : new URL(PACKAGE_DIST, import.meta.url).href);
  }

  // Return the base path without a trailing slash. If one exists, append the subpath separated by a slash.
  return basePath.replace(/\/$/, '') + (subpath ? `/${subpath.replace(/^\//, '')}` : ``);
}
