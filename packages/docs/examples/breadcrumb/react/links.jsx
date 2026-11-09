import { VelcroBreadcrumb as SlBreadcrumb } from '@charm-ux/velcro/react/VelcroBreadcrumb.js';
import { VelcroBreadcrumbItem as SlBreadcrumbItem } from '@charm-ux/velcro/react/VelcroBreadcrumbItem.js';

const App = () => (
  <SlBreadcrumb>
    <SlBreadcrumbItem href="https://example.com/home">Homepage</SlBreadcrumbItem>

    <SlBreadcrumbItem href="https://example.com/home/services">Our Services</SlBreadcrumbItem>

    <SlBreadcrumbItem href="https://example.com/home/services/digital">Digital Media</SlBreadcrumbItem>

    <SlBreadcrumbItem href="https://example.com/home/services/digital/web-design">Web Design</SlBreadcrumbItem>
  </SlBreadcrumb>
);
