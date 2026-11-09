import { VelcroRange as SlRange } from '@charm-ux/velcro/react/VelcroRange.js';

const App = () => (
  <SlRange
    min={-100}
    max={100}
    style={{
      '--track-color-active': 'var(--sl-color-primary-600)',
      '--track-color-inactive': 'var(--sl-color-primary-200)',
      '--track-active-offset': '50%'
    }}
  />
);
