import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, InlineNotification, Search, SkeletonText } from '@carbon/react';
import { Close } from '@carbon/react/icons';
import { navigate, useDebounce } from '@openmrs/esm-framework';
import { patientChartUrl } from '../patient-chart-url';
import {
  type SearchedPatient,
  searchPageSize,
  usePatientSearch,
  useRecentlyViewedPatients,
} from './patient-search.resource';
import { PatientSearchRow } from './patient-search-row.component';
import styles from './patient-search-panel.scss';

interface PatientSearchPanelProps {
  onClose: () => void;
  /** How the panel is announced; Find a patient by default. */
  label?: string;
  /** What picking a patient does; by default it opens their chart. The panel stays open, busy, until it settles. */
  onSelect?: (patient: SearchedPatient) => void | Promise<void>;
  /** Shown above the patients, as Enter prophylaxis shows its banner and choice. */
  children?: React.ReactNode;
}

/** A patient search over the page, by name or ACT ID, listing recently viewed patients before a search. */
export function PatientSearchPanel({ onClose, onSelect, label, children }: PatientSearchPanelProps) {
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const searchTerm = useDebounce(term);
  const searching = searchTerm.trim().length >= 2;
  const search = usePatientSearch(searchTerm);
  const recent = useRecentlyViewedPatients();
  const patients = searching ? search.patients : recent.patients;
  const isLoading = searching ? search.isLoading : recent.isLoading;

  // Read while rendering, before the search box takes focus, so closing gives it back to Find a patient.
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => () => opener.current?.focus?.(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Not while a pick is opening, as closing would not stop it.
      if (event.key === 'Escape' && !busy) {
        onClose();
      } else if (event.key === 'Tab' && panel.current) {
        // Tab stays in the panel, as the page behind it is covered.
        const focusable = panel.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]):not([tabindex="-1"])',
        );
        const [first, last] = [focusable[0], focusable[focusable.length - 1]];
        if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
    };
    // In the capture phase, as Carbon's Search takes Escape to clear itself and stops it there.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, busy]);

  const select = async (patient: SearchedPatient) => {
    recent.addRecentlyViewed(patient.uuid).catch(() => undefined);
    if (!onSelect) {
      onClose();
      navigate({ to: `${patientChartUrl(patient.uuid)}/Patient Summary` });
      return;
    }
    setBusy(patient.uuid);
    try {
      await onSelect(patient);
    } finally {
      onClose();
    }
  };

  return (
    <div
      ref={panel}
      className={styles.panel}
      role="dialog"
      aria-modal="true"
      aria-label={label ?? t('findPatient', 'Find a patient')}
    >
      <div className={styles.searchBar}>
        <Search
          autoFocus
          size="lg"
          labelText={t('searchForPatient', 'Search for a patient by name or ACT ID')}
          placeholder={t('searchForPatient', 'Search for a patient by name or ACT ID')}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
        <Button
          kind="ghost"
          hasIconOnly
          renderIcon={Close}
          iconDescription={t('closeSearch', 'Close search')}
          disabled={Boolean(busy)}
          onClick={onClose}
        />
      </div>
      <div className={styles.body}>
        {children}
        <p className={styles.heading}>
          {searching
            ? t('searchResultCount', '{{count}} search results', { count: search.totalCount })
            : t('recentlyViewedPatients', 'Recently viewed patients')}
        </p>
        {searching && search.totalCount > patients.length && (
          <p className={styles.empty}>
            {t(
              'refineSearch',
              'Showing the first {{shown}}. Add more of the name, or the ACT ID, to find the others.',
              {
                shown: searchPageSize,
              },
            )}
          </p>
        )}
        {searching && search.error ? (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('couldNotSearch', 'Could not search for patients')}
            subtitle={search.error.message}
          />
        ) : isLoading ? (
          <SkeletonText paragraph lineCount={3} />
        ) : patients.length ? (
          <ul className={styles.results}>
            {patients.map((patient) => (
              <PatientSearchRow
                key={patient.uuid}
                patient={patient}
                busy={busy === patient.uuid}
                disabled={Boolean(busy)}
                onSelect={() => select(patient)}
              />
            ))}
          </ul>
        ) : searching ? (
          <p className={styles.empty}>{t('noPatientsFound', 'Sorry, no patient charts were found')}</p>
        ) : null}
      </div>
    </div>
  );
}
