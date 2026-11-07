// The icon library registry (registerIconLibrary / unregisterIconLibrary, the default and system libraries, and the
// redraw of watched icons when a library is registered) is adapted from Shoelace v2.20.1
// (src/components/icon/library.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT License. See THIRD_PARTY_NOTICES.md.
import defaultLibrary from './library.default.js';
import systemLibrary from './library.system.js';

export type IconLibraryResolver = (name: string) => string;
export type IconLibraryMutator = (svg: SVGElement) => void;
export interface IconLibrary {
  name: string;
  resolver: IconLibraryResolver;
  mutator?: IconLibraryMutator;
  spriteSheet?: boolean;
}

/** The part of an icon element the registry needs: its library name and a way to redraw it. */
export interface WatchedIcon {
  library: string;
  setIcon(): unknown;
}

let registry: IconLibrary[] = [defaultLibrary, systemLibrary];
let watchedIcons: WatchedIcon[] = [];

/** Adds an icon to the list of watched icons. */
export function watchIcon(icon: WatchedIcon) {
  watchedIcons.push(icon);
}

/** Removes an icon from the list of watched icons. */
export function unwatchIcon(icon: WatchedIcon) {
  watchedIcons = watchedIcons.filter(el => el !== icon);
}

/** Returns a library from the registry. */
export function getIconLibrary(name?: string) {
  return registry.find(lib => lib.name === name);
}

/** Adds an icon library to the registry, or overrides an existing one. Icons that use it are redrawn. */
export function registerIconLibrary(name: string, options: Omit<IconLibrary, 'name'>) {
  unregisterIconLibrary(name);
  registry.push({
    name,
    resolver: options.resolver,
    mutator: options.mutator,
    spriteSheet: options.spriteSheet,
  });

  // Redraw watched icons
  watchedIcons.forEach(icon => {
    if (icon.library === name) {
      icon.setIcon();
    }
  });
}

/** Removes an icon library from the registry. Icons already drawn keep their current SVG. */
export function unregisterIconLibrary(name: string) {
  registry = registry.filter(lib => lib.name !== name);
}
