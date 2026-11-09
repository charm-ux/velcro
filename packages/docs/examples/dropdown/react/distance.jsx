import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDivider as SlDivider } from '@charm-ux/velcro/react/VelcroDivider.js';
import { VelcroDropdown as SlDropdown } from '@charm-ux/velcro/react/VelcroDropdown.js';
import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';

const App = () => (
  <SlDropdown distance={30}>
    <SlButton slot="trigger" caret>
      Edit
    </SlButton>
    <SlMenu>
      <SlMenuItem>Cut</SlMenuItem>
      <SlMenuItem>Copy</SlMenuItem>
      <SlMenuItem>Paste</SlMenuItem>
      <SlDivider />
      <SlMenuItem>Find</SlMenuItem>
      <SlMenuItem>Replace</SlMenuItem>
    </SlMenu>
  </SlDropdown>
);
