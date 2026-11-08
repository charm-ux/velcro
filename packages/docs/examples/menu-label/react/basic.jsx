import { VelcroDivider as SlDivider } from '@charm-ux/velcro/react/VelcroDivider.js';
import { VelcroMenuLabel as SlMenuLabel } from '@charm-ux/velcro/react/VelcroMenuLabel.js';

// Stand-ins for SlMenu and SlMenuItem, which Velcro does not implement yet.
const SlMenu = ({ style, children }) => (
  <div
    style={{
      boxSizing: 'border-box',
      padding: 'var(--sl-spacing-x-small) 0',
      background: 'var(--sl-panel-background-color)',
      border: 'solid var(--sl-panel-border-width) var(--sl-panel-border-color)',
      borderRadius: 'var(--sl-border-radius-medium)',
      ...style,
    }}
  >
    {children}
  </div>
);

const SlMenuItem = ({ value, children }) => (
  <div
    data-value={value}
    style={{
      padding: 'var(--sl-spacing-2x-small) var(--sl-spacing-x-large)',
      fontFamily: 'var(--sl-font-sans)',
      lineHeight: 'var(--sl-line-height-normal)',
      color: 'var(--sl-color-neutral-700)',
    }}
  >
    {children}
  </div>
);

const App = () => (
  <SlMenu style={{ maxWidth: '200px' }}>
    <SlMenuLabel>Fruits</SlMenuLabel>
    <SlMenuItem value="apple">Apple</SlMenuItem>
    <SlMenuItem value="banana">Banana</SlMenuItem>
    <SlMenuItem value="orange">Orange</SlMenuItem>
    <SlDivider />
    <SlMenuLabel>Vegetables</SlMenuLabel>
    <SlMenuItem value="broccoli">Broccoli</SlMenuItem>
    <SlMenuItem value="carrot">Carrot</SlMenuItem>
    <SlMenuItem value="zucchini">Zucchini</SlMenuItem>
  </SlMenu>
);
