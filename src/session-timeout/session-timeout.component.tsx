import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ComposedModal, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { getCoreTranslation, navigate, openmrsFetch, restBaseUrl, useConfig, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

/** What counts as the user being at the keyboard. */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

const TICK_MS = 1000;

const MINUTE_MS = 60_000;

/** Where each tab tells the others when the user was last active, since a sign-out ends the session for all of them. */
const activityKey = 'act-session-last-activity';

const SHARE_MS = 5000;

/** Where a tab that signs out tells the others, which otherwise learn of it only when their next request fails. */
const signedOutKey = 'act-session-signed-out';

/** The seconds left as m:ss. */
export function countdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Warns before the server's idle timeout signs the user out, as ACT 2.0 did, and keeps the session alive while they
 * are active, since a long unsaved form makes no request of its own.
 */
export default function SessionTimeout() {
  const { t } = useTranslation();
  const { sessionTimeout } = useConfig<Config>();
  const { authenticated } = useSession();
  const idleMs = sessionTimeout.idleMinutes * MINUTE_MS;
  const warningMs = sessionTimeout.warningMinutes * MINUTE_MS;
  const keepAliveMs = sessionTimeout.keepAliveMinutes * MINUTE_MS;
  const enabled = authenticated && idleMs > 0 && warningMs > 0 && warningMs < idleMs;
  // The timer reads the clock from refs; `warning` only draws the modal.
  const lastActivity = useRef(Date.now());
  const lastShared = useRef(0);
  const lastRequest = useRef(Date.now());
  const warningSince = useRef<number | null>(null);
  const signingOut = useRef(false);
  const [warning, setWarning] = useState<{ since: number; now: number } | null>(null);

  const signOut = useCallback(() => {
    // A logout that fails leaves the timer past the idle time, which would navigate again every tick.
    if (signingOut.current) {
      return;
    }
    signingOut.current = true;
    warningSince.current = null;
    setWarning(null);
    try {
      window.localStorage.setItem(signedOutKey, String(Date.now()));
    } catch {
      // The other tabs then find out from their next request.
    }
    navigate({ to: '${openmrsSpaBase}/logout' });
  }, []);

  const keepAlive = useCallback(() => {
    lastRequest.current = Date.now();
    // A session that has already ended still answers 200, saying it is not authenticated.
    openmrsFetch<{ authenticated?: boolean }>(`${restBaseUrl}/session`)
      .then(({ data }) => data?.authenticated === false && signOut())
      .catch(() => undefined);
  }, [signOut]);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    // Input after a sleep past the idle time can reach here before the timer does.
    if (now - lastActivity.current >= idleMs) {
      signOut();
      return;
    }
    lastActivity.current = now;
    // An open warning waits for a choice, so a nudge here leaves other tabs' warnings open too.
    if (warningSince.current !== null || now - lastShared.current < SHARE_MS) {
      return;
    }
    lastShared.current = now;
    try {
      window.localStorage.setItem(activityKey, String(now));
    } catch {
      // Without local storage each tab keeps its own clock, as if it were the only one open.
    }
  }, [idleMs, signOut]);

  const staySignedIn = useCallback(() => {
    warningSince.current = null;
    setWarning(null);
    recordActivity();
    keepAlive();
  }, [recordActivity, keepAlive]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onOtherTab = (event: StorageEvent) => {
      if (event.key === signedOutKey && event.newValue) {
        // The session is gone for this tab too; the login page is better than a failed save.
        warningSince.current = null;
        setWarning(null);
        navigate({ to: '${openmrsSpaBase}/login' });
        return;
      }
      const activeAt = Number(event.newValue);
      if (event.key !== activityKey || !(activeAt > lastActivity.current)) {
        return;
      }
      lastActivity.current = activeAt;
      warningSince.current = null;
      setWarning(null);
    };
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener('storage', onOtherTab);
    return () => {
      ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, recordActivity));
      window.removeEventListener('storage', onOtherTab);
    };
  }, [enabled, recordActivity]);

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
      // Past the idle time there is nothing left to warn about.
      if (now - lastActivity.current >= idleMs) {
        signOut();
        return;
      }
      if (now - lastActivity.current >= idleMs - warningMs) {
        warningSince.current = now;
        setWarning({ since: now, now });
        return;
      }
      // While the user is active, keep the server's clock from running out.
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
      <ModalHeader iconDescription={getCoreTranslation('close')} title={t('sessionTimeoutTitle', 'Still there?')} />
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
