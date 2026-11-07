import { VelcroAnimation as SlAnimation } from '@charm-ux/velcro/react/VelcroAnimation.js';

const css = `
  .animation-overview .box {
    display: inline-block;
    width: 100px;
    height: 100px;
    background-color: var(--sl-color-primary-600);
    margin: 1.5rem;
  }
`;

const App = () => (
  <>
    <div class="animation-overview">
      <SlAnimation name="bounce" duration={2000} play>
        <div class="box" />
      </SlAnimation>
      <SlAnimation name="jello" duration={2000} play>
        <div class="box" />
      </SlAnimation>
      <SlAnimation name="heartBeat" duration={2000} play>
        <div class="box" />
      </SlAnimation>
      <SlAnimation name="flip" duration={2000} play>
        <div class="box" />
      </SlAnimation>
    </div>

    <style>{css}</style>
  </>
);
