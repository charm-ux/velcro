import { project } from '@charm-ux/core/dist/utilities/project.js';
import VelcroButton from './button.js';

export * from './button.js';

// Shoelace-compatible tag names: the core scope builds `${prefix}-${baseName}`.
project.updateProject({ prefix: 'sl' });
project.scope.registerComponent(VelcroButton);
