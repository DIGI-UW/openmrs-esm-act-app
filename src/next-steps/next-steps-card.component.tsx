import React, { useEffect, useRef } from 'react';
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
} from '@carbon/react/icons';
import {
  CardHeader,
  launchWorkspace2,
  showSnackbar,
  useConfig,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PRIVILEGE_ADD_ENCOUNTERS } from '../constants';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { type NextStep, useNextSteps, usePublishedForms } from './next-steps.resource';
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
function useFormCount() {
  const { user } = useSession();
  const forms = usePublishedForms();
  if (!user) {
    return 0;
  }
  return forms.filter((form) =>
    userHasAccess([PRIVILEGE_ADD_ENCOUNTERS, form.encounterType?.editPrivilege?.display].filter(Boolean), user),
  ).length;
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
  const formCount = useFormCount();
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

  if (!nextSteps.enabled || error) {
    return null;
  }
  const firstName = patient?.name?.[0]?.given?.[0] ?? '';

  return (
    <div className={cardStyles.card}>
      <CardHeader title={t('nextStepsForThisVisit', 'Next steps for this visit')}>
        <Button kind="ghost" size="sm" onClick={() => launchWorkspace2('clinical-forms-workspace')}>
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
                  </span>
                  <span className={styles.reason}>{step.reason}</span>
                </div>
                {step.done ? (
                  <span className={styles.completed}>
                    <CheckmarkFilled size={16} aria-hidden />
                    {t('completed', 'Completed')}
                  </span>
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
