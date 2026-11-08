import { VelcroTab as SlTab } from '@charm-ux/velcro/react/VelcroTab.js';
import { VelcroTabGroup as SlTabGroup } from '@charm-ux/velcro/react/VelcroTabGroup.js';
import { VelcroTabPanel as SlTabPanel } from '@charm-ux/velcro/react/VelcroTabPanel.js';

const App = () => (
  <SlTabGroup>
    <SlTab slot="nav" panel="general">
      General
    </SlTab>
    <SlTab slot="nav" panel="custom">
      Custom
    </SlTab>
    <SlTab slot="nav" panel="advanced">
      Advanced
    </SlTab>
    <SlTab slot="nav" panel="disabled" disabled>
      Disabled
    </SlTab>

    <SlTabPanel name="general">This is the general tab panel.</SlTabPanel>
    <SlTabPanel name="custom">This is the custom tab panel.</SlTabPanel>
    <SlTabPanel name="advanced">This is the advanced tab panel.</SlTabPanel>
    <SlTabPanel name="disabled">This is a disabled tab panel.</SlTabPanel>
  </SlTabGroup>
);
