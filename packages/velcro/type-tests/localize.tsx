// Type-level check of the localization module's API, as Shoelace 2.20.1 types it (src/utilities/localize.ts with
// @shoelace-style/localize). Compiled (never run) by `tsc -p tsconfig.react.json` as the last step of the library build.
import type { LocalizeController, Translation } from '../dist/utilities/localize.js';
import type { registerTranslation } from '../dist/utilities/localize.js';
import type de from '../dist/translations/de.js';

declare const register: typeof registerTranslation;
declare const controller: LocalizeController;
declare const german: typeof de;

// A vendored translation is a full Translation, and several register at once.
const full: Translation = german;
register(full, german);

// A partial translation (a code, a name, a direction and only some terms) can be registered, as upstream. As upstream,
// the parameter type lists no terms, so a partial translation is declared first rather than passed as a literal.
const partial = { $code: 'xx', $name: 'Example', $dir: 'ltr' as const, loading: 'example' };
register(partial);

// Terms are typed by Shoelace's term list: plain terms take no arguments, function terms take theirs.
const loading: string = controller.term('loading');
const slide: string = controller.term('goToSlide', 1, 3);
const has: boolean = controller.exists('progress', { lang: 'de', includeFallback: true });
const lang: string = controller.lang();
const dir: string = controller.dir();
void [loading, slide, has, lang, dir];

// @ts-expect-error not a Shoelace term
controller.term('notATerm');

// @ts-expect-error goToSlide takes two numbers
controller.term('goToSlide', 'one', 'two');

// @ts-expect-error a translation needs a code, a name and a direction
register({ loading: 'example' });
