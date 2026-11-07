// Adapted from Shoelace v2.20.1 (src/components/icon/library.default.ts), Copyright (c) 2020 A Beautiful Site, LLC, MIT
// License. See THIRD_PARTY_NOTICES.md.
import { getBasePath } from '../../utilities/base-path.js';
import type { IconLibrary } from './library.js';

/** Bootstrap Icons, shipped by the package in `dist/assets/icons` and resolved against the base path. */
const library: IconLibrary = {
  name: 'default',
  resolver: name => getBasePath(`assets/icons/${name}.svg`),
};

export default library;
