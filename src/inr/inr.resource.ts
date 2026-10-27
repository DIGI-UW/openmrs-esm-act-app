import { parseDate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import {
  answersIn,
  answerText,
  type ChartEncounter,
  useChartEncounters,
  useConsultations,
  warfarinOf,
} from '../consultations/consultations.resource';

export type InrResult = 'inRange' | 'below' | 'above' | 'unknown';

export interface InrReview {
  key: string;
  /** The RHD INR Monitoring that records it, which Edit reopens. */
  encounterUuid: string;
  date: Date;
  inr: number | null;
  target: string;
  result: InrResult;
  nextInr: Date | null;
  newDose: string | null;
}

/** The low and high of a target range such as "2.0 - 3.0" or "2.5-3.5"; null when it names no range. */
export function targetRange(target: string): [number, number] | null {
  const [low, high] = (target.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  return low !== undefined && high !== undefined ? [low, high] : null;
}

/** Whether an INR value falls in, below or above its target range. */
export function inrResult(inr: number | null, target: string): InrResult {
  const range = targetRange(target);
  if (inr === null || !range) {
    return 'unknown';
  }
  return inr < range[0] ? 'below' : inr > range[1] ? 'above' : 'inRange';
}

/**
 * One row per INR value an RHD INR Monitoring records, with that encounter's target and next INR date, newest
 * first. An encounter with no value still lists its date, so a missed test shows.
 */
export function toInrReviews(encounters: Array<ChartEncounter>, concepts: Config['inrReviews']['concepts']) {
  return encounters
    .flatMap((encounter) => {
      const target = answerText(answersIn(encounter.obs, concepts.target)[0]?.value ?? '');
      const [next] = answersIn(encounter.obs, concepts.nextInr);
      const nextInr = next?.value ? parseDate(String(next.value)) : null;
      const groups = answersIn(encounter.obs, concepts.group);
      const values = groups.length ? groups : [null];
      return values.map((group, index): InrReview => {
        const [tested] = answersIn(group?.groupMembers, concepts.dateTested);
        const [value] = answersIn(group?.groupMembers, concepts.value);
        const [dose] = answersIn(group?.groupMembers, concepts.newDose);
        const inr = value ? Number(value.value) : null;
        return {
          key: `${encounter.uuid}-${index}`,
          encounterUuid: encounter.uuid,
          date: parseDate(String(tested?.value ?? encounter.encounterDatetime)),
          inr,
          target,
          result: inrResult(inr, target),
          nextInr,
          newDose: dose ? answerText(dose.value) : null,
        };
      });
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * The patient's INR reviews and whether they are on warfarin, with the dose: the latest INR's new dose, else the one
 * the consultation records.
 */
export function useInrReviews(patientUuid: string | null) {
  const { inrReviews, consultations } = useConfig<Config>();
  const consults = useConsultations(patientUuid);
  const inr = useChartEncounters(patientUuid, inrReviews.encounterType);
  const reviews = toInrReviews(inr.encounters, inrReviews.concepts);
  const warfarin = warfarinOf(consults.encounters, consultations.concepts, consultations.vitaminKAntagonists);
  const nextInr = inr.encounters.length ? (reviews.find((review) => review.nextInr)?.nextInr ?? null) : null;
  return {
    reviews,
    onWarfarin: Boolean(warfarin),
    dose: reviews.find((review) => review.newDose)?.newDose ?? warfarin?.dose ?? null,
    nextInr,
    isLoading: consults.isLoading || inr.isLoading,
    error: consults.error ?? inr.error,
  };
}
