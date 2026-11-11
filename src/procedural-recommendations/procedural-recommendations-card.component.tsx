import React from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { AddIcon, CardHeader, formatDate, useConfig } from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import {
  doneProcedures,
  proceduralRecommendations,
  type ProceduralRecommendation,
} from '../clinical-flags/clinical-flags';
import { type Config } from '../config-schema';
import { useChartEncounters } from '../consultations/consultations.resource';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import styles from '../styles/summary-card.scss';
import { clinicToday } from '../clinic-clock';

const day = (value: string) => formatDate(dayjs(value).toDate(), { time: false, noToday: true });

type Status = 'done' | 'overdue' | 'open';

/**
 * The patient summary's Procedural recommendations: what the latest consultation recommends, with its urgency, when it
 * is due and whether Procedures and Outcomes has recorded it, which is what completes it and takes it off the
 * Procedural waiting list (AR-162, AR-191). Record procedure opens Procedures and Outcomes for a user who may record it.
 * Nothing for a patient whose latest consultation recommends no procedure.
 */
export default function ProceduralRecommendationsCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { consultations, procedures, urgencyBands } = useConfig<Config>();
  const consults = useChartEncounters(patientUuid, consultations.encounterType);
  const procedureEncounters = useChartEncounters(patientUuid, procedures.encounterType);
  const mayRecord = useMayEnterForm(procedures.form);
  const { open, isOpening } = useOpenFormInVisit(patientUuid);
  const isLoading = consults.isLoading || procedureEncounters.isLoading;
  const recommendations = isLoading
    ? []
    : proceduralRecommendations(
        consults.encounters,
        consultations.concepts,
        doneProcedures(procedureEncounters.encounters, procedures.concepts),
      );
  if (!isLoading && !recommendations.length) {
    return null;
  }

  const today = clinicToday();
  const bandOf = (recommendation: ProceduralRecommendation) =>
    urgencyBands.find((band) => band.concept === recommendation.urgencyConcept);
  const dueOf = (recommendation: ProceduralRecommendation) => {
    const band = bandOf(recommendation);
    return band ? dayjs(recommendation.recommended).add(band.deadlineDays, 'day').format('YYYY-MM-DD') : null;
  };
  const statusOf = (recommendation: ProceduralRecommendation): Status => {
    if (recommendation.doneOn || recommendation.markedCompleted) {
      return 'done';
    }
    const due = dueOf(recommendation);
    return due && due < today ? 'overdue' : 'open';
  };
  const urgencyName = (recommendation: ProceduralRecommendation) => {
    const band = bandOf(recommendation);
    return band ? t(band.label) : recommendation.urgency || '--';
  };
  const anyOpen = recommendations.some((recommendation) => statusOf(recommendation) !== 'done');

  return (
    <div className={styles.card}>
      <CardHeader title={t('proceduralRecommendations', 'Procedural recommendations')}>
        <div className={styles.headerActions}>
          {mayRecord && anyOpen && (
            <Button
              kind="ghost"
              size="sm"
              renderIcon={(props) => <AddIcon size={16} {...props} />}
              disabled={isOpening}
              onClick={() => open(procedures.form)}
            >
              {t('recordProcedure', 'Record procedure')}
            </Button>
          )}
        </div>
      </CardHeader>
      {isLoading ? (
        <SkeletonText paragraph lineCount={2} />
      ) : (
        <>
          <Table size="sm" aria-label={t('proceduralRecommendations', 'Procedural recommendations')}>
            <TableHead>
              <TableRow>
                <TableHeader>{t('procedure', 'Procedure')}</TableHeader>
                <TableHeader>{t('procedureType', 'Type')}</TableHeader>
                <TableHeader>{t('urgency', 'Urgency')}</TableHeader>
                <TableHeader>{t('recommendedOn', 'Recommended')}</TableHeader>
                <TableHeader>{t('dueBy', 'Due by')}</TableHeader>
                <TableHeader>{t('status', 'Status')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {recommendations.map((recommendation) => {
                const status = statusOf(recommendation);
                const due = dueOf(recommendation);
                return (
                  <TableRow key={recommendation.key} data-testid="procedural-recommendation">
                    <TableCell>{recommendation.procedure || '--'}</TableCell>
                    <TableCell>{recommendation.type || '--'}</TableCell>
                    <TableCell>{urgencyName(recommendation)}</TableCell>
                    <TableCell>{day(recommendation.recommended)}</TableCell>
                    <TableCell>{due ? day(due) : '--'}</TableCell>
                    <TableCell>
                      {status === 'done' ? (
                        <Tag size="sm" type="green">
                          {recommendation.doneOn
                            ? t('procedureDoneOn', 'Done {{date}}', { date: day(recommendation.doneOn) })
                            : t('procedureDone', 'Done')}
                        </Tag>
                      ) : status === 'overdue' ? (
                        <Tag size="sm" type="red">
                          {t('procedureOverdue', 'Overdue')}
                        </Tag>
                      ) : (
                        <Tag size="sm" type="gray">
                          {t('procedureWaiting', 'Waiting')}
                        </Tag>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {anyOpen && (
            <p className={`${styles.note} ${styles.recommendationNote}`}>
              {t(
                'procedureCompletesRecommendation',
                'A recommendation is done once Procedures and Outcomes records the same procedure, dated on or after the consultation.',
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
