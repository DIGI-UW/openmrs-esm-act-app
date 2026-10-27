import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SkeletonText, Tag } from '@carbon/react';
import {
  Activity,
  CheckmarkFilled,
  Chemistry,
  Hospital,
  Medication,
  Pills,
  Stethoscope,
  UserFollow,
  UserMultiple,
} from '@carbon/react/icons';
import { useSWRConfig } from 'swr';
import { CardHeader, showSnackbar, useConfig, usePatient, useSession, userHasAccess } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PRIVILEGE_ADD_ENCOUNTERS, PRIVILEGE_SEND_REFERRAL } from '../constants';
import { mayEnter } from '../access/may-enter-form';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { launchInClinicalFormsWindow } from '../visits/launch-in-clinical-forms-window';
import { restErrorMessage } from '../rest-error-message';
import { sendReferral } from './send-referral';
import { type NextStep, nextStepsKey, useNextSteps, usePublishedForms } from './next-steps.resource';
import cardStyles from '../styles/summary-card.scss';
import styles from './next-steps-card.scss';

const icons = {
  bpg: Medication,
  oral: Pills,
  consult: Stethoscope,
  echo: Activity,
  procedures: Hospital,
  inr: Chemistry,
  refer: UserFollow,
  pregnancy: UserMultiple,
};

function useActionLabel() {
  const { t } = useTranslation();
  return (step: NextStep) =>
    ({
      bpg: t('recordBpg', 'Record BPG'),
      oral: t('recordOral', 'Record oral'),
      echo: t('enterResult', 'Enter result'),
    })[step.key] ?? t('start', 'Start');
}

/** How many forms the user may open from Clinical forms: Add Encounters and each form's edit privilege, if any. */
function useFormCount(patientUuid: string, enabled: boolean) {
  const { user } = useSession();
  const forms = usePublishedForms(patientUuid, enabled);
  if (!user) {
    return 0;
  }
  return forms.filter((form) => mayEnter(form, user)).length;
}

/** The steps a newer list adds that are still to do, to name in the toast after a save. */
function addedSteps(before: Array<NextStep>, after: Array<NextStep>) {
  const known = new Set(before.filter((step) => !step.done).map((step) => `${step.key}|${step.reason}`));
  return after.filter((step) => step.isNew && !step.done && !known.has(`${step.key}|${step.reason}`));
}

/** The patient summary's next steps for this visit, from ACT Core's rules over the patient's forms. */
export default function NextStepsCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { nextSteps } = useConfig<Config>();
  const { steps, error } = useNextSteps(nextSteps.enabled ? patientUuid : null);
  const { patient } = usePatient(patientUuid);
  const { open, isOpening } = useOpenFormInVisit(patientUuid);
  const actionLabel = useActionLabel();
  const { user, sessionLocation } = useSession();
  const { mutate } = useSWRConfig();
  const [sending, setSending] = useState(false);
  const sendingNow = useRef(false);
  const maySendReferral = Boolean(user) && userHasAccess([PRIVILEGE_ADD_ENCOUNTERS, PRIVILEGE_SEND_REFERRAL], user);
  const formCount = useFormCount(patientUuid, nextSteps.enabled);
  const previous = useRef<Array<NextStep>>(null);

  useEffect(() => {
    if (!steps) {
      return;
    }
    // The first list is what the patient needs; a later one follows a save.
    const added = previous.current ? addedSteps(previous.current, steps) : [];
    previous.current = steps;
    if (added.length) {
      showSnackbar({
        kind: 'info',
        title: t('nextStepAdded', 'Next step added: {{steps}}', { steps: added.map((step) => step.title).join(', ') }),
      });
    }
  }, [steps, t]);

  // A failed refetch keeps the last list; only a first load that fails hides the card.
  if (!nextSteps.enabled || (error && !steps)) {
    return null;
  }
  const firstName = patient?.name?.[0]?.given?.[0] ?? '';

  const send = async (referralType: string) => {
    // State disables the button only after a render, so a second click in the same tick needs the ref.
    if (sendingNow.current) {
      return;
    }
    if (!sessionLocation?.uuid) {
      showSnackbar({
        kind: 'error',
        title: t('referralNotSent', 'The referral could not be sent'),
        subtitle: t('referralNeedsLocation', 'Choose a login location first'),
      });
      return;
    }
    sendingNow.current = true;
    setSending(true);
    try {
      await sendReferral(patientUuid, referralType, sessionLocation.uuid);
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('referralNotSent', 'The referral could not be sent'),
        subtitle: restErrorMessage(e),
      });
      sendingNow.current = false;
      setSending(false);
      return;
    }
    showSnackbar({
      kind: 'success',
      title: t('referralSent', 'Referral sent'),
      subtitle: t('referralSentSubtitle', 'The cardiac clinic will see it on their worklist'),
    });
    try {
      await mutate(nextStepsKey(patientUuid));
    } finally {
      sendingNow.current = false;
      setSending(false);
    }
  };

  return (
    <div className={cardStyles.card}>
      <CardHeader title={t('nextStepsForThisVisit', 'Next steps for this visit')}>
        <Button kind="ghost" size="sm" onClick={() => launchInClinicalFormsWindow('clinical-forms-workspace')}>
          {t('allFormsCount', 'All forms ({{count}})', { count: formCount })}
        </Button>
      </CardHeader>
      <p className={styles.subtitle}>
        {t('formsShowUpWhenNeeded', 'Forms show up here only when {{name}} needs them', { name: firstName })}
      </p>
      {!steps ? (
        <div data-testid="next-steps-loading" className={styles.loading}>
          <SkeletonText paragraph lineCount={2} />
        </div>
      ) : !steps.length ? (
        <p className={styles.empty}>{t('nothingDueToday', 'Nothing due for this patient today.')}</p>
      ) : (
        <ul className={styles.steps}>
          {steps.map((step) => {
            const Icon = icons[step.key] ?? Activity;
            return (
              <li
                key={step.key}
                className={styles.step}
                data-new={step.isNew && !step.done ? 'true' : undefined}
                data-done={step.done ? 'true' : undefined}
              >
                <Icon size={20} className={styles.icon} aria-hidden />
                <div className={styles.text}>
                  <span className={styles.title}>
                    {step.title}
                    {step.isNew && !step.done && (
                      <Tag type="blue" size="sm" className={styles.newTag}>
                        {t('new', 'New')}
                      </Tag>
                    )}
                    {step.onHold && !step.done && (
                      <Tag type="gray" size="sm" className={styles.newTag} data-testid="step-on-hold">
                        {t('onHold', 'On hold')}
                      </Tag>
                    )}
                  </span>
                  <span className={styles.reason}>{step.reason}</span>
                </div>
                {step.done ? (
                  <span className={styles.completed}>
                    <CheckmarkFilled size={16} aria-hidden />
                    {t('completed', 'Completed')}
                  </span>
                ) : step.key === 'refer' ? (
                  step.referralType &&
                  maySendReferral && (
                    <Button kind="ghost" size="sm" disabled={sending} onClick={() => send(step.referralType)}>
                      {t('sendReferral', 'Send referral')}
                    </Button>
                  )
                ) : (
                  step.form && (
                    <Button kind="ghost" size="sm" disabled={isOpening} onClick={() => open(step.form)}>
                      {actionLabel(step)}
                    </Button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
