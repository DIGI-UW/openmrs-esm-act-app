import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultsFromConfigSchema, openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import { diagnosisConcepts } from '../consultations/patient-details.resource';
import ClinicalFlags from './clinical-flags.component';
import { doneProcedures, needsConfirmatoryEcho, procedureStatus } from './clinical-flags';

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const YES = { uuid: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Yes' };
const NO = { uuid: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'No' };
const SCREEN = '82a5fbb5-038d-57b8-82d1-3fd0ac95673d';
const MVR = { uuid: 'mvr', display: 'Mitral valve repair/replacement' };
const AVR = { uuid: 'avr', display: 'Aortic valve repair/replacement' };
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});

const recommending = (date: string, procedure: unknown, completed = false): ChartEncounter =>
  ({
    uuid: date,
    encounterDatetime: `${date}T09:00:00.000+0300`,
    obs: [
      obs(c.recommendation, null, [obs(c.recommendation, procedure), ...(completed ? [obs(c.completed, YES)] : [])]),
    ],
  }) as ChartEncounter;
const p = config.procedures.concepts;
/** A Procedures and Outcomes encounter recording a surgery, dated by its Date of Procedure. */
const procedureDone = (date: string, procedure: unknown): ChartEncounter =>
  ({
    uuid: `procedure-${date}`,
    encounterDatetime: '2026-10-22T09:00:00.000+0300',
    obs: [obs(p.date, `${date}T00:00:00.000+0300`), obs(p.surgeryType, null, [obs(p.surgeryType, procedure)])],
  }) as ChartEncounter;

const plain = (date: string): ChartEncounter => ({
  uuid: date,
  encounterDatetime: `${date}T09:00:00.000+0300`,
  obs: [],
});

const patientInformation = (screen: unknown, diagnosed: boolean, date = '2026-09-01'): ChartEncounter =>
  ({
    uuid: `pi-${date}`,
    encounterDatetime: `${date}T09:00:00.000+0300`,
    obs: [
      obs(SCREEN, screen),
      ...(diagnosed
        ? [obs(diagnosisConcepts.group, null, [obs(diagnosisConcepts.category, { uuid: 'rhd', display: 'RHD' })])]
        : []),
    ],
  }) as ChartEncounter;

describe('clinical banner flags', () => {
  const now = new Date('2026-10-21T12:00:00+0300');

  it('ages the procedural recommendation from the first consultation of the latest run that recommends its procedure', () => {
    expect(procedureStatus([], c, now)).toBeNull();
    expect(procedureStatus([plain('2026-09-01'), recommending('2025-01-01', MVR)], c, now)).toBe('none');
    expect(procedureStatus([recommending('2026-09-01', MVR, true)], c, now)).toBe('none');
    expect(procedureStatus([recommending('2026-09-01', MVR), recommending('2026-03-01', MVR)], c, now)).toBe('recent');
    expect(
      procedureStatus(
        [recommending('2026-09-01', MVR), recommending('2026-03-01', MVR), recommending('2025-06-01', MVR)],
        c,
        now,
      ),
    ).toBe('old');
    // A run broken by a consultation without it, or recommending another procedure, starts again after the break.
    expect(
      procedureStatus([recommending('2026-09-01', MVR), plain('2026-03-01'), recommending('2025-06-01', MVR)], c, now),
    ).toBe('recent');
    expect(procedureStatus([recommending('2026-09-01', MVR), recommending('2025-06-01', AVR)], c, now)).toBe('recent');
  });

  it('counts a recommendation done once its procedure is recorded on Procedures and Outcomes on or after the consultation', () => {
    const done = doneProcedures([procedureDone('2026-10-20', MVR)], p);
    expect(done).toEqual([{ procedure: 'mvr', day: '2026-10-20' }]);
    // Done after the recommendation, and on its day: no open recommendation.
    expect(procedureStatus([recommending('2026-09-01', MVR)], c, now, done)).toBe('none');
    expect(procedureStatus([recommending('2026-10-20', MVR)], c, now, done)).toBe('none');
    // Recommended again after the procedure: open again, and recent.
    expect(procedureStatus([recommending('2026-10-21', MVR), recommending('2026-09-01', MVR)], c, now, done)).toBe(
      'recent',
    );
    // Another procedure stays open.
    expect(procedureStatus([recommending('2026-09-01', AVR)], c, now, done)).toBe('recent');
  });

  it('needs a confirmatory echo while the latest screen is positive and no diagnosis is recorded', () => {
    expect(needsConfirmatoryEcho([patientInformation(YES, false)], SCREEN)).toBe(true);
    expect(
      needsConfirmatoryEcho([patientInformation(YES, false), patientInformation(YES, true, '2026-08-01')], SCREEN),
    ).toBe(false);
    expect(
      needsConfirmatoryEcho([patientInformation(NO, false), patientInformation(YES, false, '2026-08-01')], SCREEN),
    ).toBe(false);
    expect(needsConfirmatoryEcho([], SCREEN)).toBe(false);
  });

  function serve(prophylaxisStatus: string) {
    vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
      if (url.includes(`encounterType=${diagnosisConcepts.encounterType}`)) {
        return { data: { results: [patientInformation(YES, false)], totalCount: 1 } };
      }
      if (url.includes(`encounterType=${config.consultations.encounterType}`)) {
        return { data: { results: [recommending('2026-09-01', MVR)], totalCount: 1 } };
      }
      if (url.includes('/actcore/prophylaxis')) {
        return { data: { status: prophylaxisStatus, type: null, nextDue: null } };
      }
      return { data: { results: [] } };
    }) as never);
  }

  const renderFlags = () =>
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ClinicalFlags patientUuid="winnie" />
      </SWRConfig>,
    );

  it('shows a clinician every flag: the echo, no prescription, and the recent recommendation', async () => {
    await signInWith(['Get Encounters', 'Get Observations', 'Task: act.enterClinicalForms']);
    serve('none');

    renderFlags();

    expect(await screen.findByTestId('echo-status')).toHaveTextContent('Confirmatory echo needed');
    expect(await screen.findByTestId('prescription-status')).toHaveTextContent('No prophylaxis prescription');
    expect(await screen.findByTestId('procedure-status')).toHaveTextContent('Procedural rec. < 12 months');
  });

  it('shows anyone else only the echo flag', async () => {
    await signInWith(['Get Encounters', 'Get Observations']);
    serve('ok');

    renderFlags();

    expect(await screen.findByTestId('echo-status')).toBeInTheDocument();
    expect(screen.queryByTestId('prescription-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('procedure-status')).not.toBeInTheDocument();
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('/actcore/prophylaxis'))).toBe(
      false,
    );
  });
});
