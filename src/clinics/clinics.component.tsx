import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Search,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Add, Edit } from '@carbon/react/icons';
import { isDesktop, FacilityPictogram, launchWorkspace2, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { restErrorMessage } from '../rest-error-message';
import { FilterEmptyState, TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import { useClinicText } from './clinic-text';
import { useClinics } from './clinics.resource';
import styles from './clinics.scss';

export default function Clinics() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { clinics: config, clinicLocationTags } = useConfig<Config>();
  const { clinics, error, isLoading } = useClinics(config.levels);
  const unlistedTags = config.levels
    .map(({ tag }) => tag)
    .filter((tag) => ![...clinicLocationTags.cardiac, ...clinicLocationTags.primaryCare].includes(tag));
  const { levelText, typeText } = useClinicText();
  const [status, setStatus] = useState<'enabled' | 'all'>('enabled');
  const [query, setQuery] = useState('');
  const filters = useMemo(() => ({ status, query }), [status, query]);
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return clinics.filter(
      (clinic) =>
        (status === 'all' || !clinic.retired) &&
        [
          clinic.name,
          clinic.type,
          typeText(clinic.type),
          clinic.level,
          levelText(clinic.level),
          clinic.parentLocation?.display,
        ]
          .filter(Boolean)
          .some((text) => text.toLowerCase().includes(words)),
    );
  }, [clinics, status, query, levelText, typeText]);
  const { results, paginationProps } = usePagedRows(shown, filters);

  let body: React.ReactNode;
  if (error) {
    body = (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadClinics', 'Could not load the clinics')}
        subtitle={restErrorMessage(error)}
      />
    );
  } else if (isLoading) {
    body = (
      <DataTableSkeleton
        role="progressbar"
        compact={desktop}
        zebra
        columnCount={6}
        rowCount={5}
        showHeader={false}
        showToolbar={false}
      />
    );
  } else if (!clinics.length) {
    body = <TableEmptyState message={t('noClinics', 'There are no clinics to display')} />;
  } else if (!shown.length) {
    body = <FilterEmptyState message={t('noClinicMatches', 'No clinics to display')} />;
  } else {
    body = (
      <div className={styles.tableContainer}>
        <Table aria-label={t('clinics', 'Clinics')} size={desktop ? 'sm' : 'lg'} useZebraStyles>
          <TableHead>
            <TableRow>
              <TableHeader>{t('name', 'Name')}</TableHeader>
              <TableHeader>{t('type', 'Type')}</TableHeader>
              <TableHeader>{t('level', 'Level')}</TableHeader>
              <TableHeader>{t('parentClinic', 'Parent clinic')}</TableHeader>
              <TableHeader>{t('status', 'Status')}</TableHeader>
              <TableHeader aria-label={t('actions', 'Actions')} />
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((clinic) => (
              <TableRow key={clinic.uuid} data-testid="act-clinic-row">
                <TableCell className={styles.name}>{clinic.name}</TableCell>
                <TableCell>{typeText(clinic.type)}</TableCell>
                <TableCell>{levelText(clinic.level)}</TableCell>
                <TableCell>{clinic.parentLocation?.display ?? '--'}</TableCell>
                <TableCell>
                  <Tag size="sm" type={clinic.retired ? 'gray' : 'green'}>
                    {clinic.retired ? t('disabled', 'Disabled') : t('enabled', 'Enabled')}
                  </Tag>
                </TableCell>
                <TableCell>
                  <Button
                    kind="ghost"
                    size="sm"
                    hasIconOnly
                    renderIcon={Edit}
                    iconDescription={t('editClinic', 'Edit clinic')}
                    onClick={() => launchWorkspace2('act-clinic-form-workspace', { clinicUuid: clinic.uuid })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination {...paginationProps} />
      </div>
    );
  }

  return (
    <>
      <ActPageHeader title={t('clinics', 'Clinics')} illustration={<FacilityPictogram />} />
      <div className={styles.clinics}>
        <p className={styles.note}>
          {t(
            'clinicsNote',
            "Clinics that come from the distribution's locations file return to what that file says when it is updated; clinics added here keep their changes.",
          )}
        </p>
        {unlistedTags.length > 0 && (
          <InlineNotification
            kind="warning"
            lowContrast
            hideCloseButton
            title={t(
              'levelTagsNotInClinicLocationTags',
              'These clinic level tags are not in clinicLocationTags, so the rest of ACT does not count their clinics: {{tags}}',
              { tags: unlistedTags.join(', '), interpolation: { escapeValue: false } },
            )}
          />
        )}
        <div className={styles.toolbar}>
          <Search
            size="lg"
            labelText={t('searchClinics', 'Search clinics')}
            placeholder={t('searchClinicsPlaceholder', 'Search by name, type, level or parent clinic')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            id="clinics-status"
            labelText={t('status', 'Status')}
            value={status}
            onChange={(event) => setStatus(event.target.value as 'enabled' | 'all')}
          >
            <SelectItem value="enabled" text={t('enabled', 'Enabled')} />
            <SelectItem value="all" text={t('all', 'All')} />
          </Select>
          <Button
            kind="primary"
            size="md"
            renderIcon={Add}
            onClick={() => launchWorkspace2('act-clinic-form-workspace', { clinicUuid: undefined })}
          >
            {t('addClinic', 'Add clinic')}
          </Button>
        </div>
        {body}
      </div>
    </>
  );
}
