import { VelcroCopyButton as SlCopyButton } from '@charm-ux/velcro/react/VelcroCopyButton.js';

const css = `
  .custom-styles {
    --success-color: white;
    --error-color: white;
    color: white;
  }

  .custom-styles::part(button) {
    background-color: #ff1493;
    border: solid 4px #ff7ac1;
    border-right-color: #ad005c;
    border-bottom-color: #ad005c;
    border-radius: 0;
    transition: 100ms scale ease-in-out, 100ms translate ease-in-out;
  }

  .custom-styles::part(button):hover {
    scale: 1.1;
  }

  .custom-styles::part(button):active {
    translate: 0 2px;
  }

  .custom-styles::part(button):focus-visible {
    outline: dashed 2px deeppink;
    outline-offset: 4px;
  }
`;

const App = () => (
  <>
    <SlCopyButton value="I'm so stylish" className="custom-styles" />

    <style>{css}</style>
  </>
);
