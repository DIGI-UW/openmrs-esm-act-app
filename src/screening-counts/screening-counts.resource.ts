import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export const settings = ['school', 'community', 'facility'] as const;
export const metrics = ['screened', 'children', 'adolescents', 'adults', 'females', 'positive'] as const;

export type Setting = (typeof settings)[number];
export type Metric = (typeof metrics)[number];
/** By ACT Core's column, `<setting>_<metric>`. */
export type Counts = Record<string, number>;

export interface ScreeningMonth {
  clinic: string;
  /** YYYY-MM. */
  month: string;
  /** False for a month nobody has entered, whose counts are zeros. */
  saved: boolean;
  counts: Counts;
  notes: string | null;
}

export interface ScreeningSummary {
  startMonth: string;
  endMonth: string;
  /** How many clinic months were entered in the range. */
  months: number;
  screened: number;
  females: number;
  positive: number;
  negative: number;
  children: number;
  adolescents: number;
  adults: number;
  settings: Record<Setting, number>;
}

const screeningCountsUrl = `${restBaseUrl}/actcore/screeningcounts`;

export const column = (setting: Setting, metric: Metric) => `${setting}_${metric}`;

/** This month and the ones before it, newest first, as YYYY-MM. */
export const recentMonths = (count: number) =>
  Array.from({ length: count }, (_, back) => dayjs().subtract(back, 'month').format('YYYY-MM'));

export const monthName = (month: string) => dayjs(`${month}-01`).format('MMMM YYYY');

/** What the Screening counts page and the Dashboard call each setting and count. */
export function useScreeningLabels() {
  const { t } = useTranslation();
  const settingLabel: Record<Setting, string> = {
    school: t('school', 'School'),
    community: t('community', 'Community'),
    facility: t('healthFacility', 'Health facility'),
  };
  const metricLabel: Record<Metric, string> = {
    screened: t('screened', 'Screened'),
    children: t('children0to9', 'Children 0-9'),
    adolescents: t('adolescents10to19', 'Adolescents 10-19'),
    adults: t('adults20plus', 'Adults 20+'),
    females: t('female', 'Female'),
    positive: t('positive', 'Positive'),
  };
  return { settingLabel, metricLabel };
}

const monthUrl = (clinic: string, month: string) =>
  `${screeningCountsUrl}?clinic=${encodeURIComponent(clinic)}&month=${encodeURIComponent(month)}`;

export function useScreeningMonth(clinic: string | null, month: string | null) {
  const url = clinic && month ? monthUrl(clinic, month) : null;
  const { data, error, isLoading, mutate } = useSWR<ScreeningMonth, Error>(
    url,
    async (key: string) => (await openmrsFetch<ScreeningMonth>(key)).data,
    // A refetch while counts are being typed would put the saved ones back over them.
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  return { month: data, error, isLoading, mutate };
}

/** Replaces the clinic's month; ACT Core answers with the month as saved, or a 400 saying what does not add up. */
export async function saveScreeningMonth(clinic: string, month: string, counts: Counts, notes: string) {
  const { data } = await openmrsFetch<ScreeningMonth>(monthUrl(clinic, month), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { counts, notes },
  });
  return data;
}

/** The sums of the clinics' months, or of every clinic with none given; nothing is fetched while params is null. */
export function useScreeningSummary(params: { clinics: Array<string>; startMonth: string; endMonth: string } | null) {
  const url = params
    ? `${screeningCountsUrl}/summary?${[
        ...params.clinics.map((clinic) => `clinic=${encodeURIComponent(clinic)}`),
        `startMonth=${params.startMonth}`,
        `endMonth=${params.endMonth}`,
      ].join('&')}`
    : null;
  const { data, error, isLoading, mutate } = useSWR<ScreeningSummary, Error>(
    url,
    async (key: string) => (await openmrsFetch<ScreeningSummary>(key)).data,
    { shouldRetryOnError: false },
  );
  return { summary: data, error, isLoading, mutate };
}
