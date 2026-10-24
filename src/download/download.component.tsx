import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  SkeletonText,
  Tile,
} from '@carbon/react';
import { Download } from '@carbon/react/icons';
import {
  OpenmrsDatePicker,
  PatientListsPictogram,
  showSnackbar,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import {
  PRIVILEGE_DOWNLOAD_DATA,
  PRIVILEGE_DOWNLOAD_IDENTIFIERS,
  PRIVILEGE_DOWNLOAD_RESEARCH_DATA,
} from '../constants';
import { restErrorMessage } from '../rest-error-message';
import { downloadCsv } from '../table-filters/csv';
import { downloadForm, useDownloadForms, useFormFields } from './download.resource';
import styles from './download.scss';

const isoDate = (date: Date | null) => (date ? dayjs(date).format('YYYY-MM-DD') : null);

/**
 * ACT 2.0's Download: a form's chosen fields over a date range, as a CSV with a row per saved form. ACT Core leaves
 * out the identifiers unless the user may download them, and records each download in ACT Core's download log.
 */
export default function DownloadData() {
  const { t } = useTranslation();
  const { user } = useSession();
  const may = (privilege: string) => !!user && userHasAccess(privilege, user);
  const researchOnly = !may(PRIVILEGE_DOWNLOAD_DATA);
  const { forms, error: formsError, isLoading: formsLoading } = useDownloadForms();
  const [formUuid, setFormUuid] = useState('');
  const { fields, error: fieldsError, isLoading: fieldsLoading } = useFormFields(formUuid);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [downloading, setDownloading] = useState(false);
  const chosen = useMemo(() => fields.filter((field) => !unchecked.has(field.concept)), [fields, unchecked]);
  const backwards = !!startDate && !!endDate && dayjs(startDate).isAfter(endDate, 'day');

  if (!may(PRIVILEGE_DOWNLOAD_DATA) && !may(PRIVILEGE_DOWNLOAD_RESEARCH_DATA)) {
    return null;
  }

  const toggle = (concept: string, checked: boolean) =>
    setUnchecked((current) => {
      const next = new Set(current);
      if (checked) {
        next.delete(concept);
      } else {
        next.add(concept);
      }
      return next;
    });

  const download = async () => {
    setDownloading(true);
    try {
      const form = forms.find((f) => f.uuid === formUuid);
      const result = await downloadForm({
        form: formUuid,
        fields: chosen,
        startDate: isoDate(startDate),
        endDate: isoDate(endDate),
      });
      if (!result.rows.length) {
        showSnackbar({ kind: 'info', title: t('noFormsToDownload', 'No saved forms match') });
        return;
      }
      const name = (form?.name ?? 'download').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      downloadCsv(`${name}-${dayjs().format('YYYY-MM-DD')}.csv`, result.headers, result.rows);
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('couldNotDownload', 'Could not download the data'),
        subtitle: restErrorMessage(e),
      });
    } finally {
      setDownloading(false);
    }
  };

  const fieldList = () => {
    if (!formUuid) {
      return null;
    }
    if (fieldsLoading) {
      return <SkeletonText paragraph lineCount={4} />;
    }
    if (fieldsError) {
      return (
        <InlineNotification
          kind="error"
          statusIconDescription={t('errorIcon', 'error icon')}
          lowContrast
          hideCloseButton
          title={t('couldNotLoadFields', "Could not load the form's fields")}
          subtitle={fieldsError.message}
        />
      );
    }
    return (
      <fieldset className={styles.fields}>
        <legend className={styles.legend}>
          {t('fieldsChosen', '{{chosen}} of {{total}} fields', { chosen: chosen.length, total: fields.length })}
        </legend>
        <div className={styles.fieldActions}>
          <Button kind="ghost" size="sm" onClick={() => setUnchecked(new Set())}>
            {t('checkAll', 'Check all')}
          </Button>
          <Button kind="ghost" size="sm" onClick={() => setUnchecked(new Set(fields.map((field) => field.concept)))}>
            {t('uncheckAll', 'Uncheck all')}
          </Button>
        </div>
        <div className={styles.fieldGrid}>
          {fields.map((field) => (
            <Checkbox
              key={field.concept}
              id={`download-field-${field.concept}`}
              labelText={field.label}
              checked={!unchecked.has(field.concept)}
              onChange={(_, { checked }) => toggle(field.concept, checked)}
            />
          ))}
        </div>
      </fieldset>
    );
  };

  return (
    <>
      <ActPageHeader title={t('downloadData', 'Download data')} illustration={<PatientListsPictogram />} />
      <div className={styles.page}>
        <Tile className={styles.tile}>
          <p className={styles.explanation}>
            {researchOnly
              ? t(
                  'downloadResearchExplanation',
                  'A row for each saved form of the patients who opted in to research, without names, birth dates, ID numbers or phones. Each download is recorded.',
                )
              : may(PRIVILEGE_DOWNLOAD_IDENTIFIERS)
                ? t(
                    'downloadIdentifiedExplanation',
                    "A row for each saved form, with the patient's names, birth date, ID numbers and phones. Each download is recorded.",
                  )
                : t(
                    'downloadDeidentifiedExplanation',
                    'A row for each saved form, without names, birth dates, ID numbers or phones. Each download is recorded.',
                  )}
          </p>
          {formsError ? (
            <InlineNotification
              kind="error"
              statusIconDescription={t('errorIcon', 'error icon')}
              lowContrast
              hideCloseButton
              title={t('couldNotLoadForms', 'Could not load the forms')}
              subtitle={formsError.message}
            />
          ) : (
            <Select
              id="download-form"
              labelText={t('form', 'Form')}
              value={formUuid}
              disabled={formsLoading}
              onChange={(event) => {
                setFormUuid(event.target.value);
                setUnchecked(new Set());
              }}
            >
              <SelectItem value="" text={t('chooseAForm', 'Choose a form')} />
              {forms.map((form) => (
                <SelectItem key={form.uuid} value={form.uuid} text={form.name} />
              ))}
            </Select>
          )}
          <div className={styles.dates}>
            <OpenmrsDatePicker
              id="download-start-date"
              labelText={t('fromDate', 'From')}
              value={startDate}
              onChange={(date) => setStartDate(date ?? null)}
            />
            <OpenmrsDatePicker
              id="download-end-date"
              labelText={t('toDate', 'To')}
              value={endDate}
              invalid={backwards}
              invalidText={t('endBeforeStart', 'The end is before the start')}
              onChange={(date) => setEndDate(date ?? null)}
            />
          </div>
          {fieldList()}
          <Button
            kind="primary"
            size="md"
            renderIcon={Download}
            disabled={!formUuid || !chosen.length || backwards || downloading}
            onClick={download}
          >
            {downloading ? (
              <InlineLoading description={t('downloading', 'Downloading...')} />
            ) : (
              t('downloadCsv', 'Download CSV')
            )}
          </Button>
        </Tile>
      </div>
    </>
  );
}
