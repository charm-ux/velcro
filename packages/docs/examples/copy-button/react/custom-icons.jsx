import { VelcroCopyButton as SlCopyButton } from '@charm-ux/velcro/react/VelcroCopyButton.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const App = () => (
  <>
    <SlCopyButton value="Copied from a custom button">
      <SlIcon slot="copy-icon" name="clipboard" />
      <SlIcon slot="success-icon" name="clipboard-check" />
      <SlIcon slot="error-icon" name="clipboard-x" />
    </SlCopyButton>
  </>
);
