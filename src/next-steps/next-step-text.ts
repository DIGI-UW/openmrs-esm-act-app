import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fullDate } from '../patient-status/due-tone';
import { type NextStep } from './next-steps.resource';

const REASON_PREFIX = 'actcore.nextStep.reason.';

/**
 * Writes a next step's title and reason in the user's language from the message codes ACT Core sends with them.
 * A code this app does not know, as from a newer ACT Core, shows the text ACT Core wrote instead. The keys are
 * written out literally so that the translation check keeps them.
 */
export function useNextStepText() {
  const { t } = useTranslation();

  return useMemo(() => {
    const title = (step: NextStep) =>
      ({
        bpg: t('nextStepTitleBpg', 'Give BPG injection'),
        oral: t('nextStepTitleOral', 'Record oral prophylaxis visit'),
        consult: t('nextStepTitleConsult', 'Consultation visit'),
        echo: t('nextStepTitleEcho', 'Echocardiogram'),
        procedures: t('nextStepTitleProcedures', 'Procedures and outcomes'),
        inr: t('nextStepTitleInr', 'INR review'),
        patientInfo: t('nextStepTitlePatientInfo', 'Patient Information'),
        pregnancy: t('nextStepTitlePregnancy', 'Pregnancy'),
        refer: t('nextStepTitleRefer', 'Refer to clinician'),
      })[step.titleCode ? step.key : ''] ?? step.title;

    const reason = (step: NextStep) => {
      const code = step.reasonCode?.startsWith(REASON_PREFIX) ? step.reasonCode.slice(REASON_PREFIX.length) : null;
      const args = step.reasonArgs ?? [];
      const date = (value: unknown) => (typeof value === 'string' ? fullDate(value) : '');
      switch (code) {
        case 'anaphylaxisReview':
          return t('nextStepReasonAnaphylaxisReview', 'Anaphylaxis reported after BPG: review before the next dose');
        case 'anaphylaxisReferral':
          return t(
            'nextStepReasonAnaphylaxisReferral',
            'Anaphylaxis reported: a clinician must review before the next dose',
          );
        case 'deliveryOverdue':
          return t('nextStepReasonDeliveryOverdue', 'Delivery outcome overdue');
        case 'dueInDays':
          return t('nextStepReasonDueInDays', 'Due in {{count}} days', { count: Number(args[0]) });
        case 'dueToday':
          return t('nextStepReasonDueToday', 'Due today');
        case 'dueTomorrow':
          return t('nextStepReasonDueTomorrow', 'Due tomorrow');
        case 'echoOverdue':
          return t('nextStepReasonEchoOverdue', 'Last echo was over {{months}} months ago ({{date}})', {
            months: args[0],
            date: date(args[1]),
          });
        case 'enteredThisVisit':
          return t('nextStepReasonEnteredThisVisit', 'Entered this visit');
        case 'followUpDue':
          return t('nextStepReasonFollowUpDue', '30-day follow-up due');
        case 'inrDue':
          return t('nextStepReasonInrDue', 'INR review due');
        case 'inrDueOn':
          return t('nextStepReasonInrDueOn', 'INR review due {{date}}', { date: date(args[0]) });
        case 'inrOverdue':
          return t('nextStepReasonInrOverdue', 'INR review overdue: was due {{date}}', { date: date(args[0]) });
        case 'lowAdherenceReview':
          return t(
            'nextStepReasonLowAdherenceReview',
            'Oral adherence below {{percent}}%: a clinician to review the plan',
            {
              percent: args[0],
            },
          );
        case 'lowAdherenceSwitch':
          return t('nextStepReasonLowAdherenceSwitch', 'Oral adherence below {{percent}}%: consider switching to BPG', {
            percent: args[0],
          });
        case 'noEcho':
          return t('nextStepReasonNoEcho', 'No echocardiogram recorded');
        case 'notPrescribed':
          return t('nextStepReasonNotPrescribed', 'No prophylaxis prescribed');
        case 'notPrescribedReferral':
          return t('nextStepReasonNotPrescribedReferral', 'No prophylaxis prescribed: a clinician to prescribe');
        case 'onHoldConsult':
          return t('nextStepReasonOnHoldConsult', 'On hold: complete the consultation before giving BPG');
        case 'onHoldReview':
          return t('nextStepReasonOnHoldReview', 'On hold: a clinician must review before the next dose');
        case 'overdue':
          return t('nextStepReasonOverdue', 'Overdue: was due {{date}}', { date: date(args[0]) });
        case 'patientInfoNotRecorded':
          return t('nextStepReasonPatientInfoNotRecorded', 'Patient Information not recorded');
        case 'referralSent':
          return t('nextStepReasonReferralSent', 'Referral sent: a clinician to review');
        case 'reviewEcho':
          return t('nextStepReasonReviewEcho', 'Review the new echo result and update the care plan');
        default:
          return step.reason;
      }
    };

    return { title, reason };
  }, [t]);
}

/** Identifies a step and why it is listed, for telling a newly added step from one already shown. */
export function stepIdentity(step: NextStep) {
  return `${step.key}|${step.reasonCode ?? step.reason}|${JSON.stringify(step.reasonArgs ?? [])}`;
}
