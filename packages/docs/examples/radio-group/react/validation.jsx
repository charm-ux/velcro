import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';
import { VelcroRadio as SlRadio } from '@charm-ux/velcro/react/VelcroRadio.js';
import { VelcroRadioGroup as SlRadioGroup } from '@charm-ux/velcro/react/VelcroRadioGroup.js';
const App = () => {
  function handleSubmit(event) {
    event.preventDefault();
    alert('All fields are valid!');
  }

  return (
    <form class="custom-validity" onSubmit={handleSubmit}>
      <SlRadioGroup label="Select an option" name="a" required>
        <SlRadio value="1">
          Option 1
        </SlRadio>
        <SlRadio value="2">
          Option 2
        </SlRadio>
        <SlRadio value="3">
          Option 3
        </SlRadio>
      </SlRadioGroup>
      <br />
      <SlButton type="submit" variant="primary">
        Submit
      </SlButton>
    </form>
  );
};
