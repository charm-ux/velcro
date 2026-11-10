import { VelcroImageComparer as SlImageComparer } from '@charm-ux/velcro/react/VelcroImageComparer.js';

const App = () => (
  <SlImageComparer position={25}>
    <img
      slot="before"
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 800 533'%3E%3Crect width='800' height='533' fill='%23a8a29e'/%3E%3Crect y='330' width='800' height='60' fill='%2378716c'/%3E%3Crect y='390' width='800' height='143' fill='%2344403c'/%3E%3Cpath d='M330 330 V250 H400 V300 H480 V330z' fill='%2357534e'/%3E%3Cpath d='M360 270 L440 310 M360 300 L430 260' stroke='%23f5f5f4' stroke-width='6' fill='none'/%3E%3C/svg%3E"
      alt="A placeholder drawing of a boot on a gray curb."
    />
    <img
      slot="after"
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 800 533'%3E%3Crect width='800' height='533' fill='%23a8a29e'/%3E%3Crect y='330' width='800' height='60' fill='%23facc15'/%3E%3Crect y='390' width='800' height='143' fill='%2344403c'/%3E%3Cpath d='M330 330 V250 H400 V300 H480 V330z' fill='%2357534e'/%3E%3Cpath d='M360 270 L440 310 M360 300 L430 260' stroke='%23f5f5f4' stroke-width='6' fill='none'/%3E%3C/svg%3E"
      alt="A placeholder drawing of the same boot on a yellow curb."
    />
  </SlImageComparer>
);
