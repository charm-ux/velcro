import { VelcroQrCode as SlQrCode } from '@charm-ux/velcro/react/VelcroQrCode.js';

const css = `
  .qr-error-correction {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
`;

const App = () => {
  return (
    <>
      <div className="qr-error-correction">
        <SlQrCode value="https://shoelace.style/" error-correction="L" />
        <SlQrCode value="https://shoelace.style/" error-correction="M" />
        <SlQrCode value="https://shoelace.style/" error-correction="Q" />
        <SlQrCode value="https://shoelace.style/" error-correction="H" />
      </div>

      <style>{css}</style>
    </>
  );
};
