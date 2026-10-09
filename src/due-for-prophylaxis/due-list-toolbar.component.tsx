import React from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button, ContentSwitcher, Switch } from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { UserHasAccess } from '@openmrs/esm-framework';
import { PRIVILEGE_EXPORT_LISTS } from '../constants';
import { type ReportRow } from '../reports/report-dataset.resource';
import { downloadCsv } from '../table-filters/csv';
import { adherence, type DueFilter, lastDose, prescription, statusLabel } from './due-list';
import styles from './due-for-prophylaxis.scss';

const filters: Array<DueFilter> = ['bpg', 'oral', 'all'];

/** The due list's description, its BPG, Oral and All filter with counts, and Download CSV of the filtered rows. */
export function DueListToolbar({
  description,
  filter,
  counts,
  onFilter,
  rows,
  recorded,
}: {
  description?: string;
  filter: DueFilter;
  counts: Record<DueFilter, number>;
  onFilter: (filter: DueFilter) => void;
  rows: Array<ReportRow>;
  recorded: Set<string>;
}) {
  const { t } = useTranslation();
  const labels: Record<DueFilter, string> = { bpg: t('bpg', 'BPG'), oral: t('oral', 'Oral'), all: t('all', 'All') };

  const download = () =>
    downloadCsv(
      `due-for-prophylaxis-${filter}-${dayjs().format('YYYY-MM-DD')}.csv`,
      [
        t('patient', 'Patient'),
        t('actId', 'ACT ID'),
        t('prescription', 'Prescription'),
        t('lastDose', 'Last dose'),
        t('status', 'Status'),
        t('adherence', 'Adherence'),
      ],
      rows.map((row) => {
        const percent = adherence(row);
        return [
          String(row.full_name ?? ''),
          String(row.rhd_id ?? ''),
          prescription(t, row),
          lastDose(row),
          statusLabel(t, row, recorded.has(String(row.patient_uuid))),
          percent === null ? '' : `${percent}%`,
        ];
      }),
    );

  return (
    <div className={styles.toolbar}>
      {description && <p className={styles.description}>{description}</p>}
      <div className={styles.toolbarActions}>
        <ContentSwitcher
          size="md"
          selectedIndex={filters.indexOf(filter)}
          onChange={({ name }) => onFilter(name as DueFilter)}
          className={styles.filter}
        >
          {filters.map((key) => (
            <Switch key={key} name={key} text={`${labels[key]} ${counts[key]}`} />
          ))}
        </ContentSwitcher>
        <UserHasAccess privilege={PRIVILEGE_EXPORT_LISTS}>
          <Button kind="tertiary" size="md" renderIcon={Download} disabled={!rows.length} onClick={download}>
            {t('downloadCsv', 'Download CSV')}
          </Button>
        </UserHasAccess>
      </div>
    </div>
  );
}
