import { useState } from 'react';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDialog as SlDialog } from '@charm-ux/velcro/react/VelcroDialog.js';
import { VelcroIconButton as SlIconButton } from '@charm-ux/velcro/react/VelcroIconButton.js';

const App = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SlDialog label="Dialog" open={open} onSlAfterHide={() => setOpen(false)}>
        <SlIconButton
          class="new-window"
          slot="header-actions"
          name="box-arrow-up-right"
          onClick={() => window.open(location.href)}
        />
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        <SlButton slot="footer" variant="primary" onClick={() => setOpen(false)}>
          Close
        </SlButton>
      </SlDialog>

      <SlButton onClick={() => setOpen(true)}>Open Dialog</SlButton>
    </>
  );
};
