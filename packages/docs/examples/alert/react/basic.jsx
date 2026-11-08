import { VelcroAlert as SlAlert } from '@charm-ux/velcro/react/VelcroAlert.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const App = () => (
  <SlAlert open>
    <SlIcon slot="icon" name="info-circle" />
    This is a standard alert. You can customize its content and even the icon.
  </SlAlert>
);
