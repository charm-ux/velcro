import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';
import { VelcroDropdown as SlDropdown } from '@charm-ux/velcro/react/VelcroDropdown.js';
import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';
import { VelcroVisuallyHidden as SlVisuallyHidden } from '@charm-ux/velcro/react/VelcroVisuallyHidden.js';

const App = () => (
  <SlButtonGroup label="Example Button Group">
    <SlButton variant="primary">Save</SlButton>
    <SlDropdown placement="bottom-end">
      <SlButton slot="trigger" variant="primary" caret>
        <SlVisuallyHidden>More options</SlVisuallyHidden>
      </SlButton>
      <SlMenu>
        <SlMenuItem>Save</SlMenuItem>
        <SlMenuItem>Save as&hellip;</SlMenuItem>
        <SlMenuItem>Save all</SlMenuItem>
      </SlMenu>
    </SlDropdown>
  </SlButtonGroup>
);
