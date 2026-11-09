import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';
import { VelcroTree as SlTree } from '@charm-ux/velcro/react/VelcroTree.js';
import { VelcroTreeItem as SlTreeItem } from '@charm-ux/velcro/react/VelcroTreeItem.js';

const App = () => {
  return (
    <SlTree class="tree-with-icons">
      <SlTreeItem expanded>
        <SlIcon name="folder" />
        Root
        <SlTreeItem>
          <SlIcon name="folder" />
          Folder 1<SlTreeItem>
            <SlIcon name="files" />
            File 1 - 1
          </SlTreeItem>
          <SlTreeItem disabled>
            <SlIcon name="files" />
            File 1 - 2
          </SlTreeItem>
          <SlTreeItem>
            <SlIcon name="files" />
            File 1 - 3
          </SlTreeItem>
        </SlTreeItem>
        <SlTreeItem>
          <SlIcon name="files" />
          Folder 2<SlTreeItem>
            <SlIcon name="files" />
            File 2 - 1
          </SlTreeItem>
          <SlTreeItem>
            <SlIcon name="files" />
            File 2 - 2
          </SlTreeItem>
        </SlTreeItem>
        <SlTreeItem>
          <SlIcon name="files" />
          File 1
        </SlTreeItem>
      </SlTreeItem>
    </SlTree>
  );
};
