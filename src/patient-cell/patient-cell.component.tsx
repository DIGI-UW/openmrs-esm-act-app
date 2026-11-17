import React from 'react';
import { ConfigurableLink } from '@openmrs/esm-framework';
import { patientChartUrl } from '../patient-chart-url';
import styles from './patient-cell.scss';

interface PatientCellProps {
  row: { patient_uuid?: unknown; full_name?: unknown; rhd_id?: unknown };
  to?: string;
  detail?: string;
  children?: React.ReactNode;
}

export function PatientCell({ row, to, detail, children }: PatientCellProps) {
  const actId = String(row.rhd_id ?? '');
  return (
    <>
      <ConfigurableLink to={to ?? patientChartUrl(row.patient_uuid)}>{String(row.full_name ?? '')}</ConfigurableLink>
      {children}
      <span className={styles.actId}>{[actId, detail].filter(Boolean).join(' · ')}</span>
    </>
  );
}
