import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDropdown as SlDropdown } from '@charm-ux/velcro/react/VelcroDropdown.js';
import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';

const App = () => {
  function handleSelect(event) {
    const selectedItem = event.detail.item;
    console.log(selectedItem.value);
  }

  return (
    <SlDropdown>
      <SlButton slot="trigger" caret>
        Edit
      </SlButton>
      <SlMenu onSlSelect={handleSelect}>
        <SlMenuItem value="cut">Cut</SlMenuItem>
        <SlMenuItem value="copy">Copy</SlMenuItem>
        <SlMenuItem value="paste">Paste</SlMenuItem>
      </SlMenu>
    </SlDropdown>
  );
};
