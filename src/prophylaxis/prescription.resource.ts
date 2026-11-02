import { useMemo } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';

type Concepts = Config['prophylaxisUpdate']['concepts'];

export interface PrescriptionObs {
  uuid: string;
  concept: { uuid: string };
  value: unknown;
  groupMembers?: Array<PrescriptionObs> | null;
}

export interface PrescriptionEncounter {
  uuid: string;
  encounterDatetime: string;
  encounterType: { uuid: string };
  obs: Array<PrescriptionObs>;
}

type Answer = { uuid: string; label: string };

export interface PrescriptionGroup {
  uuid: string;
  regimen: Answer;
  started: string;
}

export interface CurrentPrescription {
  /** The encounter ACT Core reads the patient's prescription from. */
  encounter: PrescriptionEncounter;
  /** Its day, by its Consultation Date when it has one, else its encounter date. */
  day: string;
  /** The prescriptions in force (not stopped, not None, with a Date Started), by start date and then obs order. */
  groups: Array<PrescriptionGroup>;
  /** The last-started of `groups`, which ACT Core counts as the current regimen. */
  main: PrescriptionGroup | null;
  duration: (Answer & { obsUuid: string }) | null;
}

const representation =
  'custom:(uuid,encounterDatetime,encounterType:(uuid),obs:(uuid,concept:(uuid),value,groupMembers:(uuid,concept:(uuid),value)))';

/** The date part of a REST date, as the server wrote it, so that no time zone moves it. */
export const dayOf = (value: unknown) => String(value).slice(0, 10);

const answerOf = (value: unknown): Answer => {
  const answer = (value ?? {}) as { uuid?: string; display?: string };
  return { uuid: answer.uuid ?? '', label: answer.display ?? '' };
};

const memberOf = (group: PrescriptionObs, concept: string) =>
  (group.groupMembers ?? []).find((member) => member.concept.uuid === concept);

const dayOfEncounter = (encounter: PrescriptionEncounter, concepts: Concepts) =>
  dayOf(
    encounter.obs.find((one) => one.concept.uuid === concepts.consultationDate)?.value ?? encounter.encounterDatetime,
  );

const groupsOf = (encounter: PrescriptionEncounter, concepts: Concepts) =>
  encounter.obs.filter((one) => one.concept.uuid === concepts.prescription && memberOf(one, concepts.prescription));

/**
 * The prescription ACT Core counts as current: the groups of the latest day's first encounter, a day being the
 * Consultation Date or else the encounter date. Groups without a Date Started, stopped or None are not in force.
 */
export function currentPrescriptionOf(
  encounters: Array<PrescriptionEncounter>,
  concepts: Concepts,
): CurrentPrescription | null {
  const firstOfDay = new Map<string, PrescriptionEncounter>();
  for (const encounter of encounters.filter((one) => groupsOf(one, concepts).length)) {
    const day = dayOfEncounter(encounter, concepts);
    const first = firstOfDay.get(day);
    // Approximates ACT Core's smallest encounter id of the day, which REST does not expose.
    if (!first || encounter.encounterDatetime < first.encounterDatetime) {
      firstOfDay.set(day, encounter);
    }
  }
  const day = [...firstOfDay.keys()].sort().pop();
  if (!day) {
    return null;
  }
  const encounter = firstOfDay.get(day)!;
  const groups = groupsOf(encounter, concepts)
    .flatMap((group) => {
      const regimen = answerOf(memberOf(group, concepts.prescription)!.value);
      const started = memberOf(group, concepts.dateStarted)?.value;
      const stopped = memberOf(group, concepts.dateStopped);
      return started && !stopped && regimen.uuid !== concepts.none
        ? [{ uuid: group.uuid, regimen, started: dayOf(started) }]
        : [];
    })
    .sort((a, b) => a.started.localeCompare(b.started));
  const duration = encounter.obs.find((one) => one.concept.uuid === concepts.duration);
  return {
    encounter,
    day,
    groups,
    main: groups[groups.length - 1] ?? null,
    duration: duration ? { ...answerOf(duration.value), obsUuid: duration.uuid } : null,
  };
}

export interface PrescribedCourse {
  regimen: string;
  started: string;
  stopped: string | null;
  reasonStopped: string | null;
  /** The day of the first encounter that records the course. */
  recorded: string;
  current: boolean;
}

/**
 * Each course, a regimen and its Date Started however many encounters carry it, newest start first; None is skipped.
 * A course takes the Date Stopped of the latest encounter that stops it.
 */
