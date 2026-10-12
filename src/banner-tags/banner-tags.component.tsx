import React from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import useSWR from 'swr';
import { Tag } from '@carbon/react';
import { restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useConsultationSummary } from '../consultations/consultations.resource';
import { fetchRaisedFlags } from '../flag-gaps/flag-gaps.resource';
import { useInrSummary } from '../inr/inr.resource';
import { useProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { useReportDataset } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';

/** What the patient banner's tags slot passes each tag. */
interface BannerTagProps {
  patientUuid: string;
  patient?: fhir.Patient;
  renderedFrom?: string;
}

type TagType = 'red' | 'blue' | 'purple' | 'green' | 'magenta' | 'gray' | 'teal';

/**
 * The chart's banner, for a living patient. A search result's banner shows these tags too, and each would evaluate
 * reports or fetch the patient's forms for every result, so there they show nothing.
 */
const onChart = ({ patient, renderedFrom }: BannerTagProps) =>
  renderedFrom === 'patient-chart' && !patient?.deceasedBoolean && !patient?.deceasedDateTime;

function BannerTag({ type, children }: { type: TagType; children: React.ReactNode }) {
  return (
    <Tag data-testid="banner-tag" type={type}>
      {children}
    </Tag>
  );
}

function useRaisedFlag(patientUuid: string | null, flagUuid: string) {
  const { data } = useSWR(
    patientUuid ? `${restBaseUrl}/patientflags/patientflag?patient=${patientUuid}&for=act-banner` : null,
    () => fetchRaisedFlags(patientUuid),
    { shouldRetryOnError: false },
  );
  return Boolean(data?.some((flag) => flag.uuid === flagUuid));
}

/**
 * A whole list read for one patient: what a list page or worklist already holds will do, rather than evaluating the
 * report again on every chart opened or each return to the tab.
 */
const onceForTheBanner = { revalidateIfStale: false, revalidateOnFocus: false };

const passed = (date: Date | null) => Boolean(date) && dayjs(date).isBefore(dayjs().startOf('day'));

/**
 * Cardiology visit due, or overdue once the next review has passed, while the patient has the flag RHD cardiology
 * follow-up due, which counts the next review as the Consultation visits card does.
 */
export function CardiologyVisitTag(props: BannerTagProps) {
  const { t } = useTranslation();
  const { bannerFlags } = useConfig<Config>();
  const patientUuid = onChart(props) ? props.patientUuid : null;
  const flagged = useRaisedFlag(patientUuid, bannerFlags.cardiologyFollowUp);
  const { nextReview, isLoading } = useConsultationSummary(flagged ? patientUuid : null);
  if (!flagged || isLoading) {
    return null;
  }
  return passed(nextReview) ? (
    <BannerTag type="red">{t('cardiologyVisitOverdue', 'Cardiology visit overdue')}</BannerTag>
  ) : (
    <BannerTag type="blue">{t('cardiologyVisitDue', 'Cardiology visit due')}</BannerTag>
  );
}

/** INR due, or overdue once the Next INR Date has passed, while the patient has the flag RHD INR review due. */
export function InrTag(props: BannerTagProps) {
  const { t } = useTranslation();
  const { bannerFlags } = useConfig<Config>();
  const patientUuid = onChart(props) ? props.patientUuid : null;
  const flagged = useRaisedFlag(patientUuid, bannerFlags.inrReview);
  const { nextInr, isLoading } = useInrSummary(flagged ? patientUuid : null);
  if (!flagged || isLoading) {
    return null;
  }
  return passed(nextInr) ? (
    <BannerTag type="red">{t('inrOverdue', 'INR overdue')}</BannerTag>
  ) : (
    <BannerTag type="blue">{t('inrDue', 'INR due')}</BannerTag>
  );
}

/** Confirmatory echo needed, for a patient on the list the Confirmatory echo due worklist shows. */
export function ConfirmatoryEchoTag(props: BannerTagProps) {
  const { t } = useTranslation();
  const { screenPositive } = useConfig<Config>();
  const { rows } = useReportDataset(onChart(props) ? screenPositive.report : null, undefined, onceForTheBanner);
  return rows.some((row) => row.patient_uuid === props.patientUuid) ? (
    <BannerTag type="purple">{t('confirmatoryEchoNeeded', 'Confirmatory echo needed')}</BannerTag>
  ) : null;
}

/** Prophylaxis prescribed, or No prophylaxis prescription, as ACT Core reads the patient's regimen. */
export function PrescriptionTag(props: BannerTagProps) {
  const { t } = useTranslation();
  const { summary } = useProphylaxisSummary(onChart(props) ? props.patientUuid : null);
  if (!summary) {
    return null;
  }
  return summary.type ? (
    <BannerTag type="green">{t('prophylaxisPrescribed', 'Prophylaxis prescribed')}</BannerTag>
  ) : (
    <BannerTag type="magenta">{t('noProphylaxisPrescription', 'No prophylaxis prescription')}</BannerTag>
  );
}

/**
 * The patient's procedural recommendation, by how long its oldest pending one has waited on the procedural waiting
 * list: under or over 12 months, or none.
 */
export function ProceduralRecommendationTag(props: BannerTagProps) {
  const { t } = useTranslation();
  const { waitingList } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(
    onChart(props) ? waitingList.report : null,
    undefined,
    onceForTheBanner,
  );
  if (!onChart(props) || isLoading || error) {
    return null;
  }
  const added = rows
    .filter((row) => row.patient_uuid === props.patientUuid)
    .map((row) => parseReportDate(row.date_added))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  if (!added.length) {
    return <BannerTag type="gray">{t('noProceduralRecommendation', 'No procedural recommendation')}</BannerTag>;
  }
  return dayjs(added[0]).isAfter(dayjs().subtract(12, 'month')) ? (
    <BannerTag type="teal">{t('procedureUnder12Months', 'Procedure recommended < 12 months')}</BannerTag>
  ) : (
    <BannerTag type="red">{t('procedureOver12Months', 'Procedure recommended > 12 months')}</BannerTag>
  );
}
