import { VelcroTree as SlTree } from '@charm-ux/velcro/react/VelcroTree.js';
import { VelcroTreeItem as SlTreeItem } from '@charm-ux/velcro/react/VelcroTreeItem.js';

const App = () => (
  <SlTree>
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
);
