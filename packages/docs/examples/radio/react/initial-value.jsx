import { VelcroRadio as SlRadio } from '@charm-ux/velcro/react/VelcroRadio.js';
import { VelcroRadioGroup as SlRadioGroup } from '@charm-ux/velcro/react/VelcroRadioGroup.js';

const App = () => (
  <SlRadioGroup label="Select an option" name="a" value="3">
    <SlRadio value="1">Option 1</SlRadio>
    <SlRadio value="2">Option 2</SlRadio>
    <SlRadio value="3">Option 3</SlRadio>
  </SlRadioGroup>
);
