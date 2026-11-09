import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';
import { VelcroDropdown as SlDropdown } from '@charm-ux/velcro/react/VelcroDropdown.js';
import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';

const App = () => (
  <SlButtonGroup label="Example Button Group">
    <SlButton>Button</SlButton>
    <SlButton>Button</SlButton>
    <SlDropdown>
      <SlButton slot="trigger" caret>
        Dropdown
      </SlButton>
      <SlMenu>
        <SlMenuItem>Item 1</SlMenuItem>
        <SlMenuItem>Item 2</SlMenuItem>
        <SlMenuItem>Item 3</SlMenuItem>
      </SlMenu>
    </SlDropdown>
  </SlButtonGroup>
);
