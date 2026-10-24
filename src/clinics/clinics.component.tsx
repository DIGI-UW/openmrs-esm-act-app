import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Modal,
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
  TextInput,
} from '@carbon/react';
import { Add, Edit } from '@carbon/react/icons';
import { isDesktop, FacilityPictogram, showSnackbar, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { restErrorMessage } from '../rest-error-message';
import { FilterEmptyState, TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import {
  type Clinic,
  type ClinicForm,
  MissingLocationTags,
  saveClinic,
  useClinics,
  useLocationTags,
} from './clinics.resource';
import styles from './clinics.scss';

/** The levels and types ACT names, translated; a clinic's own value shows as written. */
function useClinicText() {
  const { t } = useTranslation();
  const levels: Record<string, string> = {
    Tertiary: t('tertiary', 'Tertiary'),
    District: t('district', 'District'),
    Community: t('community', 'Community'),
  };
  const types: Record<string, string> = {
    Public: t('public', 'Public'),
    'Private Not-For-Profit': t('privateNotForProfit', 'Private Not-For-Profit'),
    'Private For-Profit': t('privateForProfit', 'Private For-Profit'),
  };
  return { levelText: (level: string) => levels[level] ?? level, typeText: (type: string) => types[type] ?? type };
}

function ClinicModal({
  clinic,
  clinics,
  onClose,
  onSaved,
}: {
  clinic?: Clinic;
  clinics: Array<Clinic>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { clinics: config, clinicLocationTags } = useConfig<Config>();
  const { tagUuids, error: tagsError } = useLocationTags();
  const { levelText, typeText } = useClinicText();
  const [form, setForm] = useState<ClinicForm>({
    name: clinic?.name ?? '',
    type: clinic?.type ?? '',
    level: clinic?.level ?? '',
    parent: clinic?.parentLocation?.uuid ?? '',
    enabled: !clinic?.retired,
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const change = (field: Partial<ClinicForm>) => setForm((current) => ({ ...current, ...field }));
  const types = [...config.types, ...(clinic?.type && !config.types.includes(clinic.type) ? [clinic.type] : [])];
  // As in ACT 2.0, a clinic's parent is a cardiac clinic, one of the higher levels.
  const parentLevels = config.levels
    .filter(({ tag }) => clinicLocationTags.cardiac.includes(tag))
    .map(({ level }) => level);
  const parents = clinics.filter(
    (other) =>
      other.uuid !== clinic?.uuid &&
      parentLevels.includes(other.level) &&
      (!other.retired || other.uuid === form.parent),
  );
  const missing = {
    name: !form.name.trim(),
    level: !form.level,
    type: !form.type,
  };

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(missing).some(Boolean) || !tagUuids) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveClinic(form, config, tagUuids, clinic);
      showSnackbar({ kind: 'success', title: t('clinicSaved', 'Clinic saved') });
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(
        e instanceof MissingLocationTags
          ? t('missingLocationTags', 'The server has no location tag named {{tags}}; ask an administrator to add it', {
              tags: e.tags.join(', '),
              interpolation: { escapeValue: false },
            })
          : restErrorMessage(e),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      modalHeading={
        clinic ? t('editClinicNamed', 'Edit {{name}}', { name: clinic.name }) : t('addClinic', 'Add clinic')
      }
      primaryButtonText={saving ? t('saving', 'Saving...') : t('save', 'Save')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={saving}
      onRequestSubmit={submit}
      onRequestClose={onClose}
      size="sm"
    >
      {(saveError || tagsError) && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotSaveClinic', 'Could not save the clinic')}
          subtitle={saveError ?? restErrorMessage(tagsError)}
        />
      )}
      <div className={styles.form}>
        <TextInput
          id="clinic-name"
          labelText={t('name', 'Name')}
          value={form.name}
          invalid={submitted && missing.name}
          invalidText={t('enterClinicName', 'Enter the clinic name')}
          onChange={(event) => change({ name: event.target.value })}
        />
        <Select
          id="clinic-level"
          labelText={t('level', 'Level')}
          value={form.level}
          invalid={submitted && missing.level}
          invalidText={t('chooseClinicLevel', 'Choose the clinic level')}
          onChange={(event) => change({ level: event.target.value })}
        >
          <SelectItem value="" text={t('chooseLevel', 'Choose a level')} disabled />
          {config.levels.map(({ level }) => (
            <SelectItem key={level} value={level} text={levelText(level)} />
          ))}
        </Select>
        <Select
          id="clinic-type"
          labelText={t('type', 'Type')}
          value={form.type}
          invalid={submitted && missing.type}
          invalidText={t('chooseClinicType', 'Choose the clinic type')}
          onChange={(event) => change({ type: event.target.value })}
        >
          <SelectItem value="" text={t('chooseType', 'Choose a type')} disabled />
          {types.map((type) => (
            <SelectItem key={type} value={type} text={typeText(type)} />
          ))}
        </Select>
        <Select
          id="clinic-parent"
          labelText={t('parentClinic', 'Parent clinic')}
          value={form.parent}
          onChange={(event) => change({ parent: event.target.value })}
        >
          <SelectItem value="" text={t('none', 'None')} />
          {parents.map((parent) => (
            <SelectItem key={parent.uuid} value={parent.uuid} text={parent.name} />
          ))}
        </Select>
        {clinic && (
          <Select
            id="clinic-status"
            labelText={t('status', 'Status')}
            value={form.enabled ? 'enabled' : 'disabled'}
            onChange={(event) => change({ enabled: event.target.value === 'enabled' })}
          >
            <SelectItem value="enabled" text={t('enabled', 'Enabled')} />
            <SelectItem value="disabled" text={t('disabled', 'Disabled')} />
          </Select>
        )}
      </div>
    </Modal>
  );
}

/** ACT 2.0's Clinic Management: the clinics, their type, level and parent, added, edited and disabled here. */
export default function Clinics() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { clinics: config } = useConfig<Config>();
  const { clinics, error, isLoading, mutate } = useClinics(config.levels);
  const { levelText, typeText } = useClinicText();
  const [status, setStatus] = useState<'enabled' | 'all'>('enabled');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Clinic | 'new' | null>(null);
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
                    iconDescription={t('edit', 'Edit')}
                    onClick={() => setEditing(clinic)}
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
          <Button kind="primary" size="md" renderIcon={Add} onClick={() => setEditing('new')}>
            {t('addClinic', 'Add clinic')}
          </Button>
        </div>
        {body}
      </div>
      {editing && (
        <ClinicModal
          clinic={editing === 'new' ? undefined : editing}
          clinics={clinics}
          onClose={() => setEditing(null)}
          onSaved={() => mutate()}
        />
      )}
    </>
  );
}
