import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';

// <span title> stands in for <sl-tooltip>, which Velcro does not implement yet: the browser's own tooltip shows.
const App = () => (
  <SlButtonGroup label="Alignment">
    <span title="I'm on the left">
      <SlButton>Left</SlButton>
    </span>

    <span title="I'm in the middle">
      <SlButton>Center</SlButton>
    </span>

    <span title="I'm on the right">
      <SlButton>Right</SlButton>
    </span>
  </SlButtonGroup>
);
