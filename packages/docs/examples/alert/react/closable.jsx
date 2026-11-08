import { useState } from 'react';
import { VelcroAlert as SlAlert } from '@charm-ux/velcro/react/VelcroAlert.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const App = () => {
  const [open, setOpen] = useState(true);

  function handleHide() {
    setOpen(false);
    setTimeout(() => setOpen(true), 2000);
  }

  return (
    <SlAlert open={open} closable onSlAfterHide={handleHide}>
      <SlIcon slot="icon" name="info-circle" />
      You can close this alert any time!
    </SlAlert>
  );
};
