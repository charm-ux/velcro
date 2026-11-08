import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';

const App = () => (
  <>
    <SlButtonGroup label="Alignment">
      <SlButton variant="primary">Left</SlButton>
      <SlButton variant="primary">Center</SlButton>
      <SlButton variant="primary">Right</SlButton>
    </SlButtonGroup>

    <br />
    <br />

    <SlButtonGroup label="Alignment">
      <SlButton variant="success">Left</SlButton>
      <SlButton variant="success">Center</SlButton>
      <SlButton variant="success">Right</SlButton>
    </SlButtonGroup>

    <br />
    <br />

    <SlButtonGroup label="Alignment">
      <SlButton variant="neutral">Left</SlButton>
      <SlButton variant="neutral">Center</SlButton>
      <SlButton variant="neutral">Right</SlButton>
    </SlButtonGroup>

    <br />
    <br />

    <SlButtonGroup label="Alignment">
      <SlButton variant="warning">Left</SlButton>
      <SlButton variant="warning">Center</SlButton>
      <SlButton variant="warning">Right</SlButton>
    </SlButtonGroup>

    <br />
    <br />

    <SlButtonGroup label="Alignment">
      <SlButton variant="danger">Left</SlButton>
      <SlButton variant="danger">Center</SlButton>
      <SlButton variant="danger">Right</SlButton>
    </SlButtonGroup>
  </>
);
