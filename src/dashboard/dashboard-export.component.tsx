import React, { useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { formatDate, launchWorkspace2, showSnackbar, UserHasAccess } from '@openmrs/esm-framework';
import { PRIVILEGE_EXPORT_LISTS } from '../constants';
import { recordDownload } from '../logs/logs.resource';
import { restErrorMessage } from '../rest-error-message';
import { downloadCsv } from '../table-filters/csv';
import { type CountRow } from './dashboard-csv';
import {
  downloadBlob,
  type ExportChoice,
  exportingClass,
  type ExportSection,
  markChosen,
  printSections,
  sectionAttribute,
  settle,
  slug,
  zip,
} from './dashboard-export';
import { sectionPng } from './dashboard-images';

/** Each export section's name, as its card or tab names it. */
export function useSectionNames(): Record<ExportSection, string> {
  const { t } = useTranslation();
  return {
    keyFigures: t('keyFigures', 'Key figures'),
    status: t('registrantStatus', 'Registrant status'),
    cascade: t('rhdCareCascade', 'RHD care cascade'),
    active: t('activeRegistrants', 'Active registrants'),
    waitlist: t('proceduralWaitlist', 'Procedural waitlist'),
    optimisation: t('medicalOptimisation', 'Medical optimisation'),
    screeningCascade: t('screeningCascade', 'Screening cascade'),
    rhdScreening: t('rhdScreening', 'RHD screening'),
    registrations: t('screeningFromRegistrations', 'Screening, from registrations'),
    runCharts: t('runCharts', 'Run charts'),
  };
}

/**
 * The Dashboard's Export, for a user who may export lists: it opens the export workspace beside the page, and makes
 * what is chosen there from the page as it is then: a PDF (the browser's print), images (a PNG of each section, zipped
 * when there are several) or the counts CSV. Each export is recorded in the download log first; one that cannot be
 * recorded is not made, and the workspace stays open.
 */
export function DashboardExportButton({
  container,
  csvRows,
  csvLoading,
  filters,
  clinics,
  asOf,
  showScreening,
}: {
  container: React.RefObject<HTMLElement>;
  csvRows: Array<CountRow>;
  csvLoading: boolean;
  filters: Record<string, string>;
  clinics: string;
  asOf: string;
  showScreening: boolean;
}) {
  const { t } = useTranslation();
  const names = useSectionNames();
  const [busy, setBusy] = useState(false);
  const today = dayjs().format('YYYY-MM-DD');
  const summary = `${clinics} · ${t('figuresAsOfDate', 'figures as of {{date}}', { date: formatDate(dayjs(asOf).toDate(), { time: false, noToday: true }) })}`;
  const csvHeaders = [
    t('csvSection', 'Section'),
    t('csvGroup', 'Group'),
    t('csvLabel', 'Label'),
    t('csvCount', 'Count'),
    t('period', 'Period'),
    t('csvClinics', 'Clinics'),
  ];
  const record = (list: string, columns: Array<string>, rows: number) =>
    recordDownload({ list, columns, rows, identifiers: false, filters });

  const images = async (sections: Array<ExportSection>) => {
    const { elements, undo } = markChosen(container.current, sections, exportingClass);
    try {
      await settle();
      const files: Array<{ name: string; data: Uint8Array }> = [];
      for (const [index, element] of elements.entries()) {
        const name = names[element.getAttribute(sectionAttribute) as ExportSection];
        // A card names itself, with its count; a section in a tab or the tiles are named in the band.
        const titled = Boolean(element.querySelector('h2'));
        files.push({
          name: `${String(index + 1).padStart(2, '0')}-${slug(name)}.png`,
          data: await sectionPng(element, titled ? '' : name, summary),
        });
      }
      if (files.length === 1) {
        downloadBlob(`dashboard-${files[0].name.slice(3, -4)}-${today}.png`, new Blob([files[0].data as BlobPart]));
      } else {
        downloadBlob(`dashboard-images-${today}.zip`, zip(files));
      }
    } finally {
      undo();
    }
  };

  const run = async ({ format, sections, orientation }: ExportChoice, close: () => void) => {
    const sectionNames = sections.map((section) => names[section]);
    if (format === 'csv' && csvLoading) {
      showSnackbar({
        kind: 'info',
        title: t('countsStillLoading', 'The counts are still loading; export again in a moment'),
      });
      return;
    }
    setBusy(true);
    try {
      if (format === 'csv') {
        const rows = csvRows
          .filter((row) => sectionNames.includes(row.section))
          .map((row) => [row.section, row.group, row.label, String(row.count), row.period, clinics]);
        await record('dashboard:counts', csvHeaders, rows.length);
        downloadCsv(`dashboard-counts-${today}.csv`, csvHeaders, rows);
        close();
        return;
      }
      await record(format === 'pdf' ? 'dashboard:pdf' : 'dashboard:images', sectionNames, sections.length);
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('couldNotRecordDownload', 'Could not record the download, so no file was made'),
        subtitle: restErrorMessage(e),
      });
      return;
    } finally {
      setBusy(false);
    }
    // The workspace is closed first, and the page left to widen again, so it is captured as it is without it.
    close();
    setBusy(true);
    try {
      await settle();
      if (format === 'pdf') {
        await printSections(container.current, sections, orientation);
      } else {
        await images(sections);
      }
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('couldNotMakeExport', 'Could not make the export'),
        subtitle: e?.message,
      });
    } finally {
      setBusy(false);
    }
  };
  // The workspace keeps the props it opened with, so it calls the page's latest run through this.
  const latest = useRef(run);
  latest.current = run;

  return (
    <UserHasAccess privilege={PRIVILEGE_EXPORT_LISTS}>
      <Button
        kind="primary"
        size="md"
        renderIcon={Download}
        disabled={busy}
        onClick={() =>
          launchWorkspace2('act-dashboard-export-workspace', {
            summary,
            showScreening,
            run: (choice: ExportChoice, close: () => void) => latest.current(choice, close),
          })
        }
      >
        {t('export', 'Export')}
      </Button>
    </UserHasAccess>
  );
}
