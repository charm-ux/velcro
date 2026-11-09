import '@charm-ux/velcro/icon';
import { VelcroBreadcrumb as SlBreadcrumb } from '@charm-ux/velcro/react/VelcroBreadcrumb.js';
import { VelcroBreadcrumbItem as SlBreadcrumbItem } from '@charm-ux/velcro/react/VelcroBreadcrumbItem.js';

const App = () => (
  <>
    <SlBreadcrumb>
      <sl-icon name="dot" slot="separator" />
      <SlBreadcrumbItem>First</SlBreadcrumbItem>
      <SlBreadcrumbItem>Second</SlBreadcrumbItem>
      <SlBreadcrumbItem>Third</SlBreadcrumbItem>
    </SlBreadcrumb>

    <br />

    <SlBreadcrumb>
      <sl-icon name="arrow-right" slot="separator" />
      <SlBreadcrumbItem>First</SlBreadcrumbItem>
      <SlBreadcrumbItem>Second</SlBreadcrumbItem>
      <SlBreadcrumbItem>Third</SlBreadcrumbItem>
    </SlBreadcrumb>

    <br />

    <SlBreadcrumb>
      <span slot="separator">/</span>
      <SlBreadcrumbItem>First</SlBreadcrumbItem>
      <SlBreadcrumbItem>Second</SlBreadcrumbItem>
      <SlBreadcrumbItem>Third</SlBreadcrumbItem>
    </SlBreadcrumb>
  </>
);
