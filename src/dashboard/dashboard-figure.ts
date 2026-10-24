import { createContext, useMemo } from 'react';
import { type TFunction } from 'i18next';
import { useClinicLimit } from '../clinic-limit';
import { type Config } from '../config-schema';

export const sections = ['registrants', 'waitlist', 'cascade', 'optimisation'] as const;

export type Section = (typeof sections)[number];

/**
 * The URL keys that name a figure: its section, then the patients report's own parameters. None may take a value equal
 * to its name, which reportingrest drops (done=done arrives as null), so the done or not done key is outcome.
 */
export const figureKeys = [
  'figure',
  'breakdown',
  'label',
  'procedure',
  'urgency',
  'step',
  'measure',
  'outcome',
] as const;

export type Figure = { figure: Section } & Partial<Record<Exclude<(typeof figureKeys)[number], 'figure'>, string>>;

/** The parameters a figure passes its section's patients report: every key but the section, the empty ones left out. */
export const figureParams = ({ figure, ...rest }: Figure) =>
  Object.fromEntries(Object.entries(rest).filter(([, value]) => value)) as Record<string, string>;

export const patientsReport = (dashboard: Config['dashboard'], section: Section) =>
  ({
    registrants: dashboard.registrantPatientsReport,
    waitlist: dashboard.waitlistPatientsReport,
    cascade: dashboard.cascadePatientsReport,
    optimisation: dashboard.optimisationPatientsReport,
  })[section];

/**
 * The figure a removed figure chip leaves: every active registrant for a sex, age or disease figure, every registrant
 * for the other registrant figures, the whole waitlist, every procedure performed, or the whole cascade.
 */
export const widened = (figure: Figure): Figure =>
  ({
    registrants: {
      figure: 'registrants',
      breakdown: ['sex', 'age', 'disease'].includes(figure.breakdown) ? 'active' : 'registered',
    },
    waitlist: {
      figure: 'waitlist',
      breakdown: figure.breakdown === 'performed' || figure.breakdown === 'total' ? figure.breakdown : 'open',
    },
    cascade: { figure: 'cascade' },
    optimisation: { figure: 'optimisation', measure: figure.measure },
  })[figure.figure] as Figure;

/** A figure's URL, for a count's link, and how the Dashboard opens it in place. */
export const FigureLinks = createContext<{ href: (figure: Figure) => string; open: (figure: Figure) => void } | null>(
  null,
);

/** The cascade report reads no step as Active, so the two are one figure. */
const withStep = (figure: Figure): Figure =>
  figure.figure === 'cascade' ? { ...figure, step: figure.step || 'Active' } : figure;

export const isWidened = (figure: Figure) =>
  JSON.stringify(figureParams(withStep(figure))) === JSON.stringify(figureParams(withStep(widened(figure))));

export function measureLabel(t: TFunction, measure: string) {
  const labels: Record<string, string> = {
    consultations: t('consultationsLastYear', 'Consultations in the last year'),
    echocardiogram: t('echoLast13Months', 'Echocardiogram in the last 13 months'),
    retainedInCare: t('retainedInCare', 'Retained in care (seen in the last 7 months)'),
    interventionAssigned: t('interventionAssigned', 'Intervention assigned'),
    interventions: t('interventionsCompleted', 'Interventions completed'),
    warfarin: t('inrLast90Days', 'On warfarin, with an INR in the last 90 days'),
  };
  return labels[measure] ?? measure;
}

/** What one row of a figure's list is: consultations and interventions count those, every other figure patients. */
export function rowUnit(figure: Figure): 'patient' | 'consultation' | 'recommendation' {
  if (figure.figure === 'optimisation') {
    return figure.measure === 'consultations'
      ? 'consultation'
      : figure.measure === 'interventions'
        ? 'recommendation'
        : 'patient';
  }
  return figure.figure === 'waitlist' && figure.breakdown !== 'total' ? 'recommendation' : 'patient';
}

/**
 * The section and the figure's own label, as the banner and the figure chip name them; a cascade step by its
 * configured label, as its bar does.
 */
export function figureNames(t: TFunction, figure: Figure, cascadeSteps: Config['careCascade']['steps']) {
  switch (figure.figure) {
    case 'registrants':
      return figure.breakdown === 'status'
        ? { section: t('registrantStatus', 'Registrant status'), label: figure.label }
        : figure.breakdown === 'registered'
          ? { section: t('registered', 'Registered'), label: undefined }
          : figure.breakdown === 'active'
            ? { section: t('active', 'Active'), label: undefined }
            : { section: t('activeRegistrants', 'Active registrants'), label: figure.label };
    case 'waitlist':
      return figure.breakdown === 'performed'
        ? { section: t('performedInTheYear', 'Performed in the 12 months'), label: figure.procedure }
        : figure.breakdown === 'total'
          ? { section: t('waitingForAProcedure', 'Waiting for a procedure'), label: undefined }
          : {
              section: t('proceduralWaitlist', 'Procedural waitlist'),
              label: [figure.procedure, figure.urgency].filter(Boolean).join(', ') || undefined,
            };
    case 'cascade': {
      // A figure with no step is the Active step's.
      const shown = figure.step || 'Active';
      return {
        section: t('rhdCareCascade', 'RHD care cascade'),
        label: t(cascadeSteps.find(({ step }) => step === shown)?.label ?? shown),
      };
    }
    case 'optimisation':
      return {
        section: t('medicalOptimisation', 'Medical optimisation'),
        label: [measureLabel(t, figure.measure), figure.outcome === 'notDone' ? t('notDone', 'Not done') : undefined]
          .filter(Boolean)
          .join(', '),
      };
  }
}

/**
 * The count reports' parameters for the clinics a limited site administrator holds: theirs only, whichever clinic is
 * chosen, and nothing counted while they load or when there are none.
 */
export function useCountParams(params: Record<string, string>) {
  const limit = useClinicLimit();
  const limitedTo = limit.status === 'ready' ? limit.uuids : null;
  const counted = limit.status === 'none' || Boolean(limitedTo?.length);
  const countParams = useMemo(
    () => (limitedTo?.length ? { ...params, clinics: limitedTo.join(',') } : params),
    [params, limitedTo],
  );
  return { counted, countParams, pending: limit.status === 'pending' };
}
