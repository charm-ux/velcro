import { useEffect, useRef } from 'react';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroCheckbox as SlCheckbox } from '@charm-ux/velcro/react/VelcroCheckbox.js';

const App = () => {
  const checkbox = useRef(null);
  const errorMessage = `Don't forget to check me!`;

  function handleChange() {
    checkbox.current.setCustomValidity(checkbox.current.checked ? '' : errorMessage);
  }

  function handleSubmit(event) {
    event.preventDefault();
    alert('All fields are valid!');
  }

  useEffect(() => {
    checkbox.current.setCustomValidity(errorMessage);
  }, []);

  return (
    <form class="custom-validity" onSubmit={handleSubmit}>
      <SlCheckbox ref={checkbox} onSlChange={handleChange}>
        Check me
      </SlCheckbox>
      <br />
      <SlButton type="submit" variant="primary" style={{ marginTop: '1rem' }}>
        Submit
      </SlButton>
    </form>
  );
};
