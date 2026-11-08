import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';

const App = () => (
  <>
    <SlButtonGroup label="Alignment">
      <SlButton size="small">Left</SlButton>
      <SlButton size="small">Center</SlButton>
      <SlButton size="small">Right</SlButton>
    </SlButtonGroup>

    <br />
    <br />

    <SlButtonGroup label="Alignment">
      <SlButton size="medium">Left</SlButton>
      <SlButton size="medium">Center</SlButton>
      <SlButton size="medium">Right</SlButton>
    </SlButtonGroup>

    <br />
    <br />

    <SlButtonGroup label="Alignment">
      <SlButton size="large">Left</SlButton>
      <SlButton size="large">Center</SlButton>
      <SlButton size="large">Right</SlButton>
    </SlButtonGroup>
  </>
);
