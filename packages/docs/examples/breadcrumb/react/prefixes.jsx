import { VelcroBreadcrumb as SlBreadcrumb } from '@charm-ux/velcro/react/VelcroBreadcrumb.js';
import { VelcroBreadcrumbItem as SlBreadcrumbItem } from '@charm-ux/velcro/react/VelcroBreadcrumbItem.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const App = () => (
  <SlBreadcrumb>
    <SlBreadcrumbItem>
      <SlIcon slot="prefix" name="house" />
      Home
    </SlBreadcrumbItem>
    <SlBreadcrumbItem>Articles</SlBreadcrumbItem>
    <SlBreadcrumbItem>Traveling</SlBreadcrumbItem>
  </SlBreadcrumb>
);
