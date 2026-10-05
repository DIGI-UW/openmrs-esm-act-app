import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { type RhdFlagList, useRhdFlagLists } from '../rhd-flags/rhd-flag-lists.resource';
import WorklistTiles from './worklist-tiles.component';

vi.mock('../rhd-flags/rhd-flag-lists.resource', () => ({ useRhdFlagLists: vi.fn() }));
const mockUseRhdFlagLists = vi.mocked(useRhdFlagLists);

const list = (flagName: string, memberCount: number, priority: RhdFlagList['priority'], cohortUuid: string | null) => ({
  flagName,
  memberCount,
  priority,
  cohortUuid,
});

const demoLists: Array<RhdFlagList> = [
  list('RHD prophylaxis overdue', 4, 'risk', 'overdue'),
  list('RHD lost to follow-up', 1, 'risk', 'lost'),
  list('RHD prophylaxis not prescribed', 2, 'dataQuality', 'not-prescribed'),
  list('RHD INR target missing', 2, 'dataQuality', 'inr'),
  list('RHD 30-day follow-up due', 3, 'dataQuality', 'follow-up'),
  list('RHD perfusion issues not recorded', 1, 'dataQuality', 'perfusion'),
  list('RHD site infection not recorded', 1, 'dataQuality', 'infection'),
  list('RHD bacterial sepsis not recorded', 2, 'dataQuality', 'sepsis'),
  list('RHD delivery outcome overdue', 1, 'dataQuality', 'delivery'),
  list('RHD death not recorded on patient', 0, 'dataQuality', 'death'),
];

function lists(value: Partial<ReturnType<typeof useRhdFlagLists>>) {
  mockUseRhdFlagLists.mockReturnValue({ lists: [], isLoading: false, error: undefined, ...value });
}

describe('WorklistTiles', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([homePrivilege]);
  });

  it('shows one tile per list with its count, opening the Worklists page with that list chosen', () => {
    lists({ lists: demoLists });

    render(<WorklistTiles />);

    const tiles = screen.getAllByTestId('worklist-tile');
    expect(tiles.map((tile) => tile.textContent)).toEqual(demoLists.map((l) => `${l.memberCount}${l.flagName}`));
    expect(screen.getByRole('link', { name: /RHD prophylaxis overdue/ })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-worklists?flag=RHD+prophylaxis+overdue',
    );
  });

  it('links to the Worklists page', () => {
    lists({ lists: demoLists });

    render(<WorklistTiles />);

    expect(screen.getByRole('link', { name: 'All lists' })).toHaveAttribute('href', '/openmrs/spa/home/act-worklists');
  });

  it('puts the risk lists first, each group in the order the lists come', () => {
    lists({ lists: [demoLists[2], demoLists[0], demoLists[3], demoLists[1]] });

    render(<WorklistTiles />);

    expect(screen.getAllByTestId('worklist-tile').map((tile) => tile.textContent)).toEqual([
      '4RHD prophylaxis overdue',
      '1RHD lost to follow-up',
      '2RHD prophylaxis not prescribed',
      '2RHD INR target missing',
    ]);
  });

  it('marks risk lists and missing data lists apart', () => {
    lists({ lists: demoLists });

    render(<WorklistTiles />);

    const [overdue, , notPrescribed] = screen.getAllByTestId('worklist-tile');
    expect(overdue).toHaveAttribute('data-priority', 'risk');
    expect(notPrescribed).toHaveAttribute('data-priority', 'dataQuality');
  });

  it('shows 0 for a list with no members, still opening the list', () => {
    lists({ lists: demoLists });

    render(<WorklistTiles />);

    expect(screen.getAllByTestId('worklist-tile').at(-1)).toHaveTextContent('0RHD death not recorded on patient');
    expect(screen.getByRole('link', { name: /RHD death not recorded on patient/ })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-worklists?flag=RHD+death+not+recorded+on+patient',
    );
  });

  it('shows 0 without a link for a configured flag that has no list yet', () => {
    lists({ lists: [list('RHD new flag', 0, 'dataQuality', null)] });

    render(<WorklistTiles />);

    expect(screen.getByTestId('worklist-tile')).toHaveTextContent('0RHD new flag');
    expect(screen.queryByRole('link', { name: /RHD new flag/ })).not.toBeInTheDocument();
  });

  it('says so when there are no RHD flag lists', () => {
    lists({ lists: [] });

    render(<WorklistTiles />);

    expect(screen.getByText('No RHD flag lists found')).toBeInTheDocument();
    expect(screen.queryByTestId('worklist-tile')).not.toBeInTheDocument();
  });

  it('says so when the lists cannot be loaded', () => {
    lists({ error: new Error('Server responded with 403') });

    render(<WorklistTiles />);

    expect(screen.getByText('Could not load the worklists')).toBeInTheDocument();
    expect(screen.queryByTestId('worklist-tile')).not.toBeInTheDocument();
  });

  it('shows placeholders while the lists load', () => {
    lists({ isLoading: true });

    render(<WorklistTiles />);

    expect(screen.getByTestId('worklists-loading')).toBeInTheDocument();
  });
});
