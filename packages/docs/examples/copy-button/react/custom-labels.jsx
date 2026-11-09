import { VelcroCopyButton as SlCopyButton } from '@charm-ux/velcro/react/VelcroCopyButton.js';

const App = () => (
  <SlCopyButton
    value="Custom labels are easy"
    copyLabel="Click to copy"
    successLabel="You did it!"
    errorLabel="Whoops, your browser doesn't support this!"
  />
);
