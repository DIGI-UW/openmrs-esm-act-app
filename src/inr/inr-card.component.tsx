import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { AddIcon, CardHeader, formatDate, useConfig } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { useConsultationSummary } from '../consultations/consultations.resource';
import { SummaryFields } from '../styles/summary-fields.component';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { useInrSummary } from './inr.resource';
import styles from '../styles/summary-card.scss';

const day = (date: Date | null) => (date ? formatDate(date, { time: false }) : null);

/** The patient summary's INR review, for a patient on warfarin: the last INR, target, next INR due and dose. */
export default function InrCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { inr: config } = useConfig<Config>();
  const { onWarfarin, warfarinDosing, isLoading: consultationsLoading } = useConsultationSummary(patientUuid);
  const { lastReading, target, nextInr, lastDose, isLoading, error } = useInrSummary(onWarfarin ? patientUuid : null);
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);

  if (!onWarfarin || error) {
    return null;
  }
  // The newer of the dose the latest consultation prescribed and the one an INR review changed it to.
  const dose =
    lastDose && (!warfarinDosing || lastDose.date >= warfarinDosing.date) ? lastDose.newDose : warfarinDosing?.dose;
  return (
    <div className={styles.card}>
      <CardHeader title={t('inrReview', 'INR review')}>
        <MayEnterForm formUuid={config.form}>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={isOpening}
            onClick={() => openForm(config.form)}
          >
            {t('recordInr', 'Record INR')}
          </Button>
        </MayEnterForm>
      </CardHeader>
      <SummaryFields
        fields={
          isLoading || consultationsLoading
            ? null
            : [
                {
                  label: t('lastInr', 'Last INR'),
                  value: lastReading ? `${lastReading.inr} · ${day(lastReading.date)}` : null,
                },
                { label: t('targetRange', 'Target range'), value: target },
                { label: t('nextInrDue', 'Next INR due'), value: day(nextInr) },
                { label: t('warfarinDose', 'Warfarin dose'), value: dose ?? null },
              ]
        }
      />
    </div>
  );
}
