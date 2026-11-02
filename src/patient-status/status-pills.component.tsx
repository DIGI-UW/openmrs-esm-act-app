import React from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { type ProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { daysUntil, dueTone, fullDate, shortDate } from './due-tone';
import { type PillTone, StatusPill } from './status-pill.component';

/**
 * A prescription with no dose yet, oral included, has its first dose due; an oral one with no known supply end, none.
 */
export function ProphylaxisPill({
  summary,
  showNoPrescription = true,
}: {
  summary: ProphylaxisSummary | undefined;
  showNoPrescription?: boolean;
}) {
  const { t } = useTranslation();
  if (summary?.bpgOnHold) {
    return (
      <StatusPill
        tone="red"
        label={t('bpgOnHold', 'BPG on hold')}
        title={t('bpgOnHoldReason', 'Anaphylaxis reported after BPG: a clinician must review before the next dose')}
        testId="prophylaxis-status"
      />
    );
  }
  if (!summary) {
    return null;
  }
  if (summary.status === 'none') {
    return showNoPrescription ? (
      <StatusPill
        tone="red"
        label={t('noProphylaxisPrescription', 'No prophylaxis prescription')}
        testId="prophylaxis-status"
      />
    ) : null;
  }
  const pill: { tone: PillTone; label: string } | null =
    summary.status === 'overdue'
      ? { tone: 'red', label: t('prophylaxisOverdue', 'Prophylaxis overdue') }
      : !summary.lastGiven
        ? { tone: 'blue', label: t('prescribedFirstDoseDue', 'Prescribed, first dose due') }
        : summary.status === 'dueToday' || summary.status === 'dueSoon'
          ? { tone: 'yellow', label: t('prophylaxisDueSoon', 'Prophylaxis due soon') }
          : summary.status === 'ok'
            ? { tone: 'green', label: t('prophylaxisUpToDate', 'Prophylaxis up to date') }
            : null;
  if (!pill) {
    return null;
  }
  return (
    <StatusPill
      tone={pill.tone}
      label={pill.label}
      title={summary.nextDue ? t('dueOn', 'Due {{date}}', { date: fullDate(summary.nextDue) }) : undefined}
      testId="prophylaxis-status"
    />
  );
}

/** The next cardiology review; none without a review date. */
export function CardiologyPill({ nextDue }: { nextDue: string | null }) {
  const { t } = useTranslation();
  if (!nextDue) {
    return null;
  }
  const days = daysUntil(nextDue);
  const tone = dueTone(days);
  const label =
    tone === 'red'
      ? t('cardiologyVisitOverdue', 'Cardiology visit overdue')
      : days === 0
        ? t('cardiologyVisitDueToday', 'Cardiology visit due today')
        : t('cardiologyVisitDueOn', 'Cardiology visit due {{date}}', { date: shortDate(nextDue) });

  return (
    <StatusPill
      tone={tone}
      label={label}
      title={t('dueOn', 'Due {{date}}', { date: fullDate(nextDue) })}
      testId="cardiology-status"
    />
  );
}

/** INR, for a patient on warfarin, when the next INR is due within 48 hours or overdue; none further ahead. */
export function InrPill({ nextInr }: { nextInr: Date | null }) {
  const { t } = useTranslation();
  if (!nextInr) {
    return null;
  }
  const due = dayjs(nextInr).format('YYYY-MM-DD');
  const days = daysUntil(due);
  const tone = dueTone(days);
  if (tone === 'green') {
    return null;
  }
  const label =
    tone === 'red'
      ? t('inrOverdue', 'INR overdue')
      : days === 0
        ? t('inrDueToday', 'INR due today')
        : t('inrDueOn', 'INR due {{date}}', { date: shortDate(due) });
  return (
    <StatusPill
      tone={tone}
      label={label}
      title={t('dueOn', 'Due {{date}}', { date: fullDate(due) })}
      testId="inr-status"
    />
  );
}
