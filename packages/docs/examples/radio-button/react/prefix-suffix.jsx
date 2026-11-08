import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';
import { VelcroRadioButton as SlRadioButton } from '@charm-ux/velcro/react/VelcroRadioButton.js';
import { VelcroRadioGroup as SlRadioGroup } from '@charm-ux/velcro/react/VelcroRadioGroup.js';

const App = () => (
  <SlRadioGroup label="Select an option" name="a" value="1">
    <SlRadioButton value="1">
      <SlIcon slot="prefix" name="archive" />
      Option 1
    </SlRadioButton>

    <SlRadioButton value="2">
      <SlIcon slot="suffix" name="bag" />
      Option 2
    </SlRadioButton>

    <SlRadioButton value="3">
      <SlIcon slot="prefix" name="gift" />
      <SlIcon slot="suffix" name="cart" />
      Option 3
    </SlRadioButton>
  </SlRadioGroup>
);
