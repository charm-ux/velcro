import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const css = `
  .button-group-toolbar sl-button-group:not(:last-of-type) {
    margin-right: var(--sl-spacing-x-small);
  }
`;

// <span title> stands in for <sl-tooltip>, which Velcro does not implement yet: the browser's own tooltip shows.
const App = () => (
  <>
    <div className="button-group-toolbar">
      <SlButtonGroup label="History">
        <span title="Undo">
          <SlButton>
            <SlIcon name="arrow-counterclockwise" label="Undo"></SlIcon>
          </SlButton>
        </span>
        <span title="Redo">
          <SlButton>
            <SlIcon name="arrow-clockwise" label="Redo"></SlIcon>
          </SlButton>
        </span>
      </SlButtonGroup>

      <SlButtonGroup label="Formatting">
        <span title="Bold">
          <SlButton>
            <SlIcon name="type-bold" label="Bold"></SlIcon>
          </SlButton>
        </span>
        <span title="Italic">
          <SlButton>
            <SlIcon name="type-italic" label="Italic"></SlIcon>
          </SlButton>
        </span>
        <span title="Underline">
          <SlButton>
            <SlIcon name="type-underline" label="Underline"></SlIcon>
          </SlButton>
        </span>
      </SlButtonGroup>

      <SlButtonGroup label="Alignment">
        <span title="Align Left">
          <SlButton>
            <SlIcon name="justify-left" label="Align Left"></SlIcon>
          </SlButton>
        </span>
        <span title="Align Center">
          <SlButton>
            <SlIcon name="justify" label="Align Center"></SlIcon>
          </SlButton>
        </span>
        <span title="Align Right">
          <SlButton>
            <SlIcon name="justify-right" label="Align Right"></SlIcon>
          </SlButton>
        </span>
      </SlButtonGroup>
    </div>

    <style>{css}</style>
  </>
);
