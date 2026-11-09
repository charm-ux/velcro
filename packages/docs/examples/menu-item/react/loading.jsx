import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';

const App = () => (
  <SlMenu style={{ maxWidth: '200px' }}>
    <SlMenuItem>Option 1</SlMenuItem>
    <SlMenuItem loading>Option 2</SlMenuItem>
    <SlMenuItem>Option 3</SlMenuItem>
  </SlMenu>
);
