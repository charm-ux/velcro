import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroTooltip as SlTooltip } from '@charm-ux/velcro/react/VelcroTooltip.js';

const App = () => (
  <SlTooltip content="Click again to dismiss" trigger="click">
    <SlButton>Click to Toggle</SlButton>
  </SlTooltip>
);
