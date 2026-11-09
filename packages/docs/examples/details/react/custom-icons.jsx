import { VelcroDetails as SlDetails } from '@charm-ux/velcro/react/VelcroDetails.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const css = `
  sl-details.custom-icon::part(summary-icon) {
    /* Disable the expand/collapse animation */
    rotate: none;
  }
`;

const App = () => (
  <>
    <SlDetails summary="Toggle Me" class="custom-icon">
      <SlIcon name="plus-square" slot="expand-icon" />
      <SlIcon name="dash-square" slot="collapse-icon" />
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
      magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
      consequat.
    </SlDetails>

    <style>{css}</style>
  </>
);