export function prescriptionHistoryOf(
  encounters: Array<PrescriptionEncounter>,
  concepts: Concepts,
  current = currentPrescriptionOf(encounters, concepts),
): Array<PrescribedCourse> {
  const inForce = new Set(current?.groups.map((one) => `${one.regimen.uuid} ${one.started}`));
  const courses = new Map<string, PrescribedCourse>();
  const byDay = encounters
    .map((encounter) => ({ encounter, day: dayOfEncounter(encounter, concepts) }))
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) || a.encounter.encounterDatetime.localeCompare(b.encounter.encounterDatetime),
    );
  for (const { encounter, day } of byDay) {
    for (const group of groupsOf(encounter, concepts)) {
      const regimen = answerOf(memberOf(group, concepts.prescription)!.value);
      const started = memberOf(group, concepts.dateStarted)?.value;
      if (!started || regimen.uuid === concepts.none) {
        continue;
      }
      const key = `${regimen.uuid} ${dayOf(started)}`;
      const course = courses.get(key) ?? {
        regimen: regimen.label,
        started: dayOf(started),
        stopped: null,
        reasonStopped: null,
        recorded: day,
        current: inForce.has(key),
      };
      const stopped = memberOf(group, concepts.dateStopped);
      if (stopped) {
        const reason = memberOf(group, concepts.reasonStopped);
        course.stopped = dayOf(stopped.value);
        course.reasonStopped = reason ? answerOf(reason.value).label : null;
      }
      courses.set(key, course);
    }
  }
  return [...courses.values()].sort((a, b) => b.started.localeCompare(a.started));
}

/** The patient's encounters with the answers that hold a prescription, for the Prophylaxis card and its update. */
export function usePrescription(patientUuid: string | null, concepts: Concepts) {
  // Keyed under the patient's /encounter, which common-lib revalidates on every save.
  const url = patientUuid ? `${restBaseUrl}/encounter?patient=${patientUuid}&v=${representation}` : null;
  const { data, error, isLoading } = useSWR<Array<PrescriptionEncounter>, Error>(url, () =>
    fetchAll<PrescriptionEncounter>(url),
  );
  const { prescription, history } = useMemo(() => {
    const current = data ? currentPrescriptionOf(data, concepts) : null;
    return { prescription: current, history: data ? prescriptionHistoryOf(data, concepts, current) : null };
  }, [data, concepts]);
  return { prescription, history, error, isLoading };
}

export interface NewObs {
  concept: string;
  person: string;
  value?: unknown;
  groupMembers?: Array<NewObs>;
}

export interface PrescriptionEdit {
  regimen: Answer;
  started: string;
  duration?: string;
  /** Present when the prescription is stopped rather than changed. */
  stop?: { stopped: string; reason: string };
}

/**
 * The answers to save for an update, which ACT Core reads whole from the latest day: a change of start date keeps `main`
 * beside the new group so each start is scored, a correction replaces it, and a stop stops every prescription in force.
 */
export function prescriptionPayload(
  patient: string,
  concepts: Concepts,
  current: Array<PrescriptionGroup>,
  edit: PrescriptionEdit,
  main: string | null,
): Array<NewObs> {
  const answer = (concept: string, value: unknown): NewObs => ({ concept, person: patient, value });
  const group = (regimen: string, started: string, stop?: PrescriptionEdit['stop']): NewObs => ({
    concept: concepts.prescription,
    person: patient,
    groupMembers: [
      answer(concepts.prescription, regimen),
      answer(concepts.dateStarted, started),
      ...(stop ? [answer(concepts.dateStopped, stop.stopped), answer(concepts.reasonStopped, stop.reason)] : []),
    ],
  });
  const edited = current.find((one) => one.uuid === main);
  const others = current.filter((one) => one.uuid !== main);
  const replaced = edited?.started === edit.started;
  const carried = edit.stop ? [] : replaced ? others : edited ? [edited, ...others] : others;
  return [
    group(edit.regimen.uuid, edit.started, edit.stop),
    ...(edit.stop ? others.map((one) => group(one.regimen.uuid, one.started, edit.stop)) : []),
    ...carried.map((one) => group(one.regimen.uuid, one.started)),
    ...(edit.duration ? [answer(concepts.duration, edit.duration)] : []),
  ];
}

/**
 * Saves an update as a new encounter of the update type. ACT Core keeps only a day's first encounter, so one recorded
 * today is edited in place instead: its groups in force and duration voided, and the new answers added with the carried
 * groups in one request, so no earlier start is lost.
 */
export async function savePrescription({
  patient,
  location,
  encounterType,
  concepts,
  current,
  edit,
  main,
  today,
}: {
  patient: string;
  location: string;
  encounterType: string;
  concepts: Concepts;
  current: CurrentPrescription | null;
  edit: PrescriptionEdit;
  main: string | null;
  today: string;
}) {
  const obs = prescriptionPayload(patient, concepts, current?.groups ?? [], edit, main);
  const headers = { 'Content-Type': 'application/json' };
  if (current && current.day === today) {
    const voided = [...current.groups.map((one) => one.uuid), ...(current.duration ? [current.duration.obsUuid] : [])];
    await openmrsFetch(`${restBaseUrl}/encounter/${current.encounter.uuid}`, {
      method: 'POST',
      headers,
      body: { obs: [...voided.map((uuid) => ({ uuid, voided: true })), ...obs] },
    });
    return;
  }
  await openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers,
    body: { patient, encounterType, location, obs },
  });
}
