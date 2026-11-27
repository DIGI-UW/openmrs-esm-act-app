import { useMemo } from 'react';
import useSWR from 'swr';
import { type TFunction } from 'i18next';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export interface DownloadForm {
  uuid: string;
  name: string;
}

/** A question of the form: the concept it records and its label. */
export interface DownloadField {
  concept: string;
  label: string;
}

export interface DownloadResult {
  headers: Array<string>;
  rows: Array<Array<string>>;
  /** Whether the rows keep a patient field or question that identifies the patient. */
  identifiers: boolean;
  /** Whether the rows are only of patients who opted in to research. */
  researchOnly: boolean;
}

interface FormResource {
  uuid: string;
  name: string;
  display?: string;
  retired: boolean;
  resources: Array<{ name: string }>;
}

interface SchemaQuestion {
  label?: string;
  type?: string;
  questionOptions?: { concept?: string };
  questions?: Array<SchemaQuestion>;
}

interface FormSchema {
  pages?: Array<{ sections?: Array<{ questions?: Array<SchemaQuestion> }> }>;
}

const formsUrl = `${restBaseUrl}/form?v=custom:(uuid,name,display,retired,resources:(name))`;

/** The forms the chart's form engine opens: those with a JSON schema, as O3 lists them. */
export function useDownloadForms() {
  const { data, error, isLoading } = useSWR<Array<DownloadForm>, Error>(formsUrl, async () =>
    (await openmrsFetch<{ results: Array<FormResource> }>(formsUrl)).data.results
      .filter((form) => !form.retired && form.resources?.some((resource) => resource.name === 'JSON schema'))
      // The name users see: the server's display, which a ui.i18n.Form.name message can set (AR-184).
      .map(({ uuid, name, display }) => ({ uuid, name: display || name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  return { forms: data ?? [], error, isLoading };
}

/**
 * Each question that records an observation, in the form's order, once per concept. A question in a group is
 * labelled with the group's label first, as the form shows it under the group.
 */
export function formFields(schema: FormSchema): Array<DownloadField> {
  const fields: Array<DownloadField> = [];
  const walk = (questions: Array<SchemaQuestion> = [], group?: string) => {
    questions.forEach((question) => {
      if (question.type === 'obsGroup') {
        walk(question.questions, question.label);
        return;
      }
      const concept = question.questionOptions?.concept;
      if (question.type === 'obs' && concept && !fields.some((field) => field.concept === concept)) {
        const label = question.label ?? concept;
        fields.push({ concept, label: group ? `${group}: ${label}` : label });
      }
    });
  };
  schema.pages?.forEach((page) => page.sections?.forEach((section) => walk(section.questions)));
  return fields;
}

export function useFormFields(formUuid: string) {
  const url = formUuid ? `${restBaseUrl}/o3/forms/${formUuid}` : null;
  // The form engine caches the response under this same key, so the fields are read from the response, not cached.
  const { data, error, isLoading } = useSWR<FetchResponse<FormSchema>, Error>(url, openmrsFetch);
  const fields = useMemo(() => (data?.data ? formFields(data.data) : []), [data]);
  return { fields, error, isLoading };
}

export type DownloadStatus = 'active' | 'inactive';

/** ACT Core's FormDownload.PATIENT_FIELDS, in its columns' order; a key it does not list is refused. */
export const patientFields = ['givenName', 'familyName', 'birthDate', 'identifiers', 'phones', 'sex', 'age'] as const;

export type PatientField = (typeof patientFields)[number];

/** The patient fields only a user with the identifiers privilege gets; a de-identified download withholds them. */
export const identifyingPatientFields: Array<PatientField> = [
  'givenName',
  'familyName',
  'birthDate',
  'identifiers',
  'phones',
];

export const patientFieldLabels = (t: TFunction): Record<PatientField, string> => ({
  givenName: t('givenName', 'Given name'),
  familyName: t('familyName', 'Family name'),
  birthDate: t('birthDate', 'Birth date'),
  identifiers: t('idNumbers', 'ID numbers'),
  phones: t('phoneNumbers', 'Phone numbers'),
  sex: t('sex', 'Sex'),
  age: t('age', 'Age'),
});

/**
 * The chosen fields of each form, which ACT Core records in its download log: one form as a row per saved form unless
 * rowPerPatient, several as a row per patient. A filter left out keeps every patient.
 */
export async function downloadForms(request: {
  forms: Array<{ form: string; fields: Array<DownloadField> }>;
  startDate: string | null;
  endDate: string | null;
  rowPerPatient?: boolean;
  /** The patient columns after the ACT ID. */
  patient: Array<PatientField>;
  status?: DownloadStatus;
  cardiacClinic?: string;
  primaryCareClinic?: string;
}) {
  const { data } = await openmrsFetch<DownloadResult>(`${restBaseUrl}/actcore/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: request,
  });
  return data;
}

/** What ACT Core recorded of a download. */
export interface DownloadLogDetail {
  /** The labels of the fields the download gave. */
  fields: Array<string>;
  /** The labels of the chosen fields left out because they identify the patient. */
  withheld: Array<string>;
  startDate: string | null;
  endDate: string | null;
  rows: number;
  identifiers: boolean;
  researchOnly: boolean;
  /** The forms the download gave, each with its fields; absent on a list or a download recorded before them. */
  forms?: Array<{ uuid: string; name: string; fields: Array<string> }>;
  rowPerPatient?: boolean;
  /**
   * The filters the download was made with: Download data's status and clinic names, null when unset, or a list's own
   * free-form filters.
   */
  filters?: Record<string, string | null>;
  /** The patient fields the file gave after the ACT ID; absent on a list or a download recorded before they could be chosen. */
  patient?: Array<PatientField>;
}

export interface DownloadLogEntry {
  date: string;
  user: { uuid: string; username: string; display?: string | null; role?: string | null } | null;
  /** Null once the form is purged, and for a list. */
  form: { uuid: string; name: string } | null;
  /** The list a CSV the app made itself was of: the registry, a worklist or a Logs tab. */
  list?: { name: string; kind: string } | null;
  detail: DownloadLogDetail | null;
  /** The value of ACT Core's identifiers filter that lists the download; absent from a server older than it. */
  identifiers?: 'with' | 'without' | 'research';
  /** Whether a detail was recorded that ACT Core or the app cannot read, which leaves `detail` null. */
  unreadable?: boolean;
}
