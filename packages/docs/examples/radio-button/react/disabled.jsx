import { VelcroRadioButton as SlRadioButton } from '@charm-ux/velcro/react/VelcroRadioButton.js';
import { VelcroRadioGroup as SlRadioGroup } from '@charm-ux/velcro/react/VelcroRadioGroup.js';

const App = () => (
  <SlRadioGroup label="Select an option" name="a" value="1">
    <SlRadioButton value="1">Option 1</SlRadioButton>
    <SlRadioButton value="2" disabled>
      Option 2
    </SlRadioButton>
    <SlRadioButton value="3">Option 3</SlRadioButton>
  </SlRadioGroup>
);
