import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDropdown as SlDropdown } from '@charm-ux/velcro/react/VelcroDropdown.js';
import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';

const App = () => {
  function handleCut() {
    console.log('cut');
  }

  function handleCopy() {
    console.log('copy');
  }

  function handlePaste() {
    console.log('paste');
  }

  return (
    <SlDropdown>
      <SlButton slot="trigger" caret>
        Edit
      </SlButton>
      <SlMenu>
        <SlMenuItem onClick={handleCut}>Cut</SlMenuItem>
        <SlMenuItem onClick={handleCopy}>Copy</SlMenuItem>
        <SlMenuItem onClick={handlePaste}>Paste</SlMenuItem>
      </SlMenu>
    </SlDropdown>
  );
};
