import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';
import { VelcroTooltip as SlTooltip } from '@charm-ux/velcro/react/VelcroTooltip.js';

const App = () => (
  <SlButtonGroup label="Alignment">
    <SlTooltip content="I'm on the left">
      <SlButton>Left</SlButton>
    </SlTooltip>

    <SlTooltip content="I'm in the middle">
      <SlButton>Center</SlButton>
    </SlTooltip>

    <SlTooltip content="I'm on the right">
      <SlButton>Right</SlButton>
    </SlTooltip>
  </SlButtonGroup>
);
