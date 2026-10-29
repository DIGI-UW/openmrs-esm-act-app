import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getGlobalStore } from '@openmrs/esm-framework';
import { registerControl } from '../forms-engine-registry';
import InrChartControl, { inrTrendSlot } from './inr-chart-control.component';

const slots: Array<{ name: string; state: unknown }> = [];
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ExtensionSlot: ({ name, state }: { name: string; state: unknown }) => {
    slots.push({ name, state });
    return <div data-testid="slot" />;
  },
}));

afterEach(() => {
  slots.length = 0;
  window.history.pushState({}, '', '/');
});

describe('the INR chart form control', () => {
  it("hosts the INR trend extension for the chart's patient", () => {
    window.history.pushState({}, '', '/openmrs/spa/patient/grace/chart/Patient Summary');

    render(<InrChartControl />);

    expect(screen.getByTestId('slot')).toBeInTheDocument();
    expect(slots).toEqual([{ name: inrTrendSlot, state: { patientUuid: 'grace' } }]);
  });

  it('shows nothing when the form is open with no patient in the page', () => {
    window.history.pushState({}, '', '/openmrs/spa/home');

    const { container } = render(<InrChartControl />);

    expect(container).toBeEmptyDOMElement();
    expect(slots).toEqual([]);
  });
});

describe('registerControl', () => {
  it('adds the control, by the name a question names as its rendering, to the form engine registry', () => {
    const load = () => Promise.resolve({ default: () => null });

    registerControl({ name: 'act-inr-chart', type: 'control', load });

    const { controls } = getGlobalStore<{ controls: Array<{ name: string; type: string; load: unknown }> }>(
      'forms-engine-store',
    ).getState();
    expect(controls.filter((control) => control.name === 'act-inr-chart')).toEqual([
      { name: 'act-inr-chart', type: 'control', load },
    ]);
  });
});
