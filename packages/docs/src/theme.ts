/*
 * Head script adapted from @beatzball/create-litro (Litro, Copyright 2026 beatzball, Apache License 2.0), Starlight
 * recipe `recipes/starlight/template/src/route-meta.ts`. See THIRD_PARTY_NOTICES.md.
 * Changes: three-way light/dark/system preference with an in-memory choice that wins after a failed storage write, the sl-theme-dark/sl-theme-light class
 * instead of data-theme, a storage listener and a small API for the header control; the palette is Velcro's own.
 */
/**
 * Site theme: the docs palette and the head script that applies the reader's light / dark / system choice.
 *
 * The palette lives in docs-scoped `--velcro-docs-*` custom properties on the document root, so it reaches every page's
 * shadow root by inheritance and never overrides Velcro's own `--sl-*` component tokens. The dark palette applies when
 * the root carries `sl-theme-dark` (the class Velcro's dark theme keys on) and, before any script runs or with
 * scripting off, when the system prefers dark and no explicit class is set.
 *
 * The head script is the one place the theme is decided. It runs synchronously in <head>, before the first paint, so
 * there is no flash of the wrong theme. Storage may be unavailable (site data blocked); every access is guarded and the
 * choice then holds for the current page only. A reader who has chosen "system" keeps following system changes.
 */
export const THEME_STORAGE_KEY = 'velcro-docs-theme';
export type ThemePreference = 'light' | 'dark' | 'system';

const light = {
  bg: '#ffffff',
  'bg-soft': '#f8fafc',
  surface: '#f4f4f5',
  border: '#e4e4e7',
  text: '#18181b',
  'text-dim': '#52525b',
  accent: '#0369a1',
  'accent-low': '#e0f2fe',
  'accent-text': '#0369a1',
  'banner-bg': '#fef3c7',
  'banner-text': '#78350f',
  'code-bg': '#f4f4f5',
  wash: 'radial-gradient(60rem 24rem at 15% -10%, #bae6fd 0%, transparent 60%), radial-gradient(40rem 20rem at 95% 0%, #ddd6fe 0%, transparent 60%)',
};

const dark: typeof light = {
  bg: '#121214',
  'bg-soft': '#18181b',
  surface: '#1f1f23',
  border: '#33333a',
  text: '#f4f4f5',
  'text-dim': '#a1a1aa',
  accent: '#38bdf8',
  'accent-low': '#0c4a6e',
  'accent-text': '#7dd3fc',
  'banner-bg': '#422006',
  'banner-text': '#fde68a',
  'code-bg': '#1f1f23',
  wash: 'radial-gradient(60rem 24rem at 15% -10%, #0c4a6e 0%, transparent 60%), radial-gradient(40rem 20rem at 95% 0%, #3b0764 0%, transparent 60%)',
};

/** Dark palette values, exported for tests that assert the rendered colors. */
export const darkPalette = dark;
export const lightPalette = light;

const vars = (p: typeof light) =>
  Object.entries(p)
    .map(([k, v]) => `--velcro-docs-${k}:${v};`)
    .join('');

const style = [
  `:root{color-scheme:light;${vars(light)}}`,
  `:root.sl-theme-dark{color-scheme:dark;${vars(dark)}}`,
  `@media (prefers-color-scheme: dark){:root:not(.sl-theme-light):not(.sl-theme-dark){color-scheme:dark;${vars(dark)}}}`,
  'html,body{margin:0;background:var(--velcro-docs-bg);color:var(--velcro-docs-text)}',
].join('');

const script = [
  '(function(){',
  `var K=${JSON.stringify(THEME_STORAGE_KEY)},d=document.documentElement,mem=null,`,
  'm=window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;',
  'function ok(v){return v==="light"||v==="dark"||v==="system"}',
  // mem holds a choice whose storage write failed; it is authoritative for this page until another tab writes one.
  'function g(){if(mem)return mem;try{var v=localStorage.getItem(K);if(ok(v))return v}catch(e){}return"system"}',
  'function a(){var p=g(),k=p==="dark"||(p==="system"&&!!m&&m.matches);',
  'd.classList.toggle("sl-theme-dark",k);d.classList.toggle("sl-theme-light",!k);d.setAttribute("data-theme-preference",p);',
  // Announces every (re)application so controls can show the authoritative preference (e.g. after another tab's change).
  'try{window.dispatchEvent(new CustomEvent("velcro-docs-theme-change",{detail:p}))}catch(e){}}',
  'a();',
  // The header control is useless without this script, so it is shown only once the script has run.
  'd.style.setProperty("--velcro-docs-theme-control","inline-block");',
  'if(m){if(m.addEventListener)m.addEventListener("change",a);else if(m.addListener)m.addListener(a)}',
  'window.addEventListener("storage",function(e){if(e.key===K||e.key===null){mem=null;a()}});',
  'window.__velcroDocsTheme={get:g,set:function(p){if(!ok(p))return;',
  'try{if(p==="system")localStorage.removeItem(K);else localStorage.setItem(K,p);mem=null}catch(e){mem=p}a()}};',
  '})();',
].join('');

/** Markup for every page's <head>: the palette, then the synchronous theme script. */
export const themeHead = `<style id="velcro-docs-palette">${style}</style><script id="velcro-docs-theme">${script}</script>`;

interface ThemeApi {
  get(): ThemePreference;
  set(preference: ThemePreference): void;
}

const api = (): ThemeApi | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { __velcroDocsTheme?: ThemeApi }).__velcroDocsTheme;

/** The stored preference in the browser; 'system' on the server (the prerendered toggle shows the default). */
export const themePreference = (): ThemePreference => api()?.get() ?? 'system';

/** Event dispatched on window by the head script whenever it applies a preference; `detail` is the preference. */
export const THEME_CHANGE_EVENT = 'velcro-docs-theme-change';

export function setThemePreference(preference: ThemePreference): void {
  api()?.set(preference);
}
