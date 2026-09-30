import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './adherence-ring.scss';

const radius = 17;

/** A ring filled to the patient's adherence, with the percentage inside, as ACT 2.0's registry drew it. */
export function AdherenceRing({ value }: { value: number }) {
  const { t } = useTranslation();
  const percent = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <svg
      className={styles.ring}
      viewBox="0 0 40 40"
      role="img"
      aria-label={t('adherencePercent', 'Adherence {{percent}}%', { percent })}
    >
      <circle className={styles.track} cx="20" cy="20" r={radius} />
      {/* The arc starts at the top, as a clock's hand does. */}
      <circle
        className={styles.arc}
        data-testid="adherence-arc"
        cx="20"
        cy="20"
        r={radius}
        pathLength="100"
        strokeDasharray={`${percent} ${100 - percent}`}
        transform="rotate(-90 20 20)"
      />
      <text className={styles.value} x="20" y="20" textAnchor="middle" dominantBaseline="central">
        {percent}%
      </text>
    </svg>
  );
}
