import { project } from '@charm-ux/core/dist/utilities/project.js';
import VelcroSpinner from './spinner.js';

export * from './spinner.js';

// Shoelace-compatible tag names: the core scope builds `${prefix}-${baseName}`.
project.updateProject({ prefix: 'sl' });
project.scope.registerComponent(VelcroSpinner);
