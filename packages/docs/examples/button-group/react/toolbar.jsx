import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroButtonGroup as SlButtonGroup } from '@charm-ux/velcro/react/VelcroButtonGroup.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';
import { VelcroTooltip as SlTooltip } from '@charm-ux/velcro/react/VelcroTooltip.js';

const css = `
  .button-group-toolbar sl-button-group:not(:last-of-type) {
    margin-right: var(--sl-spacing-x-small);
  }
`;

const App = () => (
  <>
    <div className="button-group-toolbar">
      <SlButtonGroup label="History">
        <SlTooltip content="Undo">
          <SlButton>
            <SlIcon name="arrow-counterclockwise" label="Undo"></SlIcon>
          </SlButton>
        </SlTooltip>
        <SlTooltip content="Redo">
          <SlButton>
            <SlIcon name="arrow-clockwise" label="Redo"></SlIcon>
          </SlButton>
        </SlTooltip>
      </SlButtonGroup>

      <SlButtonGroup label="Formatting">
        <SlTooltip content="Bold">
          <SlButton>
            <SlIcon name="type-bold" label="Bold"></SlIcon>
          </SlButton>
        </SlTooltip>
        <SlTooltip content="Italic">
          <SlButton>
            <SlIcon name="type-italic" label="Italic"></SlIcon>
          </SlButton>
        </SlTooltip>
        <SlTooltip content="Underline">
          <SlButton>
            <SlIcon name="type-underline" label="Underline"></SlIcon>
          </SlButton>
        </SlTooltip>
      </SlButtonGroup>

      <SlButtonGroup label="Alignment">
        <SlTooltip content="Align Left">
          <SlButton>
            <SlIcon name="justify-left" label="Align Left"></SlIcon>
          </SlButton>
        </SlTooltip>
        <SlTooltip content="Align Center">
          <SlButton>
            <SlIcon name="justify" label="Align Center"></SlIcon>
          </SlButton>
        </SlTooltip>
        <SlTooltip content="Align Right">
          <SlButton>
            <SlIcon name="justify-right" label="Align Right"></SlIcon>
          </SlButton>
        </SlTooltip>
      </SlButtonGroup>
    </div>

    <style>{css}</style>
  </>
);
