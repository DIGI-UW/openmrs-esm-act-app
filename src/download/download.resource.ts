import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

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
  /** Whether the rows keep the names, birth dates, ID numbers and phones. */
  identifiers: boolean;
  /** Whether the rows are only of patients who opted in to research. */
  researchOnly: boolean;
}

interface FormResource {
  uuid: string;
  name: string;
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

const formsUrl = `${restBaseUrl}/form?v=custom:(uuid,name,retired,resources:(name))`;

/** The forms the chart's form engine opens: those with a JSON schema, as O3 lists them. */
export function useDownloadForms() {
  const { data, error, isLoading } = useSWR<Array<DownloadForm>, Error>(formsUrl, async () =>
    (await openmrsFetch<{ results: Array<FormResource> }>(formsUrl)).data.results
      .filter((form) => !form.retired && form.resources?.some((resource) => resource.name === 'JSON schema'))
      .map(({ uuid, name }) => ({ uuid, name }))
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
  const { data, error, isLoading } = useSWR<Array<DownloadField>, Error>(url, async () =>
    formFields((await openmrsFetch<FormSchema>(url)).data),
  );
  return { fields: data ?? [], error, isLoading };
}

/** The form's chosen fields, one row per saved form, which ACT Core records in its download log. */
export async function downloadForm(request: {
  form: string;
  fields: Array<DownloadField>;
  startDate: string | null;
  endDate: string | null;
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
}

export interface DownloadLogEntry {
  date: string;
  user: { uuid: string; username: string };
  /** Null once the form is purged. */
  form: { uuid: string; name: string } | null;
  detail: DownloadLogDetail | null;
}

/** Everyone's latest downloads, newest first. */
export function useDownloadLog() {
  const url = `${restBaseUrl}/actcore/download`;
  const { data, error, isLoading } = useSWR<Array<DownloadLogEntry>, Error>(
    url,
    async () => (await openmrsFetch<{ results: Array<DownloadLogEntry> }>(url)).data.results,
  );
  return { entries: data ?? [], error, isLoading };
}
