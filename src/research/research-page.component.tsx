import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Add, Edit } from '@carbon/react/icons';
import {
  CardHeader,
  ErrorState,
  formatDate,
  isDesktop,
  parseDate,
  showSnackbar,
  useConfig,
  useLayoutType,
  UserHasAccess,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PRIVILEGE_ENTER_CLINICAL_FORMS } from '../constants';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { EnrollmentModal } from './enrollment-modal.component';
import { saveResearchOptIn, type StudyEnrollment, useResearchAnswers, useStudyEnrollments } from './research.resource';
import cardStyles from '../styles/summary-card.scss';
import styles from './research-page.scss';

const showDate = (value: string | null) =>
  value ? formatDate(parseDate(value), { time: false, noToday: true }) : '--';

function OptIn({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { researchOptInAttributeType, yesConcept, noConcept } = useConfig<Config>().studies;
  const { optIn, consent, isLoading, mutate } = useResearchAnswers(patientUuid);
  const [saving, setSaving] = useState(false);
  const label = t('wouldLikeToBeConsidered', 'Would the patient like to be considered for research?');
  const showAnswer = (value: string | null) =>
    value === yesConcept ? t('yes', 'Yes') : value === noConcept ? t('no', 'No') : t('notRecorded', 'Not recorded');
  const answer = showAnswer(optIn);

  const save = async (conceptUuid: string) => {
    setSaving(true);
    try {
      await saveResearchOptIn(patientUuid, conceptUuid, researchOptInAttributeType);
      await mutate();
    } catch (e) {
      showSnackbar({ kind: 'error', title: t('couldNotSaveOptIn', 'Could not save the answer'), subtitle: e?.message });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Loading...')} />;
  }
  return (
    <div className={styles.optIn}>
      <p className={styles.consent}>
        <span className={styles.optInLabel}>
          {t('registryConsent', 'Registry consent (recorded at registration):')}
        </span>{' '}
        {showAnswer(consent)}
      </p>
      <UserHasAccess
        privilege={PRIVILEGE_ENTER_CLINICAL_FORMS}
        fallback={
          <p>
            <span className={styles.optInLabel}>{label}</span> {answer}
          </p>
        }
      >
        <Select
          id="research-opt-in"
          labelText={label}
          value={optIn ?? ''}
          disabled={saving}
          onChange={(event) => event.target.value && save(event.target.value)}
        >
          {!optIn && <SelectItem value="" text={t('notRecorded', 'Not recorded')} />}
          <SelectItem value={yesConcept} text={t('yes', 'Yes')} />
          <SelectItem value={noConcept} text={t('no', 'No')} />
        </Select>
      </UserHasAccess>
    </div>
  );
}

/**
 * A patient's research participation, as ACT 2.0's Research Participation form: whether they would like to be
 * considered, and their enrolment in each study with its Study ID, dates and status.
 */
export default function ResearchPage({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { yesConcept } = useConfig<Config>().studies;
  const { optIn, consent, dead } = useResearchAnswers(patientUuid);
  const { enrollments, studies, error, isLoading, mutate } = useStudyEnrollments(patientUuid);
  const [editing, setEditing] = useState<StudyEnrollment | 'new' | null>(null);
  const title = t('researchParticipation', 'Research participation');
  const headers = [
    t('study', 'Study'),
    t('studyId', 'Study ID'),
    t('enrollmentDate', 'Enrollment date'),
    t('completionDate', 'Completion date'),
    t('studyStatus', 'Study status'),
  ];
  const statusName = (enrollment: StudyEnrollment) =>
    enrollment.study.states.find((state) => state.uuid === enrollment.stateUuid);
  const activeIn = new Set(
    enrollments
      .filter((enrollment) => !enrollment.dateCompleted && !statusName(enrollment)?.terminal)
      .map((enrollment) => enrollment.study.uuid),
  );
  const available = studies.filter((study) => !activeIn.has(study.uuid));
  const consented = consent === yesConcept;
  const optedIn = optIn === yesConcept;
  const mayEnrol = !dead && consented && optedIn;

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  const body = isLoading ? (
    <DataTableSkeleton
      role="progressbar"
      columnCount={headers.length}
      compact={desktop}
      showHeader={false}
      showToolbar={false}
    />
  ) : !enrollments.length ? (
    <TableEmptyState message={t('noParticipations', 'There are no study participations to display')} />
  ) : (
    <Table aria-label={title} size={desktop ? 'sm' : 'lg'}>
      <TableHead>
        <TableRow>
          {headers.map((header) => (
            <TableHeader key={header}>{header}</TableHeader>
          ))}
          <TableHeader aria-label={t('actions', 'Actions')} />
        </TableRow>
      </TableHead>
      <TableBody>
        {enrollments.map((enrollment) => {
          const status = statusName(enrollment);
          return (
            <TableRow key={enrollment.uuid}>
              <TableCell>{enrollment.study.name}</TableCell>
              <TableCell>{enrollment.studyId ?? '--'}</TableCell>
              <TableCell>{showDate(enrollment.dateEnrolled)}</TableCell>
              <TableCell>{showDate(enrollment.dateCompleted)}</TableCell>
              <TableCell>
                {status ? (
                  <Tag size="sm" type={status.terminal ? 'gray' : 'green'}>
                    {status.name}
                  </Tag>
                ) : (
                  '--'
                )}
              </TableCell>
              <TableCell>
                <UserHasAccess privilege={PRIVILEGE_ENTER_CLINICAL_FORMS}>
                  <Button
                    kind="ghost"
                    size="sm"
                    hasIconOnly
                    renderIcon={Edit}
                    iconDescription={t('editParticipation', 'Edit participation')}
                    onClick={() => setEditing(enrollment)}
                  />
                </UserHasAccess>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className={cardStyles.card}>
      <CardHeader title={title}>
        <UserHasAccess privilege={PRIVILEGE_ENTER_CLINICAL_FORMS}>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Add}
            disabled={!mayEnrol || !available.length}
            onClick={() => setEditing('new')}
          >
            {t('addParticipation', 'Add participation')}
          </Button>
        </UserHasAccess>
      </CardHeader>
      <OptIn patientUuid={patientUuid} />
      {!mayEnrol && !isLoading && (
        <p className={styles.hint}>
          {dead
            ? t('deceasedNotEnrolled', 'The patient has died, so they cannot be enrolled in a study.')
            : consented
              ? t('optInBeforeEnrolling', 'A patient is enrolled in a study only after answering Yes above.')
              : t(
                  'consentBeforeEnrolling',
                  'A patient is enrolled in a study only after giving registry consent, which is recorded at registration.',
                )}
        </p>
      )}
      {!mayEnrol && !isLoading && activeIn.size > 0 && (
        <InlineNotification
          className={styles.notice}
          kind="warning"
          lowContrast
          hideCloseButton
          title={t('stillActiveInAStudy', 'Still active in a study')}
          subtitle={t(
            'stillActiveInAStudyWithout',
            'The patient is active in a study without registry consent and a Yes to research. If they have left the study, edit its status.',
          )}
        />
      )}
      {body}
      {editing && (
        <EnrollmentModal
          patientUuid={patientUuid}
          studies={available}
          enrollment={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => mutate()}
        />
      )}
    </div>
  );
}
