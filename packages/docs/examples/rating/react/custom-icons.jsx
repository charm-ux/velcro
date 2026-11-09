import { VelcroRating as SlRating } from '@charm-ux/velcro/react/VelcroRating.js';

const App = () => (
  <SlRating
    label="Rating"
    getSymbol={() => '<sl-icon name="heart-fill"></sl-icon>'}
    style={{ '--symbol-color-active': '#ff4136' }}
  />
);
