import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import { ChartTableCard, type ChartTableColumn } from '../chart-pages/chart-table-card.component';
import { type Config } from '../config-schema';
import { day } from '../patient-encounters';
import { type Consultation, useConsultations } from './consultations.resource';

/** The chart's Consultation visits: each consultation, newest first, and Start consultation for whoever may record one. */
export default function ConsultationVisits({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { consultations: config } = useConfig<Config>();
  const { consultations, error, isLoading } = useConsultations(patientUuid);
  const columns: Array<ChartTableColumn<Consultation>> = [
    { header: t('date', 'Date'), text: (consultation) => day(consultation.date) ?? '--' },
    { header: t('seenBy', 'Seen by'), text: (consultation) => consultation.seenBy.join(', ') || '--' },
    { header: t('nyhaClass', 'NYHA class'), text: (consultation) => consultation.nyha ?? '--' },
    { header: t('prophylaxisPlan', 'Prophylaxis plan'), text: (consultation) => consultation.plan.join(', ') || '--' },
    { header: t('nextReview', 'Next review'), text: (consultation) => day(consultation.nextReview) ?? '--' },
  ];
  return (
    <ChartTableCard
      patientUuid={patientUuid}
      title={t('consultationVisits', 'Consultation visits')}
      rowsName={t('consultationVisitsLowercase', 'consultation visits')}
      form={config.form}
      actionLabel={t('startConsultation', 'Start consultation')}
      columns={columns}
      rows={consultations}
      rowKey={(consultation) => consultation.uuid}
      isLoading={isLoading}
      error={error}
    />
  );
}
