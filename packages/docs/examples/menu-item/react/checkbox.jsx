import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';

const App = () => (
  <SlMenu style={{ maxWidth: '200px' }}>
    <SlMenuItem type="checkbox">Autosave</SlMenuItem>
    <SlMenuItem type="checkbox" checked>
      Check Spelling
    </SlMenuItem>
    <SlMenuItem type="checkbox">Word Wrap</SlMenuItem>
  </SlMenu>
);
