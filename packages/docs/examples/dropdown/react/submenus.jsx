import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDivider as SlDivider } from '@charm-ux/velcro/react/VelcroDivider.js';
import { VelcroDropdown as SlDropdown } from '@charm-ux/velcro/react/VelcroDropdown.js';
import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';

const css = `
  .dropdown-hoist {
    border: solid 2px var(--sl-panel-border-color);
    padding: var(--sl-spacing-medium);
    overflow: hidden;
  }
`;

const App = () => (
  <>
    <SlDropdown>
      <SlButton slot="trigger" caret>Edit</SlButton>

      <SlMenu style={{ maxWidth: '200px' }}>
        <SlMenuItem value="undo">Undo</SlMenuItem>
        <SlMenuItem value="redo">Redo</SlMenuItem>
        <SlDivider />
        <SlMenuItem value="cut">Cut</SlMenuItem>
        <SlMenuItem value="copy">Copy</SlMenuItem>
        <SlMenuItem value="paste">Paste</SlMenuItem>
        <SlDivider />
        <SlMenuItem>
          Find
          <SlMenu slot="submenu">
            <SlMenuItem value="find">Find…</SlMenuItem>
            <SlMenuItem value="find-previous">Find Next</SlMenuItem>
            <SlMenuItem value="find-next">Find Previous</SlMenuItem>
          </SlMenu>
        </SlMenuItem>
        <SlMenuItem>
          Transformations
          <SlMenu slot="submenu">
            <SlMenuItem value="uppercase">Make uppercase</SlMenuItem>
            <SlMenuItem value="lowercase">Make lowercase</SlMenuItem>
            <SlMenuItem value="capitalize">Capitalize</SlMenuItem>
          </SlMenu>
        </SlMenuItem>
      </SlMenu>
    </SlDropdown>
  </>
);
