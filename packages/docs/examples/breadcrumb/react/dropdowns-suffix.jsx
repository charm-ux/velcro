import { VelcroBreadcrumb as SlBreadcrumb } from '@charm-ux/velcro/react/VelcroBreadcrumb.js';
import { VelcroBreadcrumbItem as SlBreadcrumbItem } from '@charm-ux/velcro/react/VelcroBreadcrumbItem.js';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroDropdown as SlDropdown } from '@charm-ux/velcro/react/VelcroDropdown.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';
import { VelcroMenu as SlMenu } from '@charm-ux/velcro/react/VelcroMenu.js';
import { VelcroMenuItem as SlMenuItem } from '@charm-ux/velcro/react/VelcroMenuItem.js';

const App = () => (
  <SlBreadcrumb>
    <SlBreadcrumbItem>Homepage</SlBreadcrumbItem>
    <SlBreadcrumbItem>Our Services</SlBreadcrumbItem>
    <SlBreadcrumbItem>Digital Media</SlBreadcrumbItem>
    <SlBreadcrumbItem>
      Web Design
      <SlDropdown slot="suffix">
        <SlButton slot="trigger" size="small" circle>
          <SlIcon label="More options" name="three-dots"></SlIcon>
        </SlButton>
        <SlMenu>
          <SlMenuItem type="checkbox" checked>
            Web Design
          </SlMenuItem>
          <SlMenuItem type="checkbox">Web Development</SlMenuItem>
          <SlMenuItem type="checkbox">Marketing</SlMenuItem>
        </SlMenu>
      </SlDropdown>
    </SlBreadcrumbItem>
  </SlBreadcrumb>
);
