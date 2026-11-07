import { VelcroAnimation as SlAnimation } from '@charm-ux/velcro/react/VelcroAnimation.js';

const css = `
  .animation-keyframes .box {
    width: 100px;
    height: 100px;
    background-color: var(--sl-color-primary-600);
  }
`;

const App = () => (
  <>
    <div class="animation-keyframes">
      <SlAnimation
        easing="ease-in-out"
        duration={2000}
        play
        keyframes={[
          {
            offset: 0,
            easing: 'cubic-bezier(0.250, 0.460, 0.450, 0.940)',
            fillMode: 'both',
            transformOrigin: 'center center',
            transform: 'rotate(0)'
          },
          {
            offset: 1,
            easing: 'cubic-bezier(0.250, 0.460, 0.450, 0.940)',
            fillMode: 'both',
            transformOrigin: 'center center',
            transform: 'rotate(90deg)'
          }
        ]}
      >
        <div class="box" />
      </SlAnimation>
    </div>

    <style>{css}</style>
  </>
);
