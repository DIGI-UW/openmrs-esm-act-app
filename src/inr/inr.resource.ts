import useSWR from 'swr';
import { parseDate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';
import {
  answersTo,
  answerText,
  groupsOf,
  memberValue,
  type Obs,
  type PatientEncounter,
  patientEncountersUrl,
} from '../patient-encounters';

export type InrResult = 'inRange' | 'below' | 'above' | null;

export interface InrReview {
  /** The encounter's uuid, and the reading's index within it. */
  key: string;
  date: Date;
  /** The review's encounter date, which orders reviews as the flag RHD INR review due does. */
  encounterDate: Date;
  inr: number | null;
  target: string | null;
  result: InrResult;
  nextInr: Date | null;
  newDose: string | null;
}

const representation =
  'custom:(uuid,encounterDatetime,obs:(concept:(uuid,display),value:(uuid,display),groupMembers:(concept:(uuid,display),value:(uuid,display))))';

/** In range, below or above a target answered as a range such as 2.0-3.0; null when either is missing. */
export function inrResult(inr: number | null, target: string | null): InrResult {
  const [low, high] = (target ?? '').split('-').map(Number);
  if (inr == null || !target || Number.isNaN(low) || Number.isNaN(high)) {
    return null;
  }
  return inr < low ? 'below' : inr > high ? 'above' : 'inRange';
}

/**
 * The patient's INR readings, newest first, each with its review's target and next INR date. A review with no
 * reading is one row of its own, so its target and next INR still show.
 */
export function useInrReviews(patientUuid: string | null) {
  const { inr: config } = useConfig<Config>();
  const { concepts } = config;
  const url = patientUuid ? patientEncountersUrl(patientUuid, config.encounterType, representation) : null;
  const { data, error, isLoading } = useSWR<Array<PatientEncounter>, Error>(url, () => fetchAll<PatientEncounter>(url));

  const reviews = (data ?? [])
    .flatMap((encounter): Array<InrReview> => {
      // The target and each reading's group share one question; a group may hold its own target as a member.
      const answers = answersTo(encounter, concepts.target) as Array<Obs>;
      const targetAnswer = answers.find((obs) => !obs.groupMembers?.length && obs.value != null);
      const target = targetAnswer ? answerText(targetAnswer.value) : null;
      const [next] = answersTo(encounter, concepts.nextDate);
      const nextInr = next ? parseDate(String(next.value)) : null;
      const encounterDate = parseDate(encounter.encounterDatetime);
      const readings = groupsOf(encounter, concepts.target);
      if (!readings.length) {
        return [
          {
            key: encounter.uuid,
            date: encounterDate,
            encounterDate,
            inr: null,
            target,
            result: null,
            nextInr,
            newDose: null,
          },
        ];
      }
      return readings.map((members, index) => {
        const tested = memberValue(members, concepts.dateTested);
        const value = memberValue(members, concepts.value);
        const inr = value == null ? null : Number(value);
        const newDose = memberValue(members, concepts.newDose);
        const ownTarget = memberValue(members, concepts.target);
        const readingTarget = ownTarget == null ? target : answerText(ownTarget);
        return {
          key: `${encounter.uuid}-${index}`,
          date: tested == null ? encounterDate : parseDate(String(tested)),
          encounterDate,
          inr,
          target: readingTarget,
          result: inrResult(inr, readingTarget),
          nextInr,
          newDose: newDose == null ? null : answerText(newDose),
        };
      });
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return { reviews, error, isLoading };
}

/** The latest INR reading, the latest review's target and next INR date, and the latest new warfarin dose. */
export function useInrSummary(patientUuid: string | null) {
  const { reviews, error, isLoading } = useInrReviews(patientUuid);
  const latestReview = reviews.reduce<InrReview | null>(
    (latest, review) => (!latest || review.encounterDate > latest.encounterDate ? review : latest),
    null,
  );
  const lastReading = reviews.find((review) => review.inr != null) ?? null;
  const lastDose = reviews.find((review) => review.newDose) ?? null;
  return {
    lastReading,
    target: latestReview?.target ?? null,
    nextInr: latestReview?.nextInr ?? null,
    lastDose,
    error,
    isLoading,
  };
}
