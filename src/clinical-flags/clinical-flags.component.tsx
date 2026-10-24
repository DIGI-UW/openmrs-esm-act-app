import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useChartEncounters } from '../consultations/consultations.resource';
import { diagnosisConcepts } from '../consultations/patient-details.resource';
import { pillsClassName, StatusPill } from '../patient-status/status-pill.component';
import { useProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { doneProcedures, needsConfirmatoryEcho, procedureStatus } from './clinical-flags';

/** The Screen + question of Patient Information. */
const SCREEN_POSITIVE = '82a5fbb5-038d-57b8-82d1-3fd0ac95673d';

/**
 * The prototype's other banner flags: Confirmatory echo needed, for everyone; and for a clinician, as the prototype
 * shows its clinician and site administrator, whether prophylaxis is prescribed and the procedural recommendation's
 * age. A deceased patient shows none.
 */
export default function ClinicalFlags({ patientUuid, patient }: { patientUuid: string; patient?: fhir.Patient }) {
  const { t } = useTranslation();
  const { consultations, procedures, clinicianPrivilege } = useConfig<Config>();
  const { user } = useSession();
  const deceased = Boolean(patient?.deceasedBoolean || patient?.deceasedDateTime);
  const clinician = Boolean(user) && userHasAccess(clinicianPrivilege, user);
  const living = deceased ? null : patientUuid;
  const patientInformation = useChartEncounters(living, diagnosisConcepts.encounterType);
  const consults = useChartEncounters(clinician ? living : null, consultations.encounterType);
  // A procedure recorded on Procedures and Outcomes completes its recommendation (AR-162).
  const procedureEncounters = useChartEncounters(clinician ? living : null, procedures.encounterType);
  const { summary } = useProphylaxisSummary(clinician ? living : null);
  if (deceased) {
    return null;
  }
  const echo = !patientInformation.isLoading && needsConfirmatoryEcho(patientInformation.encounters, SCREEN_POSITIVE);
  const procedure =
    clinician && !consults.isLoading && !procedureEncounters.isLoading
      ? procedureStatus(
          consults.encounters,
          consultations.concepts,
          new Date(),
          doneProcedures(procedureEncounters.encounters, procedures.concepts),
        )
      : null;
  const procedureLabels = {
    recent: { tone: 'green', label: t('proceduralRecentRecommendation', 'Procedural rec. < 12 months') },
    old: { tone: 'yellow', label: t('proceduralOldRecommendation', 'Procedural rec. > 12 months') },
    none: { tone: 'red', label: t('noProceduralRecommendation', 'No procedural rec.') },
  } as const;
  return (
    <span className={pillsClassName}>
      {echo && (
        <StatusPill
          tone="yellow"
          label={t('confirmatoryEchoNeeded', 'Confirmatory echo needed')}
          testId="echo-status"
        />
      )}
      {clinician && summary && (
        <StatusPill
          tone={summary.status === 'none' ? 'red' : 'green'}
          label={
            summary.status === 'none'
              ? t('noProphylaxisPrescription', 'No prophylaxis prescription')
              : t('prophylaxisPrescribed', 'Prophylaxis prescribed')
          }
          testId="prescription-status"
        />
      )}
      {procedure && (
        <StatusPill
          tone={procedureLabels[procedure].tone}
          label={procedureLabels[procedure].label}
          testId="procedure-status"
        />
      )}
    </span>
  );
}
