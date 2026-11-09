import { VelcroDivider as SlDivider } from '@charm-ux/velcro/react/VelcroDivider.js';
import { VelcroOption as SlOption } from '@charm-ux/velcro/react/VelcroOption.js';
import { VelcroSelect as SlSelect } from '@charm-ux/velcro/react/VelcroSelect.js';

const App = () => (
  <SlSelect value={["option-1", "option-2"]} multiple clearable>
    <SlOption value="option-1">Option 1</SlOption>
    <SlOption value="option-2">Option 2</SlOption>
    <SlOption value="option-3">Option 3</SlOption>
  </SlSelect>
);
