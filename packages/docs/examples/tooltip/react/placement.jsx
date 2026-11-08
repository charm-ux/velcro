import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroTooltip as SlTooltip } from '@charm-ux/velcro/react/VelcroTooltip.js';

const css = `
  .tooltip-placement-example {
    width: 250px;
  }

  .tooltip-placement-example-row:after {
    content: '';
    display: table;
    clear: both;
  }

  .tooltip-placement-example sl-button {
    float: left;
    width: 2.5rem;
    margin-right: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .tooltip-placement-example-row:nth-child(1) sl-tooltip:first-child sl-button,
  .tooltip-placement-example-row:nth-child(5) sl-tooltip:first-child sl-button {
    margin-left: calc(40px + 0.25rem);
  }

  .tooltip-placement-example-row:nth-child(2) sl-tooltip:nth-child(2) sl-button,
  .tooltip-placement-example-row:nth-child(3) sl-tooltip:nth-child(2) sl-button,
  .tooltip-placement-example-row:nth-child(4) sl-tooltip:nth-child(2) sl-button {
    margin-left: calc((40px * 3) + (0.25rem * 3));
  }
`;

const App = () => (
  <>
    <div className="tooltip-placement-example">
      <div className="tooltip-placement-example-row">
        <SlTooltip content="top-start" placement="top-start">
          <SlButton />
        </SlTooltip>

        <SlTooltip content="top" placement="top">
          <SlButton />
        </SlTooltip>

        <SlTooltip content="top-end" placement="top-end">
          <SlButton />
        </SlTooltip>
      </div>

      <div className="tooltip-placement-example-row">
        <SlTooltip content="left-start" placement="left-start">
          <SlButton />
        </SlTooltip>

        <SlTooltip content="right-start" placement="right-start">
          <SlButton />
        </SlTooltip>
      </div>

      <div className="tooltip-placement-example-row">
        <SlTooltip content="left" placement="left">
          <SlButton />
        </SlTooltip>

        <SlTooltip content="right" placement="right">
          <SlButton />
        </SlTooltip>
      </div>

      <div className="tooltip-placement-example-row">
        <SlTooltip content="left-end" placement="left-end">
          <SlButton />
        </SlTooltip>

        <SlTooltip content="right-end" placement="right-end">
          <SlButton />
        </SlTooltip>
      </div>

      <div className="tooltip-placement-example-row">
        <SlTooltip content="bottom-start" placement="bottom-start">
          <SlButton />
        </SlTooltip>

        <SlTooltip content="bottom" placement="bottom">
          <SlButton />
        </SlTooltip>

        <SlTooltip content="bottom-end" placement="bottom-end">
          <SlButton />
        </SlTooltip>
      </div>
    </div>

    <style>{css}</style>
  </>
);
