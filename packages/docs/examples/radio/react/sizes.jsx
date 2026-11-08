import { VelcroRadio as SlRadio } from '@charm-ux/velcro/react/VelcroRadio.js';
import { VelcroRadioGroup as SlRadioGroup } from '@charm-ux/velcro/react/VelcroRadioGroup.js';

const App = () => (
  <>
    <SlRadioGroup size="small" value="1">
      <SlRadio value="1">Small 1</SlRadio>
      <SlRadio value="2">Small 2</SlRadio>
      <SlRadio value="3">Small 3</SlRadio>
    </SlRadioGroup>

    <br />

    <SlRadioGroup size="medium" value="1">
      <SlRadio value="1">Medium 1</SlRadio>
      <SlRadio value="2">Medium 2</SlRadio>
      <SlRadio value="3">Medium 3</SlRadio>
    </SlRadioGroup>

    <br />

    <SlRadioGroup size="large" value="1">
      <SlRadio value="1">Large 1</SlRadio>
      <SlRadio value="2">Large 2</SlRadio>
      <SlRadio value="3">Large 3</SlRadio>
    </SlRadioGroup>
  </>
);
