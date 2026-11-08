import { VelcroTab as SlTab } from '@charm-ux/velcro/react/VelcroTab.js';
import { VelcroTabGroup as SlTabGroup } from '@charm-ux/velcro/react/VelcroTabGroup.js';
import { VelcroTabPanel as SlTabPanel } from '@charm-ux/velcro/react/VelcroTabPanel.js';

const App = () => {
  function handleClose(event) {
    //
    // This is a crude example that removes the tab and its panel from the DOM.
    // There are better ways to manage tab creation/removal in React, but that
    // would significantly complicate the example.
    //
    const tab = event.target;
    const tabGroup = tab.closest('sl-tab-group');
    const tabPanel = tabGroup.querySelector(`[aria-labelledby="${tab.id}"]`);

    tab.remove();
    tabPanel.remove();
  }

  return (
    <SlTabGroup className="tabs-closable" onSlClose={handleClose}>
      <SlTab slot="nav" panel="general">
        General
      </SlTab>
      <SlTab slot="nav" panel="closable-1" closable onSlClose={handleClose}>
        Closable 1
      </SlTab>
      <SlTab slot="nav" panel="closable-2" closable onSlClose={handleClose}>
        Closable 2
      </SlTab>
      <SlTab slot="nav" panel="closable-3" closable onSlClose={handleClose}>
        Closable 3
      </SlTab>

      <SlTabPanel name="general">This is the general tab panel.</SlTabPanel>
      <SlTabPanel name="closable-1">This is the first closable tab panel.</SlTabPanel>
      <SlTabPanel name="closable-2">This is the second closable tab panel.</SlTabPanel>
      <SlTabPanel name="closable-3">This is the third closable tab panel.</SlTabPanel>
    </SlTabGroup>
  );
};
