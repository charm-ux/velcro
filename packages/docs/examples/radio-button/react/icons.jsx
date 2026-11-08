import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';
import { VelcroRadioButton as SlRadioButton } from '@charm-ux/velcro/react/VelcroRadioButton.js';
import { VelcroRadioGroup as SlRadioGroup } from '@charm-ux/velcro/react/VelcroRadioGroup.js';

const App = () => (
  <SlRadioGroup label="Select an option" name="a" value="neutral">
    <SlRadioButton value="angry">
      <SlIcon name="emoji-angry" label="Angry" />
    </SlRadioButton>

    <SlRadioButton value="sad">
      <SlIcon name="emoji-frown" label="Sad" />
    </SlRadioButton>

    <SlRadioButton value="neutral">
      <SlIcon name="emoji-neutral" label="Neutral" />
    </SlRadioButton>

    <SlRadioButton value="happy">
      <SlIcon name="emoji-smile" label="Happy" />
    </SlRadioButton>

    <SlRadioButton value="laughing">
      <SlIcon name="emoji-laughing" label="Laughing" />
    </SlRadioButton>
  </SlRadioGroup>
);
