import dayjs from 'dayjs';
import useSWR from 'swr';
import { parseDate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';
import {
  answersTo,
  answerText,
  answerUuid,
  groupsOf,
  memberValue,
  type Obs,
  type PatientEncounter,
  patientEncountersUrl,
} from '../patient-encounters';

export interface Consultation {
  uuid: string;
  date: Date;
  /** The encounter's date, which orders consultations as ACT's flags do. */
  encounterDate: Date;
  seenBy: Array<string>;
  nyha: string | null;
  /** Each prophylaxis the consultation prescribes and has not stopped. */
  plan: Array<string>;
  /** The encounter date plus the Next Consultation Time, as the flag RHD cardiology follow-up due counts it. */
  nextReview: Date | null;
  /** Each cardiac medication not stopped, with its answer's uuid and dose. */
  medications: Array<{ drug: string; dosing: string | null }>;
  /** Whether the consultation records any cardiac medication, stopped or not. */
  recordsMedication: boolean;
}

const representation =
  'custom:(uuid,encounterDatetime,encounterProviders:(provider:(name,person:(display))),' +
  'obs:(concept:(uuid,display),value:(uuid,display),groupMembers:(concept:(uuid,display),value:(uuid,display))))';

export function useConsultationsUrl(patientUuid: string | null) {
  const { consultations } = useConfig<Config>();
  return patientUuid ? patientEncountersUrl(patientUuid, consultations.encounterType, representation) : null;
}

/** The patient's consultations, newest first. */
export function useConsultations(patientUuid: string | null) {
  const { consultations: config } = useConfig<Config>();
  const { concepts } = config;
  const url = useConsultationsUrl(patientUuid);
  const { data, error, isLoading } = useSWR<Array<PatientEncounter>, Error>(url, () => fetchAll<PatientEncounter>(url));

  const consultations = (data ?? [])
    .map((encounter): Consultation => {
      const encounterDate = parseDate(encounter.encounterDatetime);
      const [date] = answersTo(encounter, concepts.date);
      const [nyha] = answersTo(encounter, concepts.nyha);
      const [amount] = answersTo(encounter, concepts.nextReviewAmount);
      const unit = config.periods[answerUuid(answersTo(encounter, concepts.nextReviewPeriod)[0]?.value)];
      const notStopped = (members: Array<Obs>) => memberValue(members, concepts.dateStopped) == null;
      const medicationGroups = groupsOf(encounter, concepts.cardiacMedication);
      return {
        uuid: encounter.uuid,
        date: date ? parseDate(String(date.value)) : encounterDate,
        encounterDate,
        seenBy: (encounter.encounterProviders ?? [])
          .map(({ provider }) => provider.person?.display ?? provider.name)
          .filter(Boolean),
        nyha: nyha ? answerText(nyha.value) : null,
        plan: groupsOf(encounter, concepts.prophylaxis)
          .filter(notStopped)
          .map((members) => answerText(memberValue(members, concepts.prophylaxis))),
        nextReview:
          amount && unit
            ? dayjs(encounterDate)
                .startOf('day')
                .add(Math.round(Number(amount.value)), unit)
                .toDate()
            : null,
        medications: medicationGroups.filter(notStopped).map((members) => {
          const dosing = memberValue(members, concepts.dosing);
          return {
            drug: answerUuid(memberValue(members, concepts.cardiacMedication)),
            dosing: dosing == null ? null : answerText(dosing),
          };
        }),
        recordsMedication: medicationGroups.length > 0,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return { consultations, error, isLoading };
}

/** The patient's latest consultation and next cardiology review, and whether they are on warfarin, with its dose. */
export function useConsultationSummary(patientUuid: string | null) {
  const { consultations: config } = useConfig<Config>();
  const { consultations, error, isLoading } = useConsultations(patientUuid);
  const byEncounter = [...consultations].sort((a, b) => b.encounterDate.getTime() - a.encounterDate.getTime());
  // The latest consultation that sets one, as the flag RHD cardiology follow-up due reads it.
  const nextReview = byEncounter.find((consultation) => consultation.nextReview)?.nextReview ?? null;
  // The latest consultation recording a cardiac medication is the current list, as the flag RHD INR review due reads it.
  const current = byEncounter.find((consultation) => consultation.recordsMedication);
  const medications = current?.medications ?? [];
  const warfarin = medications.find((medication) => config.warfarin.includes(medication.drug));
  return {
    last: consultations[0] ?? null,
    nextReview,
    onWarfarin: Boolean(warfarin),
    warfarinDosing: warfarin?.dosing ? { dose: warfarin.dosing, date: current.date } : null,
    error,
    isLoading,
  };
}
