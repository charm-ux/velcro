import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDivider as SlDivider } from '@charm-ux/velcro/react/VelcroDivider.js';
import { VelcroDropdown as SlDropdown } from '@charm-ux/velcro/react/VelcroDropdown.js';
import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';

const css = `
  .dropdown-hoist {
    position: relative;
    border: solid 2px var(--sl-panel-border-color);
    padding: var(--sl-spacing-medium);
    overflow: hidden;
  }
`;

const App = () => (
  <>
    <div className="dropdown-hoist">
      <SlDropdown>
        <SlButton slot="trigger" caret>
          No Hoist
        </SlButton>
        <SlMenu>
          <SlMenuItem>Item 1</SlMenuItem>
          <SlMenuItem>Item 2</SlMenuItem>
          <SlMenuItem>Item 3</SlMenuItem>
        </SlMenu>
      </SlDropdown>

      <SlDropdown hoist>
        <SlButton slot="trigger" caret>
          Hoist
        </SlButton>
        <SlMenu>
          <SlMenuItem>Item 1</SlMenuItem>
          <SlMenuItem>Item 2</SlMenuItem>
          <SlMenuItem>Item 3</SlMenuItem>
        </SlMenu>
      </SlDropdown>
    </div>

    <style>{css}</style>
  </>
);
