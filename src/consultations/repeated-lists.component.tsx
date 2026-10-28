import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import {
  CardHeader,
  EmptyCard,
  ErrorState,
  formatDate,
  isDesktop,
  parseDate,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import { EditButton } from '../cardiac-tests/cardiac-tests.component';
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import Consultations, { useStartConsultation } from './consultations.component';
import { useConsultations } from './consultations.resource';
import { useDiagnoses } from './patient-details.resource';
import { toListedItems } from './repeated-lists.resource';
import styles from '../cardiac-tests/cardiac-tests.scss';

export const day = (date: string | null) => (date ? formatDate(parseDate(date), { time: false, noToday: true }) : '--');

export interface Column<Row> {
  header: string;
  text: (row: Row) => React.ReactNode;
}

/** A compact table of rows, or a skeleton while they load. */
export function CompactTable<Row extends { key: string }>({
  title,
  columns,
  rows,
  isLoading,
}: {
  title: string;
  columns: Array<Column<Row>>;
  rows: Array<Row>;
  isLoading: boolean;
}) {
  const desktop = isDesktop(useLayoutType());
  if (isLoading) {
    return (
      <DataTableSkeleton
        role="progressbar"
        columnCount={columns.length}
        compact={desktop}
        showHeader={false}
        showToolbar={false}
      />
    );
  }
  return (
    <div className={styles.tableContainer}>
      <Table size={desktop ? 'sm' : 'lg'} aria-label={title}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableHeader key={column.header}>{column.header}</TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} data-testid="repeated-row">
              {columns.map((column) => (
                <TableCell key={column.header}>{column.text(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Every diagnosis the patient's Patient Information records, as a table, with Edit, which reopens that Patient
 * Information, for a user who may record it.
 */
export function Diagnoses({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { patientInformationForm } = useConfig<Config>();
  const { diagnoses, error, isLoading } = useDiagnoses(patientUuid);
  const mayEdit = useMayEnterForm(patientInformationForm);
  const { open, isOpening } = useOpenFormInVisit(patientUuid);
  const title = t('diagnoses', 'Diagnoses');
  type Row = (typeof diagnoses)[number];
  const columns: Array<Column<Row>> = [
    { header: t('diagnosis', 'Diagnosis'), text: (one) => one.diagnosis },
    { header: t('active', 'Active'), text: (one) => one.active || '--' },
    { header: t('started', 'Started'), text: (one) => day(one.started) },
    { header: t('ended', 'Ended'), text: (one) => day(one.ended) },
    ...(mayEdit
      ? [
          {
            header: '',
            text: (one: Row) => (
              <EditButton
                label={t('editDiagnosis', 'Edit {{diagnosis}}', {
                  diagnosis: one.diagnosis,
                  interpolation: { escapeValue: false },
                })}
                disabled={isOpening}
                onClick={() => open(patientInformationForm, undefined, one.encounterUuid)}
              />
            ),
          },
        ]
      : []),
  ];
  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !diagnoses.length) {
    return <EmptyCard displayText={t('diagnosesLowercase', 'diagnoses')} headerTitle={title} />;
  }
  return (
    <div className={styles.card}>
      <CardHeader title={title}>{null}</CardHeader>
      <CompactTable title={title} columns={columns} rows={diagnoses} isLoading={isLoading} />
    </div>
  );
}

/**
 * One of the consultation's repeated lists as a name and date added table, with Edit, which reopens the latest
 * consultation that records the item, for a user who may record one. Edit names that consultation's date: the list
 * merges every consultation, so an item an older one also records stays listed after it is removed from this one.
 */
function ListedItems({
  patientUuid,
  list,
  title,
  lowercase,
}: {
  patientUuid: string;
  list: 'chronicCondition' | 'allergy' | 'complication';
  title: string;
  lowercase: string;
}) {
  const { t } = useTranslation();
  const { consultations } = useConfig<Config>();
  const { encounters, error, isLoading } = useConsultations(patientUuid);
  const items = toListedItems(encounters, consultations.concepts, consultations.concepts[list]);
  const start = useStartConsultation(patientUuid);
  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !items.length) {
    return <EmptyCard displayText={lowercase} headerTitle={title} />;
  }
  return (
    <div className={styles.card}>
      <CardHeader title={title}>{null}</CardHeader>
      <CompactTable
        title={title}
        columns={[
          { header: t('name', 'Name'), text: (one) => one.name },
          { header: t('dateAdded', 'Date added'), text: (one) => day(one.added) },
          ...(start
            ? [
                {
                  header: '',
                  text: (one: (typeof items)[number]) => (
                    <EditButton
                      label={t('editListedItem', 'Edit {{item}} in the consultation of {{date}}', {
                        item: one.name,
                        date: day(one.encounterDate),
                        interpolation: { escapeValue: false },
                      })}
                      disabled={start.isOpening}
                      onClick={() => start.edit(one.encounterUuid)}
                    />
                  ),
                },
              ]
            : []),
        ]}
        rows={items}
        isLoading={isLoading}
      />
    </div>
  );
}

/** The Consultation visits page: the visits, then the lists a consultation keeps adding to, each as a table. */
export default function ConsultationsPage({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.cards}>
      <Consultations patientUuid={patientUuid} />
      <Diagnoses patientUuid={patientUuid} />
      <ListedItems
        patientUuid={patientUuid}
        list="chronicCondition"
        title={t('chronicConditions', 'Chronic health conditions')}
        lowercase={t('chronicConditionsLowercase', 'chronic health conditions')}
      />
      <ListedItems
        patientUuid={patientUuid}
        list="allergy"
        title={t('allergies', 'Allergies')}
        lowercase={t('allergiesLowercase', 'allergies')}
      />
      <ListedItems
        patientUuid={patientUuid}
        list="complication"
        title={t('rhdComplications', 'RHD complications')}
        lowercase={t('rhdComplicationsLowercase', 'RHD complications')}
      />
    </div>
  );
}
