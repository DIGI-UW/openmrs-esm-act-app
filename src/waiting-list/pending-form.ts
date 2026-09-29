/** An encounter to open in the patient chart's form workspace once the chart is ready for its patient. */
export interface PendingForm {
  patientUuid: string;
  formUuid: string;
  encounterUuid: string;
  at: number;
}

const key = 'act-waiting-list-open-form';

// Long enough for the chart to load; a request the chart never took up is not replayed later.
const maxAgeMs = 60_000;

export function requestFormInChart(form: Omit<PendingForm, 'at'>) {
  window.sessionStorage.setItem(key, JSON.stringify({ ...form, at: Date.now() }));
}

/**
 * The request left by Open form, for the chart of the given patient. Any request is removed as it is read,
 * so it is acted on once, and a chart opened for another patient drops it.
 */
export function takePendingForm(patientUuid: string): PendingForm | null {
  const stored = window.sessionStorage.getItem(key);
  const pending: PendingForm | null = stored ? JSON.parse(stored) : null;
  window.sessionStorage.removeItem(key);
  return pending?.patientUuid === patientUuid && Date.now() - pending.at <= maxAgeMs ? pending : null;
}
