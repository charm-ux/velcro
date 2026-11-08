import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';

// <span> stands in for <sl-dropdown>, which Velcro does not implement yet. There is no menu.
const App = () => (
  <SlButtonGroup label="Example Button Group">
    <SlButton>Button</SlButton>
    <SlButton>Button</SlButton>
    <span>
      <SlButton caret>Dropdown</SlButton>
    </span>
  </SlButtonGroup>
);
