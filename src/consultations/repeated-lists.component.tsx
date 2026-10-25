import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  AddIcon,
  CardHeader,
  EmptyCard,
  ErrorState,
  formatDate,
  isDesktop,
  parseDate,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import Consultations, { useStartConsultation } from './consultations.component';
import { useConsultations } from './consultations.resource';
import { useDiagnoses } from './patient-details.resource';
import { toListedItems, toMedications } from './repeated-lists.resource';
import styles from '../cardiac-tests/cardiac-tests.scss';

const day = (date: string | null) => (date ? formatDate(parseDate(date), { time: false, noToday: true }) : '--');

interface Column<Row> {
  header: string;
  text: (row: Row) => string;
}

/** A compact table of rows, or a skeleton while they load. */
function CompactTable<Row extends { key: string }>({
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
 * Cardiac medications, as a table of what is active and what was used before, with when each started and stopped.
 * Add new opens the Consultation visit form, where the medication list is recorded, for a user who may record it.
 */
export function CardiacMedications({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { consultations } = useConfig<Config>();
  const { encounters, error, isLoading } = useConsultations(patientUuid);
  const start = useStartConsultation(patientUuid);
  const title = t('cardiacMedications', 'Cardiac medications');
  const { active, past } = toMedications(encounters, consultations.concepts);
  const columns = [
    { header: t('medicine', 'Medicine'), text: (one: (typeof active)[number]) => one.name },
    { header: t('dose', 'Dose'), text: (one: (typeof active)[number]) => one.dose || '--' },
    { header: t('interval', 'Interval'), text: (one: (typeof active)[number]) => one.interval || '--' },
    { header: t('started', 'Started'), text: (one: (typeof active)[number]) => day(one.started) },
    { header: t('stopped', 'Stopped'), text: (one: (typeof active)[number]) => day(one.stopped) },
  ];

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !active.length && !past.length) {
    return (
      <EmptyCard
        displayText={t('cardiacMedicationsLowercase', 'cardiac medications')}
        headerTitle={title}
        launchForm={start?.start}
      />
    );
  }
  return (
    <div className={styles.card}>
      <CardHeader title={title}>
        {start && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={start.isOpening}
            onClick={start.start}
          >
            {t('addNew', 'Add new')}
          </Button>
        )}
      </CardHeader>
      <h5 className={styles.findingLabel}>{t('activeMedications', 'Active')}</h5>
      {!isLoading && !active.length ? (
        <p>{t('noActiveMedications', 'No active medications.')}</p>
      ) : (
        <CompactTable title={t('activeMedications', 'Active')} columns={columns} rows={active} isLoading={isLoading} />
      )}
      <h5 className={styles.findingLabel}>{t('pastMedications', 'Past')}</h5>
      {!isLoading && !past.length ? (
        <p>{t('noPastMedications', 'No past medications.')}</p>
      ) : (
        <CompactTable title={t('pastMedications', 'Past')} columns={columns} rows={past} isLoading={isLoading} />
      )}
    </div>
  );
}

/** Every diagnosis the patient's Patient Information records, as a table. Read only. */
export function Diagnoses({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { diagnoses, error, isLoading } = useDiagnoses(patientUuid);
  const title = t('diagnoses', 'Diagnoses');
  type Row = (typeof diagnoses)[number];
  const columns: Array<Column<Row>> = [
    { header: t('diagnosis', 'Diagnosis'), text: (one) => one.diagnosis },
    { header: t('priority', 'Priority'), text: (one) => one.priority || '--' },
    { header: t('active', 'Active'), text: (one) => one.active || '--' },
    { header: t('started', 'Started'), text: (one) => day(one.started) },
    { header: t('ended', 'Ended'), text: (one) => day(one.ended) },
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

/** One of the consultation's repeated lists as a name and date added table. */
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
      <CardiacMedications patientUuid={patientUuid} />
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
