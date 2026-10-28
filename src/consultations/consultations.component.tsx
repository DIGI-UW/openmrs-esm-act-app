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
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import { EditButton } from '../cardiac-tests/cardiac-tests.component';
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { type Consultation, useConsultations } from './consultations.resource';
import styles from '../cardiac-tests/cardiac-tests.scss';

const day = (date: Date | null) => (date ? formatDate(date, { time: false, noToday: true }) : '--');

/**
 * Start consultation, and Edit, which reopens a consultation in the form, for a user who may record the consultation
 * form; nothing for anyone else.
 */
export function useStartConsultation(patientUuid: string) {
  const { consultations } = useConfig<Config>();
  const { open, isOpening } = useOpenFormInVisit(patientUuid);
  const may = useMayEnterForm(consultations.form);
  return may
    ? {
        start: () => open(consultations.form),
        edit: (encounterUuid: string) => open(consultations.form, undefined, encounterUuid),
        isOpening,
      }
    : null;
}

/**
 * The Consultation visits page, as the prototype's: each RHD Consultation Visit, newest first, with who saw the
 * patient, the NYHA class, the prophylaxis plan and the next review, with Edit on each. Read-only for a user who may
 * not record one.
 */
export default function Consultations({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { consultations, error, isLoading } = useConsultations(patientUuid);
  const start = useStartConsultation(patientUuid);
  const title = t('consultationVisits', 'Consultation visits');
  const columns: Array<{ header: string; text: (visit: Consultation) => string }> = [
    { header: t('date', 'Date'), text: (visit) => day(visit.date) },
    { header: t('seenBy', 'Seen by'), text: (visit) => visit.seenBy || '--' },
    { header: t('nyhaClass', 'NYHA class'), text: (visit) => visit.nyha || '--' },
    { header: t('prophylaxisPlan', 'Prophylaxis plan'), text: (visit) => visit.plan || '--' },
    { header: t('nextReview', 'Next review'), text: (visit) => day(visit.nextReview) },
  ];

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !consultations.length) {
    return (
      <EmptyCard
        displayText={t('consultationVisitsLowercase', 'consultation visits')}
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
            {t('startConsultation', 'Start consultation')}
          </Button>
        )}
      </CardHeader>
      {isLoading ? (
        <DataTableSkeleton
          role="progressbar"
          columnCount={columns.length}
          compact={desktop}
          showHeader={false}
          showToolbar={false}
        />
      ) : (
        <div className={styles.tableContainer}>
          <Table size={desktop ? 'sm' : 'lg'} aria-label={title}>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeader key={column.header}>{column.header}</TableHeader>
                ))}
                {start && <TableHeader aria-label={t('edit', 'Edit')} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {consultations.map((visit) => (
                <TableRow key={visit.uuid} data-testid="consultation-row">
                  {columns.map((column) => (
                    <TableCell key={column.header}>{column.text(visit)}</TableCell>
                  ))}
                  {start && (
                    <TableCell>
                      <EditButton
                        label={t('editConsultation', 'Edit consultation of {{date}}', { date: day(visit.date) })}
                        disabled={start.isOpening}
                        onClick={() => start.edit(visit.uuid)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
