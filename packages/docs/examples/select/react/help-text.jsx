import { VelcroOption as SlOption } from '@charm-ux/velcro/react/VelcroOption.js';
import { VelcroSelect as SlSelect } from '@charm-ux/velcro/react/VelcroSelect.js';

const App = () => (
  <SlSelect label="Experience" help-text="Please tell us your skill level.">
    <SlOption value="1">Novice</SlOption>
    <SlOption value="2">Intermediate</SlOption>
    <SlOption value="3">Advanced</SlOption>
  </SlSelect>
);
