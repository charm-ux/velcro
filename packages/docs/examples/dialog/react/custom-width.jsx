import { useState } from 'react';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDialog as SlDialog } from '@charm-ux/velcro/react/VelcroDialog.js';

const App = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SlDialog label="Dialog" open={open} style={{ '--width': '50vw' }} onSlAfterHide={() => setOpen(false)}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        <SlButton slot="footer" variant="primary" onClick={() => setOpen(false)}>
          Close
        </SlButton>
      </SlDialog>

      <SlButton onClick={() => setOpen(true)}>Open Dialog</SlButton>
    </>
  );
};
