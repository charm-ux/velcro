import { VelcroCopyButton as SlCopyButton } from '@charm-ux/velcro/react/VelcroCopyButton.js';
import { VelcroInput as SlInput } from '@charm-ux/velcro/react/VelcroInput.js';

const App = () => (
  <>
    {/* Copies the span's textContent */}
    <span id="my-phone">+1 (234) 456-7890</span>
    <SlCopyButton from="my-phone" />

    <br /><br />

    {/* Copies the input's "value" property */}
    <SlInput id="my-input" type="text" value="User input" />
    <SlCopyButton from="my-input.value" />

    <br /><br />

    {/* Copies the link's "href" attribute */}
    <a id="my-link" href="https://example.com/">Example Website</a>
    <SlCopyButton from="my-link[href]" />
  </>
);
