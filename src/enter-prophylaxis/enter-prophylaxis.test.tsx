import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import {
  age,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  useConfig,
  useDebounce,
  useSession,
} from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { openFormInChart } from '../visits/open-form-in-chart';
import { EnterProphylaxisSearch } from './enter-prophylaxis.component';

vi.mock('../visits/open-form-in-chart', () => ({ openFormInChart: vi.fn() }));

const bpgForm = '0119d2e6-e2e1-391c-9b88-d59a10b0780d';
const oralForm = 'ba29e982-ce18-302a-9fc4-d4b2c3983465';
const person = (display: string) => ({ display, gender: 'F', age: 15, birthdate: '2011-03-14T00:00:00.000+0000' });
const patients = [
  { uuid: 'grace', person: person('Grace Achieng'), identifiers: [] },
  { uuid: 'emmanuel', person: person('Emmanuel Wanyama'), identifiers: [] },
];
const types: Record<string, string> = { grace: 'BPG', emmanuel: 'Oral' };

function serve() {
  vi.mocked(openmrsFetch).mockImplementation(((url: string) => {
    if (url.includes('/actcore/prophylaxis')) {
      const uuid = new URL(url, 'http://x').searchParams.get('patient');
      return Promise.resolve({ data: { type: types[uuid], status: 'ok' } });
    }
    if (url.includes('/user/')) {
      return Promise.resolve({ data: { userProperties: {} } });
    }
    const q = (new URL(url, 'http://x').searchParams.get('q') ?? '').toLowerCase();
    return Promise.resolve({ data: { results: patients.filter((p) => p.person.display.toLowerCase().includes(q)) } });
  }) as never);
}

async function pick(name: string, prophylaxis: 'bpg' | 'oral') {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <EnterProphylaxisSearch onClose={vi.fn()} prophylaxis={prophylaxis} />
    </SWRConfig>,
  );
  return async () => {
    await userEvent.type(screen.getByRole('searchbox'), name.split(' ')[0]);
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  };
}

describe('EnterProphylaxisSearch', () => {
  beforeEach(() => {
    vi.mocked(useConfig<Config>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
    vi.mocked(useSession).mockReturnValue({
      user: { uuid: 'clinician' },
      sessionLocation: { uuid: 'clinic' },
    } as never);
    vi.mocked(useDebounce).mockImplementation((value) => value);
    vi.mocked(age).mockImplementation(() => '15 yrs');
    serve();
  });

  it('shows the banner', async () => {
    await pick('Grace Achieng', 'bpg');

    expect(
      screen.getByText('Choose the patient. The form opens in their chart and a visit starts automatically.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['bpg', 'Record BPG injection', 'Emmanuel Wanyama', bpgForm],
    ['oral', 'Record oral prophylaxis', 'Grace Achieng', oralForm],
  ] as const)(
    'given %s, records it with no choice offered, whatever the prescription',
    async (prophylaxis, label, name, formUuid) => {
      const choose = await pick(name, prophylaxis);

      expect(screen.getByRole('dialog', { name: label })).toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
      await choose();

      await vi.waitFor(() =>
        expect(openFormInChart).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ formUuid })),
      );
    },
  );
});
