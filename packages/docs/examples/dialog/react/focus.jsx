import { useState } from 'react';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDialog as SlDialog } from '@charm-ux/velcro/react/VelcroDialog.js';
import { VelcroInput as SlInput } from '@charm-ux/velcro/react/VelcroInput.js';

const App = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SlDialog label="Dialog" open={open} onSlAfterHide={() => setOpen(false)}>
        <SlInput autofocus placeholder="I will have focus when the dialog is opened" />
        <SlButton slot="footer" variant="primary" onClick={() => setOpen(false)}>
          Close
        </SlButton>
      </SlDialog>

      <SlButton onClick={() => setOpen(true)}>Open Dialog</SlButton>
    </>
  );
};
