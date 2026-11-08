import { useEffect, useRef } from 'react';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';
import { VelcroRadio as SlRadio } from '@charm-ux/velcro/react/VelcroRadio.js';
import { VelcroRadioGroup as SlRadioGroup } from '@charm-ux/velcro/react/VelcroRadioGroup.js';
const App = () => {
  const radioGroup = useRef(null);
  const errorMessage = 'You must choose this option';

  function handleChange() {
    radioGroup.current.setCustomValidity(radioGroup.current.value === '3' ? '' : errorMessage);
  }

  function handleSubmit(event) {
    event.preventDefault();
    alert('All fields are valid!');
  }

  useEffect(() => {
    radioGroup.current.updateComplete.then(() => radioGroup.current.setCustomValidity(errorMessage));
  }, []);

  return (
    <form class="custom-validity" onSubmit={handleSubmit}>
      <SlRadioGroup ref={radioGroup} label="Select an option" name="a" value="1" onSlChange={handleChange}>
        <SlRadio value="1">Not me</SlRadio>
        <SlRadio value="2">Me neither</SlRadio>
        <SlRadio value="3">Choose me</SlRadio>
      </SlRadioGroup>
      <br />
      <SlButton type="submit" variant="primary">
        Submit
      </SlButton>
    </form>
  );
};
