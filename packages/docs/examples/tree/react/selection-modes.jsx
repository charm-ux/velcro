import { useState } from 'react';
import { VelcroOption as SlOption } from '@charm-ux/velcro/react/VelcroOption.js';
import { VelcroSelect as SlSelect } from '@charm-ux/velcro/react/VelcroSelect.js';
import { VelcroTree as SlTree } from '@charm-ux/velcro/react/VelcroTree.js';
import { VelcroTreeItem as SlTreeItem } from '@charm-ux/velcro/react/VelcroTreeItem.js';

const App = () => {
  const [selection, setSelection] = useState('single');

  return (
    <>
      <SlSelect label="Selection" value={selection} onSlChange={event => setSelection(event.target.value)}>
        <SlOption value="single">single</SlOption>
        <SlOption value="multiple">multiple</SlOption>
        <SlOption value="leaf">leaf</SlOption>
      </SlSelect>

      <br />

      <SlTree selection={selection}>
        <SlTreeItem>
          Item 1
          <SlTreeItem>
            Item A
            <SlTreeItem>Item Z</SlTreeItem>
            <SlTreeItem>Item Y</SlTreeItem>
            <SlTreeItem>Item X</SlTreeItem>
          </SlTreeItem>
          <SlTreeItem>Item B</SlTreeItem>
          <SlTreeItem>Item C</SlTreeItem>
        </SlTreeItem>
        <SlTreeItem>Item 2</SlTreeItem>
        <SlTreeItem>Item 3</SlTreeItem>
      </SlTree>
    </>
  );
};
