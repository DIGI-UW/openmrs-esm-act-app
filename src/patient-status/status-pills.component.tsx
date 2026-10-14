import React from 'react';
import { useTranslation } from 'react-i18next';
import { type ProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { daysUntil, dueTone, fullDate, shortDate } from './due-tone';
import { StatusPill } from './status-pill.component';

/** Prophylaxis by its next dose; none without a regimen in force or for an oral one whose supply end is unknown. */
export function ProphylaxisPill({ summary }: { summary: ProphylaxisSummary | undefined }) {
  const { t } = useTranslation();
  if (!summary?.nextDue || summary.status === 'none') {
    return null;
  }
  const days = daysUntil(summary.nextDue);
  const tone = dueTone(days);
  const label =
    tone === 'red'
      ? t('prophylaxisOverdue', 'Prophylaxis overdue')
      : tone === 'green'
        ? t('prophylaxisUpToDate', 'Prophylaxis up to date')
        : days === 0
          ? t('prophylaxisDueToday', 'Prophylaxis due today')
          : t('prophylaxisDueOn', 'Prophylaxis due {{date}}', { date: shortDate(summary.nextDue) });

  return (
    <StatusPill
      tone={tone}
      label={label}
      title={t('dueOn', 'Due {{date}}', { date: fullDate(summary.nextDue) })}
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
