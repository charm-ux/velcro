import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';

const App = () => (
  <>
    <SlButtonGroup label="Alignment">
      <SlButton size="small" pill>Left</SlButton>
      <SlButton size="small" pill>Center</SlButton>
      <SlButton size="small" pill>Right</SlButton>
    </SlButtonGroup>

    <br />
    <br />

    <SlButtonGroup label="Alignment">
      <SlButton size="medium" pill>Left</SlButton>
      <SlButton size="medium" pill>Center</SlButton>
      <SlButton size="medium" pill>Right</SlButton>
    </SlButtonGroup>

    <br />
    <br />

    <SlButtonGroup label="Alignment">
      <SlButton size="large" pill>Left</SlButton>
      <SlButton size="large" pill>Center</SlButton>
      <SlButton size="large" pill>Right</SlButton>
    </SlButtonGroup>
  </>
);
