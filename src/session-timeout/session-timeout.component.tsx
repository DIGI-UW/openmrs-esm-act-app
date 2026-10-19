import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ComposedModal, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { navigate, openmrsFetch, restBaseUrl, useConfig, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

/** What counts as the user being at the keyboard. */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

const TICK_MS = 1000;

const MINUTE_MS = 60_000;

/** The seconds left as m:ss. */
export function countdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Warns before the session times out, as ACT 2.0 did. The server ends a session left idle for its timeout, and the
 * app then learns of it only from the next request, which lands on the login page with any open form lost. This
 * extension sits in the top navigation on every page and keeps time on the user's side: once they have been idle
 * for the idle time less the warning time, a modal counts the warning time down and signs them out at zero unless
 * they choose to stay, which asks the server for the session so it starts its clock again. While the user is active
 * the session is kept alive every few minutes too, as a long form entered without a save makes no request of its own.
 */
export default function SessionTimeout() {
  const { t } = useTranslation();
  const { sessionTimeout } = useConfig<Config>();
  const { authenticated } = useSession();
  const idleMs = sessionTimeout.idleMinutes * MINUTE_MS;
  const warningMs = sessionTimeout.warningMinutes * MINUTE_MS;
  const keepAliveMs = sessionTimeout.keepAliveMinutes * MINUTE_MS;
  const enabled = authenticated && idleMs > 0 && warningMs > 0 && warningMs < idleMs;
  // The clock's state lives in refs, read by the timer as it runs; the state below only draws the modal.
  const lastActivity = useRef(Date.now());
  const lastRequest = useRef(Date.now());
  const warningSince = useRef<number | null>(null);
  const [warning, setWarning] = useState<{ since: number; now: number } | null>(null);

  const keepAlive = useCallback(() => {
    lastRequest.current = Date.now();
    // A failed request changes nothing here: an expired session answers the next real request with the login page.
    openmrsFetch(`${restBaseUrl}/session`).catch(() => undefined);
  }, []);

  const staySignedIn = useCallback(() => {
    lastActivity.current = Date.now();
    warningSince.current = null;
    setWarning(null);
    keepAlive();
  }, [keepAlive]);

  const signOut = useCallback(() => {
    warningSince.current = null;
    setWarning(null);
    navigate({ to: '${openmrsSpaBase}/logout' });
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onActivity = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, onActivity, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, onActivity));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timer = setInterval(() => {
      const now = Date.now();
      if (warningSince.current !== null) {
        if (now - warningSince.current >= warningMs) {
          signOut();
        } else {
          setWarning({ since: warningSince.current, now });
        }
        return;
      }
      if (now - lastActivity.current >= idleMs - warningMs) {
        warningSince.current = now;
        setWarning({ since: now, now });
        return;
      }
      // Active, with no request of their own for a while: keep the server's clock from running out.
      if (now - lastRequest.current >= keepAliveMs && now - lastActivity.current < keepAliveMs) {
        keepAlive();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [enabled, idleMs, warningMs, keepAliveMs, keepAlive, signOut]);

  if (!enabled || warning === null) {
    return null;
  }
  const remaining = countdown(warning.since + warningMs - warning.now);
  return (
    <ComposedModal open size="sm" preventCloseOnClickOutside onClose={() => false} data-testid="session-timeout">
      <ModalHeader title={t('sessionTimeoutTitle', 'Still there?')} />
      <ModalBody>
        <p>
          {t(
            'sessionTimeoutBody',
            'You have been inactive for a while. To keep your records safe you will be signed out in {{remaining}}, and anything typed into an open form will be lost.',
            { remaining },
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={signOut}>
          {t('signOut', 'Sign out')}
        </Button>
        <Button kind="primary" onClick={staySignedIn}>
          {t('staySignedIn', 'Stay signed in')}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
