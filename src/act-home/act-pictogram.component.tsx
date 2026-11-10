import React from 'react';
import actEmblem from '../assets/act-emblem.png';
import styles from './act-home.scss';

/** The ACT logo's emblem without its lettering, sized and spaced like a framework pictogram. */
export function ActPictogram({ label }: { label: string }) {
  return <img src={actEmblem} alt={label} width={60} height={60} className={styles.emblem} />;
}
