// The public localization surface, mirroring Shoelace v2.20.1's src/utilities/localize.ts (Copyright (c) 2020 A Beautiful
// Site, LLC, MIT License; the `Translation` term list and the English registration are taken from it). See
// THIRD_PARTY_NOTICES.md. The registry and controller underneath are Velcro's own (`../internal/localize.ts`).
// The registry module must be imported before the English translation: that translation calls `registerTranslation` while
// this module is still being evaluated.
import { LocalizeController as DefaultLocalizationController, registerTranslation } from '../internal/localize.js';
import en from '../translations/en.js'; // Register English as the default/fallback language
import type { Translation as DefaultTranslation } from '../internal/localize.js';

/** The controller every Velcro component uses, typed with Shoelace's term list. English is registered before any use. */
export class LocalizeController extends DefaultLocalizationController<Translation> {
  // As in Shoelace: the English import above registers itself by side effect, and this makes sure it is registered (as
  // the fallback) before a component's controller resolves a term, whatever the bundler did with the import.
  static {
    registerTranslation(en);
  }
}

// Shoelace's one central import for registering translations.
export { registerTranslation } from '../internal/localize.js';

/** Shoelace's translation terms. A translation file must provide all of them. */
export interface Translation extends DefaultTranslation {
  $code: string; // e.g. en, en-GB
  $name: string; // e.g. English, Español
  $dir: 'ltr' | 'rtl';

  carousel: string;
  clearEntry: string;
  close: string;
  copied: string;
  copy: string;
  currentValue: string;
  error: string;
  goToSlide: (slide: number, count: number) => string;
  hidePassword: string;
  loading: string;
  nextSlide: string;
  numOptionsSelected: (num: number) => string;
  previousSlide: string;
  progress: string;
  remove: string;
  resize: string;
  scrollToEnd: string;
  scrollToStart: string;
  selectAColorFromTheScreen: string;
  showPassword: string;
  slideNum: (slide: number) => string;
  toggleColorFormat: string;
}
