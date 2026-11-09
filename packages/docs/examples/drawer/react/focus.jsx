import { useState } from 'react';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDrawer as SlDrawer } from '@charm-ux/velcro/react/VelcroDrawer.js';
import { VelcroInput as SlInput } from '@charm-ux/velcro/react/VelcroInput.js';

const App = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SlDrawer label="Drawer" open={open} onSlAfterHide={() => setOpen(false)}>
        <SlInput autofocus placeholder="I will have focus when the drawer is opened" />
        <SlButton slot="footer" variant="primary" onClick={() => setOpen(false)}>
          Close
        </SlButton>
      </SlDrawer>

      <SlButton onClick={() => setOpen(true)}>Open Drawer</SlButton>
    </>
  );
};
