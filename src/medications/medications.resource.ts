import { parseDate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import {
  answersIn,
  answerText,
  type ChartEncounter,
  useChartEncounters,
} from '../consultations/consultations.resource';

type Concepts = Config['consultations']['concepts'];

const answerUuid = (value: unknown) =>
  typeof value === 'object' && value !== null ? String((value as { uuid?: string }).uuid ?? '') : '';

const time = (date: string) => parseDate(date).getTime();

export interface Medication {
  key: string;
  name: string;
  dose: string;
  interval: string;
  started: string;
  stopped: string | null;
  /** The latest record that lists the medicine, which Edit opens. */
  encounterUuid: string;
}

/**
 * The patient's cardiac medications, one row per medicine, read oldest record first.
 * The latest record decides the state: a Date Stopped means Past, none means Active.
 */
export function toMedications(encounters: Array<ChartEncounter>, concepts: Concepts) {
  const rows = new Map<string, Medication & { recordedStart: string }>();
  const oldestFirst = [...encounters].sort((a, b) => time(a.encounterDatetime) - time(b.encounterDatetime));
  for (const encounter of oldestFirst) {
    for (const group of answersIn(encounter.obs, concepts.medication)) {
      const [medicine] = answersIn(group.groupMembers, concepts.medication);
      if (!medicine) {
        continue;
      }
      const text = (concept: string) => {
        const [one] = answersIn(group.groupMembers, concept);
        return one ? answerText(one.value) : '';
      };
      const uuid = answerUuid(medicine.value);
      const dateStarted = text(concepts.dateStarted);
      const row = rows.get(uuid) ?? {
        key: uuid,
        name: answerText(medicine.value),
        dose: '',
        interval: '',
        started: encounter.encounterDatetime,
        stopped: null,
        encounterUuid: '',
        recordedStart: '',
      };
      row.encounterUuid = encounter.uuid;
      row.dose = text(concepts.medicationDose) || row.dose;
      row.interval = text(concepts.medicationInterval) || row.interval;
      row.stopped = text(concepts.dateStopped) || null;
      if (dateStarted && (!row.recordedStart || time(dateStarted) < time(row.recordedStart))) {
        row.recordedStart = dateStarted;
        row.started = dateStarted;
      }
      rows.set(uuid, row);
    }
  }
  const all = [...rows.values()];
  return {
    active: all.filter((one) => !one.stopped).sort((a, b) => time(b.started) - time(a.started)),
    past: all.filter((one) => one.stopped).sort((a, b) => time(b.stopped!) - time(a.stopped!)),
  };
}

/**
 * The cardiac medications recorded in consultations and in Medication Update, read together, each with the form of
 * its latest record.
 */
export function useMedications(patientUuid: string) {
  const { consultations, medications } = useConfig<Config>();
  const fromConsultations = useChartEncounters(patientUuid, consultations.encounterType);
  const fromUpdates = useChartEncounters(patientUuid, medications.encounterType);
  const updates = new Set(fromUpdates.encounters.map((encounter) => encounter.uuid));
  const withForm = (rows: Array<Medication>) =>
    rows.map((row) => ({ ...row, form: updates.has(row.encounterUuid) ? medications.form : consultations.form }));
  const { active, past } = toMedications(
    [...fromConsultations.encounters, ...fromUpdates.encounters],
    consultations.concepts,
  );
  return {
    active: withForm(active),
    past: withForm(past),
    error: fromConsultations.error ?? fromUpdates.error,
    isLoading: fromConsultations.isLoading || fromUpdates.isLoading,
  };
}
