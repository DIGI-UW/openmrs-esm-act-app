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
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { type InrResult, type InrReview, useInrReviews } from './inr.resource';
import styles from '../cardiac-tests/cardiac-tests.scss';

const day = (date: Date | null) => (date ? formatDate(date, { time: false }) : '--');

export function useResultLabel() {
  const { t } = useTranslation();
  return (result: InrResult) =>
    ({
      inRange: t('inRange', 'In range'),
      below: t('belowRange', 'Below range'),
      above: t('aboveRange', 'Above range'),
    })[result] ?? '--';
}

/** The chart's INR reviews: each reading, newest first, and Record INR for whoever may record one. */
export default function InrReviews({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { inr: config } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const { reviews, error, isLoading } = useInrReviews(patientUuid);
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const mayRecord = useMayEnterForm(config.form);
  const resultLabel = useResultLabel();
  const title = t('inrReviews', 'INR reviews');
  const record = () => openForm(config.form);
  const columns: Array<{ header: string; text: (review: InrReview) => string }> = [
    { header: t('date', 'Date'), text: (review) => day(review.date) },
    { header: t('inr', 'INR'), text: (review) => (review.inr == null ? '--' : String(review.inr)) },
    { header: t('targetRange', 'Target range'), text: (review) => review.target ?? '--' },
    { header: t('result', 'Result'), text: (review) => resultLabel(review.result) },
    { header: t('nextInr', 'Next INR'), text: (review) => day(review.nextInr) },
  ];

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !reviews.length) {
    return (
      <EmptyCard
        displayText={t('inrReviewsLowercase', 'INR reviews')}
        headerTitle={title}
        launchForm={mayRecord ? record : undefined}
      />
    );
  }
  return (
    <div className={styles.card}>
      <CardHeader title={title}>
        {mayRecord && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={isOpening}
            onClick={record}
          >
            {t('recordInr', 'Record INR')}
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
              {reviews.map((review) => (
                <TableRow key={review.key}>
                  {columns.map((column) => (
                    <TableCell key={column.header}>{column.text(review)}</TableCell>
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
