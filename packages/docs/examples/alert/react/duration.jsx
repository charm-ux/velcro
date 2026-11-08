import { useState } from 'react';
import { VelcroAlert as SlAlert } from '@charm-ux/velcro/react/VelcroAlert.js';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const css = `
  .alert-duration sl-alert {
    margin-top: var(--sl-spacing-medium);
  }
`;

const App = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="alert-duration">
        <SlButton variant="primary" onClick={() => setOpen(true)}>
          Show Alert
        </SlButton>

        <SlAlert variant="primary" duration="3000" open={open} closable onSlAfterHide={() => setOpen(false)}>
          <SlIcon slot="icon" name="info-circle" />
          This alert will automatically hide itself after three seconds, unless you interact with it.
        </SlAlert>
      </div>

      <style>{css}</style>
    </>
  );
};
