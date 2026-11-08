import { useRef } from 'react';
import { VelcroAlert as SlAlert } from '@charm-ux/velcro/react/VelcroAlert.js';
import { VelcroButton as SlButton } from '@charm-ux/velcro/react/VelcroButton.js';
import { VelcroIcon as SlIcon } from '@charm-ux/velcro/react/VelcroIcon.js';

function showToast(alert) {
  alert.toast();
}

const App = () => {
  const primary = useRef(null);
  const success = useRef(null);
  const neutral = useRef(null);
  const warning = useRef(null);
  const danger = useRef(null);

  return (
    <>
      <SlButton variant="primary" onClick={() => primary.current.toast()}>
        Primary
      </SlButton>

      <SlButton variant="success" onClick={() => success.current.toast()}>
        Success
      </SlButton>

      <SlButton variant="neutral" onClick={() => neutral.current.toast()}>
        Neutral
      </SlButton>

      <SlButton variant="warning" onClick={() => warning.current.toast()}>
        Warning
      </SlButton>

      <SlButton variant="danger" onClick={() => danger.current.toast()}>
        Danger
      </SlButton>

      <SlAlert ref={primary} variant="primary" duration="3000" closable>
        <SlIcon slot="icon" name="info-circle" />
        <strong>This is super informative</strong>
        <br />
        You can tell by how pretty the alert is.
      </SlAlert>

      <SlAlert ref={success} variant="success" duration="3000" closable>
        <SlIcon slot="icon" name="check2-circle" />
        <strong>Your changes have been saved</strong>
        <br />
        You can safely exit the app now.
      </SlAlert>

      <SlAlert ref={neutral} variant="neutral" duration="3000" closable>
        <SlIcon slot="icon" name="gear" />
        <strong>Your settings have been updated</strong>
        <br />
        Settings will take effect on next login.
      </SlAlert>

      <SlAlert ref={warning} variant="warning" duration="3000" closable>
        <SlIcon slot="icon" name="exclamation-triangle" />
        <strong>Your session has ended</strong>
        <br />
        Please login again to continue.
      </SlAlert>

      <SlAlert ref={danger} variant="danger" duration="3000" closable>
        <SlIcon slot="icon" name="exclamation-octagon" />
        <strong>Your account has been deleted</strong>
        <br />
        We're very sorry to see you go!
      </SlAlert>
    </>
  );
};
