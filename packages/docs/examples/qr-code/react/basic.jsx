import { useState } from 'react';
import { VelcroQrCode as SlQrCode } from '@charm-ux/velcro/react/VelcroQrCode.js';
import { VelcroInput as SlInput } from '@charm-ux/velcro/react/VelcroInput.js';

const css = `
  .qr-overview {
    max-width: 256px;
  }

  .qr-overview sl-input {
    margin-top: 1rem;
  }
`;

const App = () => {
  const [value, setValue] = useState('https://shoelace.style/');

  return (
    <>
      <div className="qr-overview">
        <SlQrCode value={value} label="Scan this code to visit Shoelace on the web!" />
        <br />

        <SlInput maxlength="255" clearable onInput={event => setValue(event.target.value)} />
      </div>

      <style>{css}</style>
    </>
  );
};
