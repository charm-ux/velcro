import { useState } from 'react';
import { VelcroRadio as SlRadio } from '@charm-ux/velcro/react/VelcroRadio.js';
import { VelcroRadioGroup as SlRadioGroup } from '@charm-ux/velcro/react/VelcroRadioGroup.js';

const App = () => {
  const [size, setSize] = useState('medium');

  return (
    <>
      <SlRadioGroup
        label="Select an option"
        size={size}
        value={size}
        class="radio-group-size"
        onSlChange={event => setSize(event.target.value)}
      >
        <SlRadio value="small">Small</SlRadio>
        <SlRadio value="medium">Medium</SlRadio>
        <SlRadio value="large">Large</SlRadio>
      </SlRadioGroup>
    </>
  );
};
