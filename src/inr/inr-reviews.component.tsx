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
  Tag,
} from '@carbon/react';
import {
  AddIcon,
  CardHeader,
  EmptyCard,
  ErrorState,
  formatDate,
  isDesktop,
  launchWorkspace2,
  useConfig,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import { EditButton } from '../cardiac-tests/cardiac-tests.component';
import { type Config } from '../config-schema';
import { PRIVILEGE_EDIT_ENCOUNTERS } from '../constants';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { launchInInrWindow } from './launch-inr-window';
import { type InrResult, type InrReview, useInrReviews } from './inr.resource';
import styles from '../cardiac-tests/cardiac-tests.scss';

const day = (date: Date | null) => (date ? formatDate(date, { time: false, noToday: true }) : '--');

/** Record INR and Edit for a user who may record the INR form; Edit also needs Edit Encounters. */
export function useRecordInr(patientUuid: string) {
  const { inrReviews } = useConfig<Config>();
  const { open, isOpening } = useOpenFormInVisit(patientUuid, launchInInrWindow);
  const { user } = useSession();
  const may = useMayEnterForm(inrReviews.form);
  const mayEdit = may && Boolean(user) && userHasAccess(PRIVILEGE_EDIT_ENCOUNTERS, user);
  return may
    ? {
        record: () => open(inrReviews.form),
        edit: mayEdit
          ? (encounterUuid: string, groupUuid: string | null) =>
              launchWorkspace2('act-inr-edit-workspace', { encounterUuid, groupUuid })
          : null,
        isOpening,
      }
    : null;
}

export function ResultTag({ result }: { result: InrResult }) {
  const { t } = useTranslation();
  if (result === 'unknown') {
    return <>--</>;
  }
  const tags = {
    inRange: { type: 'green', label: t('inRange', 'In range') },
    below: { type: 'warm-gray', label: t('belowRange', 'Below range') },
    above: { type: 'red', label: t('aboveRange', 'Above range') },
  } as const;
  return (
    <Tag size="sm" type={tags[result].type}>
      {tags[result].label}
    </Tag>
  );
}

/**
 * The INR reviews page, as the prototype's: each INR value an RHD INR Monitoring records, newest first, with its
 * target range, whether it falls in it, and the next INR date. Record INR, and Edit on each row, for a user who may
 * record one.
 */
export default function InrReviews({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { reviews, error, isLoading } = useInrReviews(patientUuid);
  const record = useRecordInr(patientUuid);
  const title = t('inrReviews', 'INR reviews');
  const columns: Array<{ header: string; cell: (review: InrReview) => React.ReactNode }> = [
    { header: t('date', 'Date'), cell: (review) => day(review.date) },
    { header: t('inr', 'INR'), cell: (review) => (review.inr === null ? '--' : String(review.inr)) },
    { header: t('targetRange', 'Target range'), cell: (review) => review.target || '--' },
    { header: t('result', 'Result'), cell: (review) => <ResultTag result={review.result} /> },
    { header: t('nextInr', 'Next INR'), cell: (review) => day(review.nextInr) },
  ];

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !reviews.length) {
    return (
      <EmptyCard
        displayText={t('inrReviewsLowercase', 'INR reviews')}
        headerTitle={title}
        launchForm={record?.record}
      />
    );
  }
  return (
    <div className={styles.card}>
      <CardHeader title={title}>
        {record && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={record.isOpening}
            onClick={record.record}
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
                {record?.edit && <TableHeader aria-label={t('edit', 'Edit')} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {reviews.map((review) => (
                <TableRow key={review.key} data-testid="inr-row">
                  {columns.map((column) => (
                    <TableCell key={column.header}>{column.cell(review)}</TableCell>
                  ))}
                  {record?.edit && (
                    <TableCell>
                      <EditButton
                        label={t('editInr', 'Edit INR of {{date}}', { date: day(review.date) })}
                        onClick={() => record.edit(review.encounterUuid, review.groupUuid)}
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
