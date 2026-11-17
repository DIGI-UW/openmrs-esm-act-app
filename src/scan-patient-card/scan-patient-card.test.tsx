import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, openmrsFetch, useConfig, useSession } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { openFormInChart } from '../visits/open-form-in-chart';
import { readBarcodeOnCanvas } from './barcode';
import ScanPatientCard from './scan-patient-card.component';

vi.mock('./barcode', () => ({ readBarcodeOnCanvas: vi.fn() }));
vi.mock('../visits/open-form-in-chart', () => ({ openFormInChart: vi.fn() }));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const actIdType = config.actIdentifierType;
const track = { stop: vi.fn() };

function cameraReturns(stream: () => Promise<object>) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(stream) } });
}

function patientsWithIdentifier(...results: Array<{ uuid: string; identifier: string; type: string }>) {
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: {
      results: results.map(({ uuid, identifier, type }) => ({
        uuid,
        identifiers: [{ identifier, identifierType: { uuid: type } }],
      })),
    },
  } as never);
}

const openedBpgFor = () =>
  vi
    .mocked(openFormInChart)
    .mock.calls.map(([, { patientUuid, formUuid, location }]) => ({ patientUuid, formUuid, location }));

describe('ScanPatientCard', () => {
  beforeEach(() => {
    vi.mocked(useConfig).mockReturnValue(config);
    vi.mocked(useSession).mockReturnValue({ sessionLocation: { uuid: 'clinic' } } as never);
    vi.mocked(openFormInChart).mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, set: () => undefined });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 720 });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never);
    cameraReturns(() => Promise.resolve({ getTracks: () => [track] }));
  });

  afterEach(() => {
    delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  });

  it("opens the BPG form of the patient whose ACT ID the sticker's barcode holds, and stops the camera", async () => {
    vi.mocked(readBarcodeOnCanvas).mockReturnValue('rhd00008');
    patientsWithIdentifier({ uuid: 'grace', identifier: 'rhd00008', type: actIdType });
    render(<ScanPatientCard />);

    await userEvent.click(screen.getByRole('button', { name: 'Start scanning' }));

    await waitFor(() =>
      expect(openedBpgFor()).toEqual([
        { patientUuid: 'grace', formUuid: config.prophylaxisCard.bpgForm, location: 'clinic' },
      ]),
    );
    expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toContain('/patient?identifier=rhd00008&');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    expect(track.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start scanning' })).toBeInTheDocument();
  });

  it('says so and opens nothing when no patient has the scanned ACT ID', async () => {
    vi.mocked(readBarcodeOnCanvas).mockReturnValue('NAT-12345');
    patientsWithIdentifier({ uuid: 'other', identifier: 'NAT-12345', type: 'national-id' });
    render(<ScanPatientCard />);

    await userEvent.click(screen.getByRole('button', { name: 'Start scanning' }));

    expect(await screen.findByText('No patient with ACT ID NAT-12345.')).toBeInTheDocument();
    expect(openFormInChart).not.toHaveBeenCalled();
  });

  it('says the camera is not available and keeps the typed ACT ID when it is refused', async () => {
    cameraReturns(() => Promise.reject(new Error('Permission denied')));
    render(<ScanPatientCard />);

    await userEvent.click(screen.getByRole('button', { name: 'Start scanning' }));

    expect(await screen.findByText('The camera is not available')).toBeInTheDocument();
    expect(screen.getByText('Type the ACT ID instead. Permission denied')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ACT ID' })).toBeInTheDocument();
  });

  it('opens the BPG form of the patient whose ACT ID is typed, not one whose other identifier matches', async () => {
    patientsWithIdentifier(
      { uuid: 'other', identifier: 'rhd00008', type: 'national-id' },
      { uuid: 'grace', identifier: 'rhd00008', type: actIdType },
    );
    render(<ScanPatientCard />);

    await userEvent.type(screen.getByRole('textbox', { name: 'ACT ID' }), 'RHD00008');
    await userEvent.click(screen.getByRole('button', { name: 'Open BPG form' }));

    await waitFor(() => expect(openedBpgFor()).toEqual([expect.objectContaining({ patientUuid: 'grace' })]));
    expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toContain('/patient?identifier=RHD00008&');
  });

  it('opens the BPG form on Enter, as a handheld barcode scanner types the ACT ID and then Enter', async () => {
    patientsWithIdentifier({ uuid: 'grace', identifier: 'rhd00008', type: actIdType });
    render(<ScanPatientCard />);

    await userEvent.type(screen.getByRole('textbox', { name: 'ACT ID' }), 'rhd00008{Enter}');

    await waitFor(() => expect(openedBpgFor()).toEqual([expect.objectContaining({ patientUuid: 'grace' })]));
  });

  it("takes a handheld scanner's ACT ID without a click first, as the field starts focused", async () => {
    patientsWithIdentifier({ uuid: 'grace', identifier: 'rhd00008', type: actIdType });
    render(<ScanPatientCard />);

    expect(screen.getByRole('textbox', { name: 'ACT ID' })).toHaveFocus();
    await userEvent.keyboard('rhd00008{Enter}');

    await waitFor(() => expect(openedBpgFor()).toEqual([expect.objectContaining({ patientUuid: 'grace' })]));
  });

  it('says so when no patient has the typed ACT ID', async () => {
    patientsWithIdentifier();
    render(<ScanPatientCard />);

    await userEvent.type(screen.getByRole('textbox', { name: 'ACT ID' }), 'rhd09999');
    await userEvent.click(screen.getByRole('button', { name: 'Open BPG form' }));

    expect(await screen.findByText('No patient with ACT ID rhd09999.')).toBeInTheDocument();
    expect(openFormInChart).not.toHaveBeenCalled();
  });
});
