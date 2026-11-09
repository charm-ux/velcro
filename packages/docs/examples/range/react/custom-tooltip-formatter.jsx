import { VelcroRange as SlRange } from '@charm-ux/velcro/react/VelcroRange.js';

const App = () => <SlRange min={0} max={100} step={1} tooltipFormatter={value => `Total - ${value}%`} />;
