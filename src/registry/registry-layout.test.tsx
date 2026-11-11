import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { laidOut } from '../table-filters/laid-out.test-helper';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
// Each class by its own name, which happy-dom's empty stylesheet modules do not give.
vi.mock('./registry.scss', () => ({ default: new Proxy({}, { get: (_, name) => name }) }));

const sheet = () => readFileSync(resolve(process.cwd(), 'src/registry/registry.scss'), 'utf8');

describe('Registry table width', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?status=');
    await signInWith(['App: act.registry']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: registryRows.map((row, i) => ({
        ...row,
        rhd_flags: i === 0 ? 'RHD prophylaxis not prescribed' : null,
      })),
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it('lets a flag wrap onto a second line rather than cutting it short', () => {
    render(<Registry />);

    const [tag] = screen.getAllByTestId('registry-flag');
    expect(tag).toHaveTextContent('RHD prophylaxis not prescribed');
    expect(tag).toHaveClass('flagTag');
    // eslint-disable-next-line testing-library/no-node-access
    expect(tag.closest('td')).toHaveClass('flagsCell');
    expect(sheet()).toMatch(
      /\.flagTag:global\(\.cds--tag\)\s*\{\s*max-inline-size: none;\s*:global\(\.cds--tag__label\)\s*\{\s*white-space: normal;/,
    );
    expect(sheet()).toMatch(/\.flagsCell\s*\{\s*min-width: 9rem;/);
  });

  it('pads Age, sex and Last updated less than the rest, in their cells and their sort buttons', () => {
    render(<Registry />);

    expect(screen.getByRole('table')).toHaveClass('table');
    const narrow = (element: Element) => element.classList.contains('narrow');
    const headerButtons = within(screen.getAllByRole('row')[0]).getAllByRole('button');
    expect(headerButtons.filter(narrow).map((button) => button.textContent)).toEqual([
      expect.stringContaining('Age, sex'),
      expect.stringContaining('Last updated'),
    ]);
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells.map(narrow)).toEqual([false, false, true, false, false, true, false, false]);
    expect(sheet()).toMatch(
      /\.table\s*\{[^}]*td:not\(:global\(\.cds--table-expand\)\)[^{]*\{\s*padding-inline: layout\.\$spacing-04;/,
    );
    expect(sheet()).toMatch(/\.narrow\s*\{\s*padding-inline: layout\.\$spacing-03;/);
  });

  it('keeps Last updated and Procedure due on one line, as a date wraps at its hyphens once the table narrows', () => {
    render(<Registry />);

    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells.map((cell) => cell.classList.contains('oneLine'))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      false,
    ]);
    expect(sheet()).toMatch(/\.oneLine\s*\{\s*white-space: nowrap;/);
  });

  it('shows a shadow at the edge it is cut at, when the page is too narrow for the table', () => {
    render(<Registry />);
    // eslint-disable-next-line testing-library/no-node-access
    const scroller = screen.getByRole('table').parentElement;
    const size = laidOut(scroller, { scrollWidth: 1056, clientWidth: 960, scrollLeft: 96 });
    fireEvent.scroll(scroller);

    expect(scroller).toHaveClass('cds--data-table-content');
    const wrapper = screen.getByTestId('scroll-edges');
    expect(wrapper).toHaveAttribute('data-more-start');
    expect(wrapper).not.toHaveAttribute('data-more-end');
    size.scrollLeft = 0;
    fireEvent.scroll(scroller);
    expect(wrapper).toHaveAttribute('data-more-end');
  });
});
