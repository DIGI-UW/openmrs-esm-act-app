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
  isDesktop,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { day } from '../patient-encounters';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { type Consultation, useConsultations } from './consultations.resource';
import styles from '../cardiac-tests/cardiac-tests.scss';

/** The chart's Consultation visits: each consultation, newest first, and Start consultation for whoever may record one. */
export default function ConsultationVisits({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { consultations: config } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const { consultations, error, isLoading } = useConsultations(patientUuid);
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const mayStart = useMayEnterForm(config.form);
  const title = t('consultationVisits', 'Consultation visits');
  const start = () => openForm(config.form);
  const columns: Array<{ header: string; text: (consultation: Consultation) => string }> = [
    { header: t('date', 'Date'), text: (consultation) => day(consultation.date) ?? '--' },
    { header: t('seenBy', 'Seen by'), text: (consultation) => consultation.seenBy.join(', ') || '--' },
    { header: t('nyhaClass', 'NYHA class'), text: (consultation) => consultation.nyha ?? '--' },
    { header: t('prophylaxisPlan', 'Prophylaxis plan'), text: (consultation) => consultation.plan.join(', ') || '--' },
    { header: t('nextReview', 'Next review'), text: (consultation) => day(consultation.nextReview) ?? '--' },
  ];

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !consultations.length) {
    return (
      <EmptyCard
        displayText={t('consultationVisitsLowercase', 'consultation visits')}
        headerTitle={title}
        launchForm={mayStart ? start : undefined}
      />
    );
  }
  return (
    <div className={styles.card}>
      <CardHeader title={title}>
        {mayStart && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={isOpening}
            onClick={start}
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
              </TableRow>
            </TableHead>
            <TableBody>
              {consultations.map((consultation) => (
                <TableRow key={consultation.uuid}>
                  {columns.map((column) => (
                    <TableCell key={column.header}>{column.text(consultation)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
