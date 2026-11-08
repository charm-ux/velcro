import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroTooltip as SlTooltip } from '@charm-ux/velcro/react/VelcroTooltip.js';

const App = () => (
  <SlTooltip style={{ '--max-width': '80px' }} content="This tooltip will wrap after only 80 pixels.">
    <SlButton>Hover Me</SlButton>
  </SlTooltip>
);
