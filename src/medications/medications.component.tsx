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

type Row = ReturnType<typeof useMedications>['active'][number];

/**
 * Add opens the Medication Update form, for a user who may record it. Edit reopens a medicine's latest record in its
 * own form, Medication Update or the consultation, for a user who may record that form.
 */
function useMedicationForms(patientUuid: string) {
  const { consultations, medications } = useConfig<Config>();
  const { open, isOpening } = useOpenFormInVisit(patientUuid);
  const mayUpdate = useMayEnterForm(medications.form);
  const mayConsult = useMayEnterForm(consultations.form);
  const mayEdit = (row: Row) => (row.form === medications.form ? mayUpdate : mayConsult);
  return {
    add: mayUpdate ? { add: () => open(medications.form), isOpening } : null,
    edit: (row: Row) => (mayEdit(row) ? () => open(row.form, undefined, row.encounterUuid) : null),
    isOpening,
  };
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
  columns: Array<Column<Row>>;
  rows: Array<Row>;
  isLoading: boolean;
  error?: Error;
  add?: ReturnType<typeof useMedicationForms>['add'];
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
 * consultations and Medication Update. Add, on either card, opens Medication Update, which records a medicine or stops
 * one, and Edit reopens the record a row comes from, where a Date Stopped moves it to Past.
 */
export default function Medications({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { active, past, error, isLoading } = useMedications(patientUuid);
  const forms = useMedicationForms(patientUuid);
  const startDate: Column<Row> = { header: t('startDate', 'Start date'), text: (one) => day(one.started) };
  const details: Column<Row> = {
    header: t('details', 'Details'),
    text: (one) => <Details medication={one} />,
  };
  const endDate: Column<Row> = { header: t('endDate', 'End date'), text: (one) => day(one.stopped) };
  const edit: Column<Row> = {
    header: '',
    text: (one) => {
      const open = forms.edit(one);
      return (
        open && (
          <Button
            kind="ghost"
            size="sm"
            disabled={forms.isOpening}
            aria-label={t('editMedicine', 'Edit {{medicine}}', {
              medicine: one.name,
              interpolation: { escapeValue: false },
            })}
            onClick={open}
          >
            {t('edit', 'Edit')}
          </Button>
        )
      );
    },
  };
  return (
    <div className={styles.cards}>
      <MedicationsCard
        title={t('activeMedications', 'Active medications')}
        lowercase={t('activeMedicationsLowercase', 'active medications')}
        columns={[startDate, details, endDate, edit]}
        rows={active}
        isLoading={isLoading}
        error={error}
        add={forms.add}
      />
      <MedicationsCard
        title={t('pastMedications', 'Past medications')}
        lowercase={t('pastMedicationsLowercase', 'past medications')}
        columns={[startDate, details, endDate, edit]}
        rows={past}
        isLoading={isLoading}
        error={error}
        add={forms.add}
      />
    </div>
  );
}
