import { useState } from 'react';
import { VelcroAlert as SlAlert } from '@charm-ux/velcro/react/VelcroAlert.js';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const css = `
  .alert-countdown sl-alert {
    margin-top: var(--sl-spacing-medium);
  }
`;

const App = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="alert-countdown">
        <SlButton variant="primary" onClick={() => setOpen(true)}>
          Show Alert
        </SlButton>

        <SlAlert variant="primary" duration="3000" countdown="rtl" open={open} closable onSlAfterHide={() => setOpen(false)}>
          <SlIcon slot="icon" name="info-circle" />
          You're not stuck, the alert will close after a pretty long duration.
        </SlAlert>
      </div>

      <style>{css}</style>
    </>
  );
};
