import React from 'react';
import { useTranslation } from 'react-i18next';
import { ContentSwitcher, Switch } from '@carbon/react';
import { type ReportRow } from '../reports/report-dataset.resource';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import { type DueFilter, dueColumns } from './due-list';
import styles from './due-for-prophylaxis.scss';

const filters: Array<DueFilter> = ['bpg', 'oral', 'all'];

/** The due list's description, its BPG, Oral and All filter with counts, and Download CSV of the filtered rows. */
export function DueListToolbar({
  csvName = 'due-for-prophylaxis',
  description,
  filter,
  counts,
  onFilter,
  rows,
  recorded,
}: {
  csvName?: string;
  description?: string;
  filter: DueFilter;
  counts: Record<DueFilter, number>;
  onFilter: (filter: DueFilter) => void;
  rows: Array<ReportRow>;
  recorded: Set<string>;
}) {
  const { t } = useTranslation();
  const labels: Record<DueFilter, string> = { bpg: t('bpg', 'BPG'), oral: t('oral', 'Oral'), all: t('all', 'All') };
  const columns = dueColumns(t, recorded);

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
        <DownloadCsvButton
          name={`${csvName}-${filter}`}
          headers={columns.map((column) => column.header)}
          rows={() => rows.map((row) => columns.map((column) => column.text(row)))}
          disabled={!rows.length}
          size="md"
        />
      </div>
    </div>
  );
}
