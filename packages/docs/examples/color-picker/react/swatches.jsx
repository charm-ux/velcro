import { VelcroColorPicker as SlColorPicker } from '@charm-ux/velcro/react/VelcroColorPicker.js';

const App = () => (
  <SlColorPicker
    label="Select a color"
    swatches="
      #d0021b; #f5a623; #f8e71c; #8b572a; #7ed321; #417505; #bd10e0; #9013fe;
      #4a90e2; #50e3c2; #b8e986; #000; #444; #888; #ccc; #fff;
    "
  />
);
