import { useSyncExternalStore } from 'react';

/** The parts of the Dashboard an export can choose, in the order the page shows them. */
export const exportSections = [
  'keyFigures',
  'status',
  'cascade',
  'active',
  'waitlist',
  'optimisation',
  'screeningCascade',
  'rhdScreening',
  'registrations',
  'runCharts',
] as const;

export type ExportSection = (typeof exportSections)[number];

export const screeningSections: Array<ExportSection> = ['screeningCascade', 'rhdScreening', 'registrations'];

export type ExportFormat = 'pdf' | 'images' | 'csv';

/** What the export workspace asks the page to make. */
export interface ExportChoice {
  format: ExportFormat;
  sections: Array<ExportSection>;
  orientation: 'portrait' | 'landscape';
}

/** The attribute that marks a part of the page as an export section, and the one that marks it chosen. */
export const sectionAttribute = 'data-export-section';
const chosenAttribute = 'data-export-chosen';
const pathAttribute = 'data-print-path';
const pageAttribute = 'data-print-page';
export const printingClass = 'act-dashboard-printing';
export const exportingClass = 'act-dashboard-exporting';

/**
 * Marks the chosen sections, and the tabs and cards holding them, so the print and image styles show those and hide
 * the rest. Returns the chosen sections' elements in page order, and a function that undoes it all.
 */
export function markChosen(container: HTMLElement, chosen: Array<ExportSection>, className: string) {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(`[${sectionAttribute}]`)).filter((element) =>
    chosen.includes(element.getAttribute(sectionAttribute) as ExportSection),
  );
  const marked: Array<Element> = [];
  elements.forEach((element) => {
    for (let node: Element | null = element; node && node !== container; node = node.parentElement) {
      if (!node.hasAttribute(chosenAttribute)) {
        node.setAttribute(chosenAttribute, '');
        marked.push(node);
      }
    }
  });
  document.body.classList.add(className);
  return {
    elements,
    undo: () => {
      marked.forEach((node) => node.removeAttribute(chosenAttribute));
      document.body.classList.remove(className);
    },
  };
}

/** Two frames and a pause, so charts shown or resized by the export styles draw again before they are captured. */
export const settle = (ms = 400) =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, ms))),
  );

/**
 * Prints the chosen sections in the print layout, on A4 in the orientation chosen. The layout is applied on screen
 * first, so the charts draw at the paper's width before the browser prints them.
 */
export async function printSections(
  container: HTMLElement,
  chosen: Array<ExportSection>,
  orientation: 'portrait' | 'landscape',
) {
  const page = document.createElement('style');
  page.textContent = `@page { size: A4 ${orientation}; margin: 12mm; }`;
  document.head.appendChild(page);
  document.body.dataset.printOrientation = orientation;
  const { undo } = markChosen(container, chosen, printingClass);
  // What holds the page, up to the body: the print styles hide everything beside it, so the app's menus and
  // backgrounds leave the page at the paper's edge.
  const path: Array<Element> = [];
  for (let node: Element | null = container.parentElement; node; node = node.parentElement) {
    node.setAttribute(pathAttribute, '');
    path.push(node);
  }
  container.setAttribute(pageAttribute, '');
  let restored = false;
  const done = () => {
    if (restored) {
      return;
    }
    restored = true;
    path.forEach((node) => node.removeAttribute(pathAttribute));
    container.removeAttribute(pageAttribute);
    undo();
    page.remove();
    delete document.body.dataset.printOrientation;
    window.removeEventListener('afterprint', done);
    document.removeEventListener('pointerdown', done, true);
    document.removeEventListener('keydown', done, true);
  };
  window.addEventListener('afterprint', done);
  await settle();
  window.print();
  // A browser that never fires afterprint leaves the page in print; nothing on it can be touched while the print
  // dialog is open, so the first touch or key after restores it, where a timer could restore it mid-print.
  if (!restored) {
    document.addEventListener('pointerdown', done, true);
    document.addEventListener('keydown', done, true);
  }
}

let summary = '';
const summaryListeners = new Set<() => void>();

/** Tells an open export workspace what the Dashboard now counts, as its props stay as they were when it opened. */
export function setExportSummary(next: string) {
  if (next !== summary) {
    summary = next;
    summaryListeners.forEach((listener) => listener());
  }
}

/** What the Dashboard counts, as it changes, or what the workspace opened with before the Dashboard has said. */
export function useExportSummary(opened: string) {
  const current = useSyncExternalStore(
    (listener) => {
      summaryListeners.add(listener);
      return () => summaryListeners.delete(listener);
    },
    () => summary,
  );
  return current || opened;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A zip of the files as they are, uncompressed: PNGs are compressed already, so storing them keeps the code small and
 * the zip the same size.
 */
export function zip(files: Array<{ name: string; data: Uint8Array }>, at = new Date()): Blob {
  const encoder = new TextEncoder();
  // The time and date each file is stamped with, in the zip's MS-DOS form.
  const time = (at.getHours() << 11) | (at.getMinutes() << 5) | Math.floor(at.getSeconds() / 2);
  const date = ((at.getFullYear() - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate();
  const parts: Array<Uint8Array> = [];
  const central: Array<Uint8Array> = [];
  let offset = 0;
  files.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, date, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as Array<BlobPart>, { type: 'application/zip' });
}

/** Gives the browser a file to save. */
export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name's part for a section, as "registrant-status". */
export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
