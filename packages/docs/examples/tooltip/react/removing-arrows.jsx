import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroTooltip as SlTooltip } from '@charm-ux/velcro/react/VelcroTooltip.js';

const App = () => (
  <div style={{ '--sl-tooltip-arrow-size': '0' }}>
    <SlTooltip content="This is a tooltip">
      <SlButton>Above</SlButton>
    </SlTooltip>

    <SlTooltip content="This is a tooltip" placement="bottom">
      <SlButton>Below</SlButton>
    </SlTooltip>
  </div>
);
