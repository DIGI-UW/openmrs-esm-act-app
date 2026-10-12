import React from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Tag } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { isDeceased } from '../deceased';
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
const onChart = ({ patient, renderedFrom }: BannerTagProps) => renderedFrom === 'patient-chart' && !isDeceased(patient);

function BannerTag({ type, children }: { type: TagType; children: React.ReactNode }) {
  return (
    <Tag data-testid="banner-tag" type={type}>
      {children}
    </Tag>
  );
}

/**
 * A whole list read for one patient: what a list page or worklist already holds will do, rather than evaluating the
 * report again on every chart opened or each return to the tab.
 */
const onceForTheBanner = { revalidateIfStale: false, revalidateOnFocus: false };

/** Confirmatory echo needed, for a patient on the list the Confirmatory echo due worklist shows. */
export function ConfirmatoryEchoTag(props: BannerTagProps) {
  const { t } = useTranslation();
  const { screenPositive } = useConfig<Config>();
  const { rows } = useReportDataset(onChart(props) ? screenPositive.report : null, undefined, onceForTheBanner);
  return rows.some((row) => row.patient_uuid === props.patientUuid) ? (
    <BannerTag type="purple">{t('confirmatoryEchoNeeded', 'Confirmatory echo needed')}</BannerTag>
  ) : null;
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
