import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { AddIcon, CardHeader, EmptyCard, ErrorState, useConfig } from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { type Column, CompactTable, day } from '../consultations/repeated-lists.component';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { type Medication, useMedications } from './medications.resource';
import styles from './medications.scss';

/** Add opens the Medication Update form, for a user who may record it. */
function useAddMedication(patientUuid: string) {
  const { medications } = useConfig<Config>();
  const { open, isOpening } = useOpenFormInVisit(patientUuid);
  const may = useMayEnterForm(medications.form);
  return may ? { add: () => open(medications.form), isOpening } : null;
}

/** A medicine as OpenMRS's medication list reads one: its name in bold, then its dose and interval. */
function Details({ medication }: { medication: Medication }) {
  const { t } = useTranslation();
  return (
    <>
      <strong>{medication.name}</strong>
      {medication.dose && (
        <>
          {' · '}
          <span className={styles.label}>{t('dose', 'Dose').toUpperCase()}</span> {medication.dose}
        </>
      )}
      {medication.interval && <>{` · ${medication.interval}`}</>}
    </>
  );
}

function MedicationsCard({
  title,
  lowercase,
  columns,
  rows,
  isLoading,
  error,
  add,
}: {
  title: string;
  lowercase: string;
  columns: Array<Column<Medication>>;
  rows: Array<Medication>;
  isLoading: boolean;
  error?: Error;
  add?: ReturnType<typeof useAddMedication>;
}) {
  const { t } = useTranslation();
  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !rows.length) {
    return <EmptyCard displayText={lowercase} headerTitle={title} launchForm={add?.add} />;
  }
  return (
    <div className={styles.card}>
      <CardHeader title={title}>
        {add && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={add.isOpening}
            onClick={add.add}
          >
            {t('add', 'Add')}
          </Button>
        )}
      </CardHeader>
      <CompactTable title={title} columns={columns} rows={rows} isLoading={isLoading} />
    </div>
  );
}

/**
 * The patient chart's Medications page, as OpenMRS's: the cardiac medicines taken now and those stopped, from
 * consultations and Medication Update. Add opens Medication Update, which records a medicine or stops one.
 */
export default function Medications({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { active, past, error, isLoading } = useMedications(patientUuid);
  const add = useAddMedication(patientUuid);
  const startDate: Column<Medication> = { header: t('startDate', 'Start date'), text: (one) => day(one.started) };
  const details: Column<Medication> = {
    header: t('details', 'Details'),
    text: (one) => <Details medication={one} />,
  };
  return (
    <div className={styles.cards}>
      <MedicationsCard
        title={t('activeMedications', 'Active medications')}
        lowercase={t('activeMedicationsLowercase', 'active medications')}
        columns={[startDate, details]}
        rows={active}
        isLoading={isLoading}
        error={error}
        add={add}
      />
      <MedicationsCard
        title={t('pastMedications', 'Past medications')}
        lowercase={t('pastMedicationsLowercase', 'past medications')}
        columns={[startDate, details, { header: t('endDate', 'End date'), text: (one) => day(one.stopped) }]}
        rows={past}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
