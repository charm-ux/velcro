import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';
import { VelcroVisuallyHidden as SlVisuallyHidden } from '@charm-ux/velcro/react/VelcroVisuallyHidden.js';

// <span> stands in for <sl-dropdown>, which Velcro does not implement yet. There is no menu.
const App = () => (
  <SlButtonGroup label="Example Button Group">
    <SlButton variant="primary">Save</SlButton>
    <span>
      <SlButton variant="primary" caret>
        <SlVisuallyHidden>More options</SlVisuallyHidden>
      </SlButton>
    </span>
  </SlButtonGroup>
);
