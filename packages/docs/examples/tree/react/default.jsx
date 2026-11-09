import { VelcroTree as SlTree } from '@charm-ux/velcro/react/VelcroTree.js';
import { VelcroTreeItem as SlTreeItem } from '@charm-ux/velcro/react/VelcroTreeItem.js';

const App = () => (
  <SlTree>
    <SlTreeItem>
      Deciduous
      <SlTreeItem>Birch</SlTreeItem>
      <SlTreeItem>
        Maple
        <SlTreeItem>Field maple</SlTreeItem>
        <SlTreeItem>Red maple</SlTreeItem>
        <SlTreeItem>Sugar maple</SlTreeItem>
      </SlTreeItem>
      <SlTreeItem>Oak</SlTreeItem>
    </SlTreeItem>

    <SlTreeItem>
      Coniferous
      <SlTreeItem>Cedar</SlTreeItem>
      <SlTreeItem>Pine</SlTreeItem>
      <SlTreeItem>Spruce</SlTreeItem>
    </SlTreeItem>

    <SlTreeItem>
      Non-trees
      <SlTreeItem>Bamboo</SlTreeItem>
      <SlTreeItem>Cactus</SlTreeItem>
      <SlTreeItem>Fern</SlTreeItem>
    </SlTreeItem>
  </SlTree>
);
