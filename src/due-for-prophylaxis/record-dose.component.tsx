import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { ConfigurableLink, useConfig, useSession } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { type ReportRow } from '../reports/report-dataset.resource';
import { openFormInChart } from '../visits/open-form-in-chart';
import { isOral } from './due-list';
import styles from './due-for-prophylaxis.scss';

/**
 * Opens a due row's next dose form in the patient's chart, one form at a time, as a second click while a visit is
 * starting would start a second visit.
 */
export function useRecordDose() {
  const { t } = useTranslation();
  const { visitType } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const [opening, setOpening] = useState(false);

  const record = async (row: ReportRow, formUuid: string) => {
    setOpening(true);
    try {
      await openFormInChart(t, {
        patientUuid: String(row.patient_uuid),
        formUuid,
        visitType,
        location: sessionLocation?.uuid,
      });
    } finally {
      setOpening(false);
    }
  };
  return { opening, record };
}

/** A due row's Record BPG or Record oral, View chart once recorded today, or Needs prescription without one. */
export function RecordDoseAction({
  row,
  recordedToday,
  disabled,
  onRecord,
}: {
  row: ReportRow;
  recordedToday: boolean;
  disabled?: boolean;
  onRecord: (row: ReportRow, formUuid: string) => void;
}) {
  const { t } = useTranslation();
  const { prophylaxisCard } = useConfig<Config>();
  if (row.status === 'no_prescription') {
    return <span className={styles.needsPrescription}>{t('needsPrescription', 'Needs prescription')}</span>;
  }
  if (recordedToday) {
    return <ConfigurableLink to={patientChartUrl(row.patient_uuid)}>{t('viewChart', 'View chart')}</ConfigurableLink>;
  }
  const oral = isOral(row);
  const form = oral ? prophylaxisCard.oralForm : prophylaxisCard.bpgForm;
  return (
    <MayEnterForm formUuid={form}>
      <Button kind="primary" size="sm" disabled={disabled} onClick={() => onRecord(row, form)}>
        {oral ? t('recordOral', 'Record oral') : t('recordBpg', 'Record BPG')}
      </Button>
    </MayEnterForm>
  );
}
