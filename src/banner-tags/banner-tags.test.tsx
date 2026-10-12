import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { respondWithEncounters } from '../chart.fixture';
import { ConfirmatoryEchoTag, ProceduralRecommendationTag } from './banner-tags.component';

const screenPositiveReport = 'e3b8f7a2-6c41-4d9e-8a57-1f0c2d4b9e63';
const waitingListReport = '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10';

let screenPositive: Array<object>;
let waitingList: Array<object> | Error;

const dataset = (rows: Array<object>) => ({ dataSets: [{ metadata: { columns: [] }, rows }] });

function respond() {
  respondWithEncounters({}, (url) => {
    if (url.includes(`/reportdata/${screenPositiveReport}`)) {
      return dataset(screenPositive);
    }
    if (url.includes(`/reportdata/${waitingListReport}`)) {
      return waitingList instanceof Error ? waitingList : dataset(waitingList);
    }
    return { results: [] };
  });
}

const onChart = { patientUuid: 'winnie', renderedFrom: 'patient-chart' };

function renderIn(element: React.ReactElement) {
  return render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>{element}</SWRConfig>);
}

async function settled() {
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const tag = () => screen.getByTestId('banner-tag');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-20T08:00:00'));
  vi.mocked(openmrsFetch).mockClear();
  await signInWith(['Run Reports']);
  screenPositive = [];
  waitingList = [];
  respond();
});

afterEach(() => vi.useRealTimers());

describe('Banner tags for a deceased patient', () => {
  const tags = [
    ['Confirmatory echo', ConfirmatoryEchoTag],
    ['Procedural recommendation', ProceduralRecommendationTag],
  ] as const;
  const deaths = [{ deceasedBoolean: true }, { deceasedDateTime: '2026-09-01' }];

  it.each(tags.flatMap(([name, BannerTag]) => deaths.map((death) => [name, death, BannerTag] as const)))(
    'shows no %s tag for %j, without asking',
    async (_, death, BannerTag) => {
      screenPositive = [{ patient_uuid: 'winnie' }];
      const { container } = renderIn(<BannerTag {...onChart} patient={{ resourceType: 'Patient', ...death }} />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(container).toBeEmptyDOMElement();
      expect(openmrsFetch).not.toHaveBeenCalled();
    },
  );
});

describe('Confirmatory echo tag', () => {
  it('says Confirmatory echo needed for a patient on the Screen Positive, Pending Confirmation list', async () => {
    screenPositive = [{ patient_uuid: 'someone-else' }, { patient_uuid: 'winnie' }];
    renderIn(<ConfirmatoryEchoTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent('Confirmatory echo needed'));
  });

  it('reads the list once, not again for the next chart opened', async () => {
    screenPositive = [{ patient_uuid: 'winnie' }];
    const cache = new Map();
    const chart = () => (
      <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>
        <ConfirmatoryEchoTag {...onChart} />
      </SWRConfig>
    );
    const { unmount } = render(chart());
    await waitFor(() => expect(tag()).toHaveTextContent('Confirmatory echo needed'));
    unmount();

    render(chart());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const evaluations = vi
      .mocked(openmrsFetch)
      .mock.calls.filter(([url]) => String(url).includes(`/reportdata/${screenPositiveReport}`));
    expect(evaluations).toHaveLength(1);
  });

  it('shows nothing for a patient not on it', async () => {
    screenPositive = [{ patient_uuid: 'someone-else' }];
    const { container } = renderIn(<ConfirmatoryEchoTag {...onChart} />);

    await settled();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Procedural recommendation tag', () => {
  it.each([
    [[{ patient_uuid: 'winnie', date_added: '2026-03-01' }], 'Procedure recommended < 12 months'],
    // The oldest pending recommendation decides how long the patient has waited.
    [
      [
        { patient_uuid: 'winnie', date_added: '2026-03-01' },
        { patient_uuid: 'winnie', date_added: '2025-08-01' },
      ],
      'Procedure recommended > 12 months',
    ],
    [[{ patient_uuid: 'someone-else', date_added: '2025-01-01' }], 'No procedural recommendation'],
  ])('reads the procedural waiting list (%j) as %s', async (rows, label) => {
    waitingList = rows;
    renderIn(<ProceduralRecommendationTag {...onChart} />);

    await waitFor(() => expect(tag()).toHaveTextContent(label));
  });

  it('shows no tag, rather than No procedural recommendation, when the waiting list cannot be read', async () => {
    waitingList = new Error('Privilege required: Run Reports');
    const { container } = renderIn(<ProceduralRecommendationTag {...onChart} />);

    await settled();
    expect(container).toBeEmptyDOMElement();
  });
});
