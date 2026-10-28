import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonSet, Checkbox, Form, RadioButton, RadioButtonGroup, Select, SelectItem } from '@carbon/react';
import { Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import {
  type ExportChoice,
  type ExportFormat,
  type ExportSection,
  exportSections,
  screeningSections,
  useExportSummary,
} from './dashboard-export';
import { useSectionNames } from './dashboard-export.component';
import formStyles from '../styles/form-workspace.scss';
import styles from './dashboard.scss';

export interface DashboardExportWorkspaceProps {
  /** What the Dashboard counted when the workspace opened: its clinics and date. */
  summary: string;
  showScreening: boolean;
  /** Makes the export from the page; it closes the workspace once the export is recorded. */
  run: (choice: ExportChoice, close: () => void) => Promise<void>;
}

/** Beside the Dashboard: which sections to export, and as a PDF, images or the counts CSV. */
const DashboardExportWorkspace: React.FC<Workspace2DefinitionProps<DashboardExportWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const names = useSectionNames();
  const summary = useExportSummary(workspaceProps.summary);
  const available = exportSections.filter(
    (section) => workspaceProps.showScreening || !screeningSections.includes(section),
  );
  const [chosen, setChosen] = useState<Array<ExportSection>>(available);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [running, setRunning] = useState(false);
  // The run charts are a line over time, with no counts for the CSV.
  const offered = (section: ExportSection) => format !== 'csv' || section !== 'runCharts';
  const picked = available.filter((section) => chosen.includes(section) && offered(section));
  const primary = {
    pdf: t('exportPdfOf', 'Export PDF of {{count}} sections', { count: picked.length }),
    images: t('exportImagesOf', 'Export images of {{count}} sections', { count: picked.length }),
    csv: t('exportCsvOf', 'Export CSV of {{count}} sections', { count: picked.length }),
  }[format];

  const submit = async () => {
    setRunning(true);
    try {
      await workspaceProps.run({ format, sections: picked, orientation }, () => closeWorkspace());
    } finally {
      setRunning(false);
    }
  };

  return (
    <Workspace2 title={t('exportDashboard', 'Export the Dashboard')}>
      <Form className={formStyles.form} onSubmit={(event) => event.preventDefault()}>
        <div className={`${formStyles.fields} ${styles.exportChoices}`}>
          <p className={styles.exportSummary}>{summary}</p>
          <fieldset className={styles.exportFieldset}>
            <legend className={styles.exportLegend}>{t('sections', 'Sections')}</legend>
            <div className={styles.exportAll}>
              <Button kind="ghost" size="sm" onClick={() => setChosen(available)}>
                {t('all', 'All')}
              </Button>
              <Button kind="ghost" size="sm" onClick={() => setChosen([])}>
                {t('none', 'None')}
              </Button>
            </div>
            {available.map((section) => (
              <Checkbox
                key={section}
                id={`dashboard-export-${section}`}
                labelText={names[section]}
                checked={chosen.includes(section) && offered(section)}
                disabled={!offered(section)}
                onChange={(_, { checked }) =>
                  setChosen((current) =>
                    checked ? [...current, section] : current.filter((other) => other !== section),
                  )
                }
              />
            ))}
          </fieldset>
          <RadioButtonGroup
            legendText={t('format', 'Format')}
            name="dashboard-export-format"
            orientation="vertical"
            valueSelected={format}
            onChange={(value) => setFormat(value as ExportFormat)}
          >
            <RadioButton
              id="dashboard-export-pdf"
              value="pdf"
              labelText={t('exportPdf', 'PDF: print, or save as a PDF; the charts stay sharp')}
            />
            <RadioButton
              id="dashboard-export-images"
              value="images"
              labelText={t('exportImages', 'Images: a PNG of each section, in one .zip, for slides or messages')}
            />
            <RadioButton
              id="dashboard-export-csv"
              value="csv"
              labelText={t('exportCsv', 'Counts (CSV): every number in the sections, for a spreadsheet')}
            />
          </RadioButtonGroup>
          {format === 'pdf' && (
            <Select
              id="dashboard-export-orientation"
              labelText={t('orientation', 'Orientation')}
              value={orientation}
              onChange={(event) => setOrientation(event.target.value as 'portrait' | 'landscape')}
            >
              <SelectItem value="portrait" text={t('portrait', 'Portrait')} />
              <SelectItem value="landscape" text={t('landscape', 'Landscape')} />
            </Select>
          )}
          <p className={styles.note}>
            {t('exportNote', 'Counts only, no patient names. Each export is recorded in the download log.')}
          </p>
        </div>
        <ButtonSet>
          <Button className={formStyles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={formStyles.button} kind="primary" disabled={running || !picked.length} onClick={submit}>
            {primary}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export default DashboardExportWorkspace;
