import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  SkeletonText,
  Tile,
} from '@carbon/react';
import { Download } from '@carbon/react/icons';
import {
  MetadataExportPictogram,
  OpenmrsDatePicker,
  showSnackbar,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import {
  PRIVILEGE_DOWNLOAD_DATA,
  PRIVILEGE_DOWNLOAD_IDENTIFIERS,
  PRIVILEGE_DOWNLOAD_RESEARCH_DATA,
} from '../constants';
import { useClinics } from '../programme-report/clinics.resource';
import { restErrorMessage } from '../rest-error-message';
import { downloadCsv } from '../table-filters/csv';
import {
  type DownloadField,
  type DownloadForm,
  type DownloadStatus,
  type PatientField,
  downloadForms,
  identifyingPatientFields,
  patientFieldLabels,
  patientFields,
  useDownloadForms,
  useFormFields,
} from './download.resource';
import styles from './download.scss';

const isoDate = (date: Date | null) => (date ? dayjs(date).format('YYYY-MM-DD') : null);

const fieldKey = (form: string, concept: string) => `${form}:${concept}`;

/** Fields to tick under a legend, with Check all and Uncheck all. */
function FieldChecklist({
  legend,
  fields,
  isChecked,
  onToggle,
  onAll,
}: {
  legend: string;
  fields: Array<{ key: string; id: string; label: string }>;
  isChecked: (key: string) => boolean;
  onToggle: (key: string, checked: boolean) => void;
  onAll: (keys: Array<string>, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const keys = fields.map((field) => field.key);
  return (
    <fieldset className={styles.fields}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.fieldActions}>
        <Button kind="ghost" size="sm" onClick={() => onAll(keys, true)}>
          {t('checkAll', 'Check all')}
        </Button>
        <Button kind="ghost" size="sm" onClick={() => onAll(keys, false)}>
          {t('uncheckAll', 'Uncheck all')}
        </Button>
      </div>
      <div className={styles.fieldGrid}>
        {fields.map((field) => (
          <Checkbox
            key={field.key}
            id={field.id}
            labelText={field.label}
            checked={isChecked(field.key)}
            onChange={(_, { checked }) => onToggle(field.key, checked)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * One chosen form's fields to tick, under its name. Tells the page the fields once they load, which it needs to build
 * the request, and null while they load or when they cannot.
 */
function FormFieldList({
  form,
  unchecked,
  onToggle,
  onAll,
  onFields,
}: {
  form: DownloadForm;
  unchecked: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
  onAll: (keys: Array<string>, checked: boolean) => void;
  onFields: (form: string, fields: Array<DownloadField> | null) => void;
}) {
  const { t } = useTranslation();
  const { fields, error, isLoading } = useFormFields(form.uuid);
  useEffect(() => {
    onFields(form.uuid, isLoading || error ? null : fields);
  }, [form.uuid, fields, isLoading, error, onFields]);

  if (isLoading) {
    return <SkeletonText paragraph lineCount={4} />;
  }
  if (error) {
    return (
      <InlineNotification
        kind="error"
        statusIconDescription={t('errorIcon', 'error icon')}
        lowContrast
        hideCloseButton
        title={t('couldNotLoadFormFields', "Could not load {{form}}'s fields", { form: form.name })}
        subtitle={error.message}
      />
    );
  }
  const keys = fields.map((field) => fieldKey(form.uuid, field.concept));
  return (
    <FieldChecklist
      legend={t('formFieldsChosen', '{{form}}: {{chosen}} of {{total}} fields', {
        form: form.name,
        chosen: keys.filter((key) => !unchecked.has(key)).length,
        total: fields.length,
      })}
      fields={fields.map((field) => ({
        key: fieldKey(form.uuid, field.concept),
        id: `download-field-${form.uuid}-${field.concept}`,
        label: field.label,
      }))}
      isChecked={(key) => !unchecked.has(key)}
      onToggle={onToggle}
      onAll={onAll}
    />
  );
}

/**
 * ACT 2.0's Download: the chosen fields of one or more forms, of the patients the filters keep, as a CSV. One form is
 * a row per saved form unless a row per patient is asked for; several are always a row per patient.
 */
export default function DownloadData() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { clinicLocationTags } = useConfig<Config>();
  const cardiacClinics = useClinics(clinicLocationTags.cardiac);
  const primaryCareClinics = useClinics(clinicLocationTags.primaryCare);
  const may = (privilege: string) => !!user && userHasAccess(privilege, user);
  const researchOnly = !may(PRIVILEGE_DOWNLOAD_DATA);
  // ACT Core withholds the identifying fields from anyone else, so offering them would only promise columns it drops.
  const offeredPatientFields = patientFields.filter(
    (key) => (!researchOnly && may(PRIVILEGE_DOWNLOAD_IDENTIFIERS)) || !identifyingPatientFields.includes(key),
  );
  const { forms, error: formsError, isLoading: formsLoading } = useDownloadForms();
  const [chosenForms, setChosenForms] = useState<Array<string>>([]);
  const [fieldsByForm, setFieldsByForm] = useState<Record<string, Array<DownloadField> | null>>({});
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  // Nothing identifying leaves unless the user ticks it (AR-76: only the chosen variables, plus the ACT ID).
  const [patientChecked, setPatientChecked] = useState<Set<string>>(new Set<PatientField>(['sex', 'age']));
  const [rowPerPatient, setRowPerPatient] = useState(false);
  const [status, setStatus] = useState<DownloadStatus | ''>('');
  const [cardiacClinic, setCardiacClinic] = useState('');
  const [primaryCareClinic, setPrimaryCareClinic] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [downloading, setDownloading] = useState(false);
  const backwards = !!startDate && !!endDate && dayjs(startDate).isAfter(endDate, 'day');
  const several = chosenForms.length > 1;

  const onFields = useCallback(
    (form: string, fields: Array<DownloadField> | null) =>
      // Unchanged fields keep the state, or a form still loading would re-render the page without end.
      setFieldsByForm((current) => (current[form] === fields ? current : { ...current, [form]: fields })),
    [],
  );
  const request = useMemo(
    () =>
      chosenForms.map((form) => ({
        form,
        fields: (fieldsByForm[form] ?? []).filter((field) => !unchecked.has(fieldKey(form, field.concept))),
      })),
    [chosenForms, fieldsByForm, unchecked],
  );
  const ready =
    chosenForms.length > 0 &&
    chosenForms.every((form) => fieldsByForm[form]) &&
    request.every((choice) => choice.fields.length > 0);

  if (!may(PRIVILEGE_DOWNLOAD_DATA) && !may(PRIVILEGE_DOWNLOAD_RESEARCH_DATA)) {
    return null;
  }

  const chooseForm = (form: string, checked: boolean) =>
    setChosenForms((current) =>
      checked ? [...current.filter((uuid) => uuid !== form), form] : current.filter((uuid) => uuid !== form),
    );

  const setChecked = (keys: Array<string>, checked: boolean) =>
    setUnchecked((current) => {
      const next = new Set(current);
      keys.forEach((key) => (checked ? next.delete(key) : next.add(key)));
      return next;
    });

  const patientLabels = patientFieldLabels(t);

  const setPatientFieldsChecked = (keys: Array<string>, checked: boolean) =>
    setPatientChecked((current) => {
      const next = new Set(current);
      keys.forEach((key) => (checked ? next.add(key) : next.delete(key)));
      return next;
    });

  const download = async () => {
    setDownloading(true);
    try {
      const result = await downloadForms({
        forms: request,
        startDate: isoDate(startDate),
        endDate: isoDate(endDate),
        patient: offeredPatientFields.filter((key) => patientChecked.has(key)),
        ...(!several && rowPerPatient ? { rowPerPatient: true } : {}),
        ...(status ? { status } : {}),
        ...(cardiacClinic ? { cardiacClinic } : {}),
        ...(primaryCareClinic ? { primaryCareClinic } : {}),
      });
      if (!result.rows.length) {
        showSnackbar({ kind: 'info', title: t('noFormsToDownload', 'No saved forms match') });
        return;
      }
      const only = !several ? forms.find((form) => form.uuid === chosenForms[0]) : undefined;
      const name = (only?.name ?? 'act-download').toLowerCase().replace(/[^a-z0-9]+/g, '-');
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

  const clinicSelect = (
    id: string,
    label: string,
    clinics: Array<{ uuid: string; display: string }>,
    value: string,
    onChange: (value: string) => void,
  ) => (
    <Select id={id} labelText={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <SelectItem value="" text={t('allClinics', 'All clinics')} />
      {clinics.map((clinic) => (
        <SelectItem key={clinic.uuid} value={clinic.uuid} text={clinic.display} />
      ))}
    </Select>
  );

  return (
    <>
      <ActPageHeader title={t('downloadData', 'Download data')} illustration={<MetadataExportPictogram />} />
      <div className={styles.page}>
        <Tile className={styles.tile}>
          <p className={styles.explanation}>
            {researchOnly
              ? t(
                  'downloadResearchExplanation',
                  'Only the patients who opted in to research, without names, birth dates, ID numbers or phones. Each download is recorded.',
                )
              : may(PRIVILEGE_DOWNLOAD_IDENTIFIERS)
                ? t(
                    'downloadIdentifiedExplanation',
                    "The download can come with the patient's names, birth date, ID numbers and phones, those ticked under Patient. Each download is recorded.",
                  )
                : t(
                    'downloadDeidentifiedExplanation',
                    'The download comes without names, birth dates, ID numbers or phones. Each download is recorded.',
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
          ) : formsLoading ? (
            <SkeletonText paragraph lineCount={3} />
          ) : (
            <fieldset className={styles.fields}>
              <legend className={styles.legend}>{t('forms', 'Forms')}</legend>
              <div className={styles.fieldGrid}>
                {forms.map((form) => (
                  <Checkbox
                    key={form.uuid}
                    id={`download-form-${form.uuid}`}
                    labelText={form.name}
                    checked={chosenForms.includes(form.uuid)}
                    onChange={(_, { checked }) => chooseForm(form.uuid, checked)}
                  />
                ))}
              </div>
            </fieldset>
          )}
          {chosenForms.length === 1 && (
            <RadioButtonGroup
              legendText={t('rows', 'Rows')}
              name="download-rows"
              valueSelected={rowPerPatient ? 'patient' : 'form'}
              onChange={(value) => setRowPerPatient(value === 'patient')}
            >
              <RadioButton
                id="download-rows-form"
                labelText={t('rowPerSavedForm', 'A row per saved form')}
                value="form"
              />
              <RadioButton
                id="download-rows-patient"
                labelText={t('rowPerPatient', 'A row per patient')}
                value="patient"
              />
            </RadioButtonGroup>
          )}
          {several && (
            <p className={styles.explanation}>
              {t(
                'severalFormsExplanation',
                "A row per patient, each form's saves numbered from the first, with its date and location.",
              )}
            </p>
          )}
          <div className={styles.dates}>
            <Select
              id="download-status"
              labelText={t('status', 'Status')}
              value={status}
              onChange={(event) => setStatus(event.target.value as DownloadStatus | '')}
            >
              <SelectItem value="" text={t('all', 'All')} />
              <SelectItem value="active" text={t('active', 'Active')} />
              <SelectItem value="inactive" text={t('inactive', 'Inactive')} />
            </Select>
            {clinicSelect(
              'download-cardiac-clinic',
              t('cardiacClinic', 'Cardiac clinic'),
              cardiacClinics,
              cardiacClinic,
              setCardiacClinic,
            )}
            {clinicSelect(
              'download-primary-care-clinic',
              t('primaryCareClinic', 'Primary care clinic'),
              primaryCareClinics,
              primaryCareClinic,
              setPrimaryCareClinic,
            )}
          </div>
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
          {chosenForms.map((uuid) => {
            const form = forms.find((each) => each.uuid === uuid);
            return form ? (
              <FormFieldList
                key={uuid}
                form={form}
                unchecked={unchecked}
                onToggle={(key, checked) => setChecked([key], checked)}
                onAll={setChecked}
                onFields={onFields}
              />
            ) : null;
          })}
          <FieldChecklist
            legend={t('patientFieldsChosen', 'Patient: {{chosen}} of {{total}} fields, after the ACT ID', {
              chosen: offeredPatientFields.filter((key) => patientChecked.has(key)).length,
              total: offeredPatientFields.length,
            })}
            fields={offeredPatientFields.map((key) => ({
              key,
              id: `download-patient-${key}`,
              label: patientLabels[key],
            }))}
            isChecked={(key) => patientChecked.has(key)}
            onToggle={(key, checked) => setPatientFieldsChecked([key], checked)}
            onAll={setPatientFieldsChecked}
          />
          <Button
            kind="primary"
            size="md"
            renderIcon={Download}
            disabled={!ready || backwards || downloading}
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
