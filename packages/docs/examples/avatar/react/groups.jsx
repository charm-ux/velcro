import { VelcroAvatar as SlAvatar } from '@charm-ux/velcro/react/VelcroAvatar.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const css = `
  .avatar-group sl-avatar:not(:first-of-type) {
    margin-left: -1rem;
  }

  .avatar-group sl-avatar::part(base) {
    border: solid 2px var(--sl-color-neutral-0);
  }
`;

const App = () => (
  <>
    <div className="avatar-group">
      <SlAvatar
        image="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%2334d399'/%3E%3Ccircle cx='32' cy='25' r='12' fill='%23d1fae5'/%3E%3Cpath d='M10 64c2-14 11-21 22-21s20 7 22 21z' fill='%23d1fae5'/%3E%3C/svg%3E"
        label="Avatar 1 of 4"
      />

      <SlAvatar
        image="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23fb923c'/%3E%3Ccircle cx='32' cy='25' r='12' fill='%23ffedd5'/%3E%3Cpath d='M10 64c2-14 11-21 22-21s20 7 22 21z' fill='%23ffedd5'/%3E%3C/svg%3E"
        label="Avatar 2 of 4"
      />

      <SlAvatar
        image="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23f472b6'/%3E%3Ccircle cx='32' cy='25' r='12' fill='%23fce7f3'/%3E%3Cpath d='M10 64c2-14 11-21 22-21s20 7 22 21z' fill='%23fce7f3'/%3E%3C/svg%3E"
        label="Avatar 3 of 4"
      />

      <SlAvatar
        image="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%2394a3b8'/%3E%3Ccircle cx='32' cy='25' r='12' fill='%23f1f5f9'/%3E%3Cpath d='M10 64c2-14 11-21 22-21s20 7 22 21z' fill='%23f1f5f9'/%3E%3C/svg%3E"
        label="Avatar 4 of 4"
      />
    </div>

    <style>{css}</style>
  </>
);
