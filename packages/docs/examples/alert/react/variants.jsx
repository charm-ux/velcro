import { VelcroAlert as SlAlert } from '@charm-ux/velcro/react/VelcroAlert.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

const App = () => (
  <>
    <SlAlert variant="primary" open>
      <SlIcon slot="icon" name="info-circle" />
      <strong>This is super informative</strong>
      <br />
      You can tell by how pretty the alert is.
    </SlAlert>

    <br />

    <SlAlert variant="success" open>
      <SlIcon slot="icon" name="check2-circle" />
      <strong>Your changes have been saved</strong>
      <br />
      You can safely exit the app now.
    </SlAlert>

    <br />

    <SlAlert variant="neutral" open>
      <SlIcon slot="icon" name="gear" />
      <strong>Your settings have been updated</strong>
      <br />
      Settings will take effect on next login.
    </SlAlert>

    <br />

    <SlAlert variant="warning" open>
      <SlIcon slot="icon" name="exclamation-triangle" />
      <strong>Your session has ended</strong>
      <br />
      Please login again to continue.
    </SlAlert>

    <br />

    <SlAlert variant="danger" open>
      <SlIcon slot="icon" name="exclamation-octagon" />
      <strong>Your account has been deleted</strong>
      <br />
      We're very sorry to see you go!
    </SlAlert>
  </>
);
