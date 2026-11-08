import { VelcroAvatar as SlAvatar } from '@charm-ux/velcro/react/VelcroAvatar.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const App = () => (
  <>
    <SlAvatar label="Avatar with an image icon">
      <SlIcon slot="icon" name="image" />
    </SlAvatar>

    <SlAvatar label="Avatar with an archive icon">
      <SlIcon slot="icon" name="archive" />
    </SlAvatar>

    <SlAvatar label="Avatar with a briefcase icon">
      <SlIcon slot="icon" name="briefcase" />
    </SlAvatar>
  </>
);
