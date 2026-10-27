import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import {
  Button,
  InlineNotification,
  Select,
  SelectItem,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextArea,
  TextInput,
  Tile,
} from '@carbon/react';
import { ReportsPictogram, showSnackbar, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { PRIVILEGE_ENTER_SCREENING_COUNTS } from '../constants';
import { useClinicList } from '../programme-report/clinics.resource';
import { restErrorMessage } from '../rest-error-message';
import {
  column,
  type Counts,
  type Metric,
  metrics,
  monthName,
  recentMonths,
  saveScreeningMonth,
  screeningMonthsOffered,
  type Setting,
  settings,
  useScreeningLabels,
  useScreeningMonth,
} from './screening-counts.resource';
import styles from './screening-counts.scss';

const notesLength = 1000;

type Draft = Record<string, string>;

const draftOf = (counts: Counts | undefined): Draft =>
  Object.fromEntries(
    settings
      .flatMap((setting) => metrics.map((metric) => column(setting, metric)))
      .map((key) => [key, String(counts?.[key] ?? 0)]),
  );

// Nine digits at most, which ACT Core's whole numbers hold.
const isCount = (value: string) => /^\d{1,9}$/.test(value.trim());

/**
 * Admin's Screening counts page: a clinic's counts for a month, for school, community and health facility, which
 * whoever may enter them changes and saves, as ACT 2.0's screening data.
 */
export default function ScreeningCounts() {
  const { t } = useTranslation();
  const { clinicLocationTags } = useConfig<Config>();
  const { user, sessionLocation } = useSession();
  const mayEnter = Boolean(user) && userHasAccess(PRIVILEGE_ENTER_SCREENING_COUNTS, user);
  const {
    clinics,
    isLoading: clinicsLoading,
    error: clinicsError,
  } = useClinicList([...clinicLocationTags.cardiac, ...clinicLocationTags.primaryCare]);
  const months = useMemo(() => recentMonths(screeningMonthsOffered), []);
  const { settingLabel, metricLabel } = useScreeningLabels();
  const [chosenClinic, setChosenClinic] = useState('');
  const offered = (uuid?: string) => clinics.some((option) => option.uuid === uuid);
  // The clinic the user is signed in at, where offered, so counts are not typed in for another.
  const clinic = [chosenClinic, sessionLocation?.uuid].find(offered) ?? clinics[0]?.uuid ?? '';
  const clinicName = clinics.find(({ uuid }) => uuid === clinic)?.display;
  // The month before this one, which a clinic enters once it has ended.
  const [month, setMonth] = useState(months[1]);
  const { month: saved, error, isLoading, mutate } = useScreeningMonth(clinic || null, month);
  const { mutate: mutateCache } = useSWRConfig();
  // By clinic and month, so looking at another month and coming back keeps what was typed.
  const [edits, setEdits] = useState<Record<string, { draft: Draft; notes: string }>>({});
  const editKey = `${clinic}/${month}`;
  const draft = edits[editKey]?.draft ?? draftOf(saved?.counts);
  const notes = edits[editKey]?.notes ?? saved?.notes ?? '';
  const edit = (change: Partial<{ draft: Draft; notes: string }>) =>
    setEdits((current) => ({ ...current, [editKey]: { draft, notes, ...current[editKey], ...change } }));
  const without = (current: typeof edits, key: string) =>
    Object.fromEntries(Object.entries(current).filter(([other]) => other !== key));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reset = () => {
    setEdits((current) => without(current, editKey));
    setSaveError(null);
  };

  const rowErrors = Object.fromEntries(
    settings.map((setting) => {
      const values = Object.fromEntries(metrics.map((metric) => [metric, draft[column(setting, metric)]]));
      if (metrics.some((metric) => !isCount(values[metric]))) {
        return [setting, t('screeningCountsWholeNumbers', 'Enter whole numbers, 0 or more')];
      }
      const number = (metric: Metric) => Number(values[metric]);
      const ages = number('children') + number('adolescents') + number('adults');
      if (ages !== number('screened')) {
        return [
          setting,
          t('screeningAgesDoNotAddUp', 'The age groups add up to {{ages}}, not the {{screened}} screened', {
            ages,
            screened: number('screened'),
          }),
        ];
      }
      if (number('females') > number('screened') || number('positive') > number('screened')) {
        return [
          setting,
          t('screeningMoreThanScreened', 'Female and positive cannot be more than the {{screened}} screened', {
            screened: number('screened'),
          }),
        ];
      }
      return [setting, null];
    }),
  ) as Record<Setting, string | null>;
  const hasErrors = Object.values(rowErrors).some(Boolean) || notes.trim().length > notesLength;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const sent = edits[editKey];
    try {
      const counts = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, Number(value)]));
      await saveScreeningMonth(clinic, month, counts, notes, mutateCache);
      // Kept if typed into while saving, as that is not what was saved.
      setEdits((current) => (current[editKey] === sent ? without(current, editKey) : current));
      showSnackbar({
        kind: 'success',
        title: t('screeningCountsSaved', 'Screening counts for {{clinic}}, {{month}} saved', {
          clinic: clinicName,
          month: monthName(month),
        }),
      });
    } catch (e) {
      setSaveError(restErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const grid = () => {
    if (clinicsLoading) {
      return <SkeletonText paragraph lineCount={4} />;
    }
    if (clinicsError) {
      return (
        <InlineNotification
          kind="error"
          statusIconDescription={t('errorIcon', 'error icon')}
          lowContrast
          hideCloseButton
          title={t('couldNotLoadClinics', 'Could not load the clinics')}
          subtitle={restErrorMessage(clinicsError)}
        />
      );
    }
    if (!clinic) {
      return <p className={styles.explanation}>{t('noClinicsToCount', 'There are no clinics to enter counts for.')}</p>;
    }
    if (error) {
      return (
        <>
          <InlineNotification
            kind="error"
            statusIconDescription={t('errorIcon', 'error icon')}
            lowContrast
            hideCloseButton
            title={t('couldNotLoadScreeningCounts', 'Could not load the screening counts')}
            subtitle={restErrorMessage(error)}
          />
          <div className={styles.actions}>
            <Button size="md" onClick={() => void mutate()}>
              {t('tryAgain', 'Try again')}
            </Button>
          </div>
        </>
      );
    }
    if (isLoading) {
      return <SkeletonText paragraph lineCount={4} />;
    }
    return (
      <>
        {saved && !saved.saved && (
          <p className={styles.notEntered} data-testid="screening-not-entered">
            {t('screeningMonthNotEntered', 'Not entered yet: no counts for {{clinic}}, {{month}}', {
              clinic: clinicName,
              month: monthName(month),
            })}
          </p>
        )}
        <Table size="md" useZebraStyles={false} className={styles.table}>
          <TableHead>
            <TableRow>
              <TableHeader>{t('setting', 'Setting')}</TableHeader>
              {metrics.map((metric) => (
                <TableHeader key={metric}>{metricLabel[metric]}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {settings.map((setting) => (
              <TableRow key={setting} data-testid="screening-counts-row">
                <th scope="row" className={styles.setting}>
                  {settingLabel[setting]}
                </th>
                {metrics.map((metric) => {
                  const key = column(setting, metric);
                  return (
                    <TableCell key={metric}>
                      {mayEnter ? (
                        <TextInput
                          id={`screening-${key}`}
                          className={styles.count}
                          labelText={`${settingLabel[setting]}, ${metricLabel[metric]}`}
                          hideLabel
                          inputMode="numeric"
                          value={draft[key]}
                          invalid={Boolean(rowErrors[setting])}
                          aria-describedby={rowErrors[setting] ? `screening-${setting}-error` : undefined}
                          onChange={(event) => edit({ draft: { ...draft, [key]: event.target.value } })}
                        />
                      ) : (
                        <span data-testid={`screening-${key}`}>{draft[key]}</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {/* Polite, so a count still being typed is not announced as an error at each digit. */}
        {mayEnter && (
          <div aria-live="polite">
            {settings.some((setting) => rowErrors[setting]) ? (
              settings
                .filter((setting) => rowErrors[setting])
                .map((setting) => (
                  <p
                    key={setting}
                    id={`screening-${setting}-error`}
                    className={styles.rowError}
                    data-testid="screening-row-error"
                  >
                    {settingLabel[setting]}: {rowErrors[setting]}
                  </p>
                ))
            ) : (
              <p className={styles.rule}>
                {t('screeningAgesAddUp', "Each row's age groups add up to its screened total.")}
              </p>
            )}
          </div>
        )}
        {mayEnter ? (
          <TextArea
            id="screening-notes"
            labelText={t('notes', 'Notes')}
            value={notes}
            maxCount={notesLength}
            enableCounter
            onChange={(event) => edit({ notes: event.target.value })}
          />
        ) : (
          notes && (
            <div>
              <p className={styles.label}>{t('notes', 'Notes')}</p>
              <p>{notes}</p>
            </div>
          )
        )}
        {saveError && (
          <InlineNotification
            kind="error"
            statusIconDescription={t('errorIcon', 'error icon')}
            lowContrast
            hideCloseButton
            title={t('couldNotSaveScreeningCounts', 'Could not save the screening counts')}
            subtitle={saveError}
          />
        )}
        {mayEnter && (
          <div className={styles.actions}>
            <Button kind="primary" disabled={saving || hasErrors} onClick={save}>
              {t('saveMonth', 'Save {{month}}', { month: dayjs(`${month}-01`).format('MMMM') })}
            </Button>
            <Button kind="secondary" disabled={saving} onClick={reset}>
              {t('cancel', 'Cancel')}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <ActPageHeader title={t('screeningCounts', 'Screening counts')} illustration={<ReportsPictogram />} />
      <div className={styles.page}>
        <Tile className={styles.tile}>
          <p className={styles.explanation}>
            {t(
              'screeningCountsExplanation',
              "Screen-negative people are never registered, so each clinic enters its screening counts once a month. The Dashboard's RHD screening section reads them.",
            )}
          </p>
          <div className={styles.pickers}>
            <Select
              id="screening-clinic"
              labelText={t('clinic', 'Clinic')}
              value={clinic}
              onChange={(event) => {
                setChosenClinic(event.target.value);
                setSaveError(null);
              }}
            >
              {clinics.map(({ uuid, display }) => (
                <SelectItem key={uuid} value={uuid} text={display} />
              ))}
            </Select>
            <Select
              id="screening-month"
              labelText={t('month', 'Month')}
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setSaveError(null);
              }}
            >
              {months.map((value) => (
                <SelectItem key={value} value={value} text={monthName(value)} />
              ))}
            </Select>
          </div>
          {grid()}
        </Tile>
      </div>
    </>
  );
}
