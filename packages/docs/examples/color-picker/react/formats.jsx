import { VelcroColorPicker as SlColorPicker } from '@charm-ux/velcro/react/VelcroColorPicker.js';

const App = () => (
  <>
    <SlColorPicker format="hex" value="#4a90e2" />
    <SlColorPicker format="rgb" value="rgb(80, 227, 194)" />
    <SlColorPicker format="hsl" value="hsl(290, 87%, 47%)" />
    <SlColorPicker format="hsv" value="hsv(55, 89%, 97%)" />
  </>
);
